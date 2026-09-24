/* ================================================================
   CANOPUS — Auth Routes
   POST /api/auth/login  — validates admin credentials, returns JWT
   POST /api/auth/logout — stateless; client discards token
   GET  /api/auth/me     — validates current token
   ================================================================ */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const { pool } = require('../db');

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPass  = String(password).trim();

    let authenticated = false;
    let role = 'admin';
    let dbRowExists = false;

    // 1. Query admin_users from database
    try {
      const { rows } = await pool.query('SELECT * FROM admin_users WHERE LOWER(email) = $1', [cleanEmail]);
      if (rows.length > 0) {
        dbRowExists = true;
        const match = await bcrypt.compare(cleanPass, rows[0].password_hash);
        if (match) {
          authenticated = true;
          role = rows[0].role || 'admin';
        }
      }
    } catch (dbErr) {
      console.warn('[auth] DB admin check notice:', dbErr.message);
    }

    // 2. Fallback: always check env credentials even if DB row exists
    //    This handles stale/mismatched DB hashes (e.g. after password change in .env)
    if (!authenticated) {
      const envEmail = (process.env.ADMIN_EMAIL || 'admin@canopus.local').toLowerCase();
      const envPass  = process.env.ADMIN_PASSWORD || 'canopus_admin_2024';

      if (cleanEmail === envEmail && cleanPass === envPass) {
        authenticated = true;

        // Self-heal: update the DB hash so future logins use the DB path correctly
        try {
          const newHash = await bcrypt.hash(envPass, 10);
          if (dbRowExists) {
            await pool.query(
              `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = $2`,
              [newHash, envEmail]
            );
          } else {
            await pool.query(
              `INSERT INTO admin_users (id, email, password_hash, role)
               VALUES ('admin-01', $1, $2, 'admin')
               ON CONFLICT (email) DO UPDATE SET password_hash = $2, updated_at = NOW()`,
              [envEmail, newHash]
            );
          }
          console.log('[auth] DB admin hash self-healed from env credentials.');
        } catch (healErr) {
          console.warn('[auth] Could not self-heal DB hash:', healErr.message);
        }
      }
    }

    if (!authenticated) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { email: cleanEmail, role },
      process.env.JWT_SECRET || 'canopus-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
  } catch (err) {
    console.error('[auth] login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* POST /api/auth/logout  (stateless — client drops the token) */
router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out.' });
});

/* GET /api/auth/me — check if current token is valid */
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'canopus-secret-key');
    return res.json({ email: payload.email, role: payload.role });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

module.exports = router;
