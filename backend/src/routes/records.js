/* ================================================================
   CANOPUS — Records REST API
   GET    /api/records         — public
   GET    /api/records/:id     — public
   POST   /api/records         — protected (JWT)
   PUT    /api/records/:id     — protected (JWT)
   DELETE /api/records/:id     — protected (JWT)
   ================================================================ */

const router       = require('express').Router();
const path         = require('path');
const fs           = require('fs');
const multer       = require('multer');
const { v4: uuid } = require('uuid');
const { pool }     = require('../db');
const { authenticate } = require('../middleware/auth');

/* ── Multer storage ── */
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

const storage = multer.diskStorage({
  destination(req, file, cb) {
    let type = 'misc';
    if (file.fieldname === 'audioFiles' || file.fieldname === 'audioFile') type = 'audio';
    else if (file.fieldname === 'artworkFile') type = 'artwork';
    else if (file.fieldname === 'trackArtworkFiles') type = 'artwork';

    const dest = path.join(UPLOAD_DIR, type);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB to support multiple tracks
  fileFilter(_req, file, cb) {
    const allowed = /audio\/(mpeg|wav|ogg|aac|flac|mp4)|image\/(jpeg|png|webp|gif)/;
    cb(null, allowed.test(file.mimetype));
  },
});

/* Upload fields */
const uploadFields = upload.fields([
  { name: 'artworkFile',        maxCount: 1  },
  { name: 'audioFiles',         maxCount: 30 },
  { name: 'trackArtworkFiles',  maxCount: 30 },
]);

/* ── Helper: DB row → client shape ── */
function rowToRecord(r, tracks = []) {
  const hasZip = Boolean(r.digital_file_path && fs.existsSync(r.digital_file_path));

  return {
    id:                 r.id,
    title:              r.title,
    artist:             r.artist || '',
    genre:              r.genre,
    releaseDate:        r.release_date ? r.release_date.toISOString().split('T')[0] : '',
    releaseYear:        r.release_date ? r.release_date.toISOString().split('T')[0].slice(0, 4) : '',
    featured:           r.featured,
    artworkUrl:         r.artwork_url || null,
    description:        r.description || '',
    trackCount:         tracks.length,
    createdAt:          r.created_at,
    updatedAt:          r.updated_at,
    // Digital store product fields
    productEnabled:     Boolean(r.product_enabled),
    product_enabled:    Boolean(r.product_enabled),
    price:              Number(r.product_price != null ? r.product_price : 0),
    product_price:      Number(r.product_price != null ? r.product_price : 0),
    productPrice:       Number(r.product_price != null ? r.product_price : 0),
    productDescription: r.product_description || r.description || '',
    // Preview fields
    previewEnabled:     r.preview_enabled !== false,
    previewTrackId:     r.preview_track_id || (tracks.length > 0 ? tracks[0].id : null),
    previewStartTime:   Number(r.preview_start_time || 0),
    previewEndTime:     Number(r.preview_end_time || 30),
    previewDuration:    Number(r.preview_duration || (Number(r.preview_end_time || 30) - Number(r.preview_start_time || 0)) || 30),
    digitalFile: {
      exists:    hasZip,
      fileName:  r.digital_file_name || `${r.title}.zip`,
      fileSize:  Number(r.digital_file_size || 0),
      fileHash:  r.digital_file_hash || '',
      updatedAt: r.product_updated_at,
    },
    digital_file_path:  r.digital_file_path || null,
    digital_file_name:  r.digital_file_name || null,
    digital_file_size:  r.digital_file_size || null,
    digital_file_hash:  r.digital_file_hash || null,
    tracks:        tracks.map(t => ({
      id:           t.id,
      recordId:     t.record_id,
      title:        t.title,
      originalTitle: t.original_title,
      version:      t.version,
      bpm:          (t.bpm && Number(t.bpm) > 0) ? Number(t.bpm) : null,
      key:          t.key,
      audioUrl:     t.audio_url,
      artworkUrl:   t.artwork_url || null,
      trackNumber:  t.track_number,
      duration:     t.duration || null,
    })).sort((a, b) => a.trackNumber - b.trackNumber)
  };
}

/* ── Helper: extract uploaded file URL ── */
function fileUrl(req, fieldName, subdir, index = 0) {
  const files = req.files || {};
  const arr   = files[fieldName];
  if (!arr || !arr.length || !arr[index]) return null;
  const filename = arr[index].filename;
  const publicUrl = process.env.PUBLIC_URL || '';
  return `${publicUrl}/uploads/${subdir}/${filename}`;
}

/* ── GET /api/records ── */
router.get('/', async (_req, res) => {
  try {
    const recordsResult = await pool.query(
      `SELECT * FROM records ORDER BY release_date DESC NULLS LAST, created_at DESC`
    );
    const tracksResult = await pool.query(
      `SELECT * FROM tracks ORDER BY track_number ASC`
    );

    // Group tracks by record_id
    const tracksByRecord = {};
    for (const t of tracksResult.rows) {
      if (!tracksByRecord[t.record_id]) tracksByRecord[t.record_id] = [];
      tracksByRecord[t.record_id].push(t);
    }

    const records = recordsResult.rows.map(r => rowToRecord(r, tracksByRecord[r.id] || []));
    res.json(records);
  } catch (err) {
    console.error('[records] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch records.' });
  }
});

