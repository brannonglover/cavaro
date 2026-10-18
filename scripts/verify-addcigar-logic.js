#!/usr/bin/env node

/**
 * Verifies the Add Cigar validation, error-classification, and analytics-shaping
 * rules that decide whether a save attempt proceeds and what gets reported.
 *
 * Runs in plain node because lib/addCigarValidation.js has no React or native
 * imports — the same trick scripts/verify-migration-logic.js uses. The screen
 * wiring (spinner, retry banner, focus scroll, double-tap guard) still needs a
 * device build; see the matrix at the bottom of this file's output.
 *
 * Usage: node scripts/verify-addcigar-logic.js
 */

const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');

const src = readFileSync(join(dirname(__dirname), 'lib', 'addCigarValidation.js'), 'utf8')
  .replace(/^export /gm, '');
// eslint-disable-next-line no-new-func
const mod = new Function(`${src}; return {
  isValidSizeFormat, missingCatalogFields, missingCustomFields, validationReason,
  missingFieldsMessage, categorizeError, catalogState, progressStage, fieldLabel,
};`)();
const {
  isValidSizeFormat,
  missingCatalogFields,
  missingCustomFields,
  validationReason,
  missingFieldsMessage,
  categorizeError,
  catalogState,
  progressStage,
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

console.log('\nRequired catalog fields (scenarios 3 and 4)');
check('nothing selected -> all three, in screen order',
  missingCatalogFields({}),
  ['brand', 'name', 'size']);
check('brand + name but no size (scenario 3)',
  missingCatalogFields({ brand: 'Padron', name: '1964', size: '' }),
  ['size']);
check('no brand or cigar (scenario 4)',
  missingCatalogFields({ brand: '', name: '', size: '6x52' }),
  ['brand', 'name']);
check('whitespace does not count as filled',
  missingCatalogFields({ brand: '   ', name: '\t', size: ' ' }),
  ['brand', 'name', 'size']);
check('fully selected -> nothing missing',
  missingCatalogFields({ brand: 'Padron', name: '1964', size: 'Toro::6x52' }),
  []);
check('encoded size value counts as filled',
  missingCatalogFields({ brand: 'A', name: 'B', size: 'Torpedo::6.5x52' }),
  []);

console.log('\nRequired custom fields');
check('empty custom form -> all three',
  missingCustomFields({}),
  ['brand', 'name', 'size']);
check('complete custom form -> none',
  missingCustomFields({ brand: 'Mine', name: 'House Blend', size: '6x52' }),
  []);

console.log('\nSize format (scenario 5)');
check('6x52 valid', isValidSizeFormat('6x52'), true);
check('7.5x50 valid', isValidSizeFormat('7.5x50'), true);
check('surrounding space tolerated', isValidSizeFormat('  6x52 '), true);
check('6 x 52 rejected (spaces inside)', isValidSizeFormat('6 x 52'), false);
check('6/52 rejected (slash)', isValidSizeFormat('6/52'), false);
check('"toro" rejected', isValidSizeFormat('toro'), false);
check('empty rejected', isValidSizeFormat(''), false);
check('undefined rejected', isValidSizeFormat(undefined), false);

console.log('\nWhy a save was rejected');
check('missing fields reported as missing_fields',
  validationReason({ missing: ['size'] }),
  'missing_fields');
check('missing wins over a malformed size',
  validationReason({ missing: ['size'], size: 'nonsense', requireSizeFormat: true }),
  'missing_fields');
check('filled but malformed size -> invalid_size_format',
  validationReason({ missing: [], size: '6 x 52', requireSizeFormat: true }),
  'invalid_size_format');
check('catalog path does not enforce the format (sizes come from the picker)',
  validationReason({ missing: [], size: 'Toro::6x52' }),
  null);
check('valid custom input -> no reason, save proceeds',
  validationReason({ missing: [], size: '6x52', requireSizeFormat: true }),
  null);

console.log('\nUser-facing hint');
check('one field', missingFieldsMessage(['size']), 'Select a size to continue.');
check('two fields', missingFieldsMessage(['name', 'size']), 'Select a cigar name and size to continue.');
check('three fields',
  missingFieldsMessage(['brand', 'name', 'size']),
  'Select a brand, cigar name and size to continue.');
check('nothing missing -> no message', missingFieldsMessage([]), '');

console.log('\nError buckets (scenario 7) — tokens only, never raw messages');
check('network failure', categorizeError(new Error('Network request failed')), 'network');
check('unreachable server copy', categorizeError(new Error('Cannot reach server. Make sure...')), 'network');
check('TypeError from fetch', categorizeError(Object.assign(new Error('x'), { name: 'TypeError' })), 'network');
check('timeout', categorizeError(new Error('Request timed out')), 'network');
check('catalog 500', categorizeError(new Error('Failed to fetch catalog: 503')), 'server');
check('sqlite failure', categorizeError(new Error('SQLITE_FULL: disk is full')), 'database');
check('constraint violation', categorizeError(new Error('UNIQUE constraint failed')), 'database');
check('auth failure', categorizeError(new Error('Not authorized (401)')), 'permission');
check('unrecognised message', categorizeError(new Error('something odd')), 'unknown');
check('no error object at all', categorizeError(undefined), 'unknown');
check('empty error', categorizeError(new Error('')), 'unknown');

console.log('\nCatalog state (scenarios 1 and 6)');
check('rows present -> ready', catalogState({ itemCount: 1178 }), 'ready');
check('still fetching, nothing cached -> loading',
  catalogState({ loading: true, itemCount: 0 }),
  'loading');
check('fetch failed, nothing cached -> error (scenario 6)',
  catalogState({ failed: true, itemCount: 0 }),
  'error');
check('failed refresh but cache has rows -> ready, not error',
  catalogState({ failed: true, itemCount: 1178 }),
  'ready');
check('loading while cache has rows -> ready (form stays usable)',
  catalogState({ loading: true, itemCount: 12 }),
  'ready');
check('settled and genuinely empty -> empty',
  catalogState({ loading: false, failed: false, itemCount: 0 }),
  'empty');

console.log('\nAbandonment stage (bounded set, never raw input)');
check('left immediately', progressStage({}), 'nothing_selected');
check('picked a brand only', progressStage({ brand: 'Padron' }), 'brand_selected');
check('picked brand + name', progressStage({ brand: 'Padron', name: '1964' }), 'name_selected');
check('picked all three',
  progressStage({ brand: 'Padron', name: '1964', size: '6x52' }),
  'size_selected');
check('pressed Add before leaving beats field progress',
  progressStage({ brand: 'Padron', attempted: true }),
  'attempted');

console.log(`\n${pass} passed, ${fail} failed`);

if (!fail) {
  console.log(`
Covered here (pure logic): scenarios 3, 4, 5, and the decision halves of 1, 6, 7.
Still needs a device build (see Phase 4 notes):
  1. fresh install, guest, catalog add        - SQLite write + guest persistence
  2. fresh install, guest, custom add         - SQLite + shared-catalog POST
  6. catalog load failure                     - retry banner rendering
  8. rapid repeated Add taps                  - savingRef in-flight guard
  9. navigate away and back mid-add           - focus effect + abandonment event
 10. authenticated user add                   - Supabase push path
`);
}

process.exit(fail ? 1 : 0);
