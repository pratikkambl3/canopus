/* ================================================================
   CANOPUS — Orders REST API
   POST /api/orders             — public (submit order with UTR)
   GET  /api/orders/:id         — public (confirmation order lookup)
   GET  /api/orders             — protected (admin list orders)
   POST /api/orders/:id/approve — protected (admin approve & send email)
   POST /api/orders/:id/reject  — protected (admin reject payment)
   POST /api/orders/:id/resend-email — protected (resend download link)
   ================================================================ */

const router   = require('express').Router();
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { v4: uuid } = require('uuid');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/emailService');

function generateOrderNumber() {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `CAN-${rand}`;
}

function getBaseUrl(req) {
  // 1. Origin header (browser AJAX requests)
  const origin = req.get('origin');
  if (origin && !origin.includes('undefined') && !origin.includes('localhost')) {
    return origin.replace(/\/+$/, '');
  }

  // 2. Referer header (e.g. from admin panel or checkout page)
  const referer = req.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      if (!url.hostname.includes('localhost')) {
        return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
      }
    } catch (_) {}
  }

  // 3. X-Forwarded-Host or Host header (preserves :3000 from client)
  const fwdHost = req.get('x-forwarded-host');
  const host = fwdHost || req.get('host');
  if (host && !host.includes('localhost')) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  // 4. Configured environment variable
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 5. Fallback using host even if localhost
  if (host) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return envUrl || 'http://localhost:3000';
}


/* ── POST /api/orders — public (create order) ── */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      items,
      paymentReference,
    } = req.body;

    // Validate customer fields
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    if (!customerEmail || !customerEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ error: 'Please enter your phone number.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (!paymentReference || !paymentReference.trim()) {
      return res.status(400).json({ error: 'Please enter the UPI payment reference / UTR number.' });
    }

    await client.query('BEGIN');

    // Deduplicate items by albumId
    const uniqueAlbumIds = Array.from(new Set(items.map(i => i.id || i.albumId)));
    
    // Fetch product rows from DB to calculate trusted server-side total
    const { rows: products } = await client.query(
      `SELECT id, title, product_enabled, product_price, digital_file_path, digital_file_id 
       FROM records 
       WHERE id = ANY($1::text[])`,
      [uniqueAlbumIds]
    );

    if (products.length !== uniqueAlbumIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more selected albums could not be found.' });
    }

    let calculatedTotal = 0;
    const orderItemsToInsert = [];

    for (const p of products) {
      if (!p.product_enabled) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Album "${p.title}" is currently not available for purchase.` });
      }
      if (!p.digital_file_path) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Digital file is missing for album "${p.title}".` });
      }

      const price = Number(p.product_price || 0);
      calculatedTotal += price;

      orderItemsToInsert.push({
        albumId: p.id,
        titleSnapshot: p.title,
        priceSnapshot: price,
        digitalFileRef: p.digital_file_id || p.id,
      });
    }

    const orderId     = `order-${uuid()}`;
    const orderNumber = generateOrderNumber();

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (id, order_number, customer_name, customer_email, customer_phone, 
          total_amount, currency, payment_status, order_status, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orderId,
        orderNumber,
        customerName.trim(),
        customerEmail.trim().toLowerCase(),
        customerPhone.trim(),
        calculatedTotal,
        'INR',
        'PENDING',
        'PAYMENT_REVIEW',
        paymentReference.trim(),
      ]
    );

    const createdOrder = orderRows[0];

    // Insert order items
    for (const item of orderItemsToInsert) {
      await client.query(
        `INSERT INTO order_items
           (id, order_id, album_id, album_title_snapshot, album_price_snapshot, quantity, digital_file_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `item-${uuid()}`,
          orderId,
          item.albumId,
          item.titleSnapshot,
          item.priceSnapshot,
          1,
          item.digitalFileRef,
        ]
      );
    }

    // Insert audit log
    await client.query(
      `INSERT INTO order_audit_logs (id, order_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `log-${uuid()}`,
        orderId,
        'ORDER_CREATED',
        'customer',
        JSON.stringify({
          utr: paymentReference.trim(),
          amount: calculatedTotal,
          itemsCount: orderItemsToInsert.length,
        }),
      ]
    );

    await client.query('COMMIT');

    // Trigger non-blocking confirmation email
    emailService.sendOrderConfirmation(createdOrder).catch(err => {
      console.warn('[orders] Confirmation email dispatch notice:', err.message);
    });

    res.status(201).json({
      orderId:       createdOrder.id,
      orderNumber:   createdOrder.order_number,
      totalAmount:   Number(createdOrder.total_amount),
      customerName:  createdOrder.customer_name,
      customerEmail: createdOrder.customer_email,
      paymentStatus: createdOrder.payment_status,
      orderStatus:   createdOrder.order_status,
      items:         orderItemsToInsert.map(i => ({ title: i.titleSnapshot, price: i.priceSnapshot })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders] POST / error:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  } finally {
    client.release();
  }
});

