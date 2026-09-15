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
const { deleteRecordAndAssets } = require('./records');

/* Multer for custom digital ZIP uploads */
const zipStorage = multer.diskStorage({
  destination(req, file, cb) {
    const albumDir = path.join(DIGITAL_PRODUCTS_PATH, req.params.id);
    fs.mkdirSync(albumDir, { recursive: true });
    cb(null, albumDir);
  },
  filename(_req, file, cb) {
    const rand = crypto.randomBytes(6).toString('hex');
    cb(null, `upload-${Date.now()}-${rand}.tmp`);
  },
});

const uploadZip = multer({
  storage: zipStorage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB max
  fileFilter(_req, file, cb) {
    const isZip = file.mimetype === 'application/zip' || 
                  file.mimetype === 'application/x-zip-compressed' ||
                  file.mimetype === 'application/octet-stream' ||
                  path.extname(file.originalname).toLowerCase() === '.zip';
    cb(null, isZip);
  },
});

/**
 * Verifies that the file starts with standard ZIP magic bytes
 */
function verifyZipMagic(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buf, 0, 4, 0);
    if (bytesRead < 4) return false;
    // Standard ZIP: 0x50, 0x4B, 0x03, 0x04
    // Empty ZIP: 0x50, 0x4B, 0x05, 0x06
    // Spanned ZIP: 0x50, 0x4B, 0x07, 0x08
    return buf[0] === 0x50 && buf[1] === 0x4B && (
      (buf[2] === 0x03 && buf[3] === 0x04) ||
      (buf[2] === 0x05 && buf[3] === 0x06) ||
      (buf[2] === 0x07 && buf[3] === 0x08)
    );
  } catch (e) {
    return false;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_) {}
    }
  }
}

/**
 * Calculates SHA-256 hash using streaming chunks (memory safe for 1GB+ files)
 */
function getFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

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
  const previewTrackId = r.preview_track_id || (tracks.length > 0 ? tracks[0].id : null);
  const matchedTrack = tracks.find(t => t.id === previewTrackId) || tracks[0] || null;

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
    isProductOnly:      Boolean(r.is_product_only),
    is_product_only:     Boolean(r.is_product_only),
    productEnabled:     Boolean(r.product_enabled),
    price:              Number(r.product_price || 0),
    productDescription: r.product_description || r.description || '',
    // Preview Configuration
    previewEnabled:     r.preview_enabled !== false,
    previewTrackId:     previewTrackId,
    previewStartTime:   Number(r.preview_start_time || 0),
    previewEndTime:     Number(r.preview_end_time || 0),
    previewDuration:    null,
    previewTrack: matchedTrack ? {
      id: matchedTrack.id,
      title: matchedTrack.title,
      artist: matchedTrack.artist || r.artist || '',
      duration: matchedTrack.duration,
      trackNumber: matchedTrack.track_number,
    } : null,
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

