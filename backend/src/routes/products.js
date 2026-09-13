/* ================================================================
   CANOPUS — Products REST API
   GET  /api/products                   — public (enabled products)
   GET  /api/products/:id               — public (single product)
   PUT  /api/products/:id               — protected (admin update price/status)
   POST /api/products/:id/generate-zip  — protected (one-time ZIP generation)
   POST /api/products/:id/upload-zip    — protected (upload custom ZIP)
   DELETE /api/products/:id/zip         — protected (remove ZIP)
   ================================================================ */

const router       = require('express').Router();
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');
const multer       = require('multer');
const { pool }     = require('../db');
const { authenticate } = require('../middleware/auth');
const { generateAlbumZip, deleteAlbumZip, DIGITAL_PRODUCTS_PATH } = require('../services/zipService');

/* Multer for custom digital ZIP uploads */
const zipStorage = multer.diskStorage({
  destination(req, file, cb) {
    const albumDir = path.join(DIGITAL_PRODUCTS_PATH, req.params.id);
    fs.mkdirSync(albumDir, { recursive: true });
    cb(null, albumDir);
  },
  filename(_req, file, cb) {
    cb(null, 'album.zip');
  },
});

const uploadZip = multer({
  storage: zipStorage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB max
  fileFilter(_req, file, cb) {
    const isZip = file.mimetype === 'application/zip' || 
                  file.mimetype === 'application/x-zip-compressed' ||
                  path.extname(file.originalname).toLowerCase() === '.zip';
    cb(null, isZip);
  },
});

/**
 * Helper to fetch configured preview duration (admin DB setting > env var > 30)
 */
