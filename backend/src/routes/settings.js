/* ================================================================
   CANOPUS — Settings REST API
   GET    /api/settings/character        — public: get active character config
   POST   /api/settings/character/upload — protected: upload character image
   PUT    /api/settings/character        — protected: update active selection/shuffle
   POST   /api/settings/character/reset  — protected: reset to default portrait
   DELETE /api/settings/character/gallery — protected: remove image from gallery
   ================================================================ */

const router       = require('express').Router();
const path         = require('path');
const fs           = require('fs');
const multer       = require('multer');
const { v4: uuid } = require('uuid');
const { pool }     = require('../db');
const { authenticate } = require('../middleware/auth');

/* ── Multer Storage for Character Artwork ── */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dest = path.join(UPLOAD_DIR, 'character');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `char-${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(_req, file, cb) {
    const allowed = /image\/(jpeg|png|webp|gif|svg\+xml)/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, WEBP, GIF, SVG) are allowed.'));
    }
  },
});

/* ── Helper: Get all character settings from DB ── */
async function fetchCharacterSettings() {
  const { rows } = await pool.query(
    "SELECT key, value FROM app_settings WHERE key IN ('home_character_url', 'about_character_url', 'character_shuffle_mode', 'character_gallery')"
  );

  const map = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  let gallery = ['/canopus-portrait.png'];
  if (map['character_gallery']) {
    try {
      const parsed = JSON.parse(map['character_gallery']);
      if (Array.isArray(parsed) && parsed.length > 0) {
        gallery = parsed;
      }
    } catch {
      // Keep default
    }
  }

  // Ensure default is always present
  if (!gallery.includes('/canopus-portrait.png')) {
    gallery.unshift('/canopus-portrait.png');
  }

  return {
    homeCharacterUrl: map['home_character_url'] || '/canopus-portrait.png',
    aboutCharacterUrl: map['about_character_url'] || '/canopus-portrait.png',
    shuffleMode: map['character_shuffle_mode'] === 'true',
    gallery,
  };
}

/* ── Helper: Upsert setting key ── */
async function upsertSetting(key, value) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}

/* ── GET /api/settings/character — public ── */
router.get('/character', async (_req, res) => {
  try {
    const settings = await fetchCharacterSettings();
    res.json(settings);
  } catch (err) {
    console.error('[Settings] Error fetching character settings:', err);
    res.status(500).json({ error: 'Failed to fetch character settings.' });
  }
});

/* ── POST /api/settings/character/upload — protected ── */
router.post('/character/upload', authenticate, upload.single('characterImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const relativeUrl = `/uploads/character/${req.file.filename}`;
    const target = (req.body.target || 'both').toLowerCase(); // 'home', 'about', 'both', 'gallery'

    const current = await fetchCharacterSettings();
    const updatedGallery = [...current.gallery];
    if (!updatedGallery.includes(relativeUrl)) {
      updatedGallery.push(relativeUrl);
    }
    await upsertSetting('character_gallery', JSON.stringify(updatedGallery));

    if (target === 'home' || target === 'both') {
      await upsertSetting('home_character_url', relativeUrl);
    }
    if (target === 'about' || target === 'both') {
      await upsertSetting('about_character_url', relativeUrl);
    }

    const updated = await fetchCharacterSettings();
    res.json({
      ...updated,
      uploadedUrl: relativeUrl,
      message: `Image uploaded and applied to ${target}.`,
    });
  } catch (err) {
    console.error('[Settings] Error uploading character image:', err);
    res.status(500).json({ error: err.message || 'Failed to upload character image.' });
  }
});

/* ── PUT /api/settings/character — protected ── */
router.put('/character', authenticate, async (req, res) => {
  try {
    const { homeCharacterUrl, aboutCharacterUrl, shuffleMode } = req.body;

    if (homeCharacterUrl !== undefined) {
      await upsertSetting('home_character_url', homeCharacterUrl);
    }
    if (aboutCharacterUrl !== undefined) {
      await upsertSetting('about_character_url', aboutCharacterUrl);
    }
    if (shuffleMode !== undefined) {
      await upsertSetting('character_shuffle_mode', shuffleMode ? 'true' : 'false');
    }

    const updated = await fetchCharacterSettings();
    res.json(updated);
  } catch (err) {
    console.error('[Settings] Error updating character settings:', err);
    res.status(500).json({ error: 'Failed to update character settings.' });
  }
});

/* ── POST /api/settings/character/reset — protected ── */
router.post('/character/reset', authenticate, async (req, res) => {
  try {
    const target = (req.body.target || 'both').toLowerCase(); // 'home', 'about', 'both'

    if (target === 'home' || target === 'both') {
      await upsertSetting('home_character_url', '/canopus-portrait.png');
    }
    if (target === 'about' || target === 'both') {
      await upsertSetting('about_character_url', '/canopus-portrait.png');
    }

    const updated = await fetchCharacterSettings();
    res.json({
      ...updated,
      message: `Reset ${target} character to default portrait.`,
    });
  } catch (err) {
    console.error('[Settings] Error resetting character:', err);
    res.status(500).json({ error: 'Failed to reset character.' });
  }
});

/* ── DELETE /api/settings/character/gallery — protected ── */
router.delete('/character/gallery', authenticate, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Image URL is required.' });
    }

    if (url === '/canopus-portrait.png') {
      return res.status(400).json({ error: 'Cannot delete the default CANOPUS character portrait.' });
    }

    const current = await fetchCharacterSettings();
    const updatedGallery = current.gallery.filter(item => item !== url);
    await upsertSetting('character_gallery', JSON.stringify(updatedGallery));

    // If deleted image was currently active, revert to default portrait
    if (current.homeCharacterUrl === url) {
      await upsertSetting('home_character_url', '/canopus-portrait.png');
    }
    if (current.aboutCharacterUrl === url) {
      await upsertSetting('about_character_url', '/canopus-portrait.png');
    }

    // Try deleting physical file from disk if it was an uploaded file
    if (url.startsWith('/uploads/character/')) {
      const filename = path.basename(url);
      const filePath = path.join(UPLOAD_DIR, 'character', filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('[Settings] Could not unlink character file:', filePath, e.message);
        }
      }
    }

    const updated = await fetchCharacterSettings();
    res.json({
      ...updated,
      message: 'Image removed from gallery.',
    });
  } catch (err) {
    console.error('[Settings] Error deleting character from gallery:', err);
    res.status(500).json({ error: 'Failed to delete character from gallery.' });
  }
});

module.exports = router;
