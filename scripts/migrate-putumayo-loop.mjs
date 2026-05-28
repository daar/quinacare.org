#!/usr/bin/env node
/**
 * Putumayo Loop — Turso schema bootstrap.
 *
 * Creates `putumayo_loop_editions`, `putumayo_loop_hubs`, and
 * `putumayo_loop_subscribers` if they don't exist, and applies idempotent
 * ALTERs that bring older databases up to the current schema. No data is
 * seeded — editions, hubs, and subscribers are managed directly in Turso.
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
    CREATE TABLE IF NOT EXISTS putumayo_loop_editions (
      year            INTEGER PRIMARY KEY,
      slug            TEXT NOT NULL UNIQUE,
      fundraiser_slug TEXT NOT NULL,
      title           TEXT NOT NULL,
      run_date        TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('upcoming','active','past')),
      raised_amount   INTEGER NOT NULL,
      target_amount   INTEGER NOT NULL,
      donors          INTEGER NOT NULL DEFAULT 0,
      currency        TEXT NOT NULL DEFAULT 'EUR',
      total_runners   INTEGER,
      story_key       TEXT,
      story_nl        TEXT,
      story_en        TEXT,
      story_es        TEXT,
      youtube_id      TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS putumayo_loop_hubs (
      edition_year  INTEGER NOT NULL,
      id            TEXT NOT NULL,
      name          TEXT NOT NULL,
      city          TEXT NOT NULL,
      country       TEXT NOT NULL,
      lat           REAL NOT NULL,
      lng           REAL NOT NULL,
      captain       TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (edition_year, id),
      FOREIGN KEY (edition_year) REFERENCES putumayo_loop_editions(year)
    )
  `);
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
      signed_up_at  TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (edition_year) REFERENCES putumayo_loop_editions(year)
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_subscribers_edition ON putumayo_loop_subscribers (edition_year)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_hubs_edition ON putumayo_loop_hubs (edition_year)`,
  );
  // Idempotent column additions for pre-existing tables.
  await tryAlter(`ALTER TABLE putumayo_loop_editions ADD COLUMN story_nl TEXT`);
  await tryAlter(`ALTER TABLE putumayo_loop_editions ADD COLUMN story_en TEXT`);
  await tryAlter(`ALTER TABLE putumayo_loop_editions ADD COLUMN story_es TEXT`);
}

async function main() {
  console.log("ensuring schema…");
  await ensureSchema();
  for (const t of [
    "putumayo_loop_editions",
    "putumayo_loop_hubs",
    "putumayo_loop_subscribers",
  ]) {
    const r = await db.execute(`SELECT count(*) AS n FROM ${t}`);
    console.log(`  ${t.padEnd(30)} -> ${r.rows[0].n} rows`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
