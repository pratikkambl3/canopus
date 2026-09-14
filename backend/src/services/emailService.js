/* ================================================================
   CANOPUS — Email Service (SMTP)
   Sends order confirmations, download links, and payment status updates.
   Supports self-hosted or standard SMTP via environment variables.
   Gracefully falls back to simulated console logging if SMTP is unconfigured.
   ================================================================ */

const nodemailer = require('nodemailer');

const SMTP_HOST       = process.env.SMTP_HOST       || '';
const SMTP_PORT       = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE     = process.env.SMTP_SECURE === 'true';
const SMTP_USER       = process.env.SMTP_USER       || '';
const SMTP_PASSWORD   = process.env.SMTP_PASSWORD   || '';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'orders@canopus.local';
const SMTP_FROM_NAME  = process.env.SMTP_FROM_NAME  || 'CANOPUS Records';
const APP_URL         = process.env.APP_URL         || 'http://localhost:3000';

let transporter = null;

function getTransporter() {
  if (!SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_SECURE,
      auth:   SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

/**
 * Sends an email or logs simulated output if SMTP is not configured.
 */
async function sendMail({ to, subject, text, html }) {
  const mailer = getTransporter();
  const from = `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`;

  if (!mailer) {
    console.log('\n────────────────────────────────────────────────────────');
    console.log(`[EmailService — SIMULATED DELIVERY (No SMTP Configured)]`);
    console.log(`To:      ${to}`);
    console.log(`From:    ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text}`);
    console.log('────────────────────────────────────────────────────────\n');
    return { success: true, simulated: true };
  }

  try {
    const info = await mailer.sendMail({ from, to, subject, text, html });
    console.log(`[EmailService] Sent to ${to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, simulated: false };
  } catch (err) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    throw err;
  }
}

/**
 * Order Received / Pending Verification Email
 */
async function sendOrderConfirmation(order) {
  const subject = `Your CANOPUS Order Has Been Received — #${order.order_number}`;
  const text = `
Hello ${order.customer_name},

Thank you for your order at CANOPUS.

Order Number: #${order.order_number}
Total:        ₹${Number(order.total_amount).toFixed(2)}
Payment:      ${order.payment_reference ? `UTR: ${order.payment_reference}` : 'Pending Verification'}

We have received your payment submission and are verifying it with our bank. 
Once approved, your secure digital album download link will be emailed to you immediately.

Thank you for supporting CANOPUS.

CANOPUS
Timeless Music. Never Gets Old.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; background-color: #F7F4F0; color: #1A1A1A; margin: 0; padding: 40px 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E2DA; padding: 40px; border-radius: 2px; }
    .brand { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #1A1A1A; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 500; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #3D3D3D; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 6px 14px; background: #F0EBE4; border: 1px solid #E8E2DA; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #1A1A1A; margin-bottom: 20px; }
    .details { border-top: 1px solid #E8E2DA; border-bottom: 1px solid #E8E2DA; padding: 16px 0; margin: 24px 0; font-size: 13px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .footer { font-size: 11px; color: #7A7A7A; text-align: center; margin-top: 32px; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">CANOPUS</div>
    <h1>Order Received</h1>
    <div class="badge">Payment Pending Verification</div>
    <p>Hello ${order.customer_name},</p>
    <p>Thank you for purchasing from CANOPUS. We have received your payment reference and our team is currently verifying the transaction.</p>
    
    <div class="details">
      <div class="row"><span>Order Number:</span><strong>#${order.order_number}</strong></div>
      <div class="row"><span>Total Amount:</span><strong>₹${Number(order.total_amount).toFixed(2)}</strong></div>
      ${order.payment_reference ? `<div class="row"><span>Payment UTR:</span><code>${order.payment_reference}</code></div>` : ''}
    </div>

    <p>Once your payment is approved, your digital album download link will be delivered directly to this email address.</p>

    <div class="footer">
      CANOPUS · Timeless Music. Never Gets Old.
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendMail({ to: order.customer_email, subject, text, html });
}

/**
 * Payment Approved & Download Links Email
 */
async function sendPaymentApprovedEmail(order, itemsWithTokens = [], reqBaseUrl = null) {
  const base = reqBaseUrl || process.env.APP_URL || process.env.PUBLIC_URL || 'http://localhost:3000';
  const albumNames = itemsWithTokens.map(i => i.album_title_snapshot).join(', ');
  const subject = `Your CANOPUS Album Is Ready — Order #${order.order_number}`;
  const orderUrl = `${base}/order-confirmation/${order.id}`;

  const downloadBlocksText = itemsWithTokens.map(i => {
    const landingUrl = `${base}/download/${i.token}`;
    const directUrl  = `${base}/api/download/${i.token}`;
    return `Album: ${i.album_title_snapshot}\nDownload Page: ${landingUrl}\nDirect File Download: ${directUrl}\n(Valid for 7 days · Up to 10 downloads)\n`;
  }).join('\n');

  const text = `
Hello ${order.customer_name},

Thank you for purchasing from CANOPUS.

Your payment has been verified and your album is ready to download!

Order Number: #${order.order_number}
Albums:       ${albumNames}

${downloadBlocksText}
Order Status & Receipt:
${orderUrl}

Please save your ZIP file to your device (compatible with Mac, Windows, iOS & Android). 
Thank you for supporting independent music on CANOPUS.

CANOPUS
Timeless Music. Never Gets Old.
  `.trim();

  const downloadCardsHtml = itemsWithTokens.map(i => {
    const landingUrl = `${base}/download/${i.token}`;
    const directUrl  = `${base}/api/download/${i.token}`;
    return `
      <div style="background: #F7F4F0; border: 1px solid #E8E2DA; padding: 24px; margin-bottom: 20px; border-radius: 4px;">
        <h3 style="margin: 0 0 6px; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #1A1A1A;">${i.album_title_snapshot}</h3>
        <p style="margin: 0 0 16px; font-size: 12px; color: #7A7A7A; letter-spacing: 0.04em;">Format: High-Quality Audio & Artwork (.ZIP Archive)</p>
        
        <div style="margin: 16px 0;">
          <a href="${landingUrl}" style="display: inline-block; background: #1A1A1A; color: #F7F4F0; text-decoration: none; padding: 13px 28px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 600; border-radius: 2px;" target="_blank">
            Download Album (.ZIP)
          </a>
        </div>

        <p style="margin: 14px 0 0; font-size: 12px; color: #666666;">
          Direct download fallback: <a href="${directUrl}" style="color: #1A1A1A; text-decoration: underline;">${directUrl}</a>
        </p>
        <p style="margin: 6px 0 0; font-size: 11px; color: #9E978F;">Link valid for 7 days · Up to 10 downloads</p>
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; background-color: #F7F4F0; color: #1A1A1A; margin: 0; padding: 40px 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E2DA; padding: 40px; border-radius: 4px; }
    .brand { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #1A1A1A; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 500; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #3D3D3D; margin-bottom: 16px; }
    .badge-approved { display: inline-block; padding: 6px 14px; background: rgba(42, 112, 64, 0.12); border: 1px solid rgba(42, 112, 64, 0.25); color: #2A7040; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 20px; }
    .footer { font-size: 11px; color: #7A7A7A; text-align: center; margin-top: 32px; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">CANOPUS</div>
    <h1>Your Music Is Ready</h1>
    <div class="badge-approved">Payment Verified ✓</div>
    <p>Hello ${order.customer_name},</p>
    <p>Your payment for Order <strong>#${order.order_number}</strong> has been verified. You can now download your digital album:</p>
    
    ${downloadCardsHtml}

    <p style="margin-top: 24px; font-size: 13px; color: #3D3D3D;">
      You can also view your receipt and order history at any time:<br/>
      <a href="${orderUrl}" style="color: #1A1A1A; font-weight: 600; text-decoration: underline;">${orderUrl}</a>
    </p>

    <p style="margin-top: 20px; font-size: 13px; color: #7A7A7A;">
      Compatible with macOS, Windows, and mobile devices. If you need any assistance, reply directly to this email.
    </p>

    <div class="footer">
      CANOPUS · Timeless Music. Never Gets Old.
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendMail({ to: order.customer_email, subject, text, html });
}

/**
 * Payment Rejected Email
 */
async function sendPaymentRejectedEmail(order, reason = '') {
  const subject = `Regarding Your CANOPUS Order #${order.order_number}`;
  const text = `
Hello ${order.customer_name},

Thank you for your order at CANOPUS (Order #${order.order_number}).

We were unable to verify your payment reference / UTR number (${order.payment_reference || 'N/A'}).
${reason ? `Reason: ${reason}\n` : ''}

If this was an error, please reach out to us at ${SMTP_FROM_EMAIL} with a screenshot of your payment confirmation and your order number so we can verify it promptly.

CANOPUS
Timeless Music. Never Gets Old.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; background-color: #F7F4F0; color: #1A1A1A; margin: 0; padding: 40px 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E2DA; padding: 40px; border-radius: 2px; }
    .brand { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #1A1A1A; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 500; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #3D3D3D; margin-bottom: 16px; }
    .badge-alert { display: inline-block; padding: 6px 14px; background: rgba(185, 28, 28, 0.08); border: 1px solid rgba(185, 28, 28, 0.2); color: #B91C1C; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 20px; }
    .footer { font-size: 11px; color: #7A7A7A; text-align: center; margin-top: 32px; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">CANOPUS</div>
    <h1>Payment Verification Notice</h1>
    <div class="badge-alert">Verification Unsuccessful</div>
    <p>Hello ${order.customer_name},</p>
    <p>We reviewed Order <strong>#${order.order_number}</strong>, but our team was unable to confirm the payment reference / UTR (<code>${order.payment_reference || 'N/A'}</code>) in our records.</p>
    ${reason ? `<p style="background: #F7F4F0; padding: 12px; font-size: 13px;"><strong>Note:</strong> ${reason}</p>` : ''}
    <p>If payment was already deducted from your account, please reply to this email with your transaction details or bank statement so we can assist you and release your digital download.</p>
    <div class="footer">
      CANOPUS · Timeless Music. Never Gets Old.
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendMail({ to: order.customer_email, subject, text, html });
}

/**
 * Support Notification to Support Team / Admin
 */
async function sendSupportNotificationToTeam(query) {
  const supportDest = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL || 'admin@canopus.local';
  const subject = `[Support Query] ${query.subject} — from ${query.name}`;

  const text = `
New Support Query Received:

Name:    ${query.name}
Email:   ${query.email}
Phone:   ${query.phone || 'Not provided'}
Subject: ${query.subject}
Date:    ${new Date().toLocaleString()}

Message / Query:
${query.message}

────────────────────────────────────────
Manage support queries in the CANOPUS admin dashboard.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; background-color: #F7F4F0; color: #1A1A1A; margin: 0; padding: 40px 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E2DA; padding: 40px; border-radius: 2px; }
    .brand { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #1A1A1A; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 500; margin-top: 0; margin-bottom: 16px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    .meta-table td { padding: 8px 0; border-bottom: 1px solid #E8E2DA; }
    .meta-label { font-weight: 600; width: 120px; color: #7A7A7A; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
    .message-box { background: #F7F4F0; border-left: 3px solid #1A1A1A; padding: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-top: 16px; color: #2A2A2A; }
    .footer { font-size: 11px; color: #7A7A7A; text-align: center; margin-top: 32px; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">CANOPUS</div>
    <h1>New Support Query</h1>
    <table class="meta-table">
      <tr><td class="meta-label">Customer:</td><td><strong>${query.name}</strong></td></tr>
      <tr><td class="meta-label">Email:</td><td><a href="mailto:${query.email}">${query.email}</a></td></tr>
      <tr><td class="meta-label">Phone:</td><td>${query.phone || 'None'}</td></tr>
      <tr><td class="meta-label">Subject:</td><td>${query.subject}</td></tr>
    </table>
    <p style="font-weight: 600; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #7A7A7A;">Message Content:</p>
    <div class="message-box">${query.message}</div>
    <div class="footer">CANOPUS Admin Support Dispatch</div>
  </div>
</body>
</html>
  `.trim();

  return sendMail({ to: supportDest, subject, text, html });
}

/**
 * Support Acknowledgement to Customer
 */
async function sendSupportAcknowledgementToUser(query) {
  const subject = `Support Request Received`;

  const text = `
Hello ${query.name},

Thank you for contacting our support team. We have received your query and our team will respond to you shortly.

Subject: ${query.subject}

CANOPUS
Timeless Music. Never Gets Old.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', -apple-system, sans-serif; background-color: #F7F4F0; color: #1A1A1A; margin: 0; padding: 40px 20px; }
    .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E2DA; padding: 40px; border-radius: 2px; }
    .brand { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #1A1A1A; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 500; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #3D3D3D; margin-bottom: 16px; }
    .query-summary { background: #F7F4F0; border: 1px solid #E8E2DA; padding: 14px 18px; border-radius: 2px; margin: 20px 0; font-size: 13px; }
    .footer { font-size: 11px; color: #7A7A7A; text-align: center; margin-top: 32px; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">CANOPUS</div>
    <h1>Support Request Received</h1>
    <p>Hello ${query.name},</p>
    <p>Thank you for contacting our support team. We have received your query and our team will respond to you shortly.</p>
    
    <div class="query-summary">
      <strong>Your Subject:</strong> ${query.subject}
    </div>

    <p style="font-size: 13px; color: #7A7A7A;">
      Our team typically responds within 24 hours. If your query is regarding a recent purchase, having your Order Number or payment UTR ready helps us resolve it faster.
    </p>

    <div class="footer">
      CANOPUS · Timeless Music. Never Gets Old.
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendMail({ to: query.email, subject, text, html });
}

module.exports = {
  sendOrderConfirmation,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
  sendSupportNotificationToTeam,
  sendSupportAcknowledgementToUser,
};
