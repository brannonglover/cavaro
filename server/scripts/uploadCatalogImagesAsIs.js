/**
 * Upload pre-processed catalog JPEGs without running catalogCommon again.
 *
 * Run from server/:
 *   node scripts/uploadCatalogImagesAsIs.js --jobs=/tmp/jobs.json
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/postgres');
const { supabase } = require('../config/supabase');

const BUCKET = 'cigar-images';
const jobsFlag = process.argv.find((arg) => arg.startsWith('--jobs='));

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function upload(localPath, storagePath) {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === '.png'
    ? 'image/png'
    : ext === '.webp'
      ? 'image/webp'
      : 'image/jpeg';
  const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error || !data?.path) {
    throw new Error(error?.message || 'Upload returned no path');
  }
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}

async function main() {
  if (!jobsFlag) {
    console.error('Usage: node scripts/uploadCatalogImagesAsIs.js --jobs=<file.json>');
    process.exit(1);
  }
  if (!supabase) {
    console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const jobs = JSON.parse(fs.readFileSync(jobsFlag.split('=').slice(1).join('='), 'utf8'));
  let updated = 0;
  let failed = 0;

  for (const job of jobs) {
    const label = `${job.brand} / ${job.name}`;
    try {
      if (!fs.existsSync(job.source)) throw new Error(`missing source ${job.source}`);
      const base = slugify(`${job.brand}_${job.name}`);
      const variant = slugify(path.basename(job.source, path.extname(job.source)));
      const ext = path.extname(job.source).toLowerCase() || '.jpg';
      const newUrl = await upload(
        job.source,
        `catalog/product/${base}_${variant}_${Date.now()}${ext}`
      );
      const result = job.image
        ? await pool.query('UPDATE cigar_catalog SET image = $1 WHERE image = $2', [newUrl, job.image])
        : await pool.query(
            'UPDATE cigar_catalog SET image = $1 WHERE brand = $2 AND name = $3',
            [newUrl, job.brand, job.name]
          );
      updated += result.rowCount;
      console.log(`✓ ${label}: ${result.rowCount} rows → ${newUrl}`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${label}: ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updated} rows, failed ${failed}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
