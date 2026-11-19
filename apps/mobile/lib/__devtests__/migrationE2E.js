/**
 * Guest-migration end-to-end verification against REAL expo-sqlite.
 *
 * Dev-only. Runs inside the app so the actual expo-sqlite driver, the actual
 * schema from initDatabase, and the actual lib/guestMigration.js write path all
 * execute — node:sqlite results are not accepted as proof of these.
 *
 * The network is stubbed by swapping global.fetch, so api/userCigars.js and the
 * revision handling in lib/userCigarsSync.js are exercised for real.
 *
 * Gated behind EXPO_PUBLIC_RUN_MIGRATION_E2E=1 and never invoked otherwise.
 * Results are written to <documents>/migration-e2e.json so the host can read
 * them with: xcrun simctl get_app_container booted <bundle-id> data
 */

import * as FileSystem from 'expo-file-system';
import { db, withSerializedTransaction, initDatabase } from '../../db';
import {
  applyMigration, beginMigration, completeMigration, confirmAccountChange,
  countUnresolved, getActiveRun, getConflicts, getForeignActiveRun,
  resolveConflict, restageMigration, PHASE,
} from '../guestMigration';
import { clearMigrationPending, isMigrationPending } from '../authState';
import { runGuestMigration } from '../userCigarsSync';

const RESULT_FILE = 'migration-e2e.json';

const results = [];
let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (ok) pass++; else fail++;
  results.push({ ok, name, ...(ok ? {} : { expected: e, actual: a }) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — expected ${e}, got ${a}`}`);
}

function section(title) {
  results.push({ section: title });
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// Network stub
// ---------------------------------------------------------------------------

let serverState = { cigars: [], revision: 0, humidors: [], cellared: [], journal: [] };
let failNextPush = false;
let realFetch = null;

function installFetchStub() {
  realFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const u = String(url);
    const method = options.method ?? 'GET';
    const json = (body, status = 200, headers = {}) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => headers[k] ?? headers[String(k).toLowerCase()] ?? null },
      json: async () => body,
      text: async () => JSON.stringify(body),
    });

    if (u.includes('/api/user/cigars')) {
      if (method === 'GET') {
        return json(serverState.cigars, 200, { 'X-Collection-Revision': String(serverState.revision) });
      }
      if (failNextPush) {
        failNextPush = false;
        return json({ error: 'simulated outage' }, 500);
      }
      const body = JSON.parse(options.body);
      if (body.baseRevision != null && body.baseRevision !== serverState.revision) {
        return json({ error: 'revision_conflict', currentRevision: serverState.revision }, 409);
      }
      const seen = new Set();
      serverState.cigars = [];
      for (const c of body.cigars) {
        const key = `${c.brand}::${c.name}::${c.length}`;
        if (!c.brand || !c.name || !c.length || seen.has(key)) continue;
        seen.add(key);
        serverState.cigars.push({ ...c });
      }
      serverState.revision += 1;
      return json({ ok: true, count: serverState.cigars.length, revision: serverState.revision });
    }
    if (u.includes('/api/user/humidors')) {
      return method === 'GET' ? json(serverState.humidors) : json({ ok: true });
    }
    if (u.includes('/api/user/cellared')) {
      return method === 'GET' ? json(serverState.cellared) : json({ ok: true });
    }
    if (u.includes('/api/user/journal')) {
      return method === 'GET' ? json(serverState.journal) : json({ ok: true });
    }
    if (u.includes('/api/user/tier')) return json({ tier: 'free' });
    return json({}, 404);
  };
}

function restoreFetch() {
  if (realFetch) global.fetch = realFetch;
}

// ---------------------------------------------------------------------------
// Local helpers (real expo-sqlite)
// ---------------------------------------------------------------------------

async function resetLocal() {
  await withSerializedTransaction(async () => {
    await db.execAsync('DELETE FROM migration_conflicts');
    await db.execAsync('DELETE FROM migration_runs');
    await db.execAsync('DELETE FROM smoke_journal_entries');
    await db.execAsync('DELETE FROM smoke_history');
    await db.execAsync('DELETE FROM cellared_items');
    await db.execAsync('DELETE FROM cigars');
    await db.execAsync('DELETE FROM humidors');
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO humidors (name, created_at, updated_at) VALUES (?, ?, ?)',
      'Main Humidor', now, now
    );
  });
  await clearMigrationPending();
  serverState = { cigars: [], revision: 0, humidors: [], cellared: [], journal: [] };
  failNextPush = false;
}

