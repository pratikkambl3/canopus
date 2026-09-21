/* ================================================================
   CANOPUS — Admin QR Panel
   • Switch the active payment QR code (slot 1, 2, 3)
   • Upload a new QR image for any slot
   • Delete / reset any slot's QR image
   • Toggle the "Pay Now" button on the checkout page
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import {
  getActiveQrSlot,
  switchQrSlot,
  uploadQrImage,
  deleteQrImage,
  getQrSettings,
  updatePayNowSetting,
} from '../../services/adminStoreService';

const QR_SLOTS = [
  { slot: 1, label: 'QR Code 1' },
  { slot: 2, label: 'QR Code 2' },
  { slot: 3, label: 'QR Code 3' },
];

/* ── small helper: bust the browser image cache by appending timestamp ── */
function cacheBustedUrl(slot) {
  return `/payment-qr-${slot}.png?t=${Date.now()}`;
}

export default function AdminQrPanel() {
  const [activeSlot, setActiveSlot]       = useState(null);
  const [payNowEnabled, setPayNowEnabled] = useState(true);
  const [slotImages, setSlotImages]       = useState({ 1: true, 2: true, 3: true });
  const [switching, setSwitching]         = useState(null);
  const [togglingPay, setTogglingPay]     = useState(false);
  const [error, setError]                 = useState(null);
  const [successMsg, setSuccessMsg]       = useState(null);

  /* per-slot upload / delete state */
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingSlot, setDeletingSlot]   = useState(null);
  /* cache-busting timestamps so images reload after upload/delete */
  const [imgTs, setImgTs] = useState({ 1: Date.now(), 2: Date.now(), 3: Date.now() });

  /* hidden file inputs — one per slot */
  const fileRefs = {
    1: useRef(null),
    2: useRef(null),
    3: useRef(null),
  };

  /* ── initial load ── */
  useEffect(() => {
    getQrSettings()
      .then(data => {
        setActiveSlot(data.slot ?? 1);
        setPayNowEnabled(data.payNowEnabled !== false);
        if (data.slots) {
          setSlotImages({
            1: Boolean(data.slots[1]?.hasImage),
            2: Boolean(data.slots[2]?.hasImage),
            3: Boolean(data.slots[3]?.hasImage),
          });
        }
      })
      .catch(() => {
        // fallback: try just the active slot
        getActiveQrSlot()
          .then(d => {
            setActiveSlot(d.slot ?? 1);
            if (typeof d.hasImage === 'boolean') {
              setSlotImages(prev => ({ ...prev, [d.slot]: d.hasImage }));
            }
          })
          .catch(() => setActiveSlot(1));
      });
  }, []);

  /* ── helpers ── */
  const showSuccess = (msg) => {
    setError(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 6000);
  };

  const showError = (msg) => {
    setSuccessMsg(null);
    setError(msg);
  };

  /* ── switch active QR slot ── */
  const handleSwitch = async (slot) => {
    if (slot === activeSlot || switching !== null) return;
    setError(null);
    setSuccessMsg(null);
    setSwitching(slot);
    try {
      const res = await switchQrSlot(slot);
      setActiveSlot(res.slot);
      showSuccess(`QR Code ${res.slot} is now active. Customers will see it immediately.`);
    } catch (e) {
      showError(e.message || 'Failed to switch QR. Please try again.');
    } finally {
      setSwitching(null);
    }
  };

  /* ── upload QR image for a slot ── */
  const handleUploadClick = (slot) => {
    if (fileRefs[slot]?.current) fileRefs[slot].current.click();
  };

  const handleFileChange = async (slot, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset so same file can be re-selected
    e.target.value = '';

    setUploadingSlot(slot);
    setUploadProgress(0);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await uploadQrImage(slot, file, (pct) => setUploadProgress(pct));
      // mark slot as having image and bust cache
      setSlotImages(prev => ({ ...prev, [slot]: true }));
      setImgTs(prev => ({ ...prev, [slot]: Date.now() }));
      showSuccess(res.message || `QR Code ${slot} image uploaded successfully.`);
    } catch (e) {
      showError(e.message || `Failed to upload QR ${slot}. Please try again.`);
    } finally {
      setUploadingSlot(null);
      setUploadProgress(0);
    }
  };

  /* ── delete QR image for a slot ── */
  const handleDelete = async (slot) => {
    if (!window.confirm(`Delete the image for QR Code ${slot}? You can upload a new one afterwards.`)) return;
    setDeletingSlot(slot);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await deleteQrImage(slot);
      // mark slot as empty and bust cache
      setSlotImages(prev => ({ ...prev, [slot]: false }));
      setImgTs(prev => ({ ...prev, [slot]: Date.now() }));
      // If the deleted slot was the active one, update activeSlot from response (backend switches it)
      if (slot === activeSlot) {
        // refetch to get the new active
        const fresh = await getActiveQrSlot().catch(() => ({ slot: slot === 1 ? 2 : 1 }));
        setActiveSlot(fresh.slot);
      }
      showSuccess(res.message || `QR Code ${slot} image removed.`);
    } catch (e) {
      showError(e.message || `Failed to delete QR ${slot}. Please try again.`);
    } finally {
      setDeletingSlot(null);
    }
  };

  /* ── toggle Pay Now button ── */
  const handleTogglePayNow = async () => {
    setTogglingPay(true);
    setError(null);
    setSuccessMsg(null);
    const newVal = !payNowEnabled;
    try {
      const res = await updatePayNowSetting(newVal);
      setPayNowEnabled(res.payNowEnabled);
      showSuccess(
        res.payNowEnabled
          ? '"Pay Now" button is now visible to customers.'
          : '"Pay Now" button is now hidden from customers.'
      );
    } catch (e) {
      showError(e.message || 'Failed to update Pay Now setting.');
    } finally {
      setTogglingPay(false);
    }
  };

  /* ── render ── */
  return (
    <div className="admin-qr-panel">

      {/* ── Panel header ── */}
      <div className="admin-qr-panel__header">
        <div>
          <span className="admin-qr-panel__eyebrow">PAYMENT SETTINGS</span>
          <h2 className="admin-qr-panel__title">UPI QR Code Manager</h2>
        </div>
        <p className="admin-qr-panel__desc">
          Switch which QR is shown to customers, upload new QR images, and control
          the "Pay Now" button visibility. All changes are instant — no rebuild required.
        </p>
      </div>

      {/* ── Global alerts ── */}
      {error && (
        <div className="admin-qr-panel__error" role="alert">
          <span>⚠</span> {error}
        </div>
      )}
      {successMsg && (
        <div className="admin-qr-panel__success" role="status">
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* ── Active slot banner ── */}
      {activeSlot !== null && (
        <div className="admin-qr-status-banner">
          <span className="admin-qr-status-badge">ACTIVE</span>
          <span>QR Code {activeSlot} is currently shown to customers</span>
        </div>
      )}

      {/* ── Pay Now Toggle ── */}
      <div className="admin-qr-pay-now-toggle">
        <div className="admin-qr-pay-now-toggle__info">
          <span className="admin-qr-pay-now-toggle__label">⚡ "Pay Now" Button</span>
          <span className="admin-qr-pay-now-toggle__desc">
            {payNowEnabled
              ? 'Visible to customers on the checkout page'
              : 'Hidden — customers see only the QR code and UTR form'}
          </span>
        </div>
        <button
          type="button"
          className={`admin-qr-toggle-btn${payNowEnabled ? ' admin-qr-toggle-btn--on' : ' admin-qr-toggle-btn--off'}`}
          onClick={handleTogglePayNow}
          disabled={togglingPay}
          aria-pressed={payNowEnabled}
          id="pay-now-toggle-btn"
        >
          <span className="admin-qr-toggle-btn__track">
            <span className="admin-qr-toggle-btn__thumb" />
          </span>
          <span className="admin-qr-toggle-btn__text">
            {togglingPay ? 'Saving…' : payNowEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* ── QR Slot Cards ── */}
      <div className="admin-qr-grid">
        {QR_SLOTS.map(({ slot, label }) => {
          const isActive    = activeSlot === slot;
          const isSwitching = switching === slot;
          const isUploading = uploadingSlot === slot;
          const isDeleting  = deletingSlot === slot;
          const hasImage    = slotImages[slot];

          return (
            <div
              key={slot}
              className={`admin-qr-card${isActive ? ' admin-qr-card--active' : ''}`}
            >
              {isActive && (
                <div className="admin-qr-card__active-ribbon">✓ ACTIVE</div>
              )}

              {/* QR Image or Empty placeholder */}
              {hasImage ? (
                <div className="admin-qr-card__img-wrap">
                  <img
                    key={imgTs[slot]}
                    src={`/api/orders/payment-qr/image/${slot}?t=${imgTs[slot]}`}
                    alt={`Payment QR Code ${slot}`}
                    className="admin-qr-card__img"
                    onLoad={(e) => { e.target.style.opacity = '1'; }}
                    onError={() => {
                      setSlotImages(prev => ({ ...prev, [slot]: false }));
                    }}
                  />
                  {isUploading && (
                    <div className="admin-qr-card__upload-overlay">
                      <div className="admin-qr-card__upload-progress">
                        <div
                          className="admin-qr-card__upload-bar"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="admin-qr-card__upload-pct">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="admin-qr-card__img-wrap admin-qr-card__img-wrap--empty"
                  onClick={() => handleUploadClick(slot)}
                  role="button"
                  tabIndex={0}
                  title="Click to upload QR image"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleUploadClick(slot); }}
                >
                  <div className="admin-qr-empty-placeholder">
                    <span className="admin-qr-empty-icon">📷</span>
                    <span className="admin-qr-empty-text">No QR Uploaded</span>
                    <span className="admin-qr-empty-sub">Click to select image</span>
                  </div>
                  {isUploading && (
                    <div className="admin-qr-card__upload-overlay">
                      <div className="admin-qr-card__upload-progress">
                        <div
                          className="admin-qr-card__upload-bar"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="admin-qr-card__upload-pct">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileRefs[slot]}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(slot, e)}
              />

              {/* Card body */}
              <div className="admin-qr-card__body">
                <p className="admin-qr-card__label">{label}</p>
                <p className="admin-qr-card__slot-num">Slot {slot}</p>

                {/* Activate / Already Active */}
                {isActive ? (
                  <button
                    type="button"
                    className="btn-secondary admin-qr-card__btn admin-qr-card__btn--active"
                    disabled
                  >
                    ✓ Currently Active
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary admin-qr-card__btn"
                    onClick={() => handleSwitch(slot)}
                    disabled={switching !== null || isUploading || isDeleting}
                  >
                    {isSwitching ? 'Activating…' : `Activate QR ${slot}`}
                  </button>
                )}

                {/* Upload new QR */}
                <button
                  type="button"
                  className="btn-secondary admin-qr-card__btn admin-qr-card__upload-btn"
                  onClick={() => handleUploadClick(slot)}
                  disabled={isUploading || isDeleting || switching !== null}
                  id={`upload-qr-${slot}-btn`}
                >
                  {isUploading
                    ? `Uploading… ${uploadProgress}%`
                    : hasImage ? '⬆ Replace QR Image' : '⬆ Upload QR Image'}
                </button>

                {/* Delete / reset QR */}
                <button
                  type="button"
                  className="btn-danger admin-qr-card__btn admin-qr-card__delete-btn"
                  onClick={() => handleDelete(slot)}
                  disabled={isDeleting || isUploading || switching !== null || !hasImage}
                  id={`delete-qr-${slot}-btn`}
                  style={{ fontSize: 12, marginTop: 4, opacity: !hasImage ? 0.4 : 0.85 }}
                >
                  {isDeleting ? 'Deleting…' : hasImage ? '🗑 Delete QR Image' : 'No Image to Delete'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Usage note ── */}
      <div className="admin-qr-panel__note">
        <strong>How to use:</strong>{' '}
        Upload a PNG/JPG QR image for each slot. Click <em>Activate</em> to make a slot live.
        Rotate between slots when you want to switch UPI accounts. Use <em>Delete</em> to
        remove a QR image and upload a fresh one. The <strong>Pay Now</strong> toggle hides
        or shows the ⚡ button on the checkout page — the QR code and UTR form remain active.
      </div>
    </div>
  );
}