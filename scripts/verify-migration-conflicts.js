#!/usr/bin/env node

/**
 * Tests for guest→account conflict resolution (requirement 9).
 *
 * Covers overlapping quantities, conflicting notes, interrupted resolution,
 * retries/idempotency, and account switching. Runs in plain node because
 * lib/migrationConflicts.js and lib/cigarIdentity.js have no native imports;
 * the SQLite and Supabase round trips still need a device build.
 *
 * Usage: node scripts/verify-migration-conflicts.js
 */

const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const ROOT = dirname(__dirname);

// Load the two ES modules without a bundler, resolving the one import between them.
function loadModules() {
  const identitySrc = readFileSync(join(ROOT, 'lib', 'cigarIdentity.js'), 'utf8')
    .replace(/^export /gm, '');
  const conflictsSrc = readFileSync(join(ROOT, 'lib', 'migrationConflicts.js'), 'utf8')
    .replace(/^import .*?;$/gms, '')
    .replace(/^export /gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(`
    ${identitySrc}
    ${conflictsSrc}
    return {
      cigarIdentityKey, hasCigarIdentity, findCigarsMissingFromCloud,
      isBlank, combineText, conflictKey, mergeField, collapseByIdentity,
      detectMigrationPlan, applyMigrationPlan, unresolvedConflicts,
      groupConflictsByCigar, CONFLICT_FIELDS, TEXT_CONFLICT_FIELDS,
      CATALOG_FIELDS, MERGED_FROM_LABEL,
    };
  `)();
}

const M = loadModules();

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); }
}

const cigar = (brand, name, length, extra = {}) => ({
  brand, name, length, collection: 'cavaro', is_favorite: 0, quantity: 1, ...extra,
});
const conflictsFor = (plan, field) => plan.conflicts.filter((c) => c.field === field);
const resolve = (plan, field, resolution, resolved_value = null) => {
  const out = {};
  for (const c of conflictsFor(plan, field)) {
    out[M.conflictKey(c.brand, c.name, c.length, c.field)] = { resolution, resolved_value };
  }
  return out;
};
const resolveAll = (plan, resolution, resolved_value = null) => {
  const out = {};
  for (const c of plan.conflicts) {
    out[M.conflictKey(c.brand, c.name, c.length, c.field)] = { resolution, resolved_value };
  }
  return out;
};

// ---------------------------------------------------------------------------
console.log('\nOverlapping quantities (req. 1, 4)');
{
  const guest = [cigar('Padron', '1964', '6x52', { quantity: 3 })];
  const server = [cigar('Padron', '1964', '6x52', { quantity: 5 })];
  const plan = M.detectMigrationPlan(guest, server);

  check('differing quantity is a conflict', conflictsFor(plan, 'quantity').length, 1);
  check('both values are preserved on the conflict',
    conflictsFor(plan, 'quantity').map((c) => [c.guest_value, c.server_value]),
    [[3, 5]]);
  check('NOT auto-summed to 8 and NOT maxed to 5 — holds guest value while undecided',
    M.applyMigrationPlan(plan, {})[0].quantity,
    3);
  check('choose guest', M.applyMigrationPlan(plan, resolve(plan, 'quantity', 'guest'))[0].quantity, 3);
  check('choose existing account', M.applyMigrationPlan(plan, resolve(plan, 'quantity', 'server'))[0].quantity, 5);
  check('choose manual combined total',
    M.applyMigrationPlan(plan, resolve(plan, 'quantity', 'manual', 8))[0].quantity, 8);
  check('manual zero is honoured, not treated as blank',
    M.applyMigrationPlan(plan, resolve(plan, 'quantity', 'manual', 0))[0].quantity, 0);

  const equal = M.detectMigrationPlan(
    [cigar('A', 'B', '5x50', { quantity: 2 })],
    [cigar('A', 'B', '5x50', { quantity: 2 })]
  );
  check('equal quantities produce no conflict', equal.conflicts.length, 0);
}

