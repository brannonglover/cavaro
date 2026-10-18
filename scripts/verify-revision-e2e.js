#!/usr/bin/env node

/**
 * End-to-end concurrency test for the revision-guarded snapshot endpoint.
 *
 * This loads the REAL server/routes/userCigars.js and serves it over a real
 * HTTP listener. Postgres is replaced by a thin adapter over node:sqlite that
 * translates the handful of statements the route issues ($n placeholders,
 * NOW(), RETURNING, transaction verbs) — so the route's own validation,
 * dedupe, transaction boundaries and 409 path are what execute, not a
 * reimplementation of them.
 *
 * Usage: node --no-warnings scripts/verify-revision-e2e.js
 */

const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.dirname(__dirname);
const SERVER = path.join(ROOT, 'server');

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); }
}

// ---------------------------------------------------------------------------
// Postgres-shaped adapter over SQLite.
// ---------------------------------------------------------------------------

function makePool() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE user_cigars (
      user_id TEXT NOT NULL, brand TEXT NOT NULL, name TEXT NOT NULL, length TEXT NOT NULL,
      line TEXT, description TEXT, wrapper TEXT, binder TEXT, filler TEXT, image TEXT,
      collection TEXT, is_favorite INTEGER, quantity INTEGER,
      smoked_date TEXT, smoke_notes TEXT, favorite_notes TEXT,
      flavor_profile TEXT, strength_profile TEXT, construction_quality TEXT,
      flavor_changes TEXT, date_added TEXT, humidor_name TEXT, updated_at TEXT
    );
    CREATE TABLE user_collection_revision (
      user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
  `);

  const translate = (sql) => sql
    .replace(/\$(\d+)/g, '?')
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/ON CONFLICT \(user_id\) DO UPDATE SET user_id = EXCLUDED\.user_id/i,
             'ON CONFLICT(user_id) DO UPDATE SET user_id = user_id');

  // Postgres binds JS booleans and undefined directly; node:sqlite does not.
  // The route legitimately passes is_favorite as a boolean, so coerce at the
  // driver boundary rather than changing the route to suit the test.
  const bind = (v) => {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === undefined) return null;
    return v;
  };

  const query = (sql, params = []) => {
    params = (params ?? []).map(bind);
    const text = String(sql).trim();
    const verb = text.split(/\s+/)[0].toUpperCase();
    if (verb === 'BEGIN' || verb === 'COMMIT' || verb === 'ROLLBACK') {
      db.exec(verb);
      return { rows: [], rowCount: 0 };
    }
    const translated = translate(text);
    const stmt = db.prepare(translated);
    if (/^SELECT/i.test(translated) || /RETURNING/i.test(translated)) {
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...params);
    return { rows: [], rowCount: Number(info.changes ?? 0) };
  };

  return {
    query: async (sql, params) => query(sql, params),
    connect: async () => ({ query: async (sql, params) => query(sql, params), release: () => {} }),
    __db: db,
    __seed: (userId, rows) => {
      db.prepare('DELETE FROM user_cigars WHERE user_id = ?').run(userId);
      for (const r of rows) {
        db.prepare(
          `INSERT INTO user_cigars (user_id, brand, name, length, quantity, smoke_notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(userId, r.brand, r.name, r.length, r.quantity ?? 1, r.smoke_notes ?? null);
      }
    },
    __revision: (userId) =>
      db.prepare('SELECT revision FROM user_collection_revision WHERE user_id = ?').get(userId)?.revision ?? 0,
    __setRevision: (userId, revision) =>
      db.prepare(
        `INSERT INTO user_collection_revision (user_id, revision, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET revision = ?`
      ).run(userId, revision, revision),
    __rows: (userId) =>
      db.prepare('SELECT brand, name, length, quantity, smoke_notes FROM user_cigars WHERE user_id = ? ORDER BY brand').all(userId),
  };
}

// Inject the adapter and a stub auth resolver in place of the real modules,
// then require the route itself unmodified.
function loadRoute(pool, currentUserId) {
  const pgPath = require.resolve(path.join(SERVER, 'config', 'postgres'));
  const authPath = require.resolve(path.join(SERVER, 'lib', 'auth'));

  for (const p of [pgPath, authPath, require.resolve(path.join(SERVER, 'routes', 'userCigars'))]) {
    delete require.cache[p];
  }
  require.cache[pgPath] = new Module(pgPath, null);
  require.cache[pgPath].exports = pool;
  require.cache[pgPath].loaded = true;

  require.cache[authPath] = new Module(authPath, null);
  require.cache[authPath].exports = { resolveUserId: async () => currentUserId() };
  require.cache[authPath].loaded = true;

  return require(path.join(SERVER, 'routes', 'userCigars'));
}

