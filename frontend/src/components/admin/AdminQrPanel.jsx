/* ================================================================
   CANOPUS — Admin QR Panel
   Allows admin to switch the active payment QR code shown to customers.
   ================================================================ */

import { useState, useEffect } from 'react';
import { getActiveQrSlot, switchQrSlot } from '../../services/adminStoreService';

const QR_SLOTS = [
  { slot: 1, label: 'QR Code 1', src: '/payment-qr-1.png' },
  { slot: 2, label: 'QR Code 2', src: '/payment-qr-2.png' },
  { slot: 3, label: 'QR Code 3', src: '/payment-qr-3.png' },
];

export default function AdminQrPanel() {
  const [activeSlot, setActiveSlot] = useState(null);
  const [switching, setSwitching]   = useState(null); // slot being switched to
  const [error, setError]           = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    getActiveQrSlot()
      .then(data => setActiveSlot(data.slot))
      .catch(() => setActiveSlot(1));
  }, []);

  const handleSwitch = async (slot) => {
    if (slot === activeSlot || switching !== null) return;
    setError(null);
    setSuccessMsg(null);
    setSwitching(slot);
    try {
      const res = await switchQrSlot(slot);
      setActiveSlot(res.slot);
      setSuccessMsg(`QR Code ${res.slot} is now active. Customers will see the new QR immediately.`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (e) {
      setError(e.message || 'Failed to switch QR. Please try again.');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="admin-qr-panel">
      <div className="admin-qr-panel__header">
        <div>
          <span className="admin-qr-panel__eyebrow">PAYMENT SETTINGS</span>
          <h2 className="admin-qr-panel__title">UPI QR Code Manager</h2>
        </div>
        <p className="admin-qr-panel__desc">
          Switch the payment QR code shown to customers at checkout. Activate the next QR when you want to rotate to a new account.
          The change is instant — no rebuild required.
        </p>
      </div>

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

      {activeSlot !== null && (
        <div className="admin-qr-status-banner">
          <span className="admin-qr-status-badge">ACTIVE</span>
          <span>QR Code {activeSlot} is currently shown to customers</span>
        </div>
      )}

      <div className="admin-qr-grid">
        {QR_SLOTS.map(({ slot, label, src }) => {
          const isActive = activeSlot === slot;
          const isSwitching = switching === slot;

          return (
            <div
              key={slot}
              className={`admin-qr-card${isActive ? ' admin-qr-card--active' : ''}`}
            >
              {isActive && (
                <div className="admin-qr-card__active-ribbon">
                  ✓ ACTIVE
                </div>
              )}

              <div className="admin-qr-card__img-wrap">
                <img
                  src={src}
                  alt={`Payment QR Code ${slot}`}
                  className="admin-qr-card__img"
                  onError={(e) => { e.target.style.opacity = '0.3'; }}
                />
              </div>

              <div className="admin-qr-card__body">
                <p className="admin-qr-card__label">{label}</p>
                <p className="admin-qr-card__slot-num">Slot {slot}</p>

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
                    disabled={switching !== null}
                  >
                    {isSwitching ? 'Activating…' : `Activate QR ${slot}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-qr-panel__note">
        <strong>How to use:</strong> When you receive multiple payments on one QR, click "Activate" on the next QR code to switch.
        Customers visiting the checkout page will immediately see the new QR code without any app reload needed.
      </div>
    </div>
  );
}