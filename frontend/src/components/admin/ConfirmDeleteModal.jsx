/* ================================================================
   CANOPUS — Confirm Delete Modal
   Contextual deletion confirmation for Records and Products.
   ================================================================ */

import { useState } from 'react';

/**
 * ConfirmDeleteModal
 *
 * Props:
 *   record        — the record/product object to be deleted
 *   onConfirm(storeOnly: boolean) — called when admin confirms deletion
 *   onCancel()    — called when admin cancels
 *   isLoading     — true while deletion is in progress
 *   error         — error message string to display (or null)
 */
export default function ConfirmDeleteModal({ record, onConfirm, onCancel, isLoading, error }) {
  const isPublishedInStore = Boolean(record?.productEnabled || record?.product_enabled);
  const isProductOnly = Boolean(record?.isProductOnly || record?.is_product_only);
  const showStoreOnlyOption = isPublishedInStore && !isProductOnly;

  const [deleteMode, setDeleteMode] = useState(showStoreOnlyOption ? 'store-only' : 'full');

  if (!record) return null;

  const trackCount = record.tracks?.length || record.trackCount || 0;
  const badge = isProductOnly
    ? 'DIGITAL STORE PRODUCT'
    : (isPublishedInStore ? 'RECORD LIBRARY · DIGITAL STORE' : 'RECORD LIBRARY');

  const handleConfirm = () => {
    onConfirm(deleteMode === 'store-only');
  };

  return (
    <div className="confirm-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="cdm-title">
      <div className="confirm-delete-modal">
        <div className="cdm-header">
          <span className="cdm-eyebrow">CONFIRM ACTION</span>
          <h2 className="cdm-title" id="cdm-title">
            {showStoreOnlyOption && deleteMode === 'store-only'
              ? 'Remove from Store'
              : 'Delete Permanently'}
          </h2>
        </div>

        <div className="cdm-record-preview">
          {record.artworkUrl ? (
            <img className="cdm-record-thumb" src={record.artworkUrl} alt={record.title} />
          ) : (
            <div className="cdm-record-thumb cdm-record-thumb--placeholder">♫</div>
          )}
          <div className="cdm-record-info">
            <span className="cdm-record-badge">{badge}</span>
            <h3 className="cdm-record-title">{record.title}</h3>
            {record.artist && <p className="cdm-record-artist">{record.artist}</p>}
            <p className="cdm-record-meta">
              {record.genre || 'Album'}
              {trackCount > 0 && ` · ${trackCount} track${trackCount === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        {showStoreOnlyOption && (
          <div className="cdm-mode-selector">
            <label className={`cdm-mode-option${deleteMode === 'store-only' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="deleteMode"
                value="store-only"
                checked={deleteMode === 'store-only'}
                onChange={() => setDeleteMode('store-only')}
                disabled={isLoading}
              />
              <div className="cdm-mode-option__content">
                <strong>Remove from Store Only</strong>
                <span>
                  Unpublishes the digital product and removes the ZIP file.
                  The record remains safely in your Library for future use.
                </span>
              </div>
            </label>

            <label className={`cdm-mode-option${deleteMode === 'full' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="deleteMode"
                value="full"
                checked={deleteMode === 'full'}
                onChange={() => setDeleteMode('full')}
                disabled={isLoading}
              />
              <div className="cdm-mode-option__content">
                <strong>Delete Permanently</strong>
                <span>
                  Removes the record from both the Library and the Store.
                  All audio files and artwork will also be cleaned up if unused.
                </span>
              </div>
            </label>
          </div>
        )}

        {!showStoreOnlyOption && (
          <p className="cdm-warning">
            {isProductOnly
              ? 'This digital product will be permanently deleted. All associated files and ZIP archives will be removed.'
              : 'This record will be permanently deleted from the Library. All audio files, artwork, and any digital product ZIP will be cleaned up if not used elsewhere.'}
            {' '}This action cannot be undone.
          </p>
        )}

        {error && (
          <div className="cdm-error-banner" role="alert">
            <span className="cdm-error-icon">⚠</span>
            {error}
          </div>
        )}

        <div className="cdm-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn-danger cdm-confirm-btn${isLoading ? ' loading' : ''}`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? 'Deleting…'
              : (showStoreOnlyOption && deleteMode === 'store-only'
                  ? 'Remove from Store'
                  : 'Delete Permanently')}
          </button>
        </div>
      </div>
    </div>
  );
}