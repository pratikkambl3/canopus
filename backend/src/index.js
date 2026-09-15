/* ================================================================
   CANOPUS — Express Server Entry Point
   ================================================================ */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDb, pool } = require('./db');

const authRouter     = require('./routes/auth');
const recordsRouter  = require('./routes/records');
const productsRouter = require('./routes/products');
const ordersRouter   = require('./routes/orders');
const downloadRouter = require('./routes/download');
const supportRouter  = require('./routes/support');
const settingsRouter = require('./routes/settings');

const app  = express();
const PORT = parseInt(process.env.BACKEND_PORT || '8000', 10);

/* ── Allowed origins ── */
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, Docker healthcheck)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Static file serving for uploads & assets ── */
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '../public')));

/* ── Routes ── */
app.use('/api/auth',     authRouter);
app.use('/api/records',  recordsRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders',   ordersRouter);
app.use('/api/download', downloadRouter);
app.use('/api/support',  supportRouter);
app.use('/api/settings', settingsRouter);

/* ── Health check ── */
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

/* ── 404 catch-all ── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

/* ── Startup: wait for DB then boot ── */
async function start() {
  const MAX_RETRIES = 15;
  const RETRY_MS    = 2000;

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[canopus] Database connected.');
      break;
    } catch (err) {
      console.log(`[canopus] Waiting for database… (${i}/${MAX_RETRIES})`);
      if (i === MAX_RETRIES) {
        console.error('[canopus] Could not connect to database. Exiting.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, RETRY_MS));
    }
  }

  await initDb();
  console.log('[canopus] Database tables initialised.');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[canopus] Backend listening on port ${PORT}`);
  });
}

start();
