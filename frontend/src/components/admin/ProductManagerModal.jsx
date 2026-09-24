/* ================================================================
   CANOPUS — Admin Product Manager Modal
   Configure digital album pricing, generate/upload reusable ZIPs,
   and publish albums to the Products digital store.
   ================================================================ */

import { useState, useRef, useEffect } from 'react';
import { updateProduct, generateProductZip, uploadProductZip, deleteProductZip } from '../../services/adminStoreService';
import { IconCheck } from '../shared/Icons';

export default function ProductManagerModal({ record, onClose, onUpdated }) {
  const [enabled, setEnabled]         = useState(Boolean(record.productEnabled ?? record.product_enabled));
  const [price, setPrice]             = useState(Number(record.price ?? record.product_price ?? 0));
  const [description, setDescription] = useState(record.productDescription ?? record.product_description ?? record.description ?? '');

  // Digital file state
  const [digitalFile, setDigitalFile] = useState(record.digitalFile || {
    exists:   Boolean(record.digital_file_path),
    fileName: record.digital_file_name || '',
    fileSize: Number(record.digital_file_size || 0),
    fileHash: record.digital_file_hash || '',
  });

  // Track preview timing state
  const [previewEnabled, setPreviewEnabled] = useState(
    record.previewEnabled !== undefined ? Boolean(record.previewEnabled) :
    record.preview_enabled !== undefined ? Boolean(record.preview_enabled) : true
  );

  const initialTrackId = record.previewTrackId || record.preview_track_id || (record.tracks?.[0]?.id || '');
  const [previewTrackId, setPreviewTrackId] = useState(initialTrackId);

  const [previewStartTime, setPreviewStartTime] = useState(
    record.previewStartTime ?? record.preview_start_time ?? 0
  );
  const [previewEndTime, setPreviewEndTime] = useState(
    record.previewEndTime ?? record.preview_end_time ?? 30
  );

  // Audition player state
  const [auditionPlaying, setAuditionPlaying] = useState(false);
  const [auditionTime, setAuditionTime]       = useState(0);
  const auditionAudioRef                      = useRef(null);

  const [saving, setSaving]                 = useState(false);
  const [generating, setGenerating]         = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError]                   = useState(null);
  const [successMsg, setSuccessMsg]         = useState(null);

  const fileInputRef = useRef(null);

  const previewDuration = Math.max(0, Number(previewEndTime || 0) - Number(previewStartTime || 0));

  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current.src = '';
      }
    };
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const stopAudition = () => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current.currentTime = 0;
    }
    setAuditionPlaying(false);
    setAuditionTime(0);
  };

  const toggleAudition = () => {
    if (auditionPlaying) {
      stopAudition();
      return;
    }

    const selectedTrack = record.tracks?.find(t => t.id === previewTrackId) || record.tracks?.[0];
    if (!selectedTrack) {
      setError('No track available to audition preview.');
      return;
    }

    if (!auditionAudioRef.current) {
      auditionAudioRef.current = new Audio();
    }
    const audio = auditionAudioRef.current;
    const BASE = import.meta.env.VITE_API_URL || '/api';
    audio.src = `${BASE}/products/${record.id}/preview?trackId=${selectedTrack.id}`;
    audio.currentTime = 0;
    setAuditionTime(0);
    setAuditionPlaying(true);

    audio.ontimeupdate = () => {
      setAuditionTime(audio.currentTime);
      if (audio.currentTime >= previewDuration && previewDuration > 0) {
        stopAudition();
      }
    };

    audio.onended = () => {
      stopAudition();
    };

    audio.onerror = () => {
      stopAudition();
      setError('Preview stream unavailable for selected track.');
    };

    audio.play().catch(err => {
      if (err.name !== 'AbortError') {
        stopAudition();
        setError('Audition playback failed: ' + err.message);
      }
    });
  };

  const handleGenerateZip = async () => {
    setError(null);
    setSuccessMsg(null);
    setGenerating(true);
    try {
      const updated = await generateProductZip(record.id);
      setDigitalFile(updated.digitalFile);
      setSuccessMsg('Album ZIP generated successfully from existing track files.');
      onUpdated && onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to generate ZIP.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadZip = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const updated = await uploadProductZip(record.id, file, (percent) => {
        setUploadProgress(percent);
      });
      setDigitalFile(updated.digitalFile);
      setSuccessMsg(`Custom album ZIP uploaded successfully (${file.name}).`);
      onUpdated && onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to upload ZIP.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteZip = async () => {
    if (!window.confirm('Remove this digital ZIP file? The product will be unpublished until a new ZIP is provided.')) return;
    setError(null);
    try {
      const updated = await deleteProductZip(record.id);
      setDigitalFile(updated.digitalFile);
      setEnabled(false);
      setSuccessMsg('Digital ZIP removed.');
      onUpdated && onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to remove ZIP.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (enabled && !digitalFile.exists) {
      setError('Cannot publish product without a valid digital ZIP file. Please generate or upload an album ZIP first.');
      return;
    }

    if (previewEnabled && previewEndTime <= previewStartTime) {
      setError('Preview end time must be greater than start time.');
      return;
    }

    setSaving(true);
    try {
      await updateProduct(record.id, {
        productEnabled:     enabled,
        price:              Number(price),
        productDescription: description.trim(),
        previewEnabled:     previewEnabled,
        previewTrackId:     previewTrackId || null,
        previewStartTime:   Number(previewStartTime),
        previewEndTime:     Number(previewEndTime),
        previewDuration:    previewDuration,
      });
      setSuccessMsg('Product settings saved successfully.');
      onUpdated && onUpdated();
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err.message || 'Failed to save product settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal__header">
          <div>
            <span className="modal__eyebrow">DIGITAL STORE</span>
            <h2 className="modal__title">Product Settings — {record.title}</h2>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="admin-alert admin-alert--error">{error}</div>}
        {successMsg && <div className="admin-alert admin-alert--success"><IconCheck /> {successMsg}</div>}

        <form onSubmit={handleSave} className="modal__body">
          {/* Enable Product Toggle */}
          <div className="admin-toggle-row">
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-primary)' }}>
                Enable as Product for Sale
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                When enabled, this album appears in the CANOPUS Products storefront for purchase.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>

          {/* Pricing */}
          <div className="form-group" style={{ marginTop: 20 }}>
            <label className="form-label" htmlFor="productPrice">Price (₹ INR) *</label>
            <input
              id="productPrice"
              type="number"
              min="0"
              step="1"
              className="form-input"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
            />
            <span className="form-hint">Displayed on the product card and checkout page.</span>
          </div>

          {/* Product Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="productDesc">Product Description</label>
            <textarea
              id="productDesc"
              rows={3}
              className="form-textarea"
              placeholder="Add product highlights or audio fidelity notes for listeners…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* ── Audio Preview Configuration ── */}
          <div className="admin-zip-box" style={{ marginTop: 20 }}>
            <div className="admin-zip-box__header">
              <h4 className="admin-zip-box__title">Audio Track Preview Timing</h4>
              <label className="switch" style={{ marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={previewEnabled}
                  onChange={e => {
                    setPreviewEnabled(e.target.checked);
                    if (!e.target.checked && auditionPlaying) stopAudition();
                  }}
                />
                <span className="slider" />
              </label>
            </div>

            <p className="admin-zip-box__desc">
              Select the preview track and define the start/end window for storefront listening.
              The server enforces byte bounds so full tracks cannot be intercepted or downloaded.
            </p>

            {previewEnabled && (
              <div style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="previewTrackSelect">Select Preview Track</label>
                  <select
                    id="previewTrackSelect"
                    className="form-input"
                    value={previewTrackId}
                    onChange={e => {
                      setPreviewTrackId(e.target.value);
                      if (auditionPlaying) stopAudition();
                    }}
                  >
                    {record.tracks && record.tracks.length > 0 ? (
                      record.tracks.map((t, idx) => (
                        <option key={t.id} value={t.id}>
                          {t.trackNumber || (idx + 1)}. {t.title} {t.duration ? `(${formatTime(t.duration)})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">No tracks available</option>
                    )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="previewStartTime">Start Time (sec)</label>
                    <input
                      id="previewStartTime"
                      type="number"
                      min="0"
                      step="1"
                      className="form-input"
                      value={previewStartTime}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setPreviewStartTime(val);
                        if (previewEndTime <= val) setPreviewEndTime(val + 30);
                        if (auditionPlaying) stopAudition();
                      }}
                    />
                    <span className="form-hint">{formatTime(previewStartTime)}</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="previewEndTime">End Time (sec)</label>
                    <input
                      id="previewEndTime"
                      type="number"
                      min={Number(previewStartTime) + 1}
                      step="1"
                      className="form-input"
                      value={previewEndTime}
                      onChange={e => {
                        const val = Math.max(Number(previewStartTime) + 1, parseInt(e.target.value, 10) || (Number(previewStartTime) + 30));
                        setPreviewEndTime(val);
                        if (auditionPlaying) stopAudition();
                      }}
                    />
                    <span className="form-hint">{formatTime(previewEndTime)}</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Preview Window</label>
                    <div
                      className="form-input"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.04)',
                        fontWeight: 600,
                        cursor: 'default',
                      }}
                    >
                      <span>{previewDuration}s</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({formatTime(previewDuration)})</span>
                    </div>
                    <span className="form-hint">Auto-calculated</span>
                  </div>
                </div>

                {/* Audition Player */}
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 14px',
                    borderRadius: 4,
                    background: 'var(--ivory-mid, #f4f3f0)',
                    border: '1px solid var(--border-subtle, #e5e3dc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={toggleAudition}
                    >
                      {auditionPlaying ? '⏸ Pause Audition' : '▶ Audition Preview Segment'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {auditionPlaying
                        ? `Playing: ${formatTime(auditionTime)} / ${formatTime(previewDuration)}`
                        : `Audition ${previewDuration}s bounded stream`}
                    </span>
                  </div>

                  {auditionPlaying && (
                    <div style={{ height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (auditionTime / Math.max(1, previewDuration)) * 100)}%`,
                          background: 'var(--navy, #1a1a2e)',
                          transition: 'width 0.2s linear',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── One-Time Digital ZIP Management ── */}
          <div className="admin-zip-box" style={{ marginTop: 20 }}>
            <div className="admin-zip-box__header">
              <h4 className="admin-zip-box__title">Reusable Digital Album ZIP (Up to 1GB)</h4>
              <span className={`admin-zip-status ${digitalFile.exists ? 'admin-zip-status--ready' : 'admin-zip-status--missing'}`}>
                {digitalFile.exists ? '✓ Ready for Delivery' : '⚠ File Missing'}
              </span>
            </div>

            <p className="admin-zip-box__desc">
              The album ZIP is generated or uploaded <strong>once</strong> and securely reused for every customer purchase. 
              Supports up to 1024MB (1GB) files with full streaming hash verification.
            </p>

            {digitalFile.exists ? (
              <div className="admin-zip-meta">
                <div className="admin-zip-meta__row">
                  <span>File Name:</span>
                  <strong>{digitalFile.fileName || `${record.title}.zip`}</strong>
                </div>
                <div className="admin-zip-meta__row">
                  <span>File Size:</span>
                  <span>{formatBytes(digitalFile.fileSize)}</span>
                </div>
                {digitalFile.fileHash && (
                  <div className="admin-zip-meta__row">
                    <span>SHA-256 Hash:</span>
                    <code style={{ fontSize: 11 }}>{digitalFile.fileHash.slice(0, 16)}…</code>
                  </div>
                )}
                <div className="admin-zip-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleGenerateZip}
                    disabled={generating || uploading}
                  >
                    {generating ? 'Regenerating…' : 'Regenerate ZIP'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generating || uploading}
                  >
                    {uploading ? `Uploading (${uploadProgress}%)…` : 'Replace with Custom ZIP'}
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleDeleteZip}
                    disabled={generating || uploading}
                  >
                    Remove File
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-zip-empty">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                  No digital ZIP exists for this album yet. You can generate one automatically from the album tracks or upload a custom ZIP up to 1GB.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleGenerateZip}
                    disabled={generating || uploading}
                  >
                    {generating ? 'Generating ZIP from Tracks…' : '⚡ Generate ZIP from Tracks'}
                  </button>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generating || uploading}
                  >
                    {uploading ? `Uploading (${uploadProgress}%)…` : 'Upload Custom .ZIP (up to 1GB)'}
                  </button>
                </div>
              </div>
            )}

            {/* Upload progress indicator */}
            {uploading && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>Uploading Custom Album ZIP…</span>
                  <strong>{uploadProgress}%</strong>
                </div>
                <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      background: 'var(--navy, #1a1a2e)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Hidden custom ZIP input */}
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleUploadZip}
            />
          </div>

          <div className="modal__footer" style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || generating || uploading}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