async function getPreviewDuration() {
  try {
    const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'preview_duration_seconds'");
    if (rows.length && rows[0].value) {
      const val = parseInt(rows[0].value, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (err) {
    console.warn('[products] Could not read preview_duration_seconds setting:', err.message);
  }
  const envVal = parseInt(process.env.PREVIEW_DURATION_SECONDS || '30', 10);
  return !isNaN(envVal) && envVal > 0 ? envVal : 30;
}

/**
 * Maps DB row to frontend product format
 */
function rowToProduct(r, tracks = [], previewDuration = 30) {
  const hasZip = Boolean(r.digital_file_path && fs.existsSync(r.digital_file_path));

  return {
    id:                 r.id,
    title:              r.title,
    artist:             r.artist || '',
    genre:              r.genre,
    releaseDate:        r.release_date ? r.release_date.toISOString().split('T')[0] : '',
    releaseYear:        r.release_date ? r.release_date.toISOString().split('T')[0].slice(0, 4) : '',
    artworkUrl:         r.artwork_url || null,
    description:        r.description || '',
    trackCount:         tracks.length,
    // Product specific fields
    productEnabled:     Boolean(r.product_enabled),
    price:              Number(r.product_price || 0),
    productDescription: r.product_description || r.description || '',
    previewDuration:    previewDuration,
    // Digital ZIP metadata (safe, no full system paths exposed)
    digitalFile: {
      exists:   hasZip,
      fileName: r.digital_file_name || `${r.title}.zip`,
      fileSize: Number(r.digital_file_size || 0),
      fileHash: r.digital_file_hash || '',
      updatedAt: r.product_updated_at,
    },
    tracks: tracks.map(t => ({
      id:           t.id,
      title:        t.title,
      originalTitle: t.original_title,
      version:      t.version,
      bpm:          (t.bpm && Number(t.bpm) > 0) ? Number(t.bpm) : null,
      key:          t.key,
      previewUrl:   `/api/products/${r.id}/preview?trackId=${t.id}`,
      artworkUrl:   t.artwork_url || r.artwork_url || null,
      trackNumber:  t.track_number,
      duration:     t.duration || null,
    })).sort((a, b) => a.trackNumber - b.trackNumber),
  };
}

/* ── GET /api/products/settings/preview — public ── */
router.get('/settings/preview', async (_req, res) => {
  try {
    const previewDuration = await getPreviewDuration();
    res.json({ previewDuration, previewDurationSeconds: previewDuration });
  } catch (err) {
    console.error('[products] GET /settings/preview error:', err);
    res.status(500).json({ error: 'Failed to fetch preview settings.' });
  }
});

/* ── PUT /api/products/settings/preview — protected (admin) ── */
router.put('/settings/preview', authenticate, async (req, res) => {
  try {
    const rawVal = parseInt(req.body.previewDuration || req.body.previewDurationSeconds, 10);
    if (isNaN(rawVal) || rawVal < 5 || rawVal > 180) {
      return res.status(400).json({ error: 'Preview duration must be between 5 and 180 seconds.' });
    }

    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('preview_duration_seconds', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [String(rawVal)]
    );

    res.json({ success: true, previewDuration: rawVal, previewDurationSeconds: rawVal });
  } catch (err) {
    console.error('[products] PUT /settings/preview error:', err);
    res.status(500).json({ error: 'Failed to update preview duration.' });
  }
});

/* ── GET /api/products — public (active products for store) ── */
router.get('/', async (req, res) => {
  try {
    const previewDuration = await getPreviewDuration();
    const { rows: records } = await pool.query(
      `SELECT * FROM records 
       WHERE product_enabled = TRUE 
       ORDER BY product_created_at DESC, release_date DESC`
    );

    const { rows: tracks } = await pool.query(
      `SELECT * FROM tracks ORDER BY track_number ASC`
    );

    const tracksByRecord = {};
    for (const t of tracks) {
      if (!tracksByRecord[t.record_id]) tracksByRecord[t.record_id] = [];
      tracksByRecord[t.record_id].push(t);
    }

    const products = records.map(r => rowToProduct(r, tracksByRecord[r.id] || [], previewDuration));
    res.json(products);
  } catch (err) {
    console.error('[products] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

/* ── GET /api/products/:id — public ── */
router.get('/:id', async (req, res) => {
  try {
    const previewDuration = await getPreviewDuration();
    const { rows } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });

    const trackRows = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    res.json(rowToProduct(rows[0], trackRows.rows, previewDuration));
  } catch (err) {
    console.error('[products] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

/* ── GET /api/products/:id/preview — public (limited audio preview streaming) ── */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { trackId } = req.query;

    const { rows: records } = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
    if (!records.length) return res.status(404).json({ error: 'Record not found.' });

    // Find requested track or default to first track
    let trackQuery = 'SELECT * FROM tracks WHERE record_id = $1';
    const params = [id];
    if (trackId) {
      trackQuery += ' AND id = $2';
      params.push(trackId);
    } else {
      trackQuery += ' ORDER BY track_number ASC LIMIT 1';
    }

    const { rows: tracks } = await pool.query(trackQuery, params);
    if (!tracks.length || !tracks[0].audio_url) {
      return res.status(404).json({ error: 'No preview audio available.' });
    }

    const track = tracks[0];
    const previewDuration = await getPreviewDuration();

    // Locate file on disk
    const audioUrl = track.audio_url;
    let filePath;
    if (audioUrl.startsWith('/uploads/audio/')) {
      const filename = path.basename(audioUrl);
      filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'audio', filename);
    } else if (audioUrl.startsWith('/uploads/')) {
      filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', audioUrl.replace('/uploads/', ''));
    } else {
      const filename = path.basename(audioUrl);
      filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'audio', filename);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Audio file not found on server.' });
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;

    // Estimate byte limit for preview duration
    // Standard high-quality MP3 (320kbps) is ~40 KB/s; 128kbps is ~16 KB/s
    // Cap strictly so unauthenticated users cannot download beyond the preview window
    const previewLimit = Math.min(totalSize, Math.max(256 * 1024, previewDuration * 42 * 1024));

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
    };
    const contentType = mimeTypes[ext] || 'audio/mpeg';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      let end = parts[1] ? parseInt(parts[1], 10) : previewLimit - 1;

      if (start >= previewLimit) {
        res.status(416).set('Content-Range', `bytes */${previewLimit}`).end();
        return;
      }

      if (end >= previewLimit) {
        end = previewLimit - 1;
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${previewLimit}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-store, must-revalidate',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': previewLimit,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store, must-revalidate',
      });
      fs.createReadStream(filePath, { start: 0, end: previewLimit - 1 }).pipe(res);
    }
  } catch (err) {
    console.error('[products] GET /:id/preview error:', err);
    res.status(500).json({ error: 'Failed to stream audio preview.' });
  }
});

/* ── PUT /api/products/:id — protected (admin configure product) ── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { productEnabled, price, productDescription } = req.body;

    const { rows: current } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'Record not found.' });

    const record = current[0];

    // Check if enabling product: require a valid ZIP file to exist!
    const wantsEnabled = Boolean(productEnabled);
    if (wantsEnabled) {
      const zipExists = Boolean(record.digital_file_path && fs.existsSync(record.digital_file_path));
      if (!zipExists) {
        return res.status(400).json({
          error: 'Cannot publish product without a valid digital ZIP file. Please generate or upload an album ZIP first.'
        });
      }
    }

    const newPrice = Math.max(0, Number(price || record.product_price || 0));

    const { rows: updated } = await pool.query(
      `UPDATE records
       SET product_enabled     = $1,
           product_price       = $2,
           product_description = $3,
           product_updated_at  = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        wantsEnabled,
        newPrice,
        productDescription !== undefined ? productDescription : record.product_description,
        req.params.id
      ]
    );

    const trackRows = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    res.json(rowToProduct(updated[0], trackRows.rows));
  } catch (err) {
    console.error('[products] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

/* ── POST /api/products/:id/generate-zip — protected (one-time ZIP generator) ── */
router.post('/:id/generate-zip', authenticate, async (req, res) => {
  try {
    const { rows: records } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!records.length) return res.status(404).json({ error: 'Record not found.' });

    const record = records[0];
    const { rows: tracks } = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    if (!tracks.length) {
      return res.status(400).json({ error: 'Cannot generate ZIP: record has no tracks.' });
    }

    // Generate the ZIP once
    const zipMeta = await generateAlbumZip(record, tracks);

    // Save ZIP metadata to record row
    const { rows: updated } = await pool.query(
      `UPDATE records
       SET digital_file_id   = $1,
           digital_file_name = $2,
           digital_file_size = $3,
           digital_file_hash = $4,
           digital_file_path = $5,
           product_updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        zipMeta.fileId,
        zipMeta.fileName,
        zipMeta.fileSize,
        zipMeta.fileHash,
        zipMeta.filePath,
        req.params.id
      ]
    );

    res.json(rowToProduct(updated[0], tracks));
  } catch (err) {
    console.error('[products] generate-zip error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate album ZIP.' });
  }
});

/* ── POST /api/products/:id/upload-zip — protected (upload custom ZIP) ── */
router.post('/:id/upload-zip', authenticate, uploadZip.single('productZipFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a valid .zip file.' });
    }

    const { rows: records } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!records.length) return res.status(404).json({ error: 'Record not found.' });

    const record   = records[0];
    const filePath = req.file.path;
    const stats    = fs.statSync(filePath);

    // Calculate SHA-256 hash of uploaded file
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const fileName = req.file.originalname || `${record.title}.zip`;
    const fileId   = uuid();

    const { rows: updated } = await pool.query(
      `UPDATE records
       SET digital_file_id   = $1,
           digital_file_name = $2,
           digital_file_size = $3,
           digital_file_hash = $4,
           digital_file_path = $5,
           product_updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [fileId, fileName, stats.size, hash, filePath, req.params.id]
    );

    const { rows: tracks } = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    res.json(rowToProduct(updated[0], tracks));
  } catch (err) {
    console.error('[products] upload-zip error:', err);
    res.status(500).json({ error: 'Failed to upload product ZIP.' });
  }
});

/* ── DELETE /api/products/:id/zip — protected (remove ZIP file) ── */
router.delete('/:id/zip', authenticate, async (req, res) => {
  try {
    deleteAlbumZip(req.params.id);

    const { rows: updated } = await pool.query(
      `UPDATE records
       SET digital_file_id     = '',
           digital_file_name   = '',
           digital_file_size   = 0,
           digital_file_hash   = '',
           digital_file_path   = '',
           product_enabled     = FALSE,
           product_updated_at  = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    const { rows: tracks } = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    res.json(rowToProduct(updated[0], tracks));
  } catch (err) {
    console.error('[products] DELETE /:id/zip error:', err);
    res.status(500).json({ error: 'Failed to delete ZIP.' });
  }
});

module.exports = router;
