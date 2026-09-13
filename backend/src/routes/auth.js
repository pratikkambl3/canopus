/* ================================================================
   CANOPUS — Auth Routes
   POST /api/auth/login  — validates admin credentials, returns JWT
   POST /api/auth/logout — stateless; client discards token
   GET  /api/auth/me     — validates current token
   ================================================================ */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

/* ── Lazy-hash the admin password so we can use a plain-text env var ── */
let cachedHash = null;
async function getAdminHash() {
  if (!cachedHash) {
    cachedHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || '', 10);
  }
  return cachedHash;
}

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Compare email (case-insensitive) and password
    const emailMatch = email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase();

    // Constant-time password comparison to resist timing attacks
    const storedHash = await getAdminHash();
    const passwordMatch = await bcrypt.compare(password, storedHash);

    if (!emailMatch || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { email: email.toLowerCase(), role: 'admin' },
      process.env.JWT_SECRET,
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
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ email: payload.email, role: payload.role });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

module.exports = router;
