/**
 * Replace white studio backgrounds on LFD catalog images with Cavaro surface tones
 * and tight-crop around the cigar so thumbnails/heroes don't look tiny.
 *
 * Downloads distinct La Flor Dominicana catalog image URLs, soft-keys white→dark,
 * crops to the cigar with modest padding, re-uploads, and updates cigar_catalog.
 *
 * Run from server/:
 *   node scripts/recolorLfdCatalogImages.js
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
const bgFlag = process.argv.find((arg) => arg.startsWith('--bg='));
const BG_HEX = (bgFlag ? bgFlag.split('=')[1] : '211912').replace(/^#/, '');

const PYTHON = process.env.LFD_PYTHON || '/tmp/lfd-venv/bin/python';
const WORK_DIR = path.join(os.tmpdir(), `lfd-recolor-${Date.now()}`);

const RECOLOR_PY = `
import sys
import numpy as np
from PIL import Image

src, dst, bg_hex = sys.argv[1], sys.argv[2], sys.argv[3]
br, bgc, bb = int(bg_hex[0:2], 16), int(bg_hex[2:4], 16), int(bg_hex[4:6], 16)
BG = np.array([br, bgc, bb], dtype=np.float32)

arr = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
chroma = mx - mn
luma = (r + g + b) / 3.0

# Soft-key near-white / light-gray studio backdrop onto app surface color.
LOW, HIGH = 198, 246
t = np.clip((luma - LOW) / (HIGH - LOW), 0.0, 1.0)
t = t * t * (3.0 - 2.0 * t)
chroma_keep = np.clip((chroma - 18.0) / 40.0, 0.0, 1.0)
t = t * (1.0 - chroma_keep)

mask = (t > 0.15).astype(np.uint8)
padded = np.pad(mask, 1, mode='edge')
dilated = np.maximum.reduce([
    padded[0:-2, 0:-2], padded[0:-2, 1:-1], padded[0:-2, 2:],
    padded[1:-1, 0:-2], padded[1:-1, 1:-1], padded[1:-1, 2:],
    padded[2:, 0:-2], padded[2:, 1:-1], padded[2:, 2:],
]).astype(np.float32)
fringe = np.clip(dilated - mask.astype(np.float32), 0.0, 1.0)
fringe_t = fringe * np.clip((luma - 170.0) / 60.0, 0.0, 1.0) * 0.85
t = np.maximum(t, fringe_t)
arr = arr * (1.0 - t[..., None]) + BG * t[..., None]

# Tight crop to cigar subject so card/hero cover framing fills with the product.
dist = np.linalg.norm(arr - BG, axis=2)
bbox = None
for thr in (22, 16, 12, 9, 6):
    subject = dist > thr
    h, w = subject.shape
    border = max(1, min(h, w) // 80)
    subject[:border, :] = False
    subject[-border:, :] = False
    subject[:, :border] = False
    subject[:, -border:] = False
    ys, xs = np.where(subject)
    if len(xs) < 200:
        continue
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    if (x1 - x0) < w * 0.015 or (y1 - y0) < h * 0.04:
        continue
    bbox = (x0, y0, x1, y1)
    break

if bbox is not None:
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    H, W = arr.shape[:2]
    # Keep the FULL cigar visible for fullscreen contain viewing,
    # with modest side padding so cards still fill well under cover.
    cigar_width_frac = 0.55
    vert_pad_frac = 0.06
    pad_y = max(8, int(bh * vert_pad_frac))
    target_w = max(bw + 16, int(bw / cigar_width_frac))
    pad_x = max(8, (target_w - bw) // 2)
    x0 = max(0, x0 - pad_x)
    y0 = max(0, y0 - pad_y)
    x1 = min(W - 1, x1 + pad_x)
    y1 = min(H - 1, y1 + pad_y)
    crop = arr[y0:y1 + 1, x0:x1 + 1]
    ch, cw = crop.shape[:2]
    want_w = max(cw, int(bw / cigar_width_frac))
    want_h = ch
    canvas = np.zeros((want_h, want_w, 3), dtype=np.float32)
    canvas[:] = BG
    ox = (want_w - cw) // 2
    canvas[0:ch, ox:ox + cw] = crop
    arr = canvas

Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB').save(
    dst, 'JPEG', quality=90, optimize=True
)
print(dst)
`;

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

function recolorLocal(src, dest) {
  const scriptPath = path.join(WORK_DIR, 'recolor.py');
  fs.writeFileSync(scriptPath, RECOLOR_PY);
  const result = spawnSync(PYTHON, [scriptPath, src, dest, BG_HEX], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'recolor failed');
  }
}

async function upload(localPath, storagePath) {
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
  if (!supabase && !DRY_RUN) {
    console.error('Supabase required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (!fs.existsSync(PYTHON)) {
    console.error(`Python not found at ${PYTHON}. Create venv with Pillow or set LFD_PYTHON.`);
    process.exit(1);
  }

  fs.mkdirSync(WORK_DIR, { recursive: true });
  console.log(`Background #${BG_HEX}; tight-crop enabled`);

  const { rows } = await pool.query(`
    SELECT DISTINCT image
    FROM cigar_catalog
    WHERE brand = 'La Flor Dominicana'
      AND COALESCE(image, '') <> ''
    ORDER BY image
  `);

  console.log(`Found ${rows.length} distinct LFD catalog images`);

  let updated = 0;
  let failed = 0;

  for (const { image: oldUrl } of rows) {
    const base = path.basename(new URL(oldUrl).pathname).replace(/\.[^.]+$/, '');
    const src = path.join(WORK_DIR, `${base}-src.jpg`);
    const dest = path.join(WORK_DIR, `${base}-dark.jpg`);

    try {
      console.log(`\nProcessing ${base}`);
      await download(oldUrl, src);
      recolorLocal(src, dest);

      if (DRY_RUN) {
        console.log(`  [DRY] would upload ${dest}`);
        continue;
      }

      const storagePath = `catalog/${slugify(`lfd_framed_${base}`)}_${Date.now()}.jpg`;
      const newUrl = await upload(dest, storagePath);

      const result = await pool.query(
        `UPDATE cigar_catalog
         SET image = $1
         WHERE brand = 'La Flor Dominicana' AND image = $2`,
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
