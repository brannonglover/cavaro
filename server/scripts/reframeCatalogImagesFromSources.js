/**
 * Reframe catalog images from local brand-source photos instead of from
 * whatever is already live, then upload and repoint the catalog rows.
 *
 * Reprocessing a live image compounds every earlier crop; going back to the
 * original press photo keeps the cap, the bands and the wrapper detail intact.
 *
 * Jobs are a JSON array of:
 *   { "brand": "Rocky Patel", "name": "Decade", "source": "/abs/photo.jpg" }
 * with an optional "image" holding the exact live URL to replace (used when a
 * blend stores a different photo per vitola).
 *
 * Run from server/:
 *   node scripts/reframeCatalogImagesFromSources.js --jobs=/tmp/jobs.json
 *   node scripts/reframeCatalogImagesFromSources.js --jobs=/tmp/jobs.json --dry-run
 *   node scripts/reframeCatalogImagesFromSources.js --jobs=/tmp/jobs.json --bg=211912
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pool = require('../config/postgres');
const { supabase } = require('../config/supabase');

const BUCKET = 'cigar-images';
const DRY_RUN = process.argv.includes('--dry-run');
const jobsFlag = process.argv.find((arg) => arg.startsWith('--jobs='));
const bgFlag = process.argv.find((arg) => arg.startsWith('--bg='));
const BG_HEX = (bgFlag ? bgFlag.split('=')[1] : '211912').replace(/^#/, '');

const PYTHON = [process.env.LFD_PYTHON, '/tmp/lfd-venv/bin/python']
  .filter((candidate) => candidate && fs.existsSync(candidate))[0] || 'python3';
const CATALOG_COMMON = path.join(__dirname, 'catalogCommon.py');
const WORK_DIR = path.join(os.tmpdir(), `catalog-reframe-${Date.now()}`);

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function recolorLocal(src, dest) {
  const result = spawnSync(PYTHON, [CATALOG_COMMON, src, dest, BG_HEX], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'recolor failed').trim());
  }
}

async function upload(localPath, storagePath) {
  const buffer = fs.readFileSync(localPath);
  const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error || !data?.path) {
    throw new Error(error?.message || 'Upload returned no path');
  }
  return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
}

async function main() {
  if (!jobsFlag) {
    console.error('Usage: node scripts/reframeCatalogImagesFromSources.js --jobs=<file.json>');
    process.exit(1);
  }
  if (!supabase && !DRY_RUN) {
    console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const jobs = JSON.parse(fs.readFileSync(jobsFlag.split('=').slice(1).join('='), 'utf8'));
  fs.mkdirSync(WORK_DIR, { recursive: true });
  console.log(`Background #${BG_HEX}; ${jobs.length} jobs`);

  let updated = 0;
  let failed = 0;

  for (const job of jobs) {
    const label = `${job.brand} / ${job.name}`;
    try {
      if (!fs.existsSync(job.source)) throw new Error(`missing source ${job.source}`);
      const base = slugify(`${job.brand}_${job.name}`);
      const dest = path.join(WORK_DIR, `${base}-${slugify(path.basename(job.source))}.jpg`);
      recolorLocal(job.source, dest);
      console.log(`\n${label}`);

      if (DRY_RUN) {
        console.log(`  [DRY] would upload ${dest}`);
        continue;
      }

      const variant = slugify(path.basename(job.source, path.extname(job.source)));
      const newUrl = await upload(dest, `catalog/${base}_framed_${variant}_${Date.now()}.jpg`);
      const result = job.image
        ? await pool.query('UPDATE cigar_catalog SET image = $1 WHERE image = $2', [newUrl, job.image])
        : await pool.query(
            'UPDATE cigar_catalog SET image = $1 WHERE brand = $2 AND name = $3',
            [newUrl, job.brand, job.name]
          );
      updated += result.rowCount;
      console.log(`  ✓ ${result.rowCount} rows → ${newUrl}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${label}: ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updated} rows, failed ${failed}.`);
  await pool.end();
  if (DRY_RUN) {
    console.log(`Dry-run outputs in ${WORK_DIR}`);
  } else {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
