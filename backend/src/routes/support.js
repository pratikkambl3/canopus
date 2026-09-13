/* ================================================================
   CANOPUS — Support REST API
   POST  /api/support             — public: submit query, send emails
   GET   /api/support             — protected: list queries for admin
   PATCH /api/support/:id/status  — protected: update query status
   ================================================================ */

const router       = require('express').Router();
const { v4: uuid } = require('uuid');
const { pool }     = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  sendSupportNotificationToTeam,
  sendSupportAcknowledgementToUser,
} = require('../services/emailService');

/* ── POST /api/support — public ── */
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message / query is required.' });
    }

    const queryId = `query-${uuid()}`;
    const cleanName    = name.trim();
    const cleanEmail   = email.trim().toLowerCase();
    const cleanPhone   = phone ? phone.trim() : '';
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    const { rows } = await pool.query(
      `INSERT INTO support_queries
         (id, name, email, phone, subject, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Open')
       RETURNING *`,
      [queryId, cleanName, cleanEmail, cleanPhone, cleanSubject, cleanMessage]
    );

    const savedQuery = rows[0];

    // Asynchronous email delivery with graceful fallback
    (async () => {
      try {
        await Promise.allSettled([
          sendSupportNotificationToTeam(savedQuery),
          sendSupportAcknowledgementToUser(savedQuery),
        ]);
      } catch (mailErr) {
        console.warn('[support] Email dispatch error:', mailErr.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting our support team. We have received your query and our team will respond to you shortly.',
      query: savedQuery,
    });
  } catch (err) {
    console.error('[support] POST / error:', err);
    res.status(500).json({ error: 'Failed to submit support query. Please try again.' });
  }
});

/* ── GET /api/support — protected ── */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM support_queries';
    const params = [];

    if (status && status !== 'ALL') {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[support] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch support queries.' });
  }
});

/* ── PATCH /api/support/:id/status — protected ── */
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Open', 'In Progress', 'Resolved'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const { rows } = await pool.query(
      `UPDATE support_queries
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Support query not found.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[support] PATCH /:id/status error:', err);
    res.status(500).json({ error: 'Failed to update query status.' });
  }
});

module.exports = router;
