/* ================================================================
   CANOPUS — Checkout Page
   Clean, minimal checkout with UPI QR payment and UTR verification.
   ================================================================ */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../services/storeService';
import { IconCopy, IconCheck, IconDownload } from '../components/shared/Icons';

export default function CheckoutPage() {
  const { cartItems, cartTotal, clearCart, refreshCartPrices } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (refreshCartPrices) {
      refreshCartPrices();
    }
  }, [refreshCartPrices]);

  const [customerName, setCustomerName]         = useState('');
  const [customerEmail, setCustomerEmail]       = useState('');
  const [customerPhone, setCustomerPhone]       = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [copied, setCopied]         = useState(false);
  const [isMobile, setIsMobile]     = useState(false);

  // Detect mobile device for UPI intent
  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent || '';
      setIsMobile(/Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // UPI configuration
  const upiId = import.meta.env.VITE_PAYMENT_UPI_ID || 'pratik.kamble11@ybl';
  const payeeName = import.meta.env.VITE_PAYMENT_PAYEE_NAME || 'Pratik Prakash Kamble';
  const qrImageUrl = import.meta.env.VITE_PAYMENT_QR_IMAGE_URL || '/payment-qr.png';
  const downloadQrUrl = `${import.meta.env.VITE_API_URL || '/api'}/orders/payment-qr/download`;
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(cartTotal)}&cu=INR&tn=${encodeURIComponent('CANOPUS Order')}`;


  if (cartItems.length === 0) {
    return (
      <main className="checkout-page page">
        <div className="checkout-empty">
          <h2>Your cart is empty</h2>
          <p>Please select an album from the digital collection to proceed with checkout.</p>
          <Link to="/products" className="btn-primary">Browse Products</Link>
        </div>
      </main>
    );
  }

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!customerName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!paymentReference.trim()) {
      setError('Please enter the 12-digit UPI reference / UTR number from your payment app.');
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        customerName:     customerName.trim(),
        customerEmail:    customerEmail.trim(),
        customerPhone:    customerPhone.trim(),
        paymentReference: paymentReference.trim(),
        items:            cartItems.map(i => ({ id: i.id, title: i.title, price: i.price })),
      };

      const result = await createOrder(orderPayload);
      clearCart();
      navigate(`/order-confirmation/${result.orderId}`, { state: { order: result } });
    } catch (err) {
      setError(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="checkout-page page">
      <div className="checkout-container">
        {/* Header */}
        <header className="checkout-header">
          <p className="checkout-header__eyebrow">CANOPUS</p>
          <h1 className="checkout-header__title">Checkout</h1>
          <p className="checkout-header__sub">Complete your digital album purchase below.</p>
        </header>

        {error && (
          <div className="checkout-error" role="alert">
            {error}
          </div>
        )}

        <div className="checkout-grid">
          {/* Left Column: Order Summary & Customer Info */}
          <div className="checkout-main-col">
            {/* 1. Order Summary */}
            <section className="checkout-section">
              <h2 className="checkout-section__title">Your Selection</h2>
              <div className="checkout-items" role="list">
                {cartItems.map(item => (
                  <div key={item.id} className="checkout-item" role="listitem">
                    <div className="checkout-item__thumb-wrap">
                      {item.artworkUrl ? (
                        <img src={item.artworkUrl} alt={item.title} className="checkout-item__thumb" />
                      ) : (
                        <div className="checkout-item__thumb checkout-item__thumb--placeholder">♫</div>
                      )}
                    </div>
                    <div className="checkout-item__info">
                      <h3 className="checkout-item__title">{item.title}</h3>
                      {item.artist && <p className="checkout-item__artist">{item.artist}</p>}
                      <p className="checkout-item__format">Digital Album · ZIP Download</p>
                    </div>
                    <div className="checkout-item__price">₹{item.price}</div>
                  </div>
                ))}
              </div>

              <div className="checkout-totals">
                <div className="checkout-totals__row">
                  <span>Subtotal</span>
                  <span>₹{cartTotal}</span>
                </div>
                <div className="checkout-totals__row checkout-totals__row--final">
                  <span>Total Amount</span>
                  <strong>₹{cartTotal}</strong>
                </div>
              </div>
            </section>

            {/* 2. Customer Details Form */}
            <section className="checkout-section">
              <h2 className="checkout-section__title">Customer Details</h2>
              <p className="checkout-section__note">
                Your album download link will be delivered to this email address after payment verification.
              </p>

              <div className="checkout-form-grid">
                <div className="checkout-field">
                  <label htmlFor="customerName" className="checkout-label">Full Name *</label>
                  <input
                    id="customerName"
                    type="text"
                    className="checkout-input"
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className="checkout-field">
                  <label htmlFor="customerEmail" className="checkout-label">Email Address *</label>
                  <input
                    id="customerEmail"
                    type="email"
                    className="checkout-input"
                    placeholder="e.g. rahul@example.com"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="checkout-field checkout-field--full">
                  <label htmlFor="customerPhone" className="checkout-label">Phone Number *</label>
                  <input
                    id="customerPhone"
                    type="tel"
                    className="checkout-input"
                    placeholder="e.g. +91 98765 43210"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: QR Payment & UTR Submission */}
          <aside className="checkout-payment-col">
            <section className="checkout-payment-box">
              <h2 className="checkout-payment__heading">Payment</h2>

              <div className="checkout-payment__amount-wrap">
                <span className="checkout-payment__amount-label">Amount to Pay</span>
                <span className="checkout-payment__amount">₹{cartTotal}</span>
              </div>

              {/* Mobile Quick Pay Intent */}
              <div className="checkout-payment__quick-actions">
                <a
                  href={upiDeepLink}
                  className="btn-primary checkout-payment__upi-app-btn"
                  id="pay-with-upi-app-btn"
                >
                  ⚡ Open in UPI App (GPay / PhonePe / Paytm)
                </a>
                <p className="checkout-payment__upi-hint">
                  {isMobile
                    ? 'Tap above to launch your UPI app with payee and amount pre-filled.'
                    : 'On mobile, this opens your UPI app directly. On desktop, please scan the QR code below.'}
                </p>
              </div>

              <div className="checkout-payment__qr-card">
                <div className="checkout-payment__qr-card-header">
                  <p className="checkout-payment__qr-instruction">
                    Or scan this QR code with any UPI app:
                  </p>
                  <a
                    href={downloadQrUrl}
                    download="payment-qr.png"
                    className="btn-secondary checkout-payment__download-qr-link"
                    id="download-qr-btn"
                  >
                    <IconDownload /> Download QR
                  </a>
                </div>

                {/* QR Code Container */}
                <div className="checkout-payment__qr-wrap">
                  <div className="upi-qr-display">
                    <img
                      src={qrImageUrl}
                      alt="UPI QR Code - Pratik Prakash Kamble"
                      className="upi-qr-image"
                    />
                    <span className="upi-qr-label">SCAN TO PAY WITH ANY UPI APP</span>
                  </div>
                </div>

                {/* UPI ID Copy bar */}
                <div className="checkout-payment__upi-bar">
                  <span className="checkout-payment__upi-id">{upiId}</span>
                  <button
                    type="button"
                    className="checkout-payment__copy-btn"
                    onClick={handleCopyUpi}
                    aria-label="Copy UPI ID"
                  >
                    {copied ? <IconCheck /> : <IconCopy />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="checkout-payment__warning-callout" role="note">
                <strong>Important:</strong> Completing payment in your UPI app does not automatically finish your order.
                You must enter the <strong>12-digit UPI UTR / Reference ID</strong> below so our team can verify and dispatch your download link.
              </div>

              {/* UTR Input & Submit */}
              <form onSubmit={handleSubmit} className="checkout-payment__form">
                <div className="checkout-field">
                  <label htmlFor="paymentReference" className="checkout-label">
                    Payment Reference / UTR Number *
                  </label>
                  <input
                    id="paymentReference"
                    type="text"
                    className="checkout-input"
                    placeholder="Enter 12-digit UTR from your bank app"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    required
                  />
                  <span className="checkout-input-hint">
                    Found in your UPI payment details (Google Pay, PhonePe, Paytm, or BHIM).
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn-primary checkout-payment__submit-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting Order…' : `Submit Order — ₹${cartTotal}`}
                </button>
              </form>

              <p className="checkout-payment__security-note">
                🔒 Your digital order will be processed as <strong>Pending Verification</strong>. Once our admin confirms the transaction with the bank, your high-fidelity album ZIP link will be sent to your email immediately.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