/* ── GET /api/products/:id/preview — public (strictly bounded audio preview streaming) ── */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { trackId } = req.query;

    const { rows: records } = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
    if (!records.length) return res.status(404).json({ error: 'Record not found.' });

    const record = records[0];

    // Find requested track or default to configured preview track or first track
    let trackQuery = 'SELECT * FROM tracks WHERE record_id = $1';
    const params = [id];
    if (trackId) {
      trackQuery += ' AND id = $2';
      params.push(trackId);
    } else if (record.preview_track_id) {
      trackQuery += ' AND id = $2';
      params.push(record.preview_track_id);
    } else {
      trackQuery += ' ORDER BY track_number ASC LIMIT 1';
    }

    const { rows: tracks } = await pool.query(trackQuery, params);
    if (!tracks.length || !tracks[0].audio_url) {
      return res.status(404).json({ error: 'No preview audio available.' });
    }

    const track = tracks[0];
    const globalDefault = await getPreviewDuration();

    // Determine configured preview window
    const startTime = Math.max(0, Number(record.preview_start_time || 0));
    let endTime = Number(record.preview_end_time || (startTime + globalDefault));
    if (endTime <= startTime) {
      endTime = startTime + globalDefault;
    }
    const previewDuration = endTime - startTime;

    // Locate file on disk
    const audioUrl = track.audio_url;
    let cleanUrl = audioUrl;
    try {
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        cleanUrl = new URL(cleanUrl).pathname;
      }
    } catch (_) {}
    cleanUrl = cleanUrl.split('?')[0].split('#')[0];

    let filePath;
    if (cleanUrl.startsWith('/uploads/audio/')) {
      const filename = path.basename(cleanUrl);
      filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'audio', filename);
    } else if (cleanUrl.startsWith('/uploads/')) {
      filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', cleanUrl.replace(/^\/uploads\//, ''));
    } else {
      const filename = path.basename(cleanUrl);
      filePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', 'audio', filename);
    }

    if (!fs.existsSync(filePath)) {
      const directFallback = path.join(process.env.UPLOAD_DIR || '/app/uploads', path.basename(cleanUrl));
      if (fs.existsSync(directFallback)) {
        filePath = directFallback;
      } else {
        return res.status(404).json({ error: 'Audio file not found on server.' });
      }
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;

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

    // Stream full audio without 30s limit
    let byteStart = 0;
    let byteEnd = totalSize - 1;
    const previewWindowSize = totalSize;

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const clientReqStart = parseInt(parts[0], 10) || 0;
      const streamStart = byteStart + clientReqStart;

      if (streamStart > byteEnd) {
        res.status(416).set('Content-Range', `bytes */${previewWindowSize}`).end();
        return;
      }

      let clientReqEnd = parts[1] ? parseInt(parts[1], 10) : previewWindowSize - 1;
      let streamEnd = byteStart + clientReqEnd;
      if (streamEnd > byteEnd) {
        streamEnd = byteEnd;
      }

      const chunkSize = (streamEnd - streamStart) + 1;
      const fileStream = fs.createReadStream(filePath, { start: streamStart, end: streamEnd });

      res.writeHead(206, {
        'Content-Range': `bytes ${clientReqStart}-${clientReqStart + chunkSize - 1}/${previewWindowSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-store, must-revalidate',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': previewWindowSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store, must-revalidate',
      });
      fs.createReadStream(filePath, { start: byteStart, end: byteEnd }).pipe(res);
    }
  } catch (err) {
    console.error('[products] GET /:id/preview error:', err);
    res.status(500).json({ error: 'Failed to stream audio preview.' });
  }
});

/* ── PUT /api/products/:id — protected (admin configure product) ── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      productEnabled,
      price,
      productDescription,
      previewEnabled,
      previewTrackId,
      previewStartTime,
      previewEndTime,
      previewDuration,
    } = req.body;

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

    const newPrice = Math.max(0, Number(price !== undefined ? price : record.product_price || 0));
    const newDesc = productDescription !== undefined ? productDescription : record.product_description;

    const newPreviewEnabled = previewEnabled !== undefined ? Boolean(previewEnabled) : (record.preview_enabled !== false);
    const newPreviewTrackId = previewTrackId !== undefined ? (previewTrackId || null) : record.preview_track_id;
    const newPreviewStartTime = previewStartTime !== undefined ? Math.max(0, Number(previewStartTime)) : Number(record.preview_start_time || 0);
    const newPreviewEndTime = previewEndTime !== undefined ? Math.max(newPreviewStartTime + 1, Number(previewEndTime)) : Number(record.preview_end_time || 30);
    const newPreviewDuration = previewDuration !== undefined ? Math.max(1, Number(previewDuration)) : (newPreviewEndTime - newPreviewStartTime);

    const { rows: updated } = await pool.query(
      `UPDATE records
       SET product_enabled     = $1,
           product_price       = $2,
           product_description = $3,
           preview_enabled     = $4,
           preview_track_id    = $5,
           preview_start_time  = $6,
           preview_end_time    = $7,
           preview_duration    = $8,
           product_updated_at  = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        wantsEnabled,
        newPrice,
        newDesc,
        newPreviewEnabled,
        newPreviewTrackId,
        newPreviewStartTime,
        newPreviewEndTime,
        newPreviewDuration,
        req.params.id
      ]
    );

    const trackRows = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    const globalPreviewDur = await getPreviewDuration();
    res.json(rowToProduct(updated[0], trackRows.rows, globalPreviewDur));
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

    const previewDuration = await getPreviewDuration();
    res.json(rowToProduct(updated[0], tracks, previewDuration));
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
    if (!records.length) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Record not found.' });
    }

    const record   = records[0];
    const filePath = req.file.path;

    // Validate ZIP magic header
    if (!verifyZipMagic(filePath)) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Uploaded file is not a valid ZIP archive.' });
    }

    // Safely promote validated upload to album.zip
    const finalPath = path.join(path.dirname(filePath), 'album.zip');
    if (filePath !== finalPath) {
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      fs.renameSync(filePath, finalPath);
    }

    const stats = fs.statSync(finalPath);

    // Calculate SHA-256 hash streamingly (memory safe for 1GB+)
    const hash = await getFileSha256(finalPath);

    const fileName = req.file.originalname || `${record.title}.zip`;
    const fileId   = crypto.randomUUID ? crypto.randomUUID() : `zip-${Date.now()}`;

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
      [fileId, fileName, stats.size, hash, finalPath, req.params.id]
    );

    const { rows: tracks } = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    const previewDuration = await getPreviewDuration();
    res.json(rowToProduct(updated[0], tracks, previewDuration));
  } catch (err) {
    console.error('[products] upload-zip error:', err);
    res.status(500).json({ error: 'Failed to upload product ZIP: ' + err.message });
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

/* ── DELETE /api/products/:id — protected (delete product or unpublish from store) ── */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const storeOnly = req.query.storeOnly === 'true' || req.body?.storeOnly === true;

    const { rows: records } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!records.length) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const record = records[0];

    // If storeOnly is requested and it's NOT a product-only record, simply remove product status and ZIP
    if (storeOnly && !record.is_product_only) {
      // Check if any orders exist for this album before deleting ZIP
      const orderCheck = await pool.query(
        'SELECT COUNT(*) AS count FROM order_items WHERE album_id = $1',
        [req.params.id]
      );
      const hasOrders = parseInt(orderCheck.rows[0].count, 10) > 0;

      // If no orders, safely delete the ZIP file from disk
      if (!hasOrders) {
        deleteAlbumZip(req.params.id);
      }

      await pool.query(
        `UPDATE records
         SET product_enabled     = FALSE,
             digital_file_id     = '',
             digital_file_name   = '',
             digital_file_size   = 0,
             digital_file_hash   = '',
             digital_file_path   = '',
             product_updated_at  = NOW()
         WHERE id = $1`,
        [req.params.id]
      );

      return res.json({
        success: true,
        message: `Product "${record.title}" removed from store. Record preserved in library.`,
        storeOnly: true,
      });
    }

    // Otherwise, full safe deletion of record and assets
    const result = await deleteRecordAndAssets(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[products] DELETE /:id error:', err);
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.status(500).json({ error: err.message || 'Failed to delete product.' });
  }
});

module.exports = router;

