/**
 * Extract brand taste profiles from catalog descriptions and store them.
 * Does not overwrite rows marked source = 'editor'.
 *
 * Run: cd server && node scripts/backfill-catalog-taste.js
 *      cd server && node scripts/backfill-catalog-taste.js --dry-run
 *      cd server && node scripts/backfill-catalog-taste.js --force
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');
const { ensureCatalogSchema } = require('../lib/catalogSchema');
const { backfillBrandTasteProfiles } = require('../lib/catalogTaste');
const { extractTasteProfile } = require('../lib/tasteVocabulary');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

function formatProfile(flavors, strength) {
  return `${(flavors || []).join(', ') || '—'} | ${strength || '—'}`;
}

async function main() {
  console.log('Preparing catalog schema…');
  await ensureCatalogSchema(pool);
  console.log('Loading catalog blends…');

  if (DRY_RUN) {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (brand, name)
        brand, name, line, description
      FROM cigar_catalog
      ORDER BY brand, name, length
    `);

    console.log(`Found ${rows.length} catalog blends`);
    let saved = 0;
    let empty = 0;
    for (const row of rows) {
      const extracted = extractTasteProfile(row.description, row.line, row.name);
      if (!extracted.flavors.length && !extracted.strength) {
        empty += 1;
        continue;
      }
      saved += 1;
      console.log(
        `[DRY] ${row.brand} ${row.name} → ${formatProfile(extracted.flavors, extracted.strength)}`
      );
    }
    console.log(`\nDone. Would save ${saved}, no notes ${empty}, editor preserved 0`);
    await pool.end();
    return;
  }

  const stats = await backfillBrandTasteProfiles(pool, {
    force: FORCE,
    onProgress: ({ phase, index, total, row, result }) => {
      if (phase === 'loaded') {
        console.log(`Found ${total} catalog blends${FORCE ? ' (force)' : ''}`);
        return;
      }
      if (result?.unchanged) return;
      if (result?.empty || (result?.skipped && !result?.editor)) return;
      if (result?.editor) {
        console.log(`  [${index}/${total}] ${row.brand} ${row.name} → editor preserved`);
        return;
      }
      console.log(
        `  [${index}/${total}] ${row.brand} ${row.name} → ${formatProfile(result.flavors, result.strength)}`
      );
    },
  });

  console.log(
    `\nDone. Saved ${stats.saved}, unchanged ${stats.unchanged}, no notes ${stats.empty}, editor preserved ${stats.editor}`
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