/* ── GET /api/orders/payment-qr/download — public (download QR image file) ── */
router.get('/payment-qr/download', (_req, res) => {
  const possiblePaths = [
    path.join(__dirname, '../public/payment-qr.png'),
    path.join(__dirname, '../../public/payment-qr.png'),
    path.join(process.env.UPLOAD_DIR || '/app/uploads', 'payment-qr.png'),
    path.join(__dirname, '../../../frontend/public/payment-qr.png'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'image/png');
      return res.download(p, 'payment-qr.png');
    }
  }

  res.status(404).json({ error: 'Payment QR image not found.' });
});

/* ── GET /api/orders/:id — public (customer confirmation check) ── */
router.get('/:id', async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT id, order_number, customer_name, customer_email, total_amount, currency,
              payment_status, order_status, payment_reference, created_at, paid_at
       FROM orders WHERE id = $1`,
      [req.params.id]
    );

    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });
    const order = orders[0];

    const { rows: items } = await pool.query(
      `SELECT album_id, album_title_snapshot, album_price_snapshot
       FROM order_items WHERE order_id = $1`,
      [order.id]
    );

    let downloads = [];
    if (order.payment_status === 'PAID') {
      const { rows: tokens } = await pool.query(
        `SELECT dt.token, dt.album_id, dt.download_count, dt.max_downloads, dt.expires_at,
                r.title, r.digital_file_name, r.digital_file_size
         FROM download_tokens dt
         JOIN records r ON r.id = dt.album_id
         WHERE dt.order_id = $1`,
        [order.id]
      );
      downloads = tokens.map(t => ({
        albumId: t.album_id,
        title: t.title || t.album_title_snapshot,
        fileName: t.digital_file_name || `${t.title || 'album'}.zip`,
        fileSize: Number(t.digital_file_size || 0),
        downloadUrl: `/api/download/${t.token}`,
        pageUrl: `/download/${t.token}`,
        downloadCount: t.download_count,
        maxDownloads: t.max_downloads,
        expiresAt: t.expires_at,
      }));
    }

    res.json({
      ...order,
      items: items.map(i => ({
        albumId: i.album_id,
        title:   i.album_title_snapshot,
        price:   Number(i.album_price_snapshot),
      })),
      downloads,
    });
  } catch (err) {
    console.error('[orders] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch order.' });
  }
});

/* ── GET /api/orders — protected (admin list all orders) ── */
router.get('/', authenticate, async (req, res) => {
  try {
    const statusFilter = req.query.status;
    let query = `
      SELECT o.*,
             COALESCE(json_agg(
               json_build_object(
                 'id', oi.id,
                 'albumId', oi.album_id,
                 'title', oi.album_title_snapshot,
                 'price', oi.album_price_snapshot
               )
             ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
    `;

    const params = [];
    if (statusFilter && statusFilter !== 'ALL') {
      query += ` WHERE o.payment_status = $1`;
      params.push(statusFilter);
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const { rows: orders } = await pool.query(query, params);
    res.json(orders);
  } catch (err) {
    console.error('[orders] admin GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

/* ── POST /api/orders/:id/approve — protected (admin approve payment & deliver) ── */
router.post('/:id/approve', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orders } = await client.query(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!orders.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orders[0];

    // Idempotent guard: if already approved, don't recreate tokens or duplicate emails
    if (order.payment_status === 'PAID') {
      const { rows: existingTokens } = await client.query(
        `SELECT dt.token, dt.album_id, oi.album_title_snapshot
         FROM download_tokens dt
         JOIN order_items oi ON oi.order_id = dt.order_id AND oi.album_id = dt.album_id
         WHERE dt.order_id = $1`,
        [order.id]
      );
      await client.query('COMMIT');
      return res.json({ message: 'Order was already approved.', order, tokens: existingTokens });
    }

    // Get order items and corresponding records
    const { rows: items } = await client.query(
      `SELECT oi.*, r.digital_file_path, r.title as current_title
       FROM order_items oi
       JOIN records r ON r.id = oi.album_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    const itemsWithTokens = [];

    for (const item of items) {
      let filePath = item.digital_file_path;

      // If digital file is missing on disk, auto-generate from tracks if available
      if (!filePath || !fs.existsSync(filePath)) {
        const { rows: tracks } = await client.query(
          'SELECT * FROM tracks WHERE record_id = $1 ORDER BY track_number ASC',
          [item.album_id]
        );
        if (tracks.length > 0) {
          const { generateAlbumZip } = require('../services/zipService');
          const zipMeta = await generateAlbumZip({ id: item.album_id, title: item.current_title || item.album_title_snapshot }, tracks);
          filePath = zipMeta.filePath;
          await client.query(
            `UPDATE records
             SET digital_file_id   = $1,
                 digital_file_name = $2,
                 digital_file_size = $3,
                 digital_file_hash = $4,
                 digital_file_path = $5,
                 product_updated_at = NOW()
             WHERE id = $6`,
            [zipMeta.fileId, zipMeta.fileName, zipMeta.fileSize, zipMeta.fileHash, zipMeta.filePath, item.album_id]
          );
        } else {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Cannot deliver order: digital file is missing and no tracks exist for album "${item.album_title_snapshot}".`
          });
        }
      }

      // Check if token already exists
      const { rows: existing } = await client.query(
        `SELECT token FROM download_tokens WHERE order_id = $1 AND album_id = $2`,
        [order.id, item.album_id]
      );

      let token;
      if (existing.length > 0) {
        token = existing[0].token;
      } else {
        token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await client.query(
          `INSERT INTO download_tokens 
             (id, order_id, album_id, token, file_path, max_downloads, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `token-${uuid()}`,
            order.id,
            item.album_id,
            token,
            filePath,
            10,
            expiresAt,
          ]
        );
      }

      itemsWithTokens.push({
        album_id: item.album_id,
        album_title_snapshot: item.album_title_snapshot,
        token,
      });
    }

    // Update order to PAID and DELIVERED
    const { rows: updatedOrders } = await client.query(
      `UPDATE orders
       SET payment_status = 'PAID',
           order_status   = 'DELIVERED',
           paid_at        = NOW(),
           updated_at     = NOW()
       WHERE id = $1
       RETURNING *`,
      [order.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO order_audit_logs (id, order_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `log-${uuid()}`,
        order.id,
        'PAYMENT_APPROVED',
        req.user?.email || 'admin',
        JSON.stringify({ tokensGenerated: itemsWithTokens.length }),
      ]
    );

    await client.query('COMMIT');

    const updatedOrder = updatedOrders[0];

    // Send email with download links
    const baseUrl = getBaseUrl(req);
    emailService.sendPaymentApprovedEmail(updatedOrder, itemsWithTokens, baseUrl).catch(err => {
      console.warn('[orders] Delivery email failed:', err.message);
    });

    res.json({
      message: 'Payment approved successfully. Download email dispatched.',
      order: updatedOrder,
      tokens: itemsWithTokens,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders] approve error:', err);
    res.status(500).json({ error: 'Failed to approve order.' });
  } finally {
    client.release();
  }
});

/* ── POST /api/orders/:id/reject — protected (admin reject payment) ── */
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows: orders } = await pool.query(
      `UPDATE orders
       SET payment_status = 'REJECTED',
           order_status   = 'CANCELLED',
           admin_notes    = $1,
           updated_at     = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason || 'Payment verification failed', req.params.id]
    );

    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });
    const order = orders[0];

    await pool.query(
      `INSERT INTO order_audit_logs (id, order_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `log-${uuid()}`,
        order.id,
        'PAYMENT_REJECTED',
        req.user?.email || 'admin',
        JSON.stringify({ reason }),
      ]
    );

    emailService.sendPaymentRejectedEmail(order, reason).catch(err => {
      console.warn('[orders] Reject email notice:', err.message);
    });

    res.json({ message: 'Order rejected.', order });
  } catch (err) {
    console.error('[orders] reject error:', err);
    res.status(500).json({ error: 'Failed to reject order.' });
  }
});

