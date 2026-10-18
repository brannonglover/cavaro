#!/usr/bin/env node

/**
 * Network integration tests for the snapshot-replace sync endpoint (audit area 2).
 *
 * Runs a REAL HTTP server over a REAL SQLite store, implementing the same
 * contract as server/routes/userCigars.js (transactional DELETE-all + INSERT,
 * dedupe keeping the first occurrence, quantity clamped). It then drives the
 * concurrent-write sequence to show whether a second device's changes survive.
 *
 * This tests the client's exposure against a faithful stand-in, not against
 * Postgres. The route's own SQL is asserted against the source file so the
 * stand-in cannot silently diverge from what ships.
 *
 * Usage: node --no-warnings scripts/verify-migration-sync.js
 */

const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const ROOT = dirname(__dirname);
const ROUTE_SRC = readFileSync(join(ROOT, 'server', 'routes', 'userCigars.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); }
}

// ---------------------------------------------------------------------------
// Faithful stand-in for PUT /api/user/cigars.
// `revisionCheck` toggles the proposed fix so both behaviours are observable.
// ---------------------------------------------------------------------------

function startServer({ revisionCheck = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE user_cigars (
      user_id TEXT NOT NULL, brand TEXT NOT NULL, name TEXT NOT NULL, length TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1, smoke_notes TEXT
    );
    CREATE TABLE user_snapshot_revision (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL);
  `);

  const revisionOf = (userId) =>
    db.prepare('SELECT revision FROM user_snapshot_revision WHERE user_id = ?').get(userId)?.revision ?? 0;

  const bumpRevision = (userId) => {
    const next = revisionOf(userId) + 1;
    db.prepare(
      `INSERT INTO user_snapshot_revision (user_id, revision) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET revision = ?`
    ).run(userId, next, next);
    return next;
  };

  const replaceSnapshot = (userId, cigars) => {
    // Mirrors the route: dedupe keeping FIRST, clamp quantity, then
    // DELETE-all + INSERT inside one transaction.
    const seen = new Set();
    const unique = [];
    for (const c of cigars) {
      const brand = String(c.brand ?? '').trim();
      const name = String(c.name ?? '').trim();
      const length = String(c.length ?? '').trim();
      if (!brand || !name || !length) continue;
      const key = `${brand}::${name}::${length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const n = parseInt(c.quantity, 10);
      unique.push({ brand, name, length, quantity: Math.max(0, Number.isFinite(n) ? n : 1), smoke_notes: c.smoke_notes ?? null });
    }
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM user_cigars WHERE user_id = ?').run(userId);
      for (const c of unique) {
        db.prepare(
          'INSERT INTO user_cigars (user_id, brand, name, length, quantity, smoke_notes) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(userId, c.brand, c.name, c.length, c.quantity, c.smoke_notes);
      }
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
    return unique.length;
  };

  const server = http.createServer((req, res) => {
    const userId = req.headers['x-user-id'];
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (!userId) return send(401, { error: 'Unauthorized' });

    if (req.method === 'GET') {
      const rows = db.prepare(
        'SELECT brand, name, length, quantity, smoke_notes FROM user_cigars WHERE user_id = ? ORDER BY brand, name, length'
      ).all(userId);
      return send(200, revisionCheck ? { cigars: rows, revision: revisionOf(userId) } : rows);
    }

    if (req.method === 'PUT') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { return send(400, { error: 'bad json' }); }
        if (!Array.isArray(body?.cigars)) return send(400, { error: 'cigars array required' });

        if (revisionCheck) {
          const current = revisionOf(userId);
          if (body.baseRevision !== current) {
            // Someone else wrote since this client read. Refuse rather than
            // clobber, and hand back what it needs to rebuild.
            return send(409, { error: 'revision_conflict', currentRevision: current });
          }
        }
        const count = replaceSnapshot(userId, body.cigars);
        return send(200, { ok: true, count, revision: revisionCheck ? bumpRevision(userId) : undefined });
      });
      return undefined;
    }
    return send(405, { error: 'method not allowed' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        seed: (userId, cigars) => replaceSnapshot(userId, cigars),
        close: () => new Promise((r) => server.close(() => { db.close(); r(); })),
      });
    });
  });
}