async function addLocalCigar({ brand, name, length, quantity = 1, smoke_notes = null }) {
  const h = await db.getFirstAsync('SELECT id FROM humidors ORDER BY id LIMIT 1');
  await db.runAsync(
    `INSERT INTO cigars (brand, name, length, quantity, smoke_notes, collection, is_favorite, humidor_id)
     VALUES (?, ?, ?, ?, ?, 'cavaro', 0, ?)`,
    brand, name, length, quantity, smoke_notes, h?.id ?? 1
  );
  return (await db.getFirstAsync('SELECT last_insert_rowid() AS id')).id;
}

async function addChildren(cigarId) {
  const now = new Date().toISOString();
  const h = await db.getFirstAsync('SELECT id FROM humidors ORDER BY id LIMIT 1');
  await db.runAsync(
    `INSERT INTO cellared_items (cigar_id, humidor_id, quantity, started_at, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?, ?)`, cigarId, h?.id ?? 1, now, now, now
  );
  await db.runAsync(
    `INSERT INTO smoke_journal_entries (cigar_id, smoked_date, notes, created_at, updated_at)
     VALUES (?, ?, 'e2e note', ?, ?)`, cigarId, now, now, now
  );
  await db.runAsync('INSERT INTO smoke_history (cigar_id, smoked_at) VALUES (?, ?)', cigarId, now);
}

const localCigars = () => db.getAllAsync('SELECT brand, name, length, quantity, smoke_notes FROM cigars ORDER BY brand');
const countRows = async (table) => (await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).n;
const orphans = async () => ({
  cellared: (await db.getFirstAsync('SELECT COUNT(*) AS n FROM cellared_items WHERE cigar_id NOT IN (SELECT id FROM cigars)')).n,
  journal: (await db.getFirstAsync('SELECT COUNT(*) AS n FROM smoke_journal_entries WHERE cigar_id NOT IN (SELECT id FROM cigars)')).n,
  history: (await db.getFirstAsync('SELECT COUNT(*) AS n FROM smoke_history WHERE cigar_id NOT IN (SELECT id FROM cigars)')).n,
});