function startServer(router) {
  const express = require(path.join(SERVER, 'node_modules', 'express'));
  const app = express();
  app.use(express.json());
  app.use('/api/user/cigars', router);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}/api/user/cigars`,
      close: () => new Promise((r) => server.close(() => r())),
    }));
  });
}

const cigar = (brand, name, length, extra = {}) => ({ brand, name, length, quantity: 1, ...extra });

(async () => {
  const pool = makePool();
  let userId = 'user-1';
  const router = loadRoute(pool, () => userId);
  const srv = await startServer(router);

  const GET = async () => {
    const res = await fetch(srv.url);
    return {
      status: res.status,
      revision: res.headers.get('X-Collection-Revision'),
      cigars: await res.json(),
    };
  };
  const PUT = async (cigars, baseRevision) => {
    const body = baseRevision === undefined ? { cigars } : { cigars, baseRevision };
    const res = await fetch(srv.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, revision: res.headers.get('X-Collection-Revision'), body: await res.json() };
  };

  // =========================================================================
  console.log('\nReal route boots and serves');
  {
    pool.__seed(userId, [cigar('Padron', '1964', '6x52', { quantity: 5 })]);
    const r = await GET();
    check('GET returns 200', r.status, 200);
    check('GET returns the seeded cigar', r.cigars.length, 1);
    check('GET exposes X-Collection-Revision', r.revision, '0');
  }

  console.log('\nbaseRevision is required');
  {
    const r = await PUT([cigar('A', 'B', '5x50')]); // omitted entirely
    check('missing baseRevision is refused with 428', r.status, 428);
    check('server data untouched by the refusal', pool.__rows(userId).length, 1);
    check('revision not bumped', pool.__revision(userId), 0);
  }

  console.log('\nStale client cannot delete another device\'s newer changes');
  {
    // Device 1 (mid-migration) reads the snapshot.
    const t0 = await GET();
    const staleRevision = Number(t0.revision);
    check('device 1 holds revision 0', staleRevision, 0);

    // Device 2 writes through the same guarded endpoint.
    const d2 = await PUT(
      [cigar('Padron', '1964', '6x52', { quantity: 5 }), cigar('Oliva', 'Serie V', '5x54', { quantity: 2 })],
      staleRevision
    );
    check('device 2 write accepted', d2.status, 200);
    check('revision advanced to 1', pool.__revision(userId), 1);
    check('server now holds 2 cigars', pool.__rows(userId).length, 2);

    // Device 1 pushes its stale snapshot, which omits Oliva entirely.
    const stale = await PUT([cigar('Padron', '1964', '6x52', { quantity: 8 })], staleRevision);
    check('stale full-replace rejected with 409', stale.status, 409);
    check('409 reports the current revision', stale.body.currentRevision, 1);
    check('THE OTHER DEVICE\'S CIGAR SURVIVED', pool.__rows(userId).map((r) => r.brand), ['Oliva', 'Padron']);
    check('rejected write did not modify quantities',
      pool.__rows(userId).find((r) => r.brand === 'Padron').quantity, 5);
    check('rejected write did not bump the revision', pool.__revision(userId), 1);
  }

  console.log('\nSafe retry at the fresh revision');
  {
    const fresh = await GET();
    check('refetch sees both cigars', fresh.cigars.length, 2);
    const rebuilt = [
      cigar('Padron', '1964', '6x52', { quantity: 8 }),           // resolved answer kept
      ...fresh.cigars.filter((c) => c.brand !== 'Padron'),         // newer remote row carried
    ];
    const retry = await PUT(rebuilt, Number(fresh.revision));
    check('retry accepted', retry.status, 200);
    check('revision advanced again', pool.__revision(userId), 2);

    const after = pool.__rows(userId);
    check('both cigars present after retry', after.length, 2);
    check('user\'s resolved quantity preserved', after.find((r) => r.brand === 'Padron').quantity, 8);
    check('other device\'s cigar preserved', after.find((r) => r.brand === 'Oliva').quantity, 2);
  }

  console.log('\nSequential writes at the correct revision keep working (normal sync)');
  {
    for (let i = 0; i < 3; i++) {
      const cur = await GET();
      const r = await PUT(cur.cigars, Number(cur.revision));
      check(`normal sync push ${i + 1} accepted`, r.status, 200);
    }
    check('revision advanced once per push', pool.__revision(userId), 5);
    check('row count stable across normal syncs', pool.__rows(userId).length, 2);
  }

  console.log('\nRoute still enforces its original contract');
  {
    const cur = await GET();
    const dupes = [
      cigar('Dup', 'Same', '5x50', { quantity: 3 }),
      cigar('Dup', 'Same', '5x50', { quantity: 9 }),
      cigar('', 'NoBrand', '5x50'),
      cigar('Neg', 'Qty', '5x50', { quantity: -4 }),
    ];
    const r = await PUT(dupes, Number(cur.revision));
    check('write accepted', r.status, 200);
    const rows = pool.__rows(userId);
    check('duplicate identity collapsed to one row',
      rows.filter((x) => x.brand === 'Dup').length, 1);
    check('first occurrence won', rows.find((x) => x.brand === 'Dup').quantity, 3);
    check('row without a brand dropped', rows.some((x) => x.name === 'NoBrand'), false);
    check('negative quantity clamped to 0', rows.find((x) => x.brand === 'Neg').quantity, 0);
  }

  console.log('\nRevision is per-user');
  {
    userId = 'user-2';
    const other = await GET();
    check('a different account starts at revision 0', other.revision, '0');
    check('and sees no cigars', other.cigars.length, 0);
    const r = await PUT([cigar('Solo', 'Cigar', '5x50')], 0);
    check('its own write succeeds at revision 0', r.status, 200);
    userId = 'user-1';
    check('user-1 revision untouched by user-2', pool.__revision('user-1'), 6);
  }

  await srv.close();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error('harness error:', err); process.exit(1); });