const get = async (url, userId) =>
  (await fetch(url, { headers: { 'x-user-id': userId } })).json();

const put = async (url, userId, cigars, baseRevision) => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cigars, baseRevision }),
  });
  return { status: res.status, body: await res.json() };
};

const cigar = (brand, name, length, extra = {}) => ({ brand, name, length, quantity: 1, ...extra });

(async () => {
  // =========================================================================
  // The endpoint was unguarded when this suite was written; Phase 3 added the
  // revision check. These assertions now pin the GUARDED contract. The
  // lost-update section below still drives an unguarded stand-in, to show what
  // the guard prevents — see scripts/verify-revision-e2e.js for the real route
  // under concurrency.
  console.log('\nAREA 2 — endpoint is now revision-guarded');
  {
    const norm = ROUTE_SRC.replace(/\s+/g, ' ');
    check('route still deletes the whole snapshot before inserting',
      norm.includes("DELETE FROM user_cigars WHERE user_id = $1"), true);
    check('route now takes a baseRevision precondition',
      ROUTE_SRC.includes('baseRevision'), true);
    check('route returns 409 on a stale write',
      ROUTE_SRC.includes("status(409)"), true);
    check('409 path rolls back before responding',
      norm.includes("await client.query('ROLLBACK'); return res.status(409)"), true);
    check('route dedupes keeping the first occurrence',
      norm.includes('if (seen.has(key)) continue;'), true);
  }

  // =========================================================================
  console.log('\nAREA 2 — lost update, reproduced over real HTTP');
  {
    const srv = await startServer({ revisionCheck: false });
    const U = 'user-1';
    srv.seed(U, [cigar('Padron', '1964', '6x52', { quantity: 5 })]);

    // T0: the migrating device reads its snapshot.
    const t0 = await get(`${srv.url}/`, U);
    check('migrating device sees 1 cigar at T0', t0.length, 1);

    // T1: a SECOND device adds a cigar directly.
    srv.seed(U, [...t0, cigar('Oliva', 'Serie V', '5x54', { quantity: 2 })]);
    check('server now holds 2 cigars', (await get(`${srv.url}/`, U)).length, 2);

    // T2: the migrating device pushes the snapshot it computed from T0.
    const resolved = [cigar('Padron', '1964', '6x52', { quantity: 8 })];
    await put(`${srv.url}/`, U, resolved);

    const after = await get(`${srv.url}/`, U);
    check('push succeeded with no warning', after.length, 1);
    check('the second device\'s cigar was DELETED — lost update',
      after.some((c) => c.brand === 'Oliva'), false);
    check('only the migrating device\'s resolved row remains',
      after.map((c) => `${c.brand}:${c.quantity}`), ['Padron:8']);
    await srv.close();
  }

  // =========================================================================
  console.log('\nAREA 2 — proposed revision check refuses the stale write');
  {
    const srv = await startServer({ revisionCheck: true });
    const U = 'user-2';
    srv.seed(U, [cigar('Padron', '1964', '6x52', { quantity: 5 })]);

    const t0 = await get(`${srv.url}/`, U);
    const baseRevision = t0.revision;
    check('GET returns a revision', typeof baseRevision, 'number');

    // Second device writes through the same guarded endpoint, bumping revision.
    const other = await put(`${srv.url}/`, U, [...t0.cigars, cigar('Oliva', 'Serie V', '5x54', { quantity: 2 })], baseRevision);
    check('second device write accepted', other.status, 200);
    check('revision advanced', other.body.revision > baseRevision, true);

    // Migrating device pushes against the now-stale revision.
    const stale = await put(`${srv.url}/`, U, [cigar('Padron', '1964', '6x52', { quantity: 8 })], baseRevision);
    check('stale push is rejected with 409', stale.status, 409);
    check('409 reports the current revision', stale.body.currentRevision, other.body.revision);

    const preserved = await get(`${srv.url}/`, U);
    check('nothing was overwritten — both cigars intact', preserved.cigars.length, 2);
    check('second device\'s cigar survived',
      preserved.cigars.some((c) => c.brand === 'Oliva'), true);

    // Safe retry: refetch, rebuild including the new remote row, push again.
    const rebuilt = [
      cigar('Padron', '1964', '6x52', { quantity: 8 }), // resolved answer kept
      ...preserved.cigars.filter((c) => c.brand !== 'Padron'),
    ];
    const retry = await put(`${srv.url}/`, U, rebuilt, preserved.revision);
    check('retry at the fresh revision succeeds', retry.status, 200);

    const final = await get(`${srv.url}/`, U);
    check('final snapshot has both cigars', final.cigars.length, 2);
    check('the user\'s resolved quantity is preserved through the retry',
      final.cigars.find((c) => c.brand === 'Padron').quantity, 8);
    check('the other device\'s cigar is preserved through the retry',
      final.cigars.find((c) => c.brand === 'Oliva').quantity, 2);
    await srv.close();
  }

  // =========================================================================
  console.log('\nAREA 2 — answered conflicts survive a plan rebuild');
  {
    // restageMigration must keep an answer when both sides are unchanged, and
    // must invalidate it when the server value moved under the user's feet.
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE migration_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, migration_id TEXT NOT NULL,
        brand TEXT NOT NULL, name TEXT NOT NULL, length TEXT NOT NULL, field TEXT NOT NULL,
        guest_value TEXT, server_value TEXT, resolution TEXT, resolved_value TEXT,
        created_at TEXT NOT NULL, resolved_at TEXT,
        UNIQUE(migration_id, brand, name, length, field)
      );
    `);
    const now = new Date(0).toISOString();
    const insert = (field, guest, server, resolution) => db.prepare(
      `INSERT INTO migration_conflicts
         (migration_id, brand, name, length, field, guest_value, server_value, resolution, created_at)
       VALUES ('run', 'A', 'B', '5x50', ?, ?, ?, ?, ?)`
    ).run(field, guest, server, resolution, now);

    insert('quantity', '3', '5', 'server');        // answered, server value will change
    insert('smoke_notes', 'g', 's', 'both');       // answered, unchanged

    // Rebuild: quantity's server value is now 9, smoke_notes unchanged.
    const rebuild = [
      { field: 'quantity', guest_value: '3', server_value: '9' },
      { field: 'smoke_notes', guest_value: 'g', server_value: 's' },
    ];
    for (const r of rebuild) {
      db.prepare(
        `UPDATE migration_conflicts
           SET resolution = CASE WHEN guest_value IS ? AND server_value IS ? THEN resolution ELSE NULL END,
               resolved_value = CASE WHEN guest_value IS ? AND server_value IS ? THEN resolved_value ELSE NULL END,
               server_value = ?
         WHERE migration_id = 'run' AND brand = 'A' AND name = 'B' AND length = '5x50' AND field = ?`
      ).run(r.guest_value, r.server_value, r.guest_value, r.server_value, r.server_value, r.field);
    }

    const row = (field) => db.prepare(
      'SELECT resolution, server_value FROM migration_conflicts WHERE field = ?'
    ).get(field);

    check('answer is DISCARDED when the server value changed', row('quantity').resolution, null);
    check('the conflict now carries the fresh server value', row('quantity').server_value, '9');
    check('answer is PRESERVED when both sides are unchanged', row('smoke_notes').resolution, 'both');
    check('no conflict rows were duplicated by the rebuild',
      db.prepare('SELECT COUNT(*) AS n FROM migration_conflicts').get().n, 2);
    db.close();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
