// The one definition of the newsletter subscriber schema and the SQL that
// writes it.
//
// Plain .mjs on purpose. src/lib/db.ts imports it to build its schema
// batch, and the scripts under scripts/ import it under plain node —
// db.ts itself can never be imported by a script because it reads
// import.meta.env. Keeping one copy is what stops the live table and a
// freshly created one from drifting apart, which is exactly what
// happened to putumayo_loop_subscribers (see scripts/migrate-putumayo-loop.mjs).

/** The language lists someone can be on. Closed set; validate against it. */
export const LOCALES = ["nl", "en", "es"];

/** Canonical order for the locale set, so "nl,en" and "en,nl" cannot both exist. */
export const CANONICAL_LOCALE_ORDER = LOCALES;

export const SUBSCRIBERS_TABLE = `CREATE TABLE IF NOT EXISTS subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL DEFAULT '',
  locale          TEXT NOT NULL DEFAULT 'nl',
  status          TEXT NOT NULL DEFAULT 'active',
  source          TEXT NOT NULL DEFAULT 'website',
  consent_ip      TEXT NOT NULL DEFAULT '',
  subscribed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT,
  external_id     TEXT,
  synced_at       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// The row carries the current state for fast queries; this log is the
// audit trail. It is what actually answers "when did this person consent,
// and by what route", and it survives resubscribe cycles that overwrite
// the row. Same split as donations / donation_events.
export const SUBSCRIBER_EVENTS_TABLE = `CREATE TABLE IF NOT EXISTS subscriber_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL,
  event_type    TEXT NOT NULL,
  source        TEXT NOT NULL,
  payload       TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// No index on email: the UNIQUE constraint already builds one.
export const SUBSCRIBERS_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_external ON subscribers(external_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriber_events_sub ON subscriber_events(subscriber_id)`,
];

/**
 * Merge two locale sets and emit them in canonical order.
 *
 * Written out per language rather than as string concatenation so the
 * result is always ordered: blind appending is what produced both
 * "nl,en" and "en,nl" in the live table. The codes share no substrings,
 * so a LIKE test is exact here.
 */
function mergeLocales(left, right) {
  const parts = CANONICAL_LOCALE_ORDER.map(
    (l) =>
      `(CASE WHEN ${left} LIKE '%${l}%' OR ${right} LIKE '%${l}%' THEN '${l},' ELSE '' END)`,
  );
  return `rtrim(${parts.join(" || ")}, ',')`;
}

const MERGED = mergeLocales("subscribers.locale", "excluded.locale");

/**
 * Someone actively opting in: the homepage form or the donation
 * thank-you checkbox.
 *
 * Reactivates a previously unsubscribed row — they just asked for mail
 * again — and moves subscribed_at to now so the consent date reflects
 * the fresh decision. `source` is never overwritten: the first recorded
 * route is the one that brought them in.
 *
 * Args: email, name, locale, source, consent_ip
 */
export const UPSERT_SUBSCRIBER_CONSENT = `INSERT INTO subscribers
    (email, name, locale, status, source, consent_ip)
  VALUES (?, ?, ?, 'active', ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    locale          = ${MERGED},
    name            = CASE WHEN subscribers.name = '' THEN excluded.name ELSE subscribers.name END,
    status          = 'active',
    unsubscribed_at = NULL,
    subscribed_at   = CASE WHEN subscribers.status = 'active'
                           THEN subscribers.subscribed_at ELSE datetime('now') END,
    consent_ip      = CASE WHEN subscribers.status = 'active'
                           THEN subscribers.consent_ip ELSE excluded.consent_ip END,
    updated_at      = datetime('now')`;

/**
 * Bulk loading from a source that is not a fresh act of consent: the
 * WordPress CSV import and the MailerLite pull.
 *
 * Identical to the consent variant except that it NEVER touches status,
 * unsubscribed_at or subscribed_at. Using the consent variant here would
 * silently resurrect everyone who had unsubscribed the next time the
 * importer ran.
 *
 * Args: email, name, locale, source, created_at, subscribed_at
 */
export const UPSERT_SUBSCRIBER_IMPORT = `INSERT INTO subscribers
    (email, name, locale, status, source, created_at, subscribed_at)
  VALUES (?, ?, ?, 'active', ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    locale     = ${MERGED},
    name       = CASE WHEN subscribers.name = '' THEN excluded.name ELSE subscribers.name END,
    updated_at = datetime('now')`;

/** Normalise a locale set read from the database into canonical order. */
export function canonicalLocales(value) {
  const held = new Set(String(value || "").split(","));
  return CANONICAL_LOCALE_ORDER.filter((l) => held.has(l));
}
