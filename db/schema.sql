CREATE TABLE IF NOT EXISTS donations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  mollie_id          TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending',
  amount_cents       INTEGER NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'EUR',
  frequency          TEXT NOT NULL DEFAULT 'one-time',
  payment_method     TEXT,
  locale             TEXT NOT NULL DEFAULT 'nl',
  context            TEXT NOT NULL DEFAULT 'donate',
  metadata           TEXT NOT NULL DEFAULT '{}',
  mollie_customer_id TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_donations_mollie_id ON donations(mollie_id);
CREATE INDEX IF NOT EXISTS idx_donations_context ON donations(context);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