// ---------------------------------------------------------------------------
console.log('\nConflicting notes (req. 5)');
{
  const guest = [cigar('Oliva', 'Serie V', '5x54', { smoke_notes: 'Cocoa, pepper' })];
  const server = [cigar('Oliva', 'Serie V', '5x54', { smoke_notes: 'Leather finish' })];
  const plan = M.detectMigrationPlan(guest, server);

  check('differing notes are a conflict', conflictsFor(plan, 'smoke_notes').length, 1);
  const both = M.applyMigrationPlan(plan, resolve(plan, 'smoke_notes', 'both'))[0].smoke_notes;
  check('keep-both retains the guest text', both.includes('Cocoa, pepper'), true);
  check('keep-both retains the account text', both.includes('Leather finish'), true);
  check('keep-both labels the merged section', both.includes(M.MERGED_FROM_LABEL), true);
  check('choose one side discards nothing from the record',
    conflictsFor(plan, 'smoke_notes').map((c) => [c.guest_value, c.server_value]),
    [['Cocoa, pepper', 'Leather finish']]);

  const oneSided = M.detectMigrationPlan(
    [cigar('A', 'B', '5x50', { smoke_notes: 'only guest' })],
    [cigar('A', 'B', '5x50', { smoke_notes: '' })]
  );
  check('blank on one side auto-merges, no question asked', oneSided.conflicts.length, 0);
  check('auto-merge takes the non-blank value',
    M.applyMigrationPlan(oneSided, {})[0].smoke_notes, 'only guest');
}

// ---------------------------------------------------------------------------
console.log('\nAuto-merge rules (req. 3)');
{
  const plan = M.detectMigrationPlan(
    [cigar('A', 'B', '5x50', { is_favorite: 1, date_added: '2026-03-01', wrapper: 'Maduro' })],
    [cigar('A', 'B', '5x50', { is_favorite: 0, date_added: '2026-01-15', wrapper: 'Habano' })]
  );
  const row = M.applyMigrationPlan(plan, {})[0];
  check('is_favorite ORs to true', row.is_favorite, 1);
  check('date_added takes the earlier date', row.date_added, '2026-01-15');
  check('catalog field prefers server', row.wrapper, 'Habano');
  check('none of those asked the user', plan.conflicts.length, 0);

  const coll = M.detectMigrationPlan(
    [cigar('A', 'B', '5x50', { collection: 'dislikes' })],
    [cigar('A', 'B', '5x50', { collection: 'cavaro' })]
  );
  check('collection difference IS asked (never silently re-shelved)',
    conflictsFor(coll, 'collection').length, 1);
  check('undecided collection holds the guest choice',
    M.applyMigrationPlan(coll, {})[0].collection, 'dislikes');
}

// ---------------------------------------------------------------------------
console.log('\nInterrupted conflict resolution (req. 2, 8)');
{
  const guest = [cigar('A', 'B', '5x50', { quantity: 2, smoke_notes: 'guest note' })];
  const server = [cigar('A', 'B', '5x50', { quantity: 9, smoke_notes: 'server note' })];
  const plan = M.detectMigrationPlan(guest, server);
  check('two independent conflicts on one cigar', plan.conflicts.length, 2);

  // User answers quantity, then the app is killed before answering notes.
  const partial = resolve(plan, 'quantity', 'server');
  const row = M.applyMigrationPlan(plan, partial)[0];
  check('answered field uses the choice', row.quantity, 9);
  check('unanswered field still holds the guest value — nothing lost', row.smoke_notes, 'guest note');
  check('both sides of the unanswered conflict remain recoverable',
    conflictsFor(plan, 'smoke_notes').map((c) => [c.guest_value, c.server_value]),
    [['guest note', 'server note']]);
  check('unresolved count reflects what is left',
    M.unresolvedConflicts(plan.conflicts.map((c) => ({
      ...c,
      resolution: partial[M.conflictKey(c.brand, c.name, c.length, c.field)]?.resolution ?? null,
    }))).length,
    1);
}

