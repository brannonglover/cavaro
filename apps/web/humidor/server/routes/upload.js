const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../config/supabase');

const BUCKET = 'cigar-images';

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

  const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const path = `cigars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

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
