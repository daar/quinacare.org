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
    // 404 / missing-page log. WordPress -> Astro migration left stale
    // URLs in the wild; this table captures every 404 hit so we can
    // pick the most-requested ones and turn them into redirects.
    // is_bot is a tagged guess from the User-Agent, never a filter —
    // both bot and human rows are kept so the heuristic can be
    // re-evaluated later without losing data.
    `CREATE TABLE IF NOT EXISTS page_misses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      path       TEXT NOT NULL,
      referrer   TEXT,
      user_agent TEXT,
      language   TEXT,
      is_bot     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_page_misses_created ON page_misses(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_page_misses_path ON page_misses(path)`,
    `CREATE INDEX IF NOT EXISTS idx_page_misses_bot ON page_misses(is_bot)`,
    // News post view counter. One row per counted view; de-duplicated to
    // a single click per hashed IP per 24h in the application layer. The
    // "most popular" list is a COUNT over a trailing window (30 days).
    // ip_hash is a salted SHA-256 of the client IP — the raw address is
    // never stored (see lib/postViews.ts).
    `CREATE TABLE IF NOT EXISTS post_views (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT NOT NULL,
      lang       TEXT NOT NULL DEFAULT 'nl',
      ip_hash    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_post_views_created ON post_views(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_post_views_lang_created ON post_views(lang, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_post_views_dedup ON post_views(slug, ip_hash, created_at)`,
  ]);
  migrated = true;
}
