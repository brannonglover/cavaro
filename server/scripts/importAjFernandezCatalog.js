/**
 * Import AJ Fernandez catalog rows + processed single-cigar product images.
 *
 * Expects:
 *   assets/aj-fernandez/catalog.json
 *   tmp/aj-fernandez/blend-images.json  (blend name → local processed JPEG)
 *
 * Catalog rows use blend-only `name` + optional `size_name` (vitola), so Add Cigar
 * can list all sizes under one cigar name.
 *
 * Run from server/:
 *   node scripts/importAjFernandezCatalog.js
 *   node scripts/importAjFernandezCatalog.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/postgres');
const { supabase } = require('../config/supabase');
const { ensureCatalogSchema } = require('../lib/catalogSchema');

const BRAND = 'AJ Fernandez';
const BUCKET = 'cigar-images';
const ROOT = path.resolve(__dirname, '../../tmp/aj-fernandez');
const CATALOG_PATH = [
  path.resolve(__dirname, '../../assets/aj-fernandez/catalog.json'),
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

function blendKeyForProduct(product, blendNames) {
  const name = product.name || '';
  if (blendNames.has(name)) return name;
  const sorted = [...blendNames].sort((a, b) => b.length - a.length);
  for (const blend of sorted) {
    if (name === blend || name.startsWith(`${blend} `)) return blend;
  }
  if (blendNames.has(product.line)) return product.line;
  return name || null;
}

async function uploadLocalImage(localPath, storagePath) {
  const buffer = fs.readFileSync(localPath);
  const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function main() {
  if (!CATALOG_PATH) {
    console.error('Missing AJ Fernandez catalog JSON (expected assets/aj-fernandez/catalog.json)');
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')).map((row) => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      if (!k.startsWith('_')) clean[k] = v;
    }
    return clean;
  });
  const blendImages = fs.existsSync(BLEND_IMAGES_PATH)
    ? JSON.parse(fs.readFileSync(BLEND_IMAGES_PATH, 'utf8'))
    : {};
  const blendNames = new Set(Object.keys(blendImages));

  console.log(`Catalog rows: ${catalog.length}`);
  console.log(`Blend images: ${blendNames.size}`);

  const uploadedByPath = new Map();
  const imageByBlend = new Map();

  if (!DRY_RUN) {
    if (!supabase) {
      console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(1);
    }
    await ensureCatalogSchema(pool);

    const existingImages = await pool.query(
      `SELECT name, image FROM cigar_catalog
       WHERE brand = $1 AND COALESCE(image, '') <> ''`,
      [BRAND]
    );
    for (const row of existingImages.rows) {
      const blend = blendKeyForProduct({ name: row.name, line: row.name }, blendNames);
      if (blend && row.image && !imageByBlend.has(blend)) {
        imageByBlend.set(blend, row.image);
      }
    }

    const del = await pool.query(`DELETE FROM cigar_catalog WHERE brand = $1`, [BRAND]);
    console.log(`Cleared ${del.rowCount} existing ${BRAND} rows`);
  }

  let uploaded = 0;
  let upserted = 0;
  let withImage = 0;

  for (const product of catalog) {
    const blend = blendKeyForProduct(product, blendNames);
    let image = '';

    if (blend) {
      if (!imageByBlend.has(blend)) {
        const localPath = blendImages[blend];
        if (localPath && fs.existsSync(localPath)) {
          if (DRY_RUN) {
            imageByBlend.set(blend, `[local] ${path.basename(localPath)}`);
          } else if (uploadedByPath.has(localPath)) {
            imageByBlend.set(blend, uploadedByPath.get(localPath));
          } else {
            const storagePath = `catalog/${slugify(`ajf_${blend}`)}_${Date.now()}.jpg`;
            const url = await uploadLocalImage(localPath, storagePath);
            uploadedByPath.set(localPath, url);
            imageByBlend.set(blend, url);
            uploaded += 1;
            console.log(`  ↑ ${blend}`);
          }
        } else {
          imageByBlend.set(blend, '');
        }
      }
      image = imageByBlend.get(blend) || '';
    }

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
