/* ================================================================
   CANOPUS — Admin Product Manager Modal
   Configure digital album pricing, generate/upload reusable ZIPs,
   and publish albums to the Products digital store.
   ================================================================ */

import { useState, useRef } from 'react';
import { updateProduct, generateProductZip, uploadProductZip, deleteProductZip } from '../../services/adminStoreService';
import { IconCheck } from '../shared/Icons';

export default function ProductManagerModal({ record, onClose, onUpdated }) {
  const [enabled, setEnabled]         = useState(Boolean(record.productEnabled ?? record.product_enabled));
  const [price, setPrice]             = useState(Number(record.price ?? record.product_price ?? 0));
  const [description, setDescription] = useState(record.productDescription ?? record.product_description ?? record.description ?? '');

  const [digitalFile, setDigitalFile] = useState(record.digitalFile || {
    exists:   Boolean(record.digital_file_path),
    fileName: record.digital_file_name || '',
    fileSize: Number(record.digital_file_size || 0),
    fileHash: record.digital_file_hash || '',
  });

  const [saving, setSaving]           = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);

  const fileInputRef = useRef(null);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    try {
      const updated = await uploadProductZip(record.id, file);
      setDigitalFile(updated.digitalFile);
      setSuccessMsg('Custom album ZIP uploaded successfully.');
      onUpdated && onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to upload ZIP.');
    } finally {
      setUploading(false);
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

    setSaving(true);
    try {
      await updateProduct(record.id, {
        productEnabled: enabled,
        price:          Number(price),
        productDescription: description.trim(),
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
      <div className="modal" style={{ maxWidth: 680 }}>
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

          {/* ── One-Time Digital ZIP Management ── */}
          <div className="admin-zip-box">
            <div className="admin-zip-box__header">
              <h4 className="admin-zip-box__title">Reusable Digital Album ZIP</h4>
              <span className={`admin-zip-status ${digitalFile.exists ? 'admin-zip-status--ready' : 'admin-zip-status--missing'}`}>
                {digitalFile.exists ? '✓ Ready for Delivery' : '⚠ File Missing'}
              </span>
            </div>

            <p className="admin-zip-box__desc">
              The album ZIP is generated or uploaded <strong>once</strong> and securely reused for every customer purchase. 
              It is never re-zipped during checkout.
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
                    {uploading ? 'Uploading…' : 'Replace with Custom ZIP'}
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
                  No digital ZIP exists for this album yet. You can generate one automatically from the album tracks or upload a custom ZIP.
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
                    {uploading ? 'Uploading…' : 'Upload Custom .ZIP'}
                  </button>
                </div>
              </div>
            )}

            {/* Hidden custom ZIP input */}
            <input
              type="file"
              accept=".zip,application/zip"
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
