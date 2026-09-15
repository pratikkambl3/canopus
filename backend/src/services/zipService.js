/* ================================================================
   CANOPUS — Digital Album ZIP Generator Service
   Creates a reusable, high-efficiency album ZIP once on publish.
   Reused for every customer purchase — NEVER regenerated per order.
   ================================================================ */

const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const archiver = require('archiver');
const { v4: uuid } = require('uuid');

const UPLOAD_DIR            = process.env.UPLOAD_DIR            || path.join(__dirname, '../../uploads');
const DIGITAL_PRODUCTS_PATH = process.env.DIGITAL_PRODUCTS_PATH || path.join(__dirname, '../../data/digital-products');

/**
 * Sanitizes a string for clean file/folder naming inside ZIP
 */
function sanitizeFileName(str) {
  return (str || 'untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolves a URL (e.g. /uploads/audio/uuid.mp3) to a local filesystem path
 */
function resolveUploadPath(url) {
  if (!url) return null;
  // If absolute path already exists
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  
  // Extract relative part after /uploads/
  const match = url.match(/\/uploads\/(.+)$/);
  if (match) {
    const relPath = match[1];
    const absPath = path.join(UPLOAD_DIR, relPath);
    if (fs.existsSync(absPath)) return absPath;
  }

  // Check direct filename in UPLOAD_DIR
  const basename = path.basename(url);
  const directPath = path.join(UPLOAD_DIR, basename);
  if (fs.existsSync(directPath)) return directPath;

  // Check audio/ or artwork/ subdirs
  const inAudio = path.join(UPLOAD_DIR, 'audio', basename);
  if (fs.existsSync(inAudio)) return inAudio;

  const inArtwork = path.join(UPLOAD_DIR, 'artwork', basename);
  if (fs.existsSync(inArtwork)) return inArtwork;

  return null;
}

/**
 * Generates an album ZIP file once and stores it in private digital product storage.
 * @param {Object} record - The record database row
 * @param {Array} tracks - Array of track database rows
 * @returns {Promise<Object>} - { fileId, fileName, filePath, fileSize, fileHash }
 */
async function generateAlbumZip(record, tracks = []) {
  if (!record || !record.id) {
    throw new Error('Valid record is required to generate album ZIP.');
  }

  // Ensure storage directory exists
  const albumDir = path.join(DIGITAL_PRODUCTS_PATH, record.id);
  fs.mkdirSync(albumDir, { recursive: true });

  const safeAlbumTitle = sanitizeFileName(record.title);
  const zipFileName    = `${safeAlbumTitle}.zip`;
  const zipFilePath    = path.join(albumDir, 'album.zip');

  // Create temporary file during compression
  const tempZipPath = `${zipFilePath}.tmp-${Date.now()}`;
  const output = fs.createWriteStream(tempZipPath);
  const archive = archiver('zip', {
    zlib: { level: 6 } // Good compression ratio without CPU choking
  });

  const hash = crypto.createHash('sha256');

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      try {
        // Move tmp file to final destination atomically
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }
        fs.renameSync(tempZipPath, zipFilePath);

        const stats = fs.statSync(zipFilePath);
        const fileHash = hash.digest('hex');

        resolve({
          fileId:   uuid(),
          fileName: zipFileName,
          filePath: zipFilePath,
          fileSize: stats.size,
          fileHash: fileHash,
        });
      } catch (err) {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      if (fs.existsSync(tempZipPath)) {
        try { fs.unlinkSync(tempZipPath); } catch {}
      }
      reject(err);
    });

    // Feed output stream to hash calculation as well
    archive.on('data', (chunk) => {
      hash.update(chunk);
    });

    archive.pipe(output);

    // Root folder inside ZIP: "Album Title/"
    const rootFolder = `${safeAlbumTitle}/`;

    // 1. Add Album Cover Art if available
    if (record.artwork_url) {
      const coverPath = resolveUploadPath(record.artwork_url);
      if (coverPath) {
        const ext = path.extname(coverPath) || '.jpg';
        archive.file(coverPath, { name: `${rootFolder}cover${ext}` });
      }
    }

    // 2. Add Audio Tracks in track_number order
    const sortedTracks = [...tracks].sort((a, b) => (a.track_number || 0) - (b.track_number || 0));

    sortedTracks.forEach((t, idx) => {
      if (t.audio_url) {
        const audioPath = resolveUploadPath(t.audio_url);
        if (audioPath) {
          const trackNum = String(t.track_number || idx + 1).padStart(2, '0');
          const trackTitle = sanitizeFileName(t.title || `Track ${idx + 1}`);
          const ext = path.extname(audioPath) || '.mp3';
          archive.file(audioPath, { name: `${rootFolder}${trackNum} - ${trackTitle}${ext}` });
        }
      }

      // Track artwork if custom per track
      if (t.artwork_url && t.artwork_url !== record.artwork_url) {
        const trackArtPath = resolveUploadPath(t.artwork_url);
        if (trackArtPath) {
          const trackNum = String(t.track_number || idx + 1).padStart(2, '0');
          const ext = path.extname(trackArtPath) || '.jpg';
          archive.file(trackArtPath, { name: `${rootFolder}artwork/track-${trackNum}${ext}` });
        }
      }
    });

    // 3. Add a classy CANOPUS Liner Notes README
    const linerNotes = [
      `================================================================`,
      ` CANOPUS — ${record.title.toUpperCase()}`,
      `================================================================`,
      `Artist:       ${record.artist || 'CANOPUS Collective'}`,
      `Genre:        ${record.genre  || 'Curated'}`,
      `Release Date: ${record.release_date || 'N/A'}`,
      `Total Tracks: ${sortedTracks.length}`,
      ``,
      `Tracklist:`,
      ...sortedTracks.map((t, i) => `  ${String(t.track_number || i + 1).padStart(2, '0')}. ${t.title}`),
      ``,
      `----------------------------------------------------------------`,
      `Thank you for supporting independent music on CANOPUS.`,
      `Timeless Music. Never Gets Old.`,
      `================================================================`,
    ].join('\n');

    archive.append(linerNotes, { name: `${rootFolder}README.txt` });

    archive.finalize();
  });
}

/**
 * Deletes an existing album ZIP file from private storage.
 */
function deleteAlbumZip(recordId) {
  try {
    const albumDir = path.join(DIGITAL_PRODUCTS_PATH, recordId);
    if (fs.existsSync(albumDir)) {
      fs.rmSync(albumDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[zipService] Error deleting album ZIP:', err.message);
  }
}

module.exports = {
  generateAlbumZip,
  deleteAlbumZip,
  resolveUploadPath,
  DIGITAL_PRODUCTS_PATH,
};
