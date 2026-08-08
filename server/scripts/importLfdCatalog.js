/**
 * Import La Flor Dominicana catalog rows + single-cigar product images.
 *
 * Expects:
 *   tmp/lfd/lfd-catalog.json  - parsed PDF products
 *   tmp/lfd/singles.json      - classified single-cigar local images
 *
 * Images upload to Supabase cigar-images/catalog/ and are applied like
 * generateCatalogImages.js: one URL shared across vitolas of the same brand+name.
 *
 * Assignment strategy per line:
 *   - darker singles -> names containing Maduro/Oscuro
 *   - lighter singles -> remaining names
 *   - if only one single for a line, share it across that line
 *
 * Run from server/:
 *   node scripts/importLfdCatalog.js
 *   node scripts/importLfdCatalog.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/postgres');
const { supabase } = require('../config/supabase');
const { ensureCatalogSchema } = require('../lib/catalogSchema');

const BUCKET = 'cigar-images';
const ROOT = path.resolve(__dirname, '../../tmp/lfd');
const CATALOG_PATH = [
  path.resolve(__dirname, '../../assets/lfd/catalog.json'),
  path.join(ROOT, 'lfd-catalog.json'),
].find((p) => fs.existsSync(p));
const SINGLES_PATH = path.join(ROOT, 'singles.json');
const DRY_RUN = process.argv.includes('--dry-run');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function isDarkWrapperName(name = '') {
  const upper = name.toUpperCase();
  return (
    upper.includes('MADURO') ||
    upper.includes('OSCURO') ||
    upper.includes('HABANO MADURO')
  );
}

function normalizeForMatch(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreFilenameMatch(product, single) {
  const name = normalizeForMatch(product.name);
  const file = normalizeForMatch(single.file);

  let score = 0;
  const noMatch = name.match(/\bno\s*(\d+)\b/);
  if (noMatch && file.includes(`no ${noMatch[1]}`)) score += 10;

  const tokenChecks = [
    ['chiselito', 8],
    ['chisel', 8],
    ['matatan', 8],
    ['valiente', 8],
    ['carajon', 10],
    ['carajón', 10],
    ['granu', 10],
    ['granú', 10],
    ['707', 10],
    ['l500', 10],
    ['l-500', 10],
    ['l400', 8],
    ['l-400', 8],
    ['l300', 8],
    ['l-300', 8],
    ['tcfka', 10],
    ['torpedito', 10],
    ['double press', 8],
  ];
  for (const [token, points] of tokenChecks) {
    const t = normalizeForMatch(token);
    if (name.includes(t) && file.includes(t.replace(/ /g, ' '))) score += points;
  }
  // L-500 style codes in filenames without hyphen
  const code = name.match(/\bl\s*[- ]?\s*(\d{3})\b/);
  if (code && (file.includes(`l${code[1]}`) || file.includes(`l ${code[1]}`))) score += 10;

  if (isDarkWrapperName(product.name) && (file.includes('maduro') || file.includes('oscuro'))) score += 4;
  if (!isDarkWrapperName(product.name) && file.includes('natural')) score += 4;
  if (file.includes('single cigar')) score += 2;
  return score;
}

function pickImageForProduct(product, singlesByLine) {
  const singles = singlesByLine.get(product.line) || [];
  if (!singles.length) return null;

  // Prefer filename matches when Dropbox assets are labeled (e.g. Oro No.5).
  const ranked = [...singles]
    .map((s) => ({ s, score: scoreFilenameMatch(product, s) }))
    .sort((a, b) => b.score - a.score || a.s.center_lum - b.s.center_lum);
  if (ranked[0].score > 0) return ranked[0].s;

  const dark = singles.filter((s) => s.center_lum < 100);
  const light = singles.filter((s) => s.center_lum >= 100);
  const wantsDark = isDarkWrapperName(product.name);

  if (wantsDark && dark.length) return dark[0];
  if (!wantsDark && light.length) return light[light.length - 1];
  if (wantsDark && light.length) return light[0];
  if (!wantsDark && dark.length) return dark[dark.length - 1];
  return singles[Math.floor(singles.length / 2)];
}

async function uploadLocalImage(localPath, storagePath) {
  const buffer = fs.readFileSync(localPath);
  const contentType = localPath.toLowerCase().endsWith('.png')
    ? 'image/png'
    : 'image/jpeg';

  const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function main() {
  if (!CATALOG_PATH) {
    console.error('Missing LFD catalog JSON (expected assets/lfd/catalog.json)');
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const singles = fs.existsSync(SINGLES_PATH)
    ? JSON.parse(fs.readFileSync(SINGLES_PATH, 'utf8'))
    : [];

  const singlesByLine = new Map();
  for (const single of singles) {
    if (!singlesByLine.has(single.line)) singlesByLine.set(single.line, []);
    singlesByLine.get(single.line).push(single);
  }
  for (const [, list] of singlesByLine) {
    list.sort((a, b) => a.center_lum - b.center_lum);
  }

  console.log(`Catalog rows: ${catalog.length}`);
  console.log(`Single-cigar images: ${singles.length} across ${singlesByLine.size} lines`);

  if (!DRY_RUN) {
    if (!supabase) {
      console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(1);
    }
    await ensureCatalogSchema(pool);
  }

  // Upload one unique local file once, reuse URL for multiple names that map to it.
  const uploadedByPath = new Map();
  // One image URL per brand+name (shared across sizes), matching Rocky Patel pattern.
  const imageByName = new Map();

  if (!DRY_RUN) {
    // Preserve existing image URLs before clearing old rows.
    const existingImages = await pool.query(
      `SELECT name, image FROM cigar_catalog
       WHERE brand = 'La Flor Dominicana' AND COALESCE(image, '') <> ''`
    );
    for (const row of existingImages.rows) {
      if (row.image && !imageByName.has(row.name)) {
        imageByName.set(row.name, row.image);
      }
    }

    const del = await pool.query(`DELETE FROM cigar_catalog WHERE brand = 'La Flor Dominicana'`);
    console.log(`Cleared ${del.rowCount} existing La Flor Dominicana rows`);
  }

  let uploaded = 0;
  let inserted = 0;
  let withImage = 0;

  for (const product of catalog) {
    if (!imageByName.has(product.name)) {
      const chosen = pickImageForProduct(product, singlesByLine);
      if (chosen) {
        if (DRY_RUN) {
          imageByName.set(product.name, `[local] ${chosen.file}`);
        } else if (uploadedByPath.has(chosen.path)) {
          imageByName.set(product.name, uploadedByPath.get(chosen.path));
        } else {
          const storagePath = `catalog/${slugify(`lfd_${product.line}_${path.parse(chosen.file).name}`)}_${Date.now()}.jpg`;
          const url = await uploadLocalImage(chosen.path, storagePath);
          uploadedByPath.set(chosen.path, url);
          imageByName.set(product.name, url);
          uploaded += 1;
          console.log(`  ↑ ${product.line} / ${chosen.file}`);
        }
      } else {
        imageByName.set(product.name, '');
      }
    }

    const image = imageByName.get(product.name) || '';
    if (image) withImage += 1;

    if (DRY_RUN) {
      console.log(
        `[DRY] ${product.brand} | ${product.name} | ${product.size_name || '-'} | ${product.length} | img=${image ? 'yes' : 'no'}`
      );
      continue;
    }

    await pool.query(
      `INSERT INTO cigar_catalog (brand, name, line, description, wrapper, binder, filler, length, size_name, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        product.brand,
        product.name,
        product.line || null,
        product.description || '',
        product.wrapper || '',
        product.binder || '',
        product.filler || '',
        product.length,
        product.size_name || null,
        image,
      ]
    );
    inserted += 1;
  }

  if (DRY_RUN) {
    const names = new Set(catalog.map((p) => p.name));
    console.log(
      `\nDry run complete. Rows: ${catalog.length}, distinct names: ${names.size}, with images: ${withImage}`
    );
  } else {
    console.log(
      `\nDone. Uploaded ${uploaded} images, inserted ${inserted} catalog rows (${withImage} with images).`
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
