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

/** Ensures the donations table exists. Runs once per cold start. */
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
  ]);
  migrated = true;
}
