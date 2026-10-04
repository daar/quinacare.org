#!/usr/bin/env node
/**
 * One-time backfill for issue #170: 10 real Mollie donations from
 * Feb-Mar 2026 (pre-dating the current webhook-based donation tracking,
 * hence never recorded in Turso) are inserted as proper `donations`
 * rows tagged to the putumayo-loop-2026 fundraiser, so they count
 * toward the live "raised" total and donor count instead of being
 * invisible. Found by diffing a Mollie export against Turso — see the
 * issue for the full reconciliation.
 *
 * This is a known, fixed, one-off dataset — not a generalized migration
 * — so the 10 rows are hardcoded below rather than parsed from a file.
 *
 * Idempotent: each insert is gated on the mollie_id not already
 * existing, so re-running is safe.
 *
 * Dry-run by default; pass --apply to actually write.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-putumayo-legacy-donations.mjs [--apply]
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const db = createClient({ url, authToken });

// Timestamps below are the export's local Amsterdam time (+01:00 — all
// 10 fall before the 2026-03-29 DST switch), converted to UTC here via
// the explicit offset rather than by hand, to avoid an arithmetic slip.
const LEGACY_DONATIONS = [
  {
    mollieId: "tr_MbvuHxWKYkHHvaUrQh4MJ",
    localIso: "2026-02-12T13:58:47+01:00",
    amountCents: 10000,
    method: "ideal",
  },
  {
    mollieId: "tr_wFLGxYcaxYGJLhD7j85MJ",
    localIso: "2026-02-12T17:56:09+01:00",
    amountCents: 2500,
    method: "ideal",
  },
  {
    mollieId: "tr_49LQrVLD73CVGRwiSA7MJ",
    localIso: "2026-02-13T12:45:10+01:00",
    amountCents: 2500,
    method: "ideal",
  },
  {
    mollieId: "tr_rbZbXkPdFTRtqMXXAJ7MJ",
    localIso: "2026-02-13T14:00:27+01:00",
    amountCents: 2500,
    method: "ideal",
  },
  {
    // Named "Demi Zijlstra" in the export — almost certainly a Demi &
    // Thomas donation, which is part of why issue #170 asked to drop
    // the old manual Demi & Thomas raisedOffset/donorsOffset once this
    // backfill lands: that money is now a real row instead of a guess.
    mollieId: "tr_xF8zcT9J6BqPv5HgW48MJ",
    localIso: "2026-02-13T21:03:22+01:00",
    amountCents: 5000,
    method: "ideal",
  },
  {
    mollieId: "tr_NVLqqUmwS6jhdXsSCAHMJ",
    localIso: "2026-02-17T09:24:16+01:00",
    amountCents: 2000,
    method: "ideal",
  },
  {
    mollieId: "tr_Wj9MwJahsbHMynYoZMLMJ",
    localIso: "2026-02-18T15:04:25+01:00",
    amountCents: 5000,
    method: "creditcard",
  },
  {
    mollieId: "tr_yu4uc4QZuanZXXCjoJNMJ",
    localIso: "2026-02-19T09:09:11+01:00",
    amountCents: 2500,
    method: "ideal",
  },
  {
    mollieId: "tr_bXv3UnfE6djWuiAqophMJ",
    localIso: "2026-02-26T22:08:58+01:00",
    amountCents: 2000,
    method: "ideal",
  },
  {
    mollieId: "tr_tXfYfvsshqQVxi4eQqBNJ",
    localIso: "2026-03-09T08:31:04+01:00",
    amountCents: 2000,
    method: "ideal",
  },
];

function toSqliteUtc(localIso) {
  // "YYYY-MM-DD HH:MM:SS", matching the format every other row in the
  // table already uses (SQLite's own datetime('now') default).
  return new Date(localIso).toISOString().slice(0, 19).replace("T", " ");
}

console.log(
  `${APPLY ? "Applying" : "Dry run"}: ${LEGACY_DONATIONS.length} legacy donations\n`,
);

let inserted = 0;
let skipped = 0;

for (const d of LEGACY_DONATIONS) {
  const existing = await db.execute({
    sql: `SELECT id FROM donations WHERE mollie_id = ?`,
    args: [d.mollieId],
  });
  if (existing.rows.length > 0) {
    console.log(
      `  SKIP  ${d.mollieId} — already in donations (#${existing.rows[0].id})`,
    );
    skipped++;
    continue;
  }

  const createdAt = toSqliteUtc(d.localIso);
  const metadata = JSON.stringify({
    fundraiser_slug: "putumayo-loop-2026",
    fundraiser_title: "Putumayo Loop 2026",
    backfilled: true,
    backfill_reason:
      "Pre-dates webhook-based tracking; found by reconciling a Mollie export against Turso — see issue #170",
  });

  console.log(
    `  ${APPLY ? "INSERT" : "would INSERT"}  ${d.mollieId}  ${createdAt}  €${(d.amountCents / 100).toFixed(2)}  ${d.method}`,
  );

  if (APPLY) {
    const result = await db.execute({
      sql: `INSERT INTO donations
              (mollie_id, status, amount_cents, amount_eur_cents, currency, frequency,
               payment_method, locale, context, metadata, created_at, updated_at)
            VALUES (?, 'paid', ?, ?, 'EUR', 'one-time', ?, 'nl', 'fundraiser', ?, ?, ?)`,
      args: [
        d.mollieId,
        d.amountCents,
        d.amountCents, // EUR, so amount_eur_cents == amount_cents (no conversion needed)
        d.method,
        metadata,
        createdAt,
        createdAt,
      ],
    });
    await db.execute({
      sql: `INSERT INTO donation_events
              (donation_id, event_type, source, mollie_status, payload, created_at)
            VALUES (?, 'reconciliation', 'cron', 'paid', ?, ?)`,
      args: [
        Number(result.lastInsertRowid),
        JSON.stringify({
          reason: "backfill",
          issue: 170,
          mollieId: d.mollieId,
        }),
        createdAt,
      ],
    });
  }
  inserted++;
}

console.log(
  `\n${APPLY ? "Done" : "Would insert"}: ${inserted} row(s), skipped (already present): ${skipped}`,
);
if (!APPLY) {
  console.log("Dry run — pass --apply to write.");
}
