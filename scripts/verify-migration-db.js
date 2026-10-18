#!/usr/bin/env node

/**
 * Database integration tests for guest-migration safety (audit areas 1 and 3).
 *
 * These run against a REAL SQLite engine (node:sqlite) using DDL extracted from
 * db/index.js, and they execute the same SQL statements lib/guestMigration.js
 * issues. Pure-JavaScript merge tests cannot show transaction, rollback or
 * foreign-key behaviour, which is the whole point of this file.
 *
 * Usage: node --no-warnings scripts/verify-migration-db.js
 */

const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const ROOT = dirname(__dirname);

// ---------------------------------------------------------------------------
// Schema, extracted from the app source so the tests cannot drift from it.
// ---------------------------------------------------------------------------

function extractSchema() {
  const src = readFileSync(join(ROOT, 'db', 'index.js'), 'utf8');

  const creates = [...src.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\s*\)/g)]
    .filter(([, table]) => !table.endsWith('_new'))
    .map(([, table, body]) => `CREATE TABLE IF NOT EXISTS ${table} (${body})`);

  const alters = [...src.matchAll(/ALTER TABLE cigars ADD COLUMN ([^'"`]+)/g)]
    .map(([, col]) => `ALTER TABLE cigars ADD COLUMN ${col.trim()}`);

  if (!creates.length) throw new Error('No CREATE TABLE statements extracted from db/index.js');
  return { creates, alters };
}

const SCHEMA = extractSchema();

function freshDb({ foreignKeys = false } = {}) {
  const db = new DatabaseSync(':memory:');
  // Mirrors the app: db/index.js never issues PRAGMA foreign_keys, so SQLite's
  // default (off) is what ships. The flag here lets tests show both worlds.
  db.exec(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`);
  for (const stmt of SCHEMA.creates) db.exec(stmt);
  for (const stmt of SCHEMA.alters) {
    try { db.exec(stmt); } catch { /* column already in the CREATE */ }
  }
  return db;
}

// ---------------------------------------------------------------------------
// The statements under test, lifted from lib/guestMigration.js applyMigration.
// assertSourceContains guards against this test asserting on SQL the app no
// longer runs.
// ---------------------------------------------------------------------------

const MIGRATION_SRC = readFileSync(join(ROOT, 'lib', 'guestMigration.js'), 'utf8');

// The pre-fix blanket delete. Retained to demonstrate the original defect; the
// shipped code no longer issues it (asserted in the FIX 2 section below).
const COLLAPSE_DELETE =
  'DELETE FROM cigars WHERE brand = ? AND name = ? AND length = ? AND id != ?';

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); }
}

function assertSourceContains(name, needle) {
  const normalized = MIGRATION_SRC.replace(/\s+/g, ' ');
  check(name, normalized.includes(needle.replace(/\s+/g, ' ')), true);
}

function seedCigar(db, { brand, name, length, quantity = 1, humidorId = 1 }) {
  db.prepare(
    `INSERT INTO cigars (brand, name, length, quantity, collection, is_favorite, humidor_id)
     VALUES (?, ?, ?, ?, 'cavaro', 0, ?)`
  ).run(brand, name, length, quantity, humidorId);
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}

function seedHumidor(db, name = 'Main Humidor') {
  const now = new Date(0).toISOString();
  db.prepare('INSERT INTO humidors (name, created_at, updated_at) VALUES (?, ?, ?)')
    .run(name, now, now);
  return db.prepare('SELECT last_insert_rowid() AS id').get().id;
}

function seedChildren(db, cigarId, humidorId) {
  const now = new Date(0).toISOString();
  db.prepare(
    `INSERT INTO cellared_items (cigar_id, humidor_id, quantity, started_at, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?, ?)`
  ).run(cigarId, humidorId, now, now, now);
  db.prepare(
    `INSERT INTO smoke_journal_entries (cigar_id, smoked_date, notes, created_at, updated_at)
     VALUES (?, ?, 'tasting note', ?, ?)`
  ).run(cigarId, now, now, now);
  db.prepare('INSERT INTO smoke_history (cigar_id, smoked_at) VALUES (?, ?)').run(cigarId, now);
}

const orphanCounts = (db) => ({
  cellared: db.prepare(
    'SELECT COUNT(*) AS n FROM cellared_items WHERE cigar_id NOT IN (SELECT id FROM cigars)'
  ).get().n,
  journal: db.prepare(
    'SELECT COUNT(*) AS n FROM smoke_journal_entries WHERE cigar_id NOT IN (SELECT id FROM cigars)'
  ).get().n,
  history: db.prepare(
    'SELECT COUNT(*) AS n FROM smoke_history WHERE cigar_id NOT IN (SELECT id FROM cigars)'
  ).get().n,
});

// ===========================================================================
console.log('\nSchema extraction');
{
  const db = freshDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all().map((r) => r.name);
  for (const t of ['cigars', 'humidors', 'cellared_items', 'smoke_journal_entries',
                   'smoke_history', 'migration_runs', 'migration_conflicts']) {
    check(`${t} created from app DDL`, tables.includes(t), true);
  }
  const cols = db.prepare('PRAGMA table_info(cigars)').all().map((c) => c.name);
  check('cigars has smoke_notes (added by ALTER)', cols.includes('smoke_notes'), true);
  check('cigars has humidor_id (added by ALTER)', cols.includes('humidor_id'), true);
  check('cigars has NO updated_at — no timestamp-based resolution possible',
    cols.includes('updated_at'), false);
  db.close();
}

// ===========================================================================
console.log('\nAREA 3 — foreign keys are not enforced in the shipped app');
{
  const db = freshDb();
  check('PRAGMA foreign_keys defaults to 0 (off)',
    db.prepare('PRAGMA foreign_keys').get().foreign_keys, 0);
  check('db/index.js never turns foreign keys on',
    readFileSync(join(ROOT, 'db', 'index.js'), 'utf8').includes('PRAGMA foreign_keys'), false);
  db.close();
}

console.log('\nAREA 3 — duplicate collapse orphans related records (FK off, as shipped)');
{
  const db = freshDb({ foreignKeys: false });
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'Padron', name: '1964', length: '6x52', quantity: 3, humidorId });
  const dupe = seedCigar(db, { brand: 'Padron', name: '1964', length: '6x52', quantity: 5, humidorId });
  seedChildren(db, dupe, humidorId); // journal + cellared + history on the DUPLICATE

  check('two rows share one identity', db.prepare(
    'SELECT COUNT(*) AS n FROM cigars WHERE brand = ? AND name = ? AND length = ?'
  ).get('Padron', '1964', '6x52').n, 2);
  check('no orphans before collapse', orphanCounts(db), { cellared: 0, journal: 0, history: 0 });

  db.prepare(COLLAPSE_DELETE).run('Padron', '1964', '6x52', keep);

  check('collapse leaves one cigar row', db.prepare(
    'SELECT COUNT(*) AS n FROM cigars WHERE brand = ? AND name = ? AND length = ?'
  ).get('Padron', '1964', '6x52').n, 1);
  check('DELETE SUCCEEDS and silently orphans child rows',
    orphanCounts(db), { cellared: 1, journal: 1, history: 1 });
  check('the orphaned journal note still exists but points nowhere', db.prepare(
    'SELECT notes FROM smoke_journal_entries WHERE cigar_id = ?'
  ).get(dupe).notes, 'tasting note');
  db.close();
}

console.log('\nAREA 3 — same collapse under FK enforcement');
{
  const db = freshDb({ foreignKeys: true });
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', humidorId });
  const dupe = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', humidorId });
  seedChildren(db, dupe, humidorId);

  let threw = null;
  try { db.prepare(COLLAPSE_DELETE).run('A', 'B', '5x50', keep); }
  catch (err) { threw = String(err.message); }

  check('with FK on, the collapse DELETE is rejected', threw !== null, true);
  check('error is a foreign key violation',
    /FOREIGN KEY constraint failed/i.test(threw ?? ''), true);
  db.close();
}

console.log('\nAREA 3 — transaction rollback restores pre-migration state');
{
  const db = freshDb();
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', quantity: 2, humidorId });
  const dupe = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', quantity: 9, humidorId });

  db.exec('BEGIN');
  db.prepare('UPDATE cigars SET quantity = ? WHERE id = ?').run(42, keep);
  db.prepare(COLLAPSE_DELETE).run('A', 'B', '5x50', keep);
  check('inside the transaction the collapse is visible', db.prepare(
    'SELECT COUNT(*) AS n FROM cigars'
  ).get().n, 1);
  db.exec('ROLLBACK');

  check('after rollback both rows are back', db.prepare('SELECT COUNT(*) AS n FROM cigars').get().n, 2);
  check('after rollback the UPDATE is undone too',
    db.prepare('SELECT quantity FROM cigars WHERE id = ?').get(keep).quantity, 2);
  check('duplicate row keeps its own quantity',
    db.prepare('SELECT quantity FROM cigars WHERE id = ?').get(dupe).quantity, 9);
  db.close();
}

console.log('\nAREA 3 — update + delete are issued inside one transaction');
{
  assertSourceContains('applyMigration wraps its writes in withSerializedTransaction',
    'await withSerializedTransaction(async () => {');
  assertSourceContains('collapse selects duplicates then deletes per row',
    'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ? AND id != ?');
  check('withSerializedTransaction delegates to db.withTransactionAsync',
    readFileSync(join(ROOT, 'db', 'index.js'), 'utf8')
      .includes('enqueueDbWrite(() => db.withTransactionAsync(work))'), true);
}

console.log('\nAREA 3 — repeated application is idempotent at the row level');
{
  const db = freshDb();
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', quantity: 4, humidorId });
  seedCigar(db, { brand: 'A', name: 'B', length: '5x50', quantity: 7, humidorId });

  for (let i = 0; i < 3; i++) {
    db.exec('BEGIN');
    db.prepare('UPDATE cigars SET quantity = ? WHERE id = ?').run(4, keep);
    db.prepare(COLLAPSE_DELETE).run('A', 'B', '5x50', keep);
    db.exec('COMMIT');
  }
  check('three applies leave exactly one row',
    db.prepare('SELECT COUNT(*) AS n FROM cigars').get().n, 1);
  check('the surviving quantity is stable',
    db.prepare('SELECT quantity FROM cigars WHERE id = ?').get(keep).quantity, 4);
  db.close();
}

// ===========================================================================
console.log('\nAREA 1 — account switching against the real run table');
{
  const db = freshDb();
  const ACTIVE = ['staged', 'awaiting_resolution', 'applying'];
  const now = new Date(0).toISOString();
  const guestSnapshot = JSON.stringify([
    { brand: 'Padron', name: '1964', length: '6x52', quantity: 3 },
  ]);

  // A migration staged for account A, deferred with one unresolved conflict.
  db.prepare(
    `INSERT INTO migration_runs
       (migration_id, user_id, phase, guest_snapshot, deferred, started_at)
     VALUES ('run-A', 'user-A', 'awaiting_resolution', ?, 1, ?)`
  ).run(guestSnapshot, now);
  db.prepare(
    `INSERT INTO migration_conflicts
       (migration_id, brand, name, length, field, guest_value, server_value, created_at)
     VALUES ('run-A', 'Padron', '1964', '6x52', 'quantity', '3', '5', ?)`
  ).run(now);

  // getActiveRun() is scoped by user_id — this is the query the app runs.
  const activeFor = (userId) => db.prepare(
    `SELECT * FROM migration_runs
     WHERE user_id = ? AND phase IN (${ACTIVE.map(() => '?').join(',')})
     ORDER BY started_at DESC LIMIT 1`
  ).get(userId, ...ACTIVE);

  check('account A has an active run', !!activeFor('user-A'), true);
  check('account B has NO active run — so beginMigration would stage a fresh one',
    activeFor('user-B') ?? null, null);

  const otherActive = db.prepare(
    `SELECT COUNT(*) AS n FROM migration_runs
     WHERE user_id != ? AND phase IN (${ACTIVE.map(() => '?').join(',')})`
  ).get('user-B', ...ACTIVE).n;
  check('a run for a DIFFERENT account is detectable at sign-in time', otherActive, 1);

  check('A\'s original snapshot is still on disk and recoverable',
    JSON.parse(activeFor('user-A').guest_snapshot)[0].quantity, 3);
  check('A\'s answered/unanswered conflict rows survive', db.prepare(
    'SELECT COUNT(*) AS n FROM migration_conflicts WHERE migration_id = ?'
  ).get('run-A').n, 1);
  db.close();
}

// ===========================================================================
console.log('\nFIX 1 — resolved values are not re-merged over by a cigar restore');
{
  const sync = readFileSync(join(ROOT, 'lib', 'userCigarsSync.js'), 'utf8');
  const migrationBlock = sync.slice(sync.indexOf('export async function runGuestMigration'));
  check('migration path does NOT call restoreAllUserDataOnLogin after apply',
    migrationBlock.includes('restoreAllUserDataOnLogin'), false);
  check('migration path restores everything except cigars',
    migrationBlock.includes('restoreNonCigarUserData'), true);
  check('humidors are restored before apply so humidor_name resolves',
    migrationBlock.indexOf('await restoreHumidorsOnly(accessToken)')
      < migrationBlock.indexOf('await applyMigration(userId, accessToken)'), true);
  check('normal sign-in path still uses the full restore',
    sync.slice(0, sync.indexOf('export async function runGuestMigration'))
      .includes('await restoreAllUserDataOnLogin(accessToken);'), true);
}

console.log('\nFIX 2 — collapse repoints related records, no orphans');
{
  const db = freshDb({ foreignKeys: true }); // strictest case
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', quantity: 2, humidorId });
  const dupe = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', quantity: 9, humidorId });
  seedChildren(db, dupe, humidorId);

  // The corrected sequence, in one transaction.
  db.exec('BEGIN');
  db.prepare('UPDATE cellared_items SET cigar_id = ? WHERE cigar_id = ?').run(keep, dupe);
  db.prepare('UPDATE smoke_journal_entries SET cigar_id = ? WHERE cigar_id = ?').run(keep, dupe);
  db.prepare('UPDATE smoke_history SET cigar_id = ? WHERE cigar_id = ?').run(keep, dupe);
  db.prepare('DELETE FROM cigars WHERE id = ?').run(dupe);
  db.exec('COMMIT');

  check('one cigar row remains', db.prepare('SELECT COUNT(*) AS n FROM cigars').get().n, 1);
  check('NO orphans even with FK enforcement on',
    orphanCounts(db), { cellared: 0, journal: 0, history: 0 });
  check('journal note was preserved and repointed', db.prepare(
    'SELECT cigar_id FROM smoke_journal_entries WHERE notes = ?'
  ).get('tasting note').cigar_id, keep);
  check('cellared item repointed', db.prepare(
    'SELECT cigar_id FROM cellared_items'
  ).get().cigar_id, keep);
  check('smoke history repointed', db.prepare(
    'SELECT cigar_id FROM smoke_history'
  ).get().cigar_id, keep);
  db.close();
}

console.log('\nFIX 2 — rollback leaves children attached to the original rows');
{
  const db = freshDb();
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', humidorId });
  const dupe = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', humidorId });
  seedChildren(db, dupe, humidorId);

  db.exec('BEGIN');
  db.prepare('UPDATE smoke_journal_entries SET cigar_id = ? WHERE cigar_id = ?').run(keep, dupe);
  db.prepare('DELETE FROM cigars WHERE id = ?').run(dupe);
  db.exec('ROLLBACK');

  check('rollback restores the duplicate row', db.prepare('SELECT COUNT(*) AS n FROM cigars').get().n, 2);
  check('rollback un-repoints the journal entry', db.prepare(
    'SELECT cigar_id FROM smoke_journal_entries'
  ).get().cigar_id, dupe);
  check('still no orphans after rollback', orphanCounts(db), { cellared: 0, journal: 0, history: 0 });
  db.close();
}

console.log('\nFIX 2 — repeated application with children stays idempotent');
{
  const db = freshDb();
  const humidorId = seedHumidor(db);
  const keep = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', humidorId });
  const dupe = seedCigar(db, { brand: 'A', name: 'B', length: '5x50', humidorId });
  seedChildren(db, dupe, humidorId);

  for (let i = 0; i < 3; i++) {
    db.exec('BEGIN');
    for (const d of db.prepare(
      'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ? AND id != ?'
    ).all('A', 'B', '5x50', keep)) {
      db.prepare('UPDATE cellared_items SET cigar_id = ? WHERE cigar_id = ?').run(keep, d.id);
      db.prepare('UPDATE smoke_journal_entries SET cigar_id = ? WHERE cigar_id = ?').run(keep, d.id);
      db.prepare('UPDATE smoke_history SET cigar_id = ? WHERE cigar_id = ?').run(keep, d.id);
      db.prepare('DELETE FROM cigars WHERE id = ?').run(d.id);
    }
    db.exec('COMMIT');
  }
  check('three runs leave one cigar', db.prepare('SELECT COUNT(*) AS n FROM cigars').get().n, 1);
  check('child rows are not duplicated by re-running', [
    db.prepare('SELECT COUNT(*) AS n FROM cellared_items').get().n,
    db.prepare('SELECT COUNT(*) AS n FROM smoke_journal_entries').get().n,
    db.prepare('SELECT COUNT(*) AS n FROM smoke_history').get().n,
  ], [1, 1, 1]);
  check('no orphans after repeated application',
    orphanCounts(db), { cellared: 0, journal: 0, history: 0 });
  db.close();
}

console.log('\nFIX 2 — source carries the repoint before the delete');
{
  assertSourceContains('cellared_items repointed', "UPDATE cellared_items SET cigar_id = ? WHERE cigar_id = ?");
  assertSourceContains('journal repointed', "UPDATE smoke_journal_entries SET cigar_id = ? WHERE cigar_id = ?");
  assertSourceContains('smoke_history repointed', "UPDATE smoke_history SET cigar_id = ? WHERE cigar_id = ?");
  const norm = MIGRATION_SRC.replace(/\s+/g, ' ');
  check('repoint precedes the per-row delete',
    norm.indexOf('UPDATE cellared_items SET cigar_id') < norm.indexOf('DELETE FROM cigars WHERE id = ?'), true);
  check('the old blanket delete is gone',
    norm.includes('DELETE FROM cigars WHERE brand = ? AND name = ? AND length = ? AND id != ?'), false);
}

console.log('\nFIX 3 — cross-account staging is refused, snapshot preserved');
{
  const src = MIGRATION_SRC;
  check('beginMigration checks for a foreign active run',
    src.includes('getForeignActiveRun'), true);
  check('it throws MIGRATION_ACCOUNT_MISMATCH rather than staging',
    src.includes('MIGRATION_ACCOUNT_MISMATCH'), true);
  check('an explicit confirmation entry point exists',
    src.includes('export async function confirmAccountChange'), true);
  check('confirmAccountChange reuses the stored snapshot, not current local rows',
    src.slice(src.indexOf('export async function confirmAccountChange'))
       .slice(0, 900).includes('unjson(foreign.guest_snapshot)'), true);
  check('nothing calls confirmAccountChange automatically',
    readFileSync(join(ROOT, 'lib', 'userCigarsSync.js'), 'utf8').includes('confirmAccountChange'), false);

  const sync = readFileSync(join(ROOT, 'lib', 'userCigarsSync.js'), 'utf8');
  check('sync returns needs_account_confirmation instead of throwing',
    sync.includes("phase: 'needs_account_confirmation'"), true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
