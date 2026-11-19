#!/usr/bin/env node

/**
 * Verifies the catalog reconciliation rules — which cached rows get deleted when
 * a fresh API response arrives.
 *
 * This is the riskiest part of the sync rewrite: getting it wrong silently
 * deletes catalog rows users rely on. Runs in plain node because
 * lib/catalogReconcile.js has no native imports (same approach as
 * scripts/verify-migration-logic.js). The SQLite write ordering itself still
 * needs a device build.
 *
 * Usage: node scripts/verify-catalog-sync-logic.js
 */

const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const src = readFileSync(join(dirname(__dirname), 'lib', 'catalogReconcile.js'), 'utf8')
  .replace(/^export /gm, '');
// eslint-disable-next-line no-new-func
const mod = new Function(
  `${src}; return { catalogRowKey, brandsInResponse, dedupeIncoming, findStaleCatalogIds, chunkIds,
     isValidCatalogRow, partitionIncoming, planReconciliation };`
)();
const {
  catalogRowKey, brandsInResponse, dedupeIncoming, findStaleCatalogIds, chunkIds,
  isValidCatalogRow, planReconciliation,
} = mod;

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

const row = (id, brand, name, length, size_name = '') => ({ id, brand, name, length, size_name });

console.log('\nRow identity');
check('matches the UNIQUE(brand, name, length, size_name) tuple',
  catalogRowKey(row(1, 'Padron', '1964', '6x52', 'Toro')),
  'Padron\u00001964\u00006x52\u0000Toro');
check('missing size_name collapses to empty, not "undefined"',
  catalogRowKey({ brand: 'A', name: 'B', length: '6x52' }),
  'A\u0000B\u00006x52\u0000');
check('same length, different vitola are distinct rows',
  catalogRowKey(row(1, 'A', 'B', '6x52', 'Toro')) === catalogRowKey(row(2, 'A', 'B', '6x52', 'Torpedo')),
  false);
check('separator cannot be forged by field content',
  catalogRowKey({ brand: 'A|B', name: 'C', length: 'D', size_name: '' }) ===
    catalogRowKey({ brand: 'A', name: 'B|C', length: 'D', size_name: '' }),
  false);

console.log('\nBrands in a response');
check('distinct, order preserved',
  brandsInResponse([row(0, 'Oliva', 'V', '5x54'), row(0, 'Padron', '1964', '6x52'), row(0, 'Oliva', 'G', '6x50')]),
  ['Oliva', 'Padron']);
check('empty and missing brands ignored',
  brandsInResponse([{ brand: '' }, { name: 'x' }, { brand: 'Oliva' }]),
  ['Oliva']);
check('empty response -> no brands', brandsInResponse([]), []);

console.log('\nDeduping the response');
check('duplicate identities collapse to the first',
  dedupeIncoming([row(0, 'A', 'B', '6x52'), row(0, 'A', 'B', '6x52'), row(0, 'A', 'C', '6x52')]).length,
  2);
check('distinct vitolas are kept',
  dedupeIncoming([row(0, 'A', 'B', '6x52', 'Toro'), row(0, 'A', 'B', '6x52', 'Torpedo')]).length,
  2);

console.log('\nStale row detection — the delete list');
check('a vitola dropped by a brand re-import is stale',
  findStaleCatalogIds(
    [row(1, 'Oliva', 'V', '5x54', 'Robusto'), row(2, 'Oliva', 'V', '6x60', 'Gordo')],
    [row(0, 'Oliva', 'V', '5x54', 'Robusto')]
  ),
  [2]);
check('unchanged catalog deletes nothing',
  findStaleCatalogIds(
    [row(1, 'Oliva', 'V', '5x54'), row(2, 'Padron', '1964', '6x52')],
    [row(0, 'Oliva', 'V', '5x54'), row(0, 'Padron', '1964', '6x52')]
  ),
  []);
check('a brand absent from the response is NEVER touched',
  findStaleCatalogIds(
    [row(1, 'Oliva', 'V', '5x54'), row(2, 'Padron', '1964', '6x52')],
    [row(0, 'Oliva', 'V', '5x54')]
  ),
  []);
check('an empty response deletes nothing at all',
  findStaleCatalogIds([row(1, 'Oliva', 'V', '5x54'), row(2, 'Padron', '1964', '6x52')], []),
  []);
check('a renamed vitola removes only the old row',
  findStaleCatalogIds(
    [row(1, 'Oliva', 'V', '5x54', 'Robusto')],
    [row(0, 'Oliva', 'V', '5x54', 'Robusto Classic')]
  ),
  [1]);
check('new rows in the response do not mark anything stale',
  findStaleCatalogIds([row(1, 'Oliva', 'V', '5x54')], [row(0, 'Oliva', 'V', '5x54'), row(0, 'Oliva', 'V', '6x60')]),
  []);
check('rows without an id are skipped rather than producing undefined deletes',
  findStaleCatalogIds([{ brand: 'Oliva', name: 'V', length: '9x99' }], [row(0, 'Oliva', 'V', '5x54')]),
  []);