const TOKEN = 'e2e-token';
const USER_A = 'user-aaaa';
const USER_B = 'user-bbbb';

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export default async function runMigrationE2E() {
  // Second, independent gate. App.js already checks the same flag, but this
  // function deletes every local cigar, humidor and journal entry via
  // resetLocal(), so it must be impossible to invoke by accident — an errant
  // import, a debugger call, or a future caller that forgets the check.
  if (process.env.EXPO_PUBLIC_RUN_MIGRATION_E2E !== '1') {
    throw new Error(
      'runMigrationE2E is a destructive dev-only harness and is disabled in this build.'
    );
  }

  await initDatabase();
  installFetchStub();

  try {
    // -----------------------------------------------------------------------
    section('Guest signup into an EMPTY account (no conflicts)');
    await resetLocal();
    await addLocalCigar({ brand: 'Padron', name: '1964', length: '6x52', quantity: 3 });
    {
      const outcome = await runGuestMigration(TOKEN, USER_A);
      check('migration completed', outcome.phase, PHASE.COMPLETED);
      check('server received the cigar', serverState.cigars.length, 1);
      check('quantity preserved', serverState.cigars[0].quantity, 3);
      check('pending flag cleared', await isMigrationPending(), false);
      check('no active run remains', await getActiveRun(USER_A), null);
    }

    // -----------------------------------------------------------------------
    section('Returning-account login with overlap stages conflicts, writes nothing');
    await resetLocal();
    await addLocalCigar({ brand: 'Padron', name: '1964', length: '6x52', quantity: 3, smoke_notes: 'guest note' });
    serverState.cigars = [
      { brand: 'Padron', name: '1964', length: '6x52', quantity: 5, smoke_notes: 'account note', collection: 'cavaro', is_favorite: 0 },
    ];
    serverState.revision = 1;
    {
      const outcome = await runGuestMigration(TOKEN, USER_A);
      check('stops at awaiting_resolution', outcome.phase, PHASE.AWAITING);
      check('two field conflicts staged', outcome.unresolved, 2);
      check('local row still holds the GUEST quantity', (await localCigars())[0].quantity, 3);
      check('local row still holds the GUEST note', (await localCigars())[0].smoke_notes, 'guest note');
      check('nothing pushed — server revision unchanged', serverState.revision, 1);
      check('server still has the account quantity', serverState.cigars[0].quantity, 5);
      check('pending flag still set', await isMigrationPending(), true);
    }

    // -----------------------------------------------------------------------
    section('Conflict resolution then restoration preserves the answers');
    {
      const run = await getActiveRun(USER_A);
      const conflicts = await getConflicts(run.migration_id);
      const q = conflicts.find((c) => c.field === 'quantity');
      const n = conflicts.find((c) => c.field === 'smoke_notes');
      await resolveConflict(run.migration_id, q, 'manual', 8);
      await resolveConflict(run.migration_id, n, 'both');
      check('all conflicts answered', await countUnresolved(run.migration_id), 0);

      // Server also has cellared + journal rows, so restoration runs for real.
      serverState.cellared = [{
        cigar_brand: 'Padron', cigar_name: '1964', cigar_length: '6x52',
        humidor_name: 'Main Humidor', quantity: 2, started_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      }];
      serverState.journal = [{
        cigar_brand: 'Padron', cigar_name: '1964', cigar_length: '6x52',
        smoked_date: '2026-02-02', notes: 'server journal', rating: 4,
        created_at: '2026-02-02T00:00:00.000Z', updated_at: '2026-02-02T00:00:00.000Z',
      }];

      const outcome = await runGuestMigration(TOKEN, USER_A);
      check('migration completed', outcome.phase, PHASE.COMPLETED);

      const rows = await localCigars();
      check('manual quantity SURVIVED restoration', rows[0].quantity, 8);
      check('keep-both note retained the guest text', rows[0].smoke_notes.includes('guest note'), true);
      check('keep-both note retained the account text', rows[0].smoke_notes.includes('account note'), true);
      check('server snapshot has the resolved quantity',
        serverState.cigars.find((c) => c.brand === 'Padron').quantity, 8);
      check('restoration pulled the server cellared item', await countRows('cellared_items'), 1);
      check('restoration pulled the server journal entry', await countRows('smoke_journal_entries'), 1);
      check('no orphans after restoration', await orphans(), { cellared: 0, journal: 0, history: 0 });
      check('pending flag cleared', await isMigrationPending(), false);
    }

    // -----------------------------------------------------------------------
    section('Duplicate collapse repoints all three child tables');
    await resetLocal();
    {
      const keep = await addLocalCigar({ brand: 'Oliva', name: 'Serie V', length: '5x54', quantity: 2 });
      const dupe = await addLocalCigar({ brand: 'Oliva', name: 'Serie V', length: '5x54', quantity: 7 });
      await addChildren(dupe);
      check('two local rows share one identity', await countRows('cigars'), 2);

      const outcome = await runGuestMigration(TOKEN, USER_A);
      check('migration completed', outcome.phase, PHASE.COMPLETED);
      check('collapsed to one cigar row', await countRows('cigars'), 1);
      check('cellared item survived', await countRows('cellared_items'), 1);
      check('journal entry survived', await countRows('smoke_journal_entries'), 1);
      check('smoke history survived', await countRows('smoke_history'), 1);
      check('NO orphans after collapse', await orphans(), { cellared: 0, journal: 0, history: 0 });

      const survivor = await db.getFirstAsync('SELECT id FROM cigars');
      check('cellared repointed at the survivor',
        (await db.getFirstAsync('SELECT cigar_id FROM cellared_items')).cigar_id, survivor.id);
      check('journal repointed at the survivor',
        (await db.getFirstAsync('SELECT cigar_id FROM smoke_journal_entries')).cigar_id, survivor.id);
      check('history repointed at the survivor',
        (await db.getFirstAsync('SELECT cigar_id FROM smoke_history')).cigar_id, survivor.id);
      check('journal note content intact',
        (await db.getFirstAsync('SELECT notes FROM smoke_journal_entries')).notes, 'e2e note');
      check('keep-row quantity used (first occurrence)',
        (await localCigars())[0].quantity, 2);
    }

    // -----------------------------------------------------------------------
    section('Transaction rollback under expo-sqlite');
    await resetLocal();
    {
      const keep = await addLocalCigar({ brand: 'Roll', name: 'Back', length: '5x50', quantity: 1 });
      await addChildren(keep);
      let threw = false;
      try {
        await withSerializedTransaction(async () => {
          await db.runAsync('UPDATE cigars SET quantity = ? WHERE id = ?', 99, keep);
          await db.runAsync('DELETE FROM smoke_history WHERE cigar_id = ?', keep);
          throw new Error('forced rollback');
        });
      } catch { threw = true; }
      check('transaction threw', threw, true);
      check('UPDATE rolled back', (await localCigars())[0].quantity, 1);
      check('DELETE rolled back', await countRows('smoke_history'), 1);
      check('no orphans after rollback', await orphans(), { cellared: 0, journal: 0, history: 0 });
    }

    // -----------------------------------------------------------------------
    section('Interrupted migration survives restart and resumes');
    await resetLocal();
    await addLocalCigar({ brand: 'Resume', name: 'Me', length: '5x50', quantity: 4, smoke_notes: 'guest' });
    serverState.cigars = [
      { brand: 'Resume', name: 'Me', length: '5x50', quantity: 9, smoke_notes: 'server', collection: 'cavaro', is_favorite: 0 },
    ];
    serverState.revision = 1;
    {
      await runGuestMigration(TOKEN, USER_A);
      const run = await getActiveRun(USER_A);
      const conflicts = await getConflicts(run.migration_id);
      await resolveConflict(run.migration_id, conflicts.find((c) => c.field === 'quantity'), 'guest');
      check('one answer recorded, one outstanding', await countUnresolved(run.migration_id), 1);

      // Simulate a cold start: re-read state from disk only.
      const reread = await getActiveRun(USER_A);
      check('run survived the "restart"', reread.migration_id, run.migration_id);
      check('snapshot survived', reread.guest_snapshot.length, 1);
      check('answer survived', (await getConflicts(run.migration_id))
        .find((c) => c.field === 'quantity').resolution, 'guest');
      check('pending flag still set', await isMigrationPending(), true);
      check('local data untouched', (await localCigars())[0].quantity, 4);

      // Push fails mid-apply, then succeeds on retry.
      await resolveConflict(run.migration_id, (await getConflicts(run.migration_id))
        .find((c) => c.field === 'smoke_notes'), 'both');
      failNextPush = true;
      let failed = false;
      try { await runGuestMigration(TOKEN, USER_A); } catch { failed = true; }
      check('push failure propagated', failed, true);
      check('pending flag STILL set after failure', await isMigrationPending(), true);
      check('local cigars intact after failure', (await localCigars()).length, 1);

      const retry = await runGuestMigration(TOKEN, USER_A);
      check('retry completed', retry.phase, PHASE.COMPLETED);
      check('guest quantity won as chosen', (await localCigars())[0].quantity, 4);
      check('no duplicate rows from the retry', await countRows('cigars'), 1);
      check('pending flag cleared on success', await isMigrationPending(), false);
    }

    // -----------------------------------------------------------------------
    section('Revision conflict rebuilds the plan, preserving valid answers');
    await resetLocal();
    await addLocalCigar({ brand: 'Rev', name: 'Check', length: '5x50', quantity: 2, smoke_notes: 'guest' });
    serverState.cigars = [
      { brand: 'Rev', name: 'Check', length: '5x50', quantity: 5, smoke_notes: 'server', collection: 'cavaro', is_favorite: 0 },
    ];
    serverState.revision = 3;
    {
      await runGuestMigration(TOKEN, USER_A);
      const run = await getActiveRun(USER_A);
      let conflicts = await getConflicts(run.migration_id);
      await resolveConflict(run.migration_id, conflicts.find((c) => c.field === 'quantity'), 'guest');
      await resolveConflict(run.migration_id, conflicts.find((c) => c.field === 'smoke_notes'), 'both');
      check('both answered', await countUnresolved(run.migration_id), 0);

      // Another device changes ONLY the quantity, bumping the revision.
      serverState.cigars[0].quantity = 11;
      serverState.revision = 4;

      await restageMigration(USER_A, TOKEN);
      conflicts = await getConflicts(run.migration_id);
      check('quantity answer invalidated (server value moved)',
        conflicts.find((c) => c.field === 'quantity').resolution, null);
      check('quantity now carries the fresh server value',
        conflicts.find((c) => c.field === 'quantity').server_value, 11);
      check('notes answer PRESERVED (both sides unchanged)',
        conflicts.find((c) => c.field === 'smoke_notes').resolution, 'both');
      check('no conflict rows duplicated by the rebuild', conflicts.length, 2);
      check('nothing written while rebuilding', (await localCigars())[0].quantity, 2);
    }

    // -----------------------------------------------------------------------
    section('Account switching requires explicit confirmation');
    await resetLocal();
    await addLocalCigar({ brand: 'Switch', name: 'Me', length: '5x50', quantity: 6 });
    serverState.cigars = [
      { brand: 'Switch', name: 'Me', length: '5x50', quantity: 2, collection: 'cavaro', is_favorite: 0 },
    ];
    serverState.revision = 1;
    {
      await runGuestMigration(TOKEN, USER_A);
      const runA = await getActiveRun(USER_A);
      check('run staged for account A', !!runA, true);
      const snapshotA = JSON.stringify(runA.guest_snapshot);

      // Account B signs in while A's run is outstanding.
      const outcome = await runGuestMigration(TOKEN, USER_B);
      check('B is refused, not silently migrated', outcome.phase, 'needs_account_confirmation');
      check('refusal names A\'s run', outcome.foreignRun.userId, USER_A);
      check('B has no run of its own', await getActiveRun(USER_B), null);
      check('A\'s snapshot NOT deleted or overwritten',
        JSON.stringify((await getActiveRun(USER_A)).guest_snapshot), snapshotA);
      check('nothing pushed for B', serverState.revision, 1);
      check('pending flag still set', await isMigrationPending(), true);
      check('foreign run is discoverable from B', (await getForeignActiveRun(USER_B)).user_id, USER_A);

      // Explicit confirmation redirects to B using the PRESERVED snapshot.
      await confirmAccountChange(runA.migration_id, USER_B, TOKEN);
      const runB = await getActiveRun(USER_B);
      check('B now has a run', !!runB, true);
      check('B\'s snapshot is A\'s preserved snapshot',
        JSON.stringify(runB.guest_snapshot), snapshotA);
      check('A\'s run retired, not active', await getActiveRun(USER_A), null);
      check('A\'s run row still exists (retired, not deleted)',
        (await db.getFirstAsync('SELECT phase FROM migration_runs WHERE migration_id = ?', runA.migration_id)).phase,
        PHASE.SUPERSEDED);

      const finish = await runGuestMigration(TOKEN, USER_B);
      check('B\'s migration reaches a decision point or completes',
        [PHASE.AWAITING, PHASE.COMPLETED].includes(finish.phase), true);
    }

    await resetLocal();
  } catch (err) {
    fail++;
    results.push({ ok: false, name: 'harness error', actual: String(err?.message || err), stack: String(err?.stack || '') });
    console.log('HARNESS ERROR', err);
  } finally {
    restoreFetch();
  }

  const summary = { pass, fail, total: pass + fail, finishedAt: new Date().toISOString(), results };
  console.log(`\n=== MIGRATION E2E: ${pass} passed, ${fail} failed ===`);
  try {
    await FileSystem.writeAsStringAsync(
      `${FileSystem.documentDirectory}${RESULT_FILE}`,
      JSON.stringify(summary, null, 2)
    );
    console.log(`results written to ${FileSystem.documentDirectory}${RESULT_FILE}`);
  } catch (err) {
    console.log('could not write results file:', err?.message);
  }
  return summary;
}
