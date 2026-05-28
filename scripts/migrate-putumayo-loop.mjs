#!/usr/bin/env node
/**
 * Putumayo Loop — Turso schema bootstrap.
 *
 * The only table managed in Turso for the Putumayo Loop is
 * `putumayo_loop_subscribers` — live signups from the modal. Editions,
 * hubs, story copy, raise goals etc. live in `src/data/putumayoLoop.ts`.
 * Donations are read live from the `donations` table (managed by the
 * Mollie integration; schema lives in `src/lib/db.ts`).
 *
 * Idempotent: creates the table if it doesn't exist and applies any
 * pending column additions.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-putumayo-loop.mjs
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function tryAlter(sql) {
  try {
    await db.execute(sql);
  } catch (e) {
    if (!/duplicate column|already exists/i.test(String(e?.message ?? e))) {
      throw e;
    }
  }
}

const SUBSCRIBERS_SCHEMA = `
  CREATE TABLE putumayo_loop_subscribers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id   TEXT UNIQUE,
    edition_year  INTEGER NOT NULL,
    first_name    TEXT,
    last_name     TEXT,
    email         TEXT,
    hub_id        TEXT,
    lat           REAL,
    lng           REAL,
    location      TEXT,
    count         INTEGER NOT NULL DEFAULT 1,
    distance      TEXT,
    signed_up_at  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

/**
 * Older DBs were created with FOREIGN KEY (edition_year) REFERENCES
 * putumayo_loop_editions(year). The editions table no longer exists
 * (edition metadata lives in src/data/putumayoLoop.ts now), so any
 * INSERT into subscribers fails the FK check. Detect the stale FK and
 * rebuild the table in-place (rename → recreate → copy → drop). Both
 * the FK and the rebuild are idempotent: once cleared, this is a noop.
 */
async function dropStaleForeignKey() {
  // Does the table even exist yet?
  const exists = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='putumayo_loop_subscribers'`,
  );
  if (exists.rows.length === 0) return;

  const fks = await db.execute(
    `PRAGMA foreign_key_list(putumayo_loop_subscribers)`,
  );
  if (fks.rows.length === 0) return;

  console.log(
    "  found stale FK on putumayo_loop_subscribers — rebuilding without it…",
  );
  // The rebuild has to bypass FK checks; if it's left on, the rename
  // step trips over the same orphan reference we're trying to remove.
  await db.execute(`PRAGMA foreign_keys = OFF`);
  await db.execute(
    `ALTER TABLE putumayo_loop_subscribers RENAME TO putumayo_loop_subscribers_old`,
  );
  await db.execute(SUBSCRIBERS_SCHEMA);
  await db.execute(`
    INSERT INTO putumayo_loop_subscribers
      (id, external_id, edition_year, first_name, last_name, email,
       hub_id, lat, lng, location, count, distance, signed_up_at, created_at)
    SELECT id, external_id, edition_year, first_name, last_name, email,
       hub_id, lat, lng, location, count, distance, signed_up_at, created_at
    FROM putumayo_loop_subscribers_old
  `);
  await db.execute(`DROP TABLE putumayo_loop_subscribers_old`);
  await db.execute(`PRAGMA foreign_keys = ON`);
}

async function ensureSchema() {
  await db.execute(`CREATE TABLE IF NOT EXISTS putumayo_loop_subscribers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id   TEXT UNIQUE,
      edition_year  INTEGER NOT NULL,
      first_name    TEXT,
      last_name     TEXT,
      email         TEXT,
      hub_id        TEXT,
      lat           REAL,
      lng           REAL,
      location      TEXT,
      count         INTEGER NOT NULL DEFAULT 1,
      distance      TEXT,
      signed_up_at  TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  await dropStaleForeignKey();
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_subscribers_edition ON putumayo_loop_subscribers (edition_year)`,
  );
  // Idempotent column additions for pre-existing tables.
  await tryAlter(
    `ALTER TABLE putumayo_loop_subscribers ADD COLUMN distance TEXT`,
  );
}

async function main() {
  console.log("ensuring schema…");
  await ensureSchema();
  const r = await db.execute(
    `SELECT count(*) AS n FROM putumayo_loop_subscribers`,
  );
  console.log(`  putumayo_loop_subscribers -> ${r.rows[0].n} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