check('several stale rows across two brands',
  findStaleCatalogIds(
    [row(1, 'Oliva', 'V', '5x54'), row(2, 'Oliva', 'V', '6x60'), row(3, 'Padron', '1964', '6x52'), row(4, 'Padron', '1964', '7x50')],
    [row(0, 'Oliva', 'V', '5x54'), row(0, 'Padron', '1964', '6x52')]
  ),
  [2, 4]);

console.log('\nMalformed rows must never cause a valid delete');
check('a complete row is valid', isValidCatalogRow(row(1, 'Oliva', 'V', '5x54')), true);
check('missing length is invalid', isValidCatalogRow({ brand: 'Oliva', name: 'V' }), false);
check('blank name is invalid', isValidCatalogRow({ brand: 'Oliva', name: '  ', length: '5x54' }), false);
check('non-string field is invalid', isValidCatalogRow({ brand: 'Oliva', name: 'V', length: 5 }), false);
check("a brand with one bad row is quarantined, so its good rows survive",
  planReconciliation({
    existing: [row(1, 'Oliva', 'V', '5x54'), row(2, 'Oliva', 'V', '6x60')],
    incoming: [row(0, 'Oliva', 'V', '5x54'), { brand: 'Oliva', name: 'V' }],
  }).staleIds,
  []);
check('a quarantined brand does not block reconciliation of a clean brand',
  planReconciliation({
    existing: [row(1, 'Oliva', 'V', '6x60'), row(2, 'Padron', '1964', '7x50')],
    incoming: [row(0, 'Oliva', 'V', '5x54'), { brand: 'Oliva', name: 'V' }, row(0, 'Padron', '1964', '6x52')],
  }).staleIds,
  [2]);
check('a row with no identifiable brand aborts the whole reconciliation',
  planReconciliation({
    existing: [row(1, 'Oliva', 'V', '6x60')],
    incoming: [row(0, 'Oliva', 'V', '5x54'), { name: 'mystery' }],
  }),
  { staleIds: [], skipped: 'malformed_response' });
check('an all-malformed response deletes nothing',
  planReconciliation({ existing: [row(1, 'Oliva', 'V', '5x54')], incoming: [{}, {}] }),
  { staleIds: [], skipped: 'malformed_response' });
check('an empty response deletes nothing',
  planReconciliation({ existing: [row(1, 'Oliva', 'V', '5x54')], incoming: [] }),
  { staleIds: [], skipped: 'empty_response' });

console.log('\nTruncated responses must never cause a mass delete');
{
  const existing = Array.from({ length: 200 }, (_, i) => row(i + 1, 'Oliva', `V${i}`, '5x54'));
  const halfGone = existing.slice(0, 80).map((r) => ({ ...r, id: 0 }));
  check('a response under half the cache size is treated as truncated',
    planReconciliation({ existing, incoming: halfGone, cachedCount: 200 }),
    { staleIds: [], skipped: 'response_too_small' });
  const mostlyThere = existing.slice(0, 180).map((r) => ({ ...r, id: 0 }));
  check('a plausible shrink still reconciles',
    planReconciliation({ existing, incoming: mostlyThere, cachedCount: 200 }).staleIds.length,
    20);
}
check('the truncation guard does not fire on a small cache (legitimate early state)',
  planReconciliation({
    existing: [row(1, 'Oliva', 'V', '5x54'), row(2, 'Oliva', 'V', '6x60')],
    incoming: [row(0, 'Oliva', 'V', '5x54')],
    cachedCount: 2,
  }).staleIds,
  [2]);

console.log('\nDelete chunking');
check('under the limit -> one chunk', chunkIds([1, 2, 3]).length, 1);
check('450 ids -> three chunks of 200/200/50',
  chunkIds(Array.from({ length: 450 }, (_, i) => i)).map((c) => c.length),
  [200, 200, 50]);
check('empty -> no chunks', chunkIds([]), []);

// buildCigarKey lives in addCigarValidation.js; exercised here because it is
// the other analytics-visible value changed in this pass.
const vsrc = readFileSync(join(dirname(__dirname), 'lib', 'addCigarValidation.js'), 'utf8')
  .replace(/^export /gm, '');
// eslint-disable-next-line no-new-func
const { buildCigarKey } = new Function(`${vsrc}; return { buildCigarKey };`)();

console.log('\nCigar breakdown key (analytics)');
check('line duplicating the name is dropped',
  buildCigarKey({ brand: 'Arturo Fuente', line: 'Don Carlos', name: 'Don Carlos' }),
  'Arturo Fuente Don Carlos');
check('genuinely distinct segments all survive',
  buildCigarKey({ brand: 'Oliva', line: 'Serie V', name: 'Melanio' }),
  'Oliva Serie V Melanio');
check('case-insensitive dedupe',
  buildCigarKey({ brand: 'Padron', line: 'padron', name: '1964' }),
  'Padron 1964');
check('missing line is fine',
  buildCigarKey({ brand: 'Oliva', name: 'V' }),
  'Oliva V');
check('whitespace trimmed',
  buildCigarKey({ brand: '  Oliva ', line: '', name: ' V ' }),
  'Oliva V');
check('all empty -> empty string', buildCigarKey({}), '');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
