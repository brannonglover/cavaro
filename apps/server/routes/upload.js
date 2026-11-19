const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../config/supabase');
const { resolveUserId } = require('../lib/auth');

const BUCKET = 'cigar-images';

/**
 * Only these destinations are accepted. The folder arrives from the client, so
 * it is matched against this map rather than interpolated — otherwise a caller
 * could write anywhere in the bucket by sending "../" or an absolute path.
 */
const FOLDERS = {
  cigars: 'cigars',
  avatars: 'avatars',
};

/**
 * This endpoint was unauthenticated: any caller could POST an image and get a
 * public URL back, making it an open image host. It now requires a valid
 * Supabase token.
 *
 * Builds already in the field upload cigar photos with no Authorization header,
 * so during the rollout window set ALLOW_UNAUTHENTICATED_UPLOADS=1 to keep them
 * working. Unset it once those builds are gone — see the runbook in
 * docs/GUEST_MIGRATION_CONFLICTS.md for the equivalent snapshot-write rollout.
 *
 * The flag is deliberately narrow: it only ever excuses `cigars` uploads.
 * Avatars are a new capability with no legacy callers, so they always require a
 * real user and are namespaced per user id.
 */
const ALLOW_UNAUTHENTICATED = process.env.ALLOW_UNAUTHENTICATED_UPLOADS === '1';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use JPEG, PNG, or WebP.'));
    }
  },
});

router.post('/', upload.single('image'), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Image upload not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const folder = FOLDERS[String(req.body?.folder || 'cigars')];
  if (!folder) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const userId = await resolveUserId(req);
  if (!userId) {
    // Avatars are never covered by the compatibility flag.
    if (folder === 'avatars' || !ALLOW_UNAUTHENTICATED) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  // Avatars are scoped to the owner so one user cannot overwrite another's.
  const path = folder === 'avatars' ? `avatars/${userId}/${unique}` : `${folder}/${unique}`;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: error.message || 'Upload failed' });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    res.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
