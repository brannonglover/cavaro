#!/usr/bin/env node

/**
 * Production-readiness checks for collection revision protection, against a
 * REAL PostgreSQL instance and the REAL server/routes/userCigars.js.
 *
 * Covers rollout items 1, 3, 4 and 5:
 *   1. revision increments atomically for BOTH revision-aware and legacy writes
 *   3. X-Collection-Revision present for empty and populated collections
 *   4. two simultaneous writes at the same base revision cannot both succeed
 *   5. existing (unversioned) clients keep working during the compatibility window
 *
 * Requires a throwaway Postgres. Start one with:
 *   docker run -d --name cavaro-pg-test -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=cavaro_test -p 55432:5432 postgres:16-alpine
 *
 * Usage:
 *   PGURL=postgres://postgres:test@127.0.0.1:55432/cavaro_test \
 *     node scripts/verify-revision-postgres.js
 */

const path = require('node:path');
const Module = require('node:module');
const { readFileSync } = require('node:fs');

const ROOT = path.dirname(__dirname);
const SERVER = path.join(ROOT, 'server');
const PGURL = process.env.PGURL || 'postgres://postgres:test@127.0.0.1:55432/cavaro_test';

const { Pool } = require(path.join(SERVER, 'node_modules', 'pg'));
const express = require(path.join(SERVER, 'node_modules', 'express'));
const cors = require(path.join(SERVER, 'node_modules', 'cors'));

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); }
}

const pool = new Pool({ connectionString: PGURL, max: 20 });

async function resetSchema() {
  // Drop everything the migration creates, so repeated runs are isolated.
  await pool.query(`DROP TABLE IF EXISTS
    user_cigars, user_collection_revision,
    unversioned_snapshot_writes, unversioned_write_observation`);
  // Minimal user_cigars matching the columns the route writes.
  await pool.query(`
    CREATE TABLE user_cigars (
      user_id TEXT NOT NULL, brand TEXT NOT NULL, name TEXT NOT NULL, length TEXT NOT NULL,
      line TEXT, description TEXT, wrapper TEXT, binder TEXT, filler TEXT, image TEXT,
      collection TEXT, is_favorite BOOLEAN, quantity INTEGER,
      smoked_date TEXT, smoke_notes TEXT, favorite_notes TEXT,
      flavor_profile TEXT, strength_profile TEXT, construction_quality TEXT,
      flavor_changes TEXT, date_added TEXT, humidor_name TEXT, updated_at TIMESTAMPTZ
    )`);
  // The ACTUAL migration file, so the deploy artefact itself is exercised.
  const migration = readFileSync(path.join(SERVER, 'scripts', 'add-collection-revision.sql'), 'utf8');
  await pool.query(migration);
}

function loadRouter(currentUserId) {
  const pgPath = require.resolve(path.join(SERVER, 'config', 'postgres'));
  const authPath = require.resolve(path.join(SERVER, 'lib', 'auth'));
  const routePath = require.resolve(path.join(SERVER, 'routes', 'userCigars'));
  for (const p of [pgPath, authPath, routePath]) delete require.cache[p];

  require.cache[pgPath] = Object.assign(new Module(pgPath, null), { exports: pool, loaded: true });
  require.cache[authPath] = Object.assign(new Module(authPath, null), {
    exports: { resolveUserId: async (req) => req.headers['x-user-id'] || currentUserId() },
    loaded: true,
  });
  return require(routePath);
}

