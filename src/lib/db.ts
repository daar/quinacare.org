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

/** Ensures all tables exist. Runs once per cold start. */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  const db = getDb();
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
    // Append-only audit log for every observable event in a donation's
    // lifecycle (form submit → Mollie create → checkout redirect →
    // return page → webhook → cron reconcile). The live status on the
    // donations row keeps the latest known state for fast queries;
    // this table is the source of truth for the funnel.
    `CREATE TABLE IF NOT EXISTS donation_events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id     INTEGER NOT NULL,
      event_type      TEXT NOT NULL,
      source          TEXT NOT NULL,
      mollie_status   TEXT,
      previous_status TEXT,
      payload         TEXT NOT NULL DEFAULT '{}',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_donation_events_donation ON donation_events(donation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_donation_events_type ON donation_events(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_donation_events_created ON donation_events(created_at)`,
    // Persistent error log — console.error is invisible to end users
    // and Netlify Function logs are not queryable after the fact, so
    // we mirror every server- and client-side error here for analysis.
    `CREATE TABLE IF NOT EXISTS app_errors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      source     TEXT NOT NULL,
      level      TEXT NOT NULL DEFAULT 'error',
      message    TEXT NOT NULL,
      context    TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_app_errors_source ON app_errors(source)`,
    `CREATE INDEX IF NOT EXISTS idx_app_errors_created ON app_errors(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_app_errors_level ON app_errors(level)`,
  ]);
  migrated = true;
}
