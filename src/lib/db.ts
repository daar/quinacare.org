import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let migrated = false;

export function getDb(): Client {
  if (!client) {
    const url = import.meta.env.TURSO_DATABASE_URL;
    const authToken = import.meta.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL is not configured");
    }

    client = createClient({ url, authToken });
  }
  return client;
}

async function addColumnIfMissing(
  db: Client,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((r) => r.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Ensures all tables exist. Runs once per cold start. */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  const db = getDb();

  // Core tables
  await db.batch([
    `CREATE TABLE IF NOT EXISTS donations (
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_donations_mollie_id ON donations(mollie_id)`,
    `CREATE INDEX IF NOT EXISTS idx_donations_context ON donations(context)`,
    `CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)`,
    `CREATE TABLE IF NOT EXISTS subscribers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL UNIQUE,
      locale     TEXT NOT NULL DEFAULT 'nl',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email)`,
    `CREATE TABLE IF NOT EXISTS donor_thanks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      locale     TEXT NOT NULL DEFAULT 'nl',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]);

  // Expand donations table with donor info and migration columns
  const donationCols: [string, string][] = [
    ["donor_name", "TEXT"],
    ["donor_email", "TEXT"],
    ["donor_phone", "TEXT"],
    ["donor_company", "TEXT"],
    ["donor_message", "TEXT"],
    ["project", "TEXT"],
    ["source", "TEXT NOT NULL DEFAULT 'astro'"],
    ["wp_donation_id", "TEXT"],
    ["mollie_subscription_id", "TEXT"],
    ["settlement_currency", "TEXT"],
    ["settlement_amount_cents", "INTEGER"],
  ];
  for (const [col, def] of donationCols) {
    await addColumnIfMissing(db, "donations", col, def);
  }

  // Donors table (Mollie customers)
  await db.batch([
    `CREATE TABLE IF NOT EXISTS donors (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      mollie_customer_id TEXT UNIQUE,
      mode               TEXT,
      name               TEXT,
      email              TEXT,
      locale             TEXT,
      source             TEXT NOT NULL DEFAULT 'astro',
      metadata           TEXT NOT NULL DEFAULT '{}',
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email)`,
    `CREATE INDEX IF NOT EXISTS idx_donors_mollie_customer_id ON donors(mollie_customer_id)`,
  ]);

  // Subscriptions table (Mollie recurring)
  await db.batch([
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      mollie_subscription_id  TEXT UNIQUE,
      mollie_customer_id      TEXT,
      mode                    TEXT,
      currency                TEXT NOT NULL DEFAULT 'EUR',
      amount_cents            INTEGER NOT NULL,
      settlement_currency     TEXT,
      settlement_amount_cents INTEGER,
      times                   INTEGER,
      interval                TEXT,
      description             TEXT,
      method                  TEXT,
      status                  TEXT NOT NULL DEFAULT 'active',
      source                  TEXT NOT NULL DEFAULT 'astro',
      created_at              TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(mollie_customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
  ]);

  await db.batch([
    `CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email)`,
    `CREATE INDEX IF NOT EXISTS idx_donations_source ON donations(source)`,
  ]);

  migrated = true;
}