function startServer(router) {
  const app = express();
  app.use(express.json());
  // Mirrors server/index.js so the CORS assertion tests what ships.
  app.use(cors({ exposedHeaders: ['X-Collection-Revision'] }));
  app.use('/api/user/cigars', router);
  return new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${s.address().port}/api/user/cigars`,
      close: () => new Promise((r) => s.close(() => r())),
    }));
  });
}

const cigar = (brand, name, length, extra = {}) => ({ brand, name, length, quantity: 1, ...extra });

(async () => {
  await resetSchema();
  const router = loadRouter(() => 'user-default');
  const srv = await startServer(router);

  const GET = async (userId) => {
    const res = await fetch(srv.url, { headers: { 'x-user-id': userId } });
    return {
      status: res.status,
      revision: res.headers.get('X-Collection-Revision'),
      expose: res.headers.get('Access-Control-Expose-Headers'),
      cigars: await res.json(),
    };
  };
  const PUT = async (userId, cigars, baseRevision) => {
    const body = baseRevision === undefined ? { cigars } : { cigars, baseRevision };
    const res = await fetch(srv.url, {
      method: 'PUT',
      headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, revision: res.headers.get('X-Collection-Revision'), body: await res.json() };
  };
  const dbRevision = async (userId) => {
    const { rows } = await pool.query('SELECT revision FROM user_collection_revision WHERE user_id = $1', [userId]);
    return rows[0] ? Number(rows[0].revision) : null;
  };
  const rowCount = async (userId) => {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM user_cigars WHERE user_id = $1', [userId]);
    return rows[0].n;
  };

  // =========================================================================
  console.log('\nITEM 3 — X-Collection-Revision on empty and populated collections');
  {
    const empty = await GET('u-empty');
    check('empty collection returns 200', empty.status, 200);
    check('empty collection returns no cigars', empty.cigars.length, 0);
    check('empty collection STILL carries the revision header', empty.revision, '0');
    check('CORS exposes the header', (empty.expose || '').includes('X-Collection-Revision'), true);

    await PUT('u-empty', [cigar('A', 'B', '5x50')], 0);
    const populated = await GET('u-empty');
    check('populated collection carries the header', populated.revision, '1');
    check('populated collection returns its cigars', populated.cigars.length, 1);
    check('CORS exposure holds on the populated response',
      (populated.expose || '').includes('X-Collection-Revision'), true);
  }

  // =========================================================================
  console.log('\nITEM 1 — revision increments atomically (revision-aware path)');
  {
    const u = 'u-atomic-versioned';
    check('no revision row before first write', await dbRevision(u), null);
    const r1 = await PUT(u, [cigar('A', 'B', '5x50')], 0);
    check('first guarded write accepted', r1.status, 200);
    check('revision row created at 1', await dbRevision(u), 1);
    check('response body reports the new revision', r1.body.revision, 1);
    check('response header reports the new revision', r1.revision, '1');

    const r2 = await PUT(u, [cigar('A', 'B', '5x50'), cigar('C', 'D', '6x52')], 1);
    check('second guarded write accepted', r2.status, 200);
    check('revision advanced to 2', await dbRevision(u), 2);
    check('rows match the payload', await rowCount(u), 2);
  }

  console.log('\nITEM 1 — revision increments atomically (LEGACY unversioned path)');
  {
    // Reload the router with legacy writes permitted.
    await srv.close();
    process.env.ALLOW_UNVERSIONED_SNAPSHOT_WRITES = '1';
    const legacyRouter = loadRouter(() => 'user-default');
    const legacySrv = await startServer(legacyRouter);
    const LPUT = async (userId, cigars, baseRevision) => {
      const body = baseRevision === undefined ? { cigars } : { cigars, baseRevision };
      const res = await fetch(legacySrv.url, {
        method: 'PUT',
        headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, revision: res.headers.get('X-Collection-Revision'), body: await res.json() };
    };

    const u = 'u-atomic-legacy';
    const r1 = await LPUT(u, [cigar('A', 'B', '5x50')]); // no baseRevision at all
    check('legacy write accepted when the flag is on', r1.status, 200);
    check('LEGACY WRITE ALSO BUMPS THE REVISION', await dbRevision(u), 1);
    check('legacy response reports the revision', r1.body.revision, 1);

    const r2 = await LPUT(u, [cigar('A', 'B', '5x50'), cigar('C', 'D', '6x52')]);
    check('second legacy write accepted', r2.status, 200);
    check('revision advanced again', await dbRevision(u), 2);

    // ITEM 5 — a legacy client and a modern client interleaving.
    console.log('\nITEM 5 — legacy and revision-aware clients coexist');
    const shared = 'u-mixed';
    await LPUT(shared, [cigar('Legacy', 'Write', '5x50')]);
    check('legacy client seeded the collection', await dbRevision(shared), 1);

    const modernRead = await fetch(legacySrv.url, { headers: { 'x-user-id': shared } });
    const modernRevision = Number(modernRead.headers.get('X-Collection-Revision'));
    check('modern client reads the revision a legacy write produced', modernRevision, 1);

    const modernWrite = await LPUT(shared, [cigar('Legacy', 'Write', '5x50'), cigar('Modern', 'Write', '6x52')], modernRevision);
    check('modern guarded write on top of legacy state accepted', modernWrite.status, 200);
    check('both rows present', await rowCount(shared), 2);

    // A legacy write AFTER a modern one still works while the flag is on, but
    // it is exactly the unprotected case the flag keeps alive.
    const legacyAfter = await LPUT(shared, [cigar('Legacy', 'Clobber', '5x50')]);
    check('legacy write still permitted while flag is on', legacyAfter.status, 200);
    check('and it DID replace the snapshot (the risk the flag preserves)', await rowCount(shared), 1);

    // ITEM 2 — durable telemetry + administrator-only access.
    console.log('\nITEM 2 — telemetry is administrator-only');
    const noToken = await fetch(`${legacySrv.url}/revision-stats`, { headers: { 'x-user-id': 'ordinary-user' } });
    check('ordinary authenticated user cannot read stats', noToken.status, 404);

    process.env.OPS_API_TOKEN = 'ops-secret-token';
    const wrongToken = await fetch(`${legacySrv.url}/revision-stats`, { headers: { 'x-ops-token': 'wrong' } });
    check('wrong ops token rejected', wrongToken.status, 404);
    const sameLenWrong = await fetch(`${legacySrv.url}/revision-stats`, { headers: { 'x-ops-token': 'ops-secret-tokeX' } });
    check('same-length wrong token rejected', sameLenWrong.status, 404);

    const okRes = await fetch(`${legacySrv.url}/revision-stats`, { headers: { 'x-ops-token': 'ops-secret-token' } });
    check('correct ops token accepted', okRes.status, 200);
    const stats = await okRes.json();

    delete process.env.OPS_API_TOKEN;
    const failClosed = await fetch(`${legacySrv.url}/revision-stats`, { headers: { 'x-ops-token': 'ops-secret-token' } });
    check('FAILS CLOSED when OPS_API_TOKEN is unset', failClosed.status, 404);
    process.env.OPS_API_TOKEN = 'ops-secret-token';

    console.log('\nITEM 2 — telemetry is durable and windowed');
    check('stats report the flag as on', stats.allowUnversioned, true);
    check('4 unversioned writes recorded in the last 7 days', stats.last7Days.writes, 4);
    check('2 distinct legacy users in the last 7 days', stats.last7Days.distinctUsers, 2);
    check('30-day window agrees', stats.last30Days.writes, 4);
    check('observation start recorded by the migration', typeof stats.observationStartedAt, 'string');
    check('lastSeenAt recorded', typeof stats.lastSeenAt, 'string');
    check('NOT safe to disable — window has not been observed for 7 days',
      stats.safeToDisableLegacyWrites, false);

    // Rows survive a process restart: re-require the router (new "process")
    // and confirm the counts come back from Postgres, not memory.
    await legacySrv.close();
    const restartedRouter = loadRouter(() => 'user-default');
    const restartedSrv = await startServer(restartedRouter);
    const afterRestart = await (await fetch(`${restartedSrv.url}/revision-stats`,
      { headers: { 'x-ops-token': 'ops-secret-token' } })).json();
    check('COUNTS SURVIVE A RESTART (durable, not in-memory)', afterRestart.last7Days.writes, 4);
    check('distinct users survive a restart', afterRestart.last7Days.distinctUsers, 2);

    // A sufficiently old observation start with zero recent writes flips the gate.
    await pool.query("UPDATE unversioned_write_observation SET started_at = NOW() - INTERVAL '10 days' WHERE id = 1");
    const stillBusy = await (await fetch(`${restartedSrv.url}/revision-stats`,
      { headers: { 'x-ops-token': 'ops-secret-token' } })).json();
    check('10 days observed but writes present -> still not safe',
      stillBusy.safeToDisableLegacyWrites, false);

    await pool.query("UPDATE unversioned_snapshot_writes SET day = CURRENT_DATE - 20");
    const quiet = await (await fetch(`${restartedSrv.url}/revision-stats`,
      { headers: { 'x-ops-token': 'ops-secret-token' } })).json();
    check('no writes in 7d and 10 days observed -> SAFE to disable',
      quiet.safeToDisableLegacyWrites, true);
    check('but the 30-day window still shows them', quiet.last30Days.writes, 4);
    await restartedSrv.close();

    // Flag OFF: legacy writes refused, and still recorded durably.
    delete process.env.ALLOW_UNVERSIONED_SNAPSHOT_WRITES;
    const strictRouter = loadRouter(() => 'user-default');
    const strictSrv = await startServer(strictRouter);
    const before = await dbRevision('u-strict-check');
    const refused = await fetch(strictSrv.url, {
      method: 'PUT',
      headers: { 'x-user-id': 'u-strict-check', 'Content-Type': 'application/json' },
      body: JSON.stringify({ cigars: [cigar('X', 'Y', '5x50')] }),
    });
    check('with the flag off, an unversioned write is refused', refused.status, 428);
    check('and nothing was written', await dbRevision('u-strict-check'), before);
    const strictStats = await (await fetch(`${strictSrv.url}/revision-stats`,
      { headers: { 'x-ops-token': 'ops-secret-token' } })).json();
    check('refused writes are still recorded for the rollout signal',
      strictStats.last7Days.writes >= 1, true);
    check('stats report the flag as off', strictStats.allowUnversioned, false);
    await strictSrv.close();
  }

  // =========================================================================
  console.log('\nITEM 4 — simultaneous writes at the same base revision');
  const finalRouter = loadRouter(() => 'user-default');
  const finalSrv = await startServer(finalRouter);
  const FPUT = async (userId, cigars, baseRevision) => {
    const res = await fetch(finalSrv.url, {
      method: 'PUT',
      headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cigars, baseRevision }),
    });
    return { status: res.status, body: await res.json() };
  };
  {
    const u = 'u-race';
    await FPUT(u, [cigar('Base', 'Row', '5x50')], 0);
    const base = await dbRevision(u);
    check('base revision established', base, 1);

    // Two writers fire at the same base revision, concurrently.
    const [a, b] = await Promise.all([
      FPUT(u, [cigar('Base', 'Row', '5x50'), cigar('Writer', 'A', '6x52')], base),
      FPUT(u, [cigar('Base', 'Row', '5x50'), cigar('Writer', 'B', '7x54')], base),
    ]);
    const statuses = [a.status, b.status].sort();
    check('EXACTLY ONE SUCCEEDED, ONE WAS REJECTED', statuses, [200, 409]);
    check('revision advanced by exactly one', await dbRevision(u), base + 1);
    check('loser was told the current revision',
      [a, b].find((r) => r.status === 409).body.currentRevision, base + 1);

    const { rows } = await pool.query(
      'SELECT brand, name FROM user_cigars WHERE user_id = $1 ORDER BY brand', [u]
    );
    check('exactly one writer\'s payload landed', rows.length, 2);
    const winner = rows.find((r) => r.brand === 'Writer');
    check('the surviving payload is internally consistent (not interleaved)',
      ['A', 'B'].includes(winner.name), true);
  }

  console.log('\nITEM 4 — higher-concurrency race (10 writers, same base)');
  {
    const u = 'u-race-10';
    await FPUT(u, [cigar('Seed', 'Row', '5x50')], 0);
    const base = await dbRevision(u);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        FPUT(u, [cigar('Seed', 'Row', '5x50'), cigar('W', `n${i}`, '6x52')], base))
    );
    const ok = results.filter((r) => r.status === 200).length;
    const conflicted = results.filter((r) => r.status === 409).length;
    check('exactly one of ten succeeded', ok, 1);
    check('the other nine got 409', conflicted, 9);
    check('revision advanced by exactly one', await dbRevision(u), base + 1);
    check('no torn snapshot — 2 rows, not 11', await rowCount(u), 2);
  }

  console.log('\nITEM 1 — a rejected write leaves no partial state');
  {
    const u = 'u-rollback';
    await FPUT(u, [cigar('Keep', 'Me', '5x50'), cigar('And', 'Me', '6x52')], 0);
    const before = { revision: await dbRevision(u), rows: await rowCount(u) };
    const stale = await FPUT(u, [cigar('Replace', 'Everything', '7x54')], 0); // stale base
    check('stale write rejected', stale.status, 409);
    check('revision unchanged after rejection', await dbRevision(u), before.revision);
    check('rows unchanged after rejection — DELETE never ran', await rowCount(u), before.rows);
  }

  // =========================================================================
  console.log('\nROLLBACK SAFETY — revision-aware client against a PRE-revision server');
  {
    // Simulates rolling the server back to a build that knows nothing about
    // revisions: no X-Collection-Revision header, baseRevision ignored in the
    // body. The new client must degrade to unversioned writes, not break.
    const legacyApp = express();
    legacyApp.use(express.json());
    legacyApp.use(cors());
    legacyApp.get('/api/user/cigars', async (req, res) => {
      const { rows } = await pool.query(
        'SELECT brand, name, length, quantity FROM user_cigars WHERE user_id = $1 ORDER BY brand',
        [req.headers['x-user-id']]
      );
      res.json(rows); // no revision header, as the old build behaved
    });
    legacyApp.put('/api/user/cigars', async (req, res) => {
      const u = req.headers['x-user-id'];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM user_cigars WHERE user_id = $1', [u]);
        for (const c of req.body.cigars) {
          await client.query(
            'INSERT INTO user_cigars (user_id, brand, name, length, quantity) VALUES ($1,$2,$3,$4,$5)',
            [u, c.brand, c.name, c.length, c.quantity ?? 1]
          );
        }
        await client.query('COMMIT');
      } finally { client.release(); }
      res.json({ ok: true }); // no revision in the response
    });
    const oldSrv = await new Promise((r) => {
      const s = legacyApp.listen(0, '127.0.0.1', () => r({
        url: `http://127.0.0.1:${s.address().port}/api/user/cigars`,
        close: () => new Promise((x) => s.close(() => x())),
      }));
    });

    const u = 'u-rollback-compat';
    await pool.query('DELETE FROM user_cigars WHERE user_id = $1', [u]);

    // The client's own code path: read revision, then write with it.
    const read = await fetch(oldSrv.url, { headers: { 'x-user-id': u } });
    const header = read.headers.get('X-Collection-Revision');
    check('old server returns NO revision header', header, null);

    // api/userCigars.js maps a missing header to null, and saveUserCigars then
    // omits baseRevision entirely — the legacy shape the old server accepts.
    const revision = header == null ? null : Number(header);
    const body = revision == null ? { cigars: [cigar('A', 'B', '5x50')] }
                                  : { cigars: [cigar('A', 'B', '5x50')], baseRevision: revision };
    check('client omits baseRevision when no header was returned',
      Object.prototype.hasOwnProperty.call(body, 'baseRevision'), false);

    const wrote = await fetch(oldSrv.url, {
      method: 'PUT',
      headers: { 'x-user-id': u, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    check('REVISION-AWARE CLIENT STILL SYNCS against the old server', wrote.status, 200);
    check('its data landed', await rowCount(u), 1);

    // And an old client against the old server, for completeness.
    const oldClient = await fetch(oldSrv.url, {
      method: 'PUT',
      headers: { 'x-user-id': u, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cigars: [cigar('A', 'B', '5x50'), cigar('C', 'D', '6x52')] }),
    });
    check('old client also still syncs', oldClient.status, 200);
    check('both rows present', await rowCount(u), 2);

    // The hazard to document: while the old server runs, writes do NOT advance
    // the revision, so the stored value goes stale relative to the data.
    const staleRevision = await dbRevision(u);
    check('revision did NOT advance during the rollback window',
      staleRevision === null || staleRevision === 0, true);
    await oldSrv.close();
  }

  console.log('\nMIGRATION — safe to rerun');
  {
    const revBefore = await dbRevision('u-atomic-versioned');
    const obsBefore = (await pool.query('SELECT started_at FROM unversioned_write_observation WHERE id = 1')).rows[0].started_at;
    const telemetryBefore = (await pool.query('SELECT COALESCE(SUM(writes),0)::int AS n FROM unversioned_snapshot_writes')).rows[0].n;

    const migration = readFileSync(path.join(SERVER, 'scripts', 'add-collection-revision.sql'), 'utf8');
    await pool.query(migration);
    await pool.query(migration); // twice, for good measure

    check('rerun preserves an advanced revision', await dbRevision('u-atomic-versioned'), revBefore);
    check('rerun preserves the observation start',
      (await pool.query('SELECT started_at FROM unversioned_write_observation WHERE id = 1')).rows[0].started_at.toISOString(),
      obsBefore.toISOString());
    check('rerun preserves telemetry rows',
      (await pool.query('SELECT COALESCE(SUM(writes),0)::int AS n FROM unversioned_snapshot_writes')).rows[0].n,
      telemetryBefore);
    check('observation table still has exactly one row',
      (await pool.query('SELECT COUNT(*)::int AS n FROM unversioned_write_observation')).rows[0].n, 1);
  }

  await finalSrv.close();
  await pool.end();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(async (err) => {
  console.error('harness error:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