/* ── POST /api/orders/:id/resend-email — protected (resend download link) ── */
router.post('/:id/resend-email', authenticate, async (req, res) => {
  try {
    const { rows: orders } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });

    const order = orders[0];
    if (order.payment_status !== 'PAID') {
      return res.status(400).json({ error: 'Cannot send download email for unpaid order.' });
    }

    const { rows: tokens } = await pool.query(
      `SELECT dt.token, oi.album_title_snapshot
       FROM download_tokens dt
       JOIN order_items oi ON oi.order_id = dt.order_id AND oi.album_id = dt.album_id
       WHERE dt.order_id = $1`,
      [order.id]
    );

    if (!tokens.length) {
      return res.status(400).json({ error: 'No download tokens found for this order.' });
    }

    const baseUrl = getBaseUrl(req);
    await emailService.sendPaymentApprovedEmail(order, tokens, baseUrl);

    await pool.query(
      `INSERT INTO order_audit_logs (id, order_id, action, performed_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `log-${uuid()}`,
        order.id,
        'EMAIL_RESENT',
        req.user?.email || 'admin',
        JSON.stringify({ tokensCount: tokens.length }),
      ]
    );

    res.json({ message: 'Download email resent successfully.' });
  } catch (err) {
    console.error('[orders] resend-email error:', err);
    res.status(500).json({ error: 'Failed to resend email.' });
  }
});

module.exports = router;
