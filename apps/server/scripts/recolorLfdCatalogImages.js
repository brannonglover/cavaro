/**
 * Replace white studio backgrounds on catalog images with Cavaro surface tones
 * and crop around the cigar so portrait rails fill like Plasencia product shots.
 *
 * Run from server/:
 *   node scripts/recolorLfdCatalogImages.js
 *   node scripts/recolorLfdCatalogImages.js --brand=Plasencia
 *   node scripts/recolorLfdCatalogImages.js --brand=Davidoff --brand=Oliva
 *   node scripts/recolorLfdCatalogImages.js --all
 *   node scripts/recolorLfdCatalogImages.js --reframe --all
 *   node scripts/recolorLfdCatalogImages.js --dry-run
 *   node scripts/recolorLfdCatalogImages.js --bg=211912
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
const ALL = process.argv.includes('--all');
const REFRAME = process.argv.includes('--reframe');
const bgFlag = process.argv.find((arg) => arg.startsWith('--bg='));
const BG_HEX = (bgFlag ? bgFlag.split('=')[1] : '211912').replace(/^#/, '');
const BRANDS = process.argv
  .filter((arg) => arg.startsWith('--brand='))
  .map((arg) => arg.slice('--brand='.length).trim())
  .filter(Boolean);

const PYTHON_CANDIDATES = [
  process.env.LFD_PYTHON,
  '/tmp/lfd-venv/bin/python',
  'python3',
].filter(Boolean);
const PYTHON = PYTHON_CANDIDATES.find((candidate) => {
  if (candidate === 'python3') return true;
  return fs.existsSync(candidate);
}) || 'python3';
const CATALOG_COMMON = path.join(__dirname, 'catalogCommon.py');
const WORK_DIR = path.join(os.tmpdir(), `catalog-recolor-${Date.now()}`);

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function isAiLifestyle(url) {
  const value = String(url || '').toLowerCase();
  return value.includes('/catalog/') && value.includes('.png');
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

function recolorLocal(src, dest) {
  const result = spawnSync(PYTHON, [CATALOG_COMMON, src, dest, BG_HEX], {
    encoding: 'utf8',
  });
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
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function loadRows() {
  const brands = ALL || BRANDS.length ? BRANDS : ['La Flor Dominicana'];
  if (ALL) {
    const { rows } = await pool.query(`
      SELECT DISTINCT brand, image
      FROM cigar_catalog
      WHERE COALESCE(image, '') <> ''
      ORDER BY brand, image
    `);
    return rows;
  }

  const { rows } = await pool.query(
    `
      SELECT DISTINCT brand, image
      FROM cigar_catalog
      WHERE brand = ANY($1)
        AND COALESCE(image, '') <> ''
      ORDER BY brand, image
    `,
    [brands]
  );
  return rows;
}

async function main() {
  if (!supabase && !DRY_RUN) {
    console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const pyCheck = spawnSync(PYTHON, ['-c', 'from PIL import Image'], { encoding: 'utf8' });
  if (pyCheck.status !== 0) {
    console.error(`Python with Pillow not found (${PYTHON}). Create a venv or set LFD_PYTHON.`);
    process.exit(1);
  }

  fs.mkdirSync(WORK_DIR, { recursive: true });
    const rows = (await loadRows()).filter((row) => {
      if (isAiLifestyle(row.image)) return false;
      const framed = /_framed_/i.test(row.image || '');
      return REFRAME ? framed : !framed;
    });
  const label = ALL ? 'all brands' : [...new Set(rows.map((row) => row.brand))].join(', ') || 'none';
  console.log(`Background #${BG_HEX}; ${rows.length} distinct images (${label})`);

  let updated = 0;
  let failed = 0;
  const seen = new Set();

  for (const { brand, image: oldUrl } of rows) {
    if (!oldUrl || seen.has(oldUrl)) continue;
    seen.add(oldUrl);

    let base;
    try {
      const rawBase = path.basename(new URL(oldUrl).pathname).replace(/\.[^.]+$/, '');
      base = rawBase
        .replace(/^(?:[a-z0-9_]+?_framed_)+/i, '')
        .replace(/(?:_\d{13,})+$/, '') || rawBase;
    } catch {
      failed += 1;
      console.error(`  ✗ bad url: ${oldUrl}`);
      continue;
    }
    const src = path.join(WORK_DIR, `${slugify(brand)}_${base}-src.jpg`);
    const dest = path.join(WORK_DIR, `${slugify(brand)}_${base}-dark.jpg`);

    try {
      console.log(`\n${brand} / ${base}`);
      await download(oldUrl, src);
      recolorLocal(src, dest);

      if (DRY_RUN) {
        console.log(`  [DRY] would upload ${dest}`);
        continue;
      }

      const storagePath = `catalog/${slugify(`${brand}_framed_${base}`)}_${Date.now()}.jpg`;
      const newUrl = await upload(dest, storagePath);
      const result = await pool.query(
        `UPDATE cigar_catalog SET image = $1 WHERE image = $2`,
        [newUrl, oldUrl]
      );
      updated += result.rowCount;
      console.log(`  ✓ ${result.rowCount} rows → ${newUrl}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${base}: ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updated} rows, failed ${failed}.`);
  await pool.end();

  if (!DRY_RUN) {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  } else {
    console.log(`Dry-run outputs in ${WORK_DIR}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
