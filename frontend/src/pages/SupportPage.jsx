/* ================================================================
   CANOPUS — Support Page
   Editorial customer inquiry & assistance desk.
   ================================================================ */

import { useState, useEffect } from 'react';
import { submitSupportQuery, getSupportConfig } from '../services/supportService';

export default function SupportPage() {
  const [supportEmail, setSupportEmail] = useState(
    import.meta.env.VITE_SUPPORT_EMAIL || 'mr.canopus111@gmail.com'
  );

  useEffect(() => {
    getSupportConfig().then(cfg => {
      if (cfg?.supportEmail) {
        setSupportEmail(cfg.supportEmail);
      }
    });
  }, []);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setError('Please fill in all required fields (Name, Email, Subject, Message).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitSupportQuery({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });

      setSubmittedQuery(res.query || { id: res.id, email: formData.email });
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
    } catch (err) {
      console.error('[Support] Submission error:', err);
      setError(err.message || 'Unable to submit your support inquiry. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="support-page page">
      {/* Header */}
      <section className="support-header">
        <p className="support-header__eyebrow">CANOPUS CONCIERGE</p>
        <h1 className="support-header__title">Support & Inquiries</h1>
        <p className="support-header__tagline">
          <em>
            Have a question about your order, digital album downloads, or the archives?
            Submit an inquiry below and our team will get back to you.
          </em>
        </p>
      </section>

      <section className="support-body">
        <div className="support-layout">
          {/* Left Column: Direct Info */}
          <aside className="support-info-panel">
            <h2 className="support-info-panel__heading">Direct Assistance</h2>
            <p className="support-info-panel__desc">
              We provide dedicated support for all digital album purchases, payment verification, and archive inquiries.
            </p>

            <dl className="support-info-panel__list">
              <div className="support-info-item">
                <dt>General & Orders</dt>
                <dd><a href={`mailto:${supportEmail}`}>{supportEmail}</a></dd>
              </div>

              <div className="support-info-item">
                <dt>Response Window</dt>
                <dd>Within 24 to 48 business hours</dd>
              </div>

              <div className="support-info-item">
                <dt>Payment Inquiries</dt>
                <dd>Please include your 12-digit UPI UTR number if writing about an order.</dd>
              </div>
            </dl>

          </aside>

          {/* Right Column: Inquiry Form */}
          <div className="support-form-container">
            {submittedQuery ? (
              <div className="support-success-card" role="alert">
                <div className="support-success-card__icon">✓</div>
                <h3 className="support-success-card__title">Inquiry Received</h3>
                <p className="support-success-card__message">
                  Thank you for contacting CANOPUS. Your inquiry has been registered under reference <strong>#{submittedQuery.id}</strong>.
                </p>
                <p className="support-success-card__sub">
                  An automated confirmation has been dispatched to your email address. Our team will review your message and reply promptly.
                </p>
                <button
                  type="button"
                  className="btn-secondary support-success-card__btn"
                  onClick={() => setSubmittedQuery(null)}
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form className="support-form" onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="support-error-banner" role="alert">
                    {error}
                  </div>
                )}

                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="support-name" className="form-label">
                      Full Name <span className="required-star">*</span>
                    </label>
                    <input
                      id="support-name"
                      name="name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Maya Roy"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="support-email" className="form-label">
                      Email Address <span className="required-star">*</span>
                    </label>
                    <input
                      id="support-email"
                      name="email"
                      type="email"
                      className="form-input"
                      placeholder="e.g. maya@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="support-phone" className="form-label">
                      Phone Number <span className="optional-tag">(Optional)</span>
                    </label>
                    <input
                      id="support-phone"
                      name="phone"
                      type="tel"
                      className="form-input"
                      placeholder="e.g. +91 98765 43210"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="support-subject" className="form-label">
                      Subject <span className="required-star">*</span>
                    </label>
                    <input
                      id="support-subject"
                      name="subject"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Download Link Issue / UTR Query"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="support-message" className="form-label">
                    Message <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="support-message"
                    name="message"
                    rows="6"
                    className="form-textarea"
                    placeholder="Describe your question or issue in detail…"
                    value={formData.message}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="support-form__actions">
                  <button
                    type="submit"
                    className="btn-primary support-submit-btn"
                    disabled={submitting}
                  >
                    {submitting ? 'Transmitting Inquiry…' : 'Send Message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
