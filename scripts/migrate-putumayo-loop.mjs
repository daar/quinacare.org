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

async function ensureSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS putumayo_loop_subscribers (
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
  `);
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