// ---------------------------------------------------------------------------
console.log('\nRetries and idempotency (req. 7)');
{
  const guest = [cigar('A', 'B', '5x50', { quantity: 2 }), cigar('C', 'D', '6x52', { quantity: 4 })];
  const server = [cigar('A', 'B', '5x50', { quantity: 7 })];

  const first = M.detectMigrationPlan(guest, server);
  const second = M.detectMigrationPlan(guest, server);
  check('detection is deterministic', JSON.stringify(first), JSON.stringify(second));

  const res = resolveAll(first, 'manual', 5);
  const a = M.applyMigrationPlan(first, res);
  const b = M.applyMigrationPlan(first, res);
  check('apply is a pure function of snapshot + resolutions', JSON.stringify(a), JSON.stringify(b));
  check('re-applying does not duplicate rows', a.length, 2);
  check('guest-only cigar survives untouched',
    a.find((c) => c.brand === 'C').quantity, 4);

  // Re-deriving from the snapshot after a partial local write still gives 2 rows.
  const third = M.applyMigrationPlan(M.detectMigrationPlan(guest, server), res);
  check('re-derive after interruption yields the same row count', third.length, 2);
  check('identity set is unchanged across retries',
    third.map((c) => M.cigarIdentityKey(c)).sort(),
    ['A|B|5x50', 'C|D|6x52']);
}

// ---------------------------------------------------------------------------
console.log('\nDuplicate local rows collapse (req. 7)');
{
  const guest = [
    cigar('A', 'B', '5x50', { quantity: 2, smoke_notes: '' }),
    cigar('A', 'B', '5x50', { quantity: 3, smoke_notes: 'from the duplicate' }),
  ];
  const collapsed = M.collapseByIdentity(guest);
  check('duplicates collapse to one row', collapsed.length, 1);
  check('first occurrence wins for set fields', collapsed[0].quantity, 2);
  check('blanks are backfilled from the duplicate', collapsed[0].smoke_notes, 'from the duplicate');

  const plan = M.detectMigrationPlan(guest, []);
  check('server-empty migration of duplicates yields one cigar',
    M.applyMigrationPlan(plan, {}).length, 1);
}

// ---------------------------------------------------------------------------
console.log('\nAccount switching (req. 9)');
{
  // Conflict keys embed the cigar identity, not the account, so a plan staged
  // for one account must never satisfy another's. The run's user_id scoping is
  // enforced in lib/guestMigration.js; here we prove the keys do not collide
  // and that resolutions cannot leak across differing server snapshots.
  const guest = [cigar('A', 'B', '5x50', { quantity: 2 })];
  const accountOne = [cigar('A', 'B', '5x50', { quantity: 7 })];
  const accountTwo = [cigar('A', 'B', '5x50', { quantity: 11 })];

  const planOne = M.detectMigrationPlan(guest, accountOne);
  const planTwo = M.detectMigrationPlan(guest, accountTwo);

  check('same cigar yields the same conflict key in both accounts',
    M.conflictKey('A', 'B', '5x50', 'quantity'), 'A|B|5x50|quantity');
  check('but the staged server values differ per account',
    [conflictsFor(planOne, 'quantity')[0].server_value,
     conflictsFor(planTwo, 'quantity')[0].server_value],
    [7, 11]);

  // A "server" resolution recorded against account one, replayed against
  // account two's plan, resolves to account two's value — which is why
  // resolutions are stored per migration_id and runs are scoped by user_id.
  const res = resolve(planOne, 'quantity', 'server');
  check('replaying a resolution against another account uses THAT account value',
    M.applyMigrationPlan(planTwo, res)[0].quantity, 11);
  check('guest value is identical in both plans, so nothing guest-side leaks',
    [conflictsFor(planOne, 'quantity')[0].guest_value,
     conflictsFor(planTwo, 'quantity')[0].guest_value],
    [2, 2]);
}

// ---------------------------------------------------------------------------
console.log('\nServer-only and guest-only cigars');
{
  const plan = M.detectMigrationPlan(
    [cigar('G', 'Only', '5x50', { quantity: 1 })],
    [cigar('S', 'Only', '6x52', { quantity: 4 })]
  );
  check('no conflicts when identities do not overlap', plan.conflicts.length, 0);
  const rows = M.applyMigrationPlan(plan, {});
  check('both cigars are kept', rows.length, 2);
  check('guest-only keeps its quantity', rows.find((r) => r.brand === 'G').quantity, 1);
  check('server-only keeps its quantity', rows.find((r) => r.brand === 'S').quantity, 4);
  check('origin is tracked for display', plan.rows.map((r) => r.origin), ['guest', 'server']);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
