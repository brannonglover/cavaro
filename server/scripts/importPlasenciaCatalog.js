/**
 * Import Plasencia catalog rows + product images.
 *
 * Expects:
 *   assets/plasencia/catalog.json
 *   tmp/plasencia/blend-images.json  (optional: "Blend||Size" or blend → local image)
 *
 * Catalog rows use blend-only `name` + `size_name` (Plasencia vitola nicknames),
 * matching the Rocky Patel Add Cigar pattern.
 *
 * Run from server/:
 *   node scripts/importPlasenciaCatalog.js
 *   node scripts/importPlasenciaCatalog.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/postgres');
const { supabase } = require('../config/supabase');
const { ensureCatalogSchema } = require('../lib/catalogSchema');

const BUCKET = 'cigar-images';
const ROOT = path.resolve(__dirname, '../../tmp/plasencia');
const CATALOG_PATH = [
  path.resolve(__dirname, '../../assets/plasencia/catalog.json'),
  path.join(ROOT, 'catalog.json'),
].find((p) => fs.existsSync(p));
const BLEND_IMAGES_PATH = path.join(ROOT, 'blend-images.json');
const DRY_RUN = process.argv.includes('--dry-run');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function imageKey(product) {
  if (product.size_name) return `${product.name}||${product.size_name}`;
  return product.name;
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
    console.error('Missing Plasencia catalog JSON (expected assets/plasencia/catalog.json)');
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')).map((row) => {
    // Drop parser private keys if present in tmp catalog
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      if (!k.startsWith('_')) clean[k] = v;
    }
    return clean;
  });
  const blendImages = fs.existsSync(BLEND_IMAGES_PATH)
    ? JSON.parse(fs.readFileSync(BLEND_IMAGES_PATH, 'utf8'))
    : {};

  console.log(`Catalog rows: ${catalog.length}`);
  console.log(`Image map keys: ${Object.keys(blendImages).length}`);

  const uploadedByPath = new Map();
  const imageByKey = new Map();

  if (!DRY_RUN) {
    if (!supabase) {
      console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(1);
    }
    await ensureCatalogSchema(pool);

    const existingImages = await pool.query(
      `SELECT name, size_name, image FROM cigar_catalog
       WHERE brand = 'Plasencia' AND COALESCE(image, '') <> ''`
    );
    for (const row of existingImages.rows) {
      const key = row.size_name ? `${row.name}||${row.size_name}` : row.name;
      if (row.image && !imageByKey.has(key)) imageByKey.set(key, row.image);
      if (row.image && !imageByKey.has(row.name)) imageByKey.set(row.name, row.image);
    }

    const del = await pool.query(`DELETE FROM cigar_catalog WHERE brand = 'Plasencia'`);
    console.log(`Cleared ${del.rowCount} existing Plasencia rows`);
  }

  let uploaded = 0;
  let upserted = 0;
  let withImage = 0;

  for (const product of catalog) {
    const key = imageKey(product);
    let image = '';

    if (!imageByKey.has(key) && !imageByKey.has(product.name)) {
      const localPath = blendImages[key] || blendImages[product.name] || '';
      if (localPath && fs.existsSync(localPath)) {
        if (DRY_RUN) {
          imageByKey.set(key, `[local] ${path.basename(localPath)}`);
        } else if (uploadedByPath.has(localPath)) {
          imageByKey.set(key, uploadedByPath.get(localPath));
        } else {
          const ext = path.extname(localPath).toLowerCase() === '.png' ? 'png' : 'jpg';
          const storagePath = `catalog/${slugify(`pla_${product.name}_${product.size_name || 'x'}`)}_${Date.now()}.${ext}`;
          const url = await uploadLocalImage(localPath, storagePath);
          uploadedByPath.set(localPath, url);
          imageByKey.set(key, url);
          uploaded += 1;
          console.log(`  ↑ ${product.name} / ${product.size_name || '-'}`);
        }
      }
    }

    image = imageByKey.get(key) || imageByKey.get(product.name) || '';
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
    upserted += 1;
  }

  if (DRY_RUN) {
    const names = new Set(catalog.map((p) => p.name));
    console.log(
      `\nDry run complete. Rows: ${catalog.length}, distinct names: ${names.size}, with images: ${withImage}`
    );
  } else {
    console.log(
      `\nDone. Uploaded ${uploaded} images, inserted ${upserted} catalog rows (${withImage} with images).`
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
