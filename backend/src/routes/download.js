/* ================================================================
   CANOPUS — Secure Digital Download Route
   GET  /api/download/:token/info — token & album metadata (no count increment)
   HEAD /api/download/:token      — inspect headers for download managers (no count increment)
   GET  /api/download/:token      — validates token, streams ZIP with RFC headers
   ================================================================ */

const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');
const { pool } = require('../db');

/**
 * Validates token, payment status, expiration, limits and confirms file on disk.
 */
async function resolveTokenDownload(token) {
  if (!token || token.length < 16) {
    return { error: 'Invalid download token.', status: 400 };
  }

  const { rows } = await pool.query(
    `SELECT dt.*, 
            o.id as order_id, o.order_number, o.payment_status, o.customer_email,
            r.title as album_title, r.artist, r.genre, r.artwork_url,
            r.digital_file_name, r.digital_file_size
     FROM download_tokens dt
     JOIN orders o ON o.id = dt.order_id
     JOIN records r ON r.id = dt.album_id
     WHERE dt.token = $1`,
    [token]
  );

  if (!rows.length) {
    return { error: 'Download link not found or has been revoked.', status: 404 };
  }

  const tokenRow = rows[0];

  // 1. Verify order payment status
  if (tokenRow.payment_status !== 'PAID') {
    return { error: 'Order payment has not been approved yet.', status: 403 };
  }

  // 2. Check token expiration
  const now = new Date();
  if (new Date(tokenRow.expires_at) < now) {
    return { error: 'This download link has expired. Please contact CANOPUS support to request a new link.', status: 410 };
  }

  // 3. Check download limits
  if (tokenRow.download_count >= tokenRow.max_downloads) {
    return { error: `Maximum download limit of ${tokenRow.max_downloads} reached for this link.`, status: 403 };
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
    return { error: 'Digital file is temporarily unavailable. Our team has been notified.', status: 404 };
  }

  const rawName = tokenRow.digital_file_name || `${tokenRow.album_title || 'album'}.zip`;
  const downloadName = rawName.replace(/["'\\]/g, '');
  const safeAscii = downloadName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stats = fs.statSync(filePath);

  return {
    tokenRow,
    filePath,
    stats,
    downloadName,
    safeAscii,
  };
}

/* ── GET /api/download/:token/info — inspect metadata without counting ── */
router.get('/:token/info', async (req, res) => {
  try {
    const result = await resolveTokenDownload(req.params.token);
    if (result.error) {
      return res.status(result.status).json({
        valid: false,
        error: result.error,
      });
    }

    const { tokenRow, stats, downloadName } = result;

    return res.json({
      valid: true,
      token: tokenRow.token,
      orderId: tokenRow.order_id,
      orderNumber: tokenRow.order_number,
      albumId: tokenRow.album_id,
      albumTitle: tokenRow.album_title,
      artist: tokenRow.artist || '',
      genre: tokenRow.genre || 'Vinyl & Digital',
      artworkUrl: tokenRow.artwork_url || null,
      fileName: downloadName,
      fileSize: stats.size,
      downloadUrl: `/api/download/${tokenRow.token}`,
      downloadCount: tokenRow.download_count,
      maxDownloads: tokenRow.max_downloads,
      downloadsRemaining: Math.max(0, tokenRow.max_downloads - tokenRow.download_count),
      expiresAt: tokenRow.expires_at,
    });
  } catch (err) {
    console.error('[download/info] error:', err);
    res.status(500).json({ valid: false, error: 'Failed to inspect download token.' });
  }
});

/* ── HEAD /api/download/:token — metadata headers for download managers ── */
router.head('/:token', async (req, res) => {
  try {
    const result = await resolveTokenDownload(req.params.token);
    if (result.error) {
      return res.status(result.status).end();
    }

    const { stats, downloadName, safeAscii } = result;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-transform, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).end();
  } catch (err) {
    console.error('[download/head] error:', err);
    return res.status(500).end();
  }
});

/* ── GET /api/download/:token — validates token, counts, streams ZIP ── */
router.get('/:token', async (req, res) => {
  try {
    const result = await resolveTokenDownload(req.params.token);
    if (result.error) {
      return res.status(result.status).send(result.error);
    }

    const { tokenRow, filePath, stats, downloadName, safeAscii } = result;

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
          userAgent: req.get('user-agent') || 'unknown',
          ip: req.ip || req.connection?.remoteAddress,
        }),
      ]
    );

    // 6. Securely stream the existing ZIP file with RFC headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-transform, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('[download] Stream read error:', streamErr);
      if (!res.headersSent) {
        res.status(500).send('Error streaming download file.');
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[download] error:', err);
    if (!res.headersSent) {
      res.status(500).send('Internal server error during download.');
    }
  }
});

module.exports = router;
