/* ================================================================
   CANOPUS — PostgreSQL connection pool & schema migrations
   Reads credentials entirely from environment variables.
   ================================================================ */

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'postgres',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'canopus_db',
  user:     process.env.DB_USER     || 'canopus',
  password: process.env.DB_PASSWORD || '',
});

/**
 * Create tables and run idempotent migrations if they do not yet exist.
 * Called once on server startup after the DB becomes reachable.
 */
async function initDb() {
  // 1. Records table (The Albums/EPs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      id                    TEXT        PRIMARY KEY,
      title                 TEXT        NOT NULL,
      artist                TEXT        DEFAULT '',
      description           TEXT        DEFAULT '',
      genre                 TEXT        DEFAULT 'Experimental',
      release_date          DATE,
      featured              BOOLEAN     DEFAULT FALSE,
      artwork_url           TEXT        DEFAULT '',
      product_enabled       BOOLEAN     DEFAULT FALSE,
      product_price         NUMERIC(10, 2) DEFAULT 0.00,
      product_description   TEXT        DEFAULT '',
      digital_file_id       TEXT        DEFAULT '',
      digital_file_name     TEXT        DEFAULT '',
      digital_file_size     BIGINT      DEFAULT 0,
      digital_file_hash     TEXT        DEFAULT '',
      digital_file_path     TEXT        DEFAULT '',
      product_created_at    TIMESTAMPTZ DEFAULT NOW(),
      product_updated_at    TIMESTAMPTZ DEFAULT NOW(),
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      updated_at            TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Idempotent migrations for existing deployments of records table
  await pool.query(`
    ALTER TABLE records ADD COLUMN IF NOT EXISTS artist TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS product_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS product_price NUMERIC(10, 2) DEFAULT 0.00;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS product_description TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS digital_file_id TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS digital_file_name TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS digital_file_size BIGINT DEFAULT 0;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS digital_file_hash TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS digital_file_path TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS product_created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE records ADD COLUMN IF NOT EXISTS product_updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE records ADD COLUMN IF NOT EXISTS preview_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS preview_track_id TEXT DEFAULT '';
    ALTER TABLE records ADD COLUMN IF NOT EXISTS preview_start_time INTEGER DEFAULT 0;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS preview_end_time INTEGER DEFAULT 30;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS preview_duration INTEGER DEFAULT 30;
  `);

  // 2. Tracks table (Individual songs inside a record)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id            TEXT        PRIMARY KEY,
      record_id     TEXT        NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      title         TEXT        NOT NULL,
      original_title TEXT       DEFAULT '',
      version       TEXT        DEFAULT '',
      bpm           INTEGER     DEFAULT NULL,
      key           TEXT        DEFAULT '',
      audio_url     TEXT        DEFAULT '',
      artwork_url   TEXT        DEFAULT '',
      track_number  INTEGER     DEFAULT 1,
      preview_start_time INTEGER DEFAULT 0,
      preview_end_time   INTEGER DEFAULT 30,
      preview_duration   INTEGER DEFAULT 30,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artwork_url TEXT DEFAULT '';
    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS preview_start_time INTEGER DEFAULT 0;
    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS preview_end_time INTEGER DEFAULT 30;
    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS preview_duration INTEGER DEFAULT 30;
    ALTER TABLE tracks ALTER COLUMN bpm DROP DEFAULT;
    UPDATE tracks SET bpm = NULL WHERE bpm = 0;
  `);

  // 3. App Settings table (Configurable settings like preview duration)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT        PRIMARY KEY,
      value       TEXT        NOT NULL,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO app_settings (key, value)
    VALUES ('preview_duration_seconds', '30')
    ON CONFLICT (key) DO NOTHING;
  `);

  // 4. Support Queries table (Customer inquiries & issues)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_queries (
      id            TEXT        PRIMARY KEY,
      name          TEXT        NOT NULL,
      email         TEXT        NOT NULL,
      phone         TEXT        DEFAULT '',
      subject       TEXT        NOT NULL,
      message       TEXT        NOT NULL,
      status        TEXT        DEFAULT 'Open',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_support_queries_created_at ON support_queries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_support_queries_status ON support_queries(status);
  `);

  // 5. Orders table (Customer purchases)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id                    TEXT        PRIMARY KEY,
      order_number          TEXT        NOT NULL UNIQUE,
      customer_name         TEXT        NOT NULL,
      customer_email        TEXT        NOT NULL,
      customer_phone        TEXT        NOT NULL,
      total_amount          NUMERIC(10, 2) NOT NULL,
      currency              TEXT        DEFAULT 'INR',
      payment_status        TEXT        NOT NULL DEFAULT 'PENDING',
      order_status          TEXT        NOT NULL DEFAULT 'PENDING_PAYMENT',
      payment_reference     TEXT        DEFAULT '',
      payment_qr_reference  TEXT        DEFAULT '',
      admin_notes           TEXT        DEFAULT '',
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      updated_at            TIMESTAMPTZ DEFAULT NOW(),
      paid_at               TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  `);

  // 4. Order Items table (Snapshot of purchased albums per order)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                    TEXT        PRIMARY KEY,
      order_id              TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      album_id              TEXT        NOT NULL REFERENCES records(id) ON DELETE RESTRICT,
      album_title_snapshot  TEXT        NOT NULL,
      album_price_snapshot  NUMERIC(10, 2) NOT NULL,
      quantity              INTEGER     DEFAULT 1,
      digital_file_reference TEXT       DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  // 5. Download Tokens table (Cryptographically secure, expiring download tokens)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS download_tokens (
      id                  TEXT        PRIMARY KEY,
      order_id            TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      album_id            TEXT        NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      token               TEXT        NOT NULL UNIQUE,
      file_path           TEXT        NOT NULL,
      download_count      INTEGER     DEFAULT 0,
      max_downloads       INTEGER     DEFAULT 10,
      expires_at          TIMESTAMPTZ NOT NULL,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      last_downloaded_at  TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_download_tokens_order_id ON download_tokens(order_id);
  `);

  // 6. Order Audit Logs (Traceability for admin approvals and status changes)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_audit_logs (
      id                  TEXT        PRIMARY KEY,
      order_id            TEXT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      action              TEXT        NOT NULL,
      performed_by        TEXT        DEFAULT 'system',
      details             JSONB       DEFAULT '{}',
      created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_order_audit_logs_order_id ON order_audit_logs(order_id);
  `);

  // 7. Admin Users table (Database-driven credentials)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id            TEXT        PRIMARY KEY,
      email         TEXT        NOT NULL UNIQUE,
      password_hash TEXT        NOT NULL,
      role          TEXT        DEFAULT 'admin',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  try {
    const bcrypt = require('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || 'canopus_admin_2024';
    const defaultHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(`
      INSERT INTO admin_users (id, email, password_hash, role)
      VALUES ('admin-01', $2, $1, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = $1, updated_at = NOW()
    `, [defaultHash, (process.env.ADMIN_EMAIL || 'admin@canopus.local').toLowerCase()]);
  } catch (err) {
    console.warn('[db] Admin user seed notice:', err.message);
  }
}

module.exports = { pool, initDb };