/* ── GET /api/records/:id ── */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found.' });

    const trackRows = await pool.query('SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC', [req.params.id]);
    
    res.json(rowToRecord(rows[0], trackRows.rows));
  } catch (err) {
    console.error('[records] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch record.' });
  }
});

/* ── POST /api/records — protected ── */
router.post('/', authenticate, uploadFields, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      id, title, artist, description, genre, releaseDate, featured, tracksData,
      price, productPrice, productDescription, productEnabled
    } = req.body;

    const recordId   = id || `record-${uuid()}`;
    const artworkUrl = fileUrl(req, 'artworkFile', 'artwork');
    const initPrice  = price !== undefined ? Math.max(0, Number(price)) : (productPrice !== undefined ? Math.max(0, Number(productPrice)) : 0);

    const { rows: recordRows } = await client.query(
      `INSERT INTO records
         (id, title, artist, description, genre, release_date, featured, artwork_url, product_price, product_description, product_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        recordId,
        title || 'Untitled Record',
        artist || '',
        description || '',
        genre || 'Experimental',
        releaseDate || null,
        featured === 'true' || featured === true,
        artworkUrl || req.body.artworkUrl || '',
        initPrice,
        productDescription || description || '',
        productEnabled === 'true' || productEnabled === true,
      ]
    );

    // Process tracks
    const parsedTracks = tracksData ? JSON.parse(tracksData) : [];
    const insertedTracks = [];

    for (let i = 0; i < parsedTracks.length; i++) {
      const t = parsedTracks[i];
      const tId = t.id || `track-${uuid()}`;
      
      // Audio file: use newly uploaded file at audioFileIndex, or fallback to existing URL
      const aUrl = (t.audioFileIndex !== undefined && t.audioFileIndex !== null)
        ? (fileUrl(req, 'audioFiles', 'audio', t.audioFileIndex) || t.audioUrl || '')
        : (fileUrl(req, 'audioFiles', 'audio', i) || t.audioUrl || '');

      // Track artwork: use uploaded file at artworkFileIndex, or fallback
      const trackArtworkUrl = (t.artworkFileIndex !== undefined && t.artworkFileIndex !== null)
        ? (fileUrl(req, 'trackArtworkFiles', 'artwork', t.artworkFileIndex) || t.artworkUrl || '')
        : (t.artworkUrl || '');

      const rawBpm = t.bpm !== undefined && t.bpm !== null && t.bpm !== '' ? parseInt(t.bpm, 10) : null;
      const bpmVal = (!isNaN(rawBpm) && rawBpm > 0) ? rawBpm : null;

      const { rows: trackRows } = await client.query(
        `INSERT INTO tracks
           (id, record_id, title, original_title, version, bpm, key, audio_url, artwork_url, track_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          tId,
          recordId,
          t.title || 'Untitled Track',
          t.originalTitle || '',
          t.version || '',
          bpmVal,
          t.key || '',
          aUrl,
          trackArtworkUrl,
          i + 1
        ]
      );
      insertedTracks.push(trackRows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(rowToRecord(recordRows[0], insertedTracks));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[records] POST error:', err);
    res.status(500).json({ error: 'Failed to create record.' });
  } finally {
    client.release();
  }
});

