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
 * Maps DB row to frontend product format
 */
function rowToProduct(r, tracks = []) {
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
      bpm:          t.bpm,
      key:          t.key,
      audioUrl:     t.audio_url,
      artworkUrl:   t.artwork_url || r.artwork_url || null,
      trackNumber:  t.track_number,
      duration:     t.duration || null,
    })).sort((a, b) => a.trackNumber - b.trackNumber),
  };
}

/* ── GET /api/products — public (active products for store) ── */
router.get('/', async (req, res) => {
  try {
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

    const products = records.map(r => rowToProduct(r, tracksByRecord[r.id] || []));
    res.json(products);
  } catch (err) {
    console.error('[products] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

/* ── GET /api/products/:id — public ── */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });

    const trackRows = await pool.query(
      'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
      [req.params.id]
    );

    res.json(rowToProduct(rows[0], trackRows.rows));
  } catch (err) {
    console.error('[products] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch product.' });
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
