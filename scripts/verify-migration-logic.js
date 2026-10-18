#!/usr/bin/env node

/**
 * Verifies the guest-migration identity and confirmation rules.
 *
 * Covers the cases that decide whether local data may be deleted: duplicates,
 * near-miss spellings, partial pushes, and incomplete rows. Runs in plain node
 * because lib/cigarIdentity.js has no native imports — the SQLite merge and the
 * live Supabase round trip still need a device build (see docs/ANALYTICS.md and
 * the device test matrix).
 *
 * Usage: node scripts/verify-migration-logic.js
 */

const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

// Load the ES module source without a bundler: strip `export ` and eval.
const src = readFileSync(join(dirname(__dirname), 'lib', 'cigarIdentity.js'), 'utf8')
  .replace(/^export /gm, '');
// eslint-disable-next-line no-new-func
const mod = new Function(`${src}; return { cigarIdentityKey, hasCigarIdentity, findCigarsMissingFromCloud };`)();
const { cigarIdentityKey, hasCigarIdentity, findCigarsMissingFromCloud } = mod;

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

const cigar = (brand, name, length, extra = {}) => ({ brand, name, length, ...extra });

console.log('\nIdentity key');
check('trims surrounding whitespace',
  cigarIdentityKey(cigar('  Padron ', ' 1964 ', ' 6x52 ')),
  'Padron|1964|6x52');
check('missing fields collapse to empty segments',
  cigarIdentityKey({ brand: 'Padron' }),
  'Padron||');
check('size spacing is NOT normalised (two distinct cigars)',
  cigarIdentityKey(cigar('Padron', '1964', '6x52')) === cigarIdentityKey(cigar('Padron', '1964', '6 x 52')),
  false);
check('case is NOT normalised (two distinct cigars)',
  cigarIdentityKey(cigar('padron', '1964', '6x52')) === cigarIdentityKey(cigar('Padron', '1964', '6x52')),
  false);

console.log('\nIdentity completeness');
check('all three fields present', hasCigarIdentity(cigar('A', 'B', '6x52')), true);
check('missing length rejected', hasCigarIdentity(cigar('A', 'B', '')), false);
check('whitespace-only name rejected', hasCigarIdentity(cigar('A', '   ', '6x52')), false);

console.log('\nMigration confirmation — guest to NEW account (cloud empty)');
{
  const local = [cigar('Padron', '1964', '6x52'), cigar('Oliva', 'Serie V', '5x54')];
  check('nothing on server yet -> both reported missing',
    findCigarsMissingFromCloud(local, []).map(cigarIdentityKey),
    ['Padron|1964|6x52', 'Oliva|Serie V|5x54']);
  check('after a successful push -> nothing missing',
    findCigarsMissingFromCloud(local, local),
    []);
}

console.log('\nMigration confirmation — guest to EXISTING account (merge)');
{
  const local = [cigar('Padron', '1964', '6x52'), cigar('Oliva', 'Serie V', '5x54')];
  const remote = [cigar('Padron', '1964', '6x52'), cigar('My Father', 'Le Bijou', '6x54')];
  check('overlapping cigar counts as present',
    findCigarsMissingFromCloud(local, remote).map(cigarIdentityKey),
    ['Oliva|Serie V|5x54']);
  check('server-only cigars are not reported (one-directional check)',
    findCigarsMissingFromCloud(local, remote).length,
    1);
}

console.log('\nMigration confirmation — duplicates');
{
  const local = [cigar('Padron', '1964', '6x52'), cigar('Padron', '1964', '6x52')];
  check('duplicate local rows satisfied by one server row',
    findCigarsMissingFromCloud(local, [cigar('Padron', '1964', '6x52')]),
    []);
  check('near-miss spelling is NOT satisfied (stays missing)',
    findCigarsMissingFromCloud([cigar('Padron', '1964', '6 x 52')], [cigar('Padron', '1964', '6x52')]).map(cigarIdentityKey),
    ['Padron|1964|6 x 52']);
}

console.log('\nMigration confirmation — partial / failed push');
{
  const local = [cigar('A', 'One', '5x50'), cigar('B', 'Two', '6x52'), cigar('C', 'Three', '7x54')];
  check('partial push leaves the remainder missing',
    findCigarsMissingFromCloud(local, [cigar('A', 'One', '5x50')]).map(cigarIdentityKey),
    ['B|Two|6x52', 'C|Three|7x54']);
  check('null remote (request failed) -> everything missing',
    findCigarsMissingFromCloud(local, null).length,
    3);
  check('undefined remote -> everything missing',
    findCigarsMissingFromCloud(local, undefined).length,
    3);
}

console.log('\nMigration confirmation — incomplete rows are ignored');
{
  const local = [cigar('A', 'One', '5x50'), cigar('B', '', '6x52')];
  check('row without a full identity is not required on the server',
    findCigarsMissingFromCloud(local, [cigar('A', 'One', '5x50')]),
    []);
  check('empty local set is trivially satisfied',
    findCigarsMissingFromCloud([], []),
    []);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
