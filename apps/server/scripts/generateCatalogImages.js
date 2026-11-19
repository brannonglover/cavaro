/**
 * Batch-generates AI lifestyle images for catalog entries missing images.
 * One image per brand + name (shared across vitolas).
 *
 * Run from server dir:
 *   node scripts/generateCatalogImages.js
 *   node scripts/generateCatalogImages.js --dry-run
 *   node scripts/generateCatalogImages.js --limit 5
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');
const { supabase } = require('../config/supabase');
const { buildCigarLifestylePrompt } = require('../lib/cigarImagePrompt');

const BUCKET = 'cigar-images';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const DRY_RUN = process.argv.includes('--dry-run');
const limitFlagIndex = process.argv.findIndex((arg) => arg === '--limit' || arg.startsWith('--limit='));
const LIMIT = (() => {
  if (limitFlagIndex === -1) return null;
  const arg = process.argv[limitFlagIndex];
  if (arg.includes('=')) return parseInt(arg.split('=')[1], 10);
  const next = process.argv[limitFlagIndex + 1];
  return next ? parseInt(next, 10) : null;
})();

async function generateImage(prompt, apiKey) {
  const isDalle3 = IMAGE_MODEL === 'dall-e-3';
  const body = {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: isDalle3 ? '1792x1024' : '1536x1024',
    quality: isDalle3 ? 'standard' : 'medium',
  };

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI image generation failed');
  }

  const image = data.data?.[0];
  if (!image) {
    throw new Error('OpenAI returned no image data');
  }

  return image;
}

async function uploadGeneratedImage(image, path) {
  let buffer;
  let contentType = 'image/png';

  if (image.b64_json) {
    buffer = Buffer.from(image.b64_json, 'base64');
  } else if (image.url) {
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
    contentType = response.headers.get('content-type') || contentType;
  } else {
    throw new Error('OpenAI image response missing url and b64_json');
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !DRY_RUN) {
    console.error('OPENAI_API_KEY is required. Use --dry-run to preview prompts only.');
    process.exit(1);
  }
  if (!supabase && !DRY_RUN) {
    console.error('Supabase is required for uploads. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (brand, name)
      brand, name, line, wrapper
    FROM cigar_catalog
    WHERE COALESCE(image, '') = ''
    ORDER BY brand, name, length
  `);

  const targets = LIMIT ? rows.slice(0, LIMIT) : rows;
  console.log(`Found ${rows.length} catalog lines without images. Processing ${targets.length}...`);
  if (!DRY_RUN) {
    console.log(`Using image model: ${IMAGE_MODEL}`);
  }

  let generated = 0;
  let failed = 0;

  for (const cigar of targets) {
    const label = `${cigar.brand} ${cigar.name}`;
    const prompt = buildCigarLifestylePrompt(cigar);

    if (DRY_RUN) {
      console.log(`\n[DRY RUN] ${label}`);
      console.log(prompt);
      continue;
    }

    try {
      console.log(`\nGenerating: ${label}`);
      const generatedImage = await generateImage(prompt, apiKey);
      const slug = `${cigar.brand}_${cigar.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const storagePath = `catalog/${slug}_${Date.now()}.png`;
      const publicUrl = await uploadGeneratedImage(generatedImage, storagePath);

      await pool.query(
        `UPDATE cigar_catalog
         SET image = $1
         WHERE brand = $2 AND name = $3`,
        [publicUrl, cigar.brand, cigar.name]
      );

      generated += 1;
      console.log(`  ✓ ${publicUrl}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${label}: ${error.message}`);
    }

    // Brief pause to reduce rate-limit risk.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (!DRY_RUN) {
    console.log(`\nDone. Generated ${generated}, failed ${failed}.`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