/* ── PUT /api/records/:id — protected ── */
router.put('/:id', authenticate, uploadFields, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      title, artist, description, genre, releaseDate, featured, tracksData,
      price, productPrice, productDescription, productEnabled,
      previewEnabled, previewTrackId, previewStartTime, previewEndTime, previewDuration
    } = req.body;

    const existing = await client.query('SELECT * FROM records WHERE id = $1', [id]);
    if (!existing.rows.length) throw new Error('NOT_FOUND');

    const prev = existing.rows[0];
    const newArtworkUrl = fileUrl(req, 'artworkFile', 'artwork') || req.body.artworkUrl || prev.artwork_url;
    const updatedPrice = price !== undefined ? Math.max(0, Number(price)) : (productPrice !== undefined ? Math.max(0, Number(productPrice)) : prev.product_price);
    const updatedDesc  = description !== undefined ? description : (productDescription !== undefined ? productDescription : prev.description);
    const updatedArtist = artist !== undefined ? artist : prev.artist;
    const updatedEnabled = productEnabled !== undefined ? (productEnabled === 'true' || productEnabled === true) : prev.product_enabled;

    const updatedPreviewEnabled = previewEnabled !== undefined ? (previewEnabled === 'true' || previewEnabled === true) : (prev.preview_enabled !== false);
    const updatedPreviewTrackId = previewTrackId !== undefined ? (previewTrackId || null) : prev.preview_track_id;
    const updatedPreviewStartTime = previewStartTime !== undefined ? Math.max(0, Number(previewStartTime)) : Number(prev.preview_start_time || 0);
    const updatedPreviewEndTime = previewEndTime !== undefined ? Math.max(updatedPreviewStartTime + 1, Number(previewEndTime)) : Number(prev.preview_end_time || 30);
    const updatedPreviewDuration = previewDuration !== undefined ? Math.max(1, Number(previewDuration)) : (updatedPreviewEndTime - updatedPreviewStartTime);

    const { rows: recordRows } = await client.query(
      `UPDATE records SET
         title = $1, artist = $2, description = $3, genre = $4, release_date = $5, featured = $6,
         artwork_url = $7, product_price = $8, product_description = $9, product_enabled = $10,
         preview_enabled = $11, preview_track_id = $12, preview_start_time = $13, preview_end_time = $14, preview_duration = $15,
         updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        title ?? prev.title,
        updatedArtist ?? '',
        updatedDesc ?? '',
        genre ?? prev.genre,
        releaseDate || prev.release_date,
        featured === 'true' || featured === true || (featured === undefined && prev.featured),
        newArtworkUrl,
        updatedPrice,
        productDescription !== undefined ? productDescription : prev.product_description,
        updatedEnabled,
        updatedPreviewEnabled,
        updatedPreviewTrackId,
        updatedPreviewStartTime,
        updatedPreviewEndTime,
        updatedPreviewDuration,
        id,
      ]
    );

    let parsedTracks = null;
    if (tracksData) {
      try {
        parsedTracks = typeof tracksData === 'string' ? JSON.parse(tracksData) : tracksData;
      } catch (_) {}
    } else if (req.body.tracks && Array.isArray(req.body.tracks)) {
      parsedTracks = req.body.tracks;
    }

    const insertedTracks = [];

    if (parsedTracks !== null) {
      // Delete old tracks and re-insert to handle reordering/deletions cleanly
      await client.query('DELETE FROM tracks WHERE record_id = $1', [id]);

      for (let i = 0; i < parsedTracks.length; i++) {
        const t = parsedTracks[i];
        const tId = t.id && !t.id.startsWith('new-') ? t.id : `track-${uuid()}`;
        
        // Audio file
        let aUrl = t.audioUrl || t.audio_url || '';
        if (t.audioFileIndex !== undefined && t.audioFileIndex !== null) {
          aUrl = fileUrl(req, 'audioFiles', 'audio', t.audioFileIndex) || aUrl;
        }

        // Track artwork
        let trackArtworkUrl = t.artworkUrl || t.artwork_url || '';
        if (t.artworkFileIndex !== undefined && t.artworkFileIndex !== null) {
          trackArtworkUrl = fileUrl(req, 'trackArtworkFiles', 'artwork', t.artworkFileIndex) || trackArtworkUrl;
        }

        const rawBpm = t.bpm !== undefined && t.bpm !== null && t.bpm !== '' ? parseInt(t.bpm, 10) : null;
        const bpmVal = (!isNaN(rawBpm) && rawBpm > 0) ? rawBpm : null;

        const { rows: trackRows } = await client.query(
          `INSERT INTO tracks
             (id, record_id, title, original_title, version, bpm, key, audio_url, artwork_url, track_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            tId,
            id,
            t.title || 'Untitled Track',
            t.originalTitle || t.original_title || '',
            t.version || '',
            bpmVal,
            t.key || '',
            aUrl,
            trackArtworkUrl,
            i + 1
          ]
        );
        insertedTracks.push(trackRows[0]);
      }
    } else {
      const { rows: existingTracks } = await client.query('SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC', [id]);
      insertedTracks.push(...existingTracks);
    }

    await client.query('COMMIT');
    res.json(rowToRecord(recordRows[0], insertedTracks));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[records] PUT error:', err);
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Record not found.' });
    res.status(500).json({ error: 'Failed to update record.' });
  } finally {
    client.release();
  }
});

/* ── DELETE /api/records/:id — protected ── */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM records WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found.' });

    // Tracks are cascade deleted in DB.
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    console.error('[records] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

module.exports = router;
