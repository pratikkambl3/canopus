/* ================================================================
   CANOPUS — Secure Digital Download Route
   GET /api/download/:token — validates token, checks order payment, streams ZIP
   ================================================================ */

const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');
const { pool } = require('../db');

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 16) {
      return res.status(400).send('Invalid download token.');
    }

    const { rows } = await pool.query(
      `SELECT dt.*, 
              o.order_number, o.payment_status, o.customer_email,
              r.title as album_title, r.digital_file_name
       FROM download_tokens dt
       JOIN orders o ON o.id = dt.order_id
       JOIN records r ON r.id = dt.album_id
       WHERE dt.token = $1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).send('Download link not found or has been revoked.');
    }

    const tokenRow = rows[0];

    // 1. Verify order payment status
    if (tokenRow.payment_status !== 'PAID') {
      return res.status(403).send('Order payment has not been approved yet.');
    }

    // 2. Check token expiration
    const now = new Date();
    if (new Date(tokenRow.expires_at) < now) {
      return res.status(410).send('This download link has expired. Please contact CANOPUS support to request a new link.');
    }

    // 3. Check download limits
    if (tokenRow.download_count >= tokenRow.max_downloads) {
      return res.status(403).send(`Maximum download limit of ${tokenRow.max_downloads} reached for this link.`);
    }

    // 4. Verify file exists on disk (with auto-generation fallback)
    let filePath = tokenRow.file_path;
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`[download] File missing on disk for token ${token}: ${filePath}. Attempting dynamic generation...`);
      try {
        const { rows: tracks } = await pool.query(
          'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
          [tokenRow.album_id]
        );
        if (tracks.length > 0) {
          const { generateAlbumZip } = require('../services/zipService');
          const zipMeta = await generateAlbumZip(
            { id: tokenRow.album_id, title: tokenRow.album_title || 'Album' },
            tracks
          );
          filePath = zipMeta.filePath;
          await pool.query(
            `UPDATE download_tokens SET file_path = $1 WHERE id = $2`,
            [filePath, tokenRow.id]
          );
          await pool.query(
            `UPDATE records
             SET digital_file_id   = $1,
                 digital_file_name = $2,
                 digital_file_size = $3,
                 digital_file_hash = $4,
                 digital_file_path = $5,
                 product_updated_at = NOW()
             WHERE id = $6`,
            [zipMeta.fileId, zipMeta.fileName, zipMeta.fileSize, zipMeta.fileHash, zipMeta.filePath, tokenRow.album_id]
          );
        }
      } catch (genErr) {
        console.error('[download] Failed to dynamically generate ZIP:', genErr);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`[download] File missing on disk for token ${token}:`, filePath);
      return res.status(404).send('Digital file is temporarily unavailable. Our team has been notified.');
    }

    // 5. Increment download count
    await pool.query(
      `UPDATE download_tokens 
       SET download_count = download_count + 1,
           last_downloaded_at = NOW()
       WHERE id = $1`,
      [tokenRow.id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO order_audit_logs (id, order_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tokenRow.order_id,
        'FILE_DOWNLOADED',
        tokenRow.customer_email,
        JSON.stringify({
          albumTitle: tokenRow.album_title,
          token: tokenRow.token,
          count: tokenRow.download_count + 1,
        }),
      ]
    );

    // 6. Securely stream the existing ZIP file
    const rawName = tokenRow.digital_file_name || `${tokenRow.album_title || 'album'}.zip`;
    const downloadName = rawName.replace(/["'\\]/g, '');
    res.setHeader('Content-Type', 'application/zip');
    res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) {
        console.error('[download] Stream error:', err);
        res.status(500).send('Error streaming download.');
      }
    });
  } catch (err) {
    console.error('[download] error:', err);
    res.status(500).send('Internal server error during download.');
  }
});

module.exports = router;
