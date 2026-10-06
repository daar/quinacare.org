#!/usr/bin/env node
/**
 * Bring the `subscribers` table up to the current schema.
 *
 * Adds the columns the newsletter needs to express more than "this
 * address exists": a status so an unsubscribe can be recorded, the
 * consent trail behind a signup, and the bookkeeping for syncing with a
 * sending platform. Also creates `subscriber_events`.
 *
 * This REBUILDS the table rather than ALTERing it. SQLite refuses
 * `ADD COLUMN ... DEFAULT (datetime('now'))` and forbids inline UNIQUE in
 * an ADD COLUMN, so an ALTER path would leave the live table permanently
 * different from one freshly created by ensureSchema(). That drift is
 * exactly what broke Putumayo signups when the `age` column was added in
 * one place and not the other. Rebuilding produces a table provably
 * identical to the shared DDL.
 *
 * Row ids are carried across explicitly: they are the payload of every
 * unsubscribe link, so they must not shift.
 *
 * Idempotent — re-running once the columns are present does nothing.
 * Dry run by default; nothing is written without --apply.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-subscribers.mjs
 *   node --env-file=.env scripts/migrate-subscribers.mjs --apply
 *   node --env-file=.env scripts/migrate-subscribers.mjs --apply \
 *     --wordpress-csv nl=/path/nl.csv en=/path/en.csv
 *
 * --wordpress-csv marks every address present in those exports as
 * source='wordpress'. Without it the origin of the historical rows is
 * inferred from their date and recorded as such in the event log, so an
 * auditor sees an inference rather than an invented fact.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import {
  SUBSCRIBERS_TABLE,
  SUBSCRIBER_EVENTS_TABLE,
  SUBSCRIBERS_INDEXES,
  CANONICAL_LOCALE_ORDER,
} from "../src/lib/subscribersSql.mjs";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env");
  process.exit(1);
}

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const db = createClient({ url, authToken });

// The live form shipped in March 2026; rows older than that can only have
// come from the WordPress export. Used only when the CSVs are not given.
const LIVE_FORM_FROM = "2026-03-09";

const EXPECTED = [
  "id",
  "email",
  "name",
  "locale",
  "status",
  "source",
  "consent_ip",
  "subscribed_at",
  "unsubscribed_at",
  "external_id",
  "synced_at",
  "created_at",
  "updated_at",
];

/** Addresses named in the WordPress exports, if any were supplied. */
function wordpressEmails() {
  const flag = argv.indexOf("--wordpress-csv");
  if (flag === -1) return null;
  const emails = new Set();
  for (const arg of argv.slice(flag + 1)) {
    if (arg.startsWith("--")) break;
    const path = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : arg;
    const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/).slice(1)) {
      const match = line.match(/[^\s;"]+@[^\s;"]+\.[^\s;"]+/);
      if (match) emails.add(match[0].toLowerCase());
    }
  }
  return emails;
}

/** SQL that rewrites a locale set into canonical order during the copy. */
function canonicalLocaleSql(column) {
  const parts = CANONICAL_LOCALE_ORDER.map(
    (l) => `(CASE WHEN ${column} LIKE '%${l}%' THEN '${l},' ELSE '' END)`,
  );
  return `rtrim(${parts.join(" || ")}, ',')`;
}

async function main() {
  const info = await db.execute(`PRAGMA table_info(subscribers)`);
  if (info.rows.length === 0) {
    console.log("No subscribers table yet — ensureSchema() will create it.");
    return;
  }

  const have = info.rows.map((r) => String(r.name));
  const missing = EXPECTED.filter((c) => !have.includes(c));
  if (missing.length === 0) {
    console.log("subscribers is already current — nothing to do.");
    return;
  }

  const { rows: countRows } = await db.execute(
    `SELECT COUNT(*) AS n FROM subscribers`,
  );
  const before = Number(countRows[0].n);

  const wordpress = wordpressEmails();
  const rule = wordpress
    ? `matched against ${wordpress.size} addresses in the WordPress exports`
    : `inferred: created_at < ${LIVE_FORM_FROM} means wordpress, later means unknown`;

  console.log(`subscribers: ${before} rows, adding ${missing.join(", ")}`);
  console.log(`source attribution: ${rule}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to rebuild the table.");
    return;
  }

  await db.execute(`ALTER TABLE subscribers RENAME TO subscribers_old`);
  await db.execute(SUBSCRIBERS_TABLE);
  await db.execute(SUBSCRIBER_EVENTS_TABLE);
  for (const sql of SUBSCRIBERS_INDEXES) await db.execute(sql);

  // created_at is the only date we hold for these people, so it becomes
  // the consent date too. Stamping "now" would destroy that evidence.
  const sourceSql = wordpress
    ? `'unknown'`
    : `CASE WHEN created_at < '${LIVE_FORM_FROM}' THEN 'wordpress' ELSE 'unknown' END`;

  await db.execute(`
    INSERT INTO subscribers
      (id, email, name, locale, status, source, consent_ip,
       subscribed_at, unsubscribed_at, created_at, updated_at)
    SELECT id,
           lower(trim(email)),
           '',
           ${canonicalLocaleSql("locale")},
           'active',
           ${sourceSql},
           '',
           created_at,
           NULL,
           created_at,
           created_at
    FROM subscribers_old
  `);

  if (wordpress) {
    // Mark the ones we can actually prove came from the export.
    const list = [...wordpress];
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200);
      await db.execute({
        sql: `UPDATE subscribers SET source = 'wordpress'
              WHERE email IN (${chunk.map(() => "?").join(",")})`,
        args: chunk,
      });
    }
  }

  const { rows: afterRows } = await db.execute(
    `SELECT COUNT(*) AS n FROM subscribers`,
  );
  const after = Number(afterRows[0].n);
  if (after !== before) {
    throw new Error(
      `row count changed during rebuild (${before} -> ${after}); subscribers_old kept`,
    );
  }

  await db.execute(`DROP TABLE subscribers_old`);

  // One event per row, recording how the source was decided, so the
  // backfill reads as a documented inference rather than a fact we made up.
  await db.execute({
    sql: `INSERT INTO subscriber_events (subscriber_id, event_type, source, payload)
          SELECT id, 'backfilled', 'migration', json_object('rule', ?, 'source', source)
          FROM subscribers`,
    args: [rule],
  });

  const { rows: check } = await db.execute(
    `SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status`,
  );
  console.log(`\nRebuilt ${after} rows.`);
  for (const r of check) console.log(`  ${r.status}: ${r.n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
