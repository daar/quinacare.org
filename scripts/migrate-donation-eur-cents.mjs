#!/usr/bin/env node
/**
 * Backfill `donations.amount_eur_cents` — the EUR-converted value of
 * each donation, used everywhere a fundraiser total is summed so a USD
 * donation isn't counted at face value as if it were EUR (issue #169).
 *
 * Going forward this column is populated automatically: EUR donations
 * get it at insert time (no conversion needed), non-EUR donations get
 * it from Mollie's own `settlementAmount` once the webhook sees the
 * payment as paid (see src/lib/donations.ts). This script only backfills
 * rows that predate that change:
 *
 *   1. Adds the column if it's missing (idempotent ALTER).
 *   2. EUR rows: amount_eur_cents = amount_cents (trivial, no API call).
 *   3. Non-EUR *paid* rows: fetches the payment from Mollie and uses its
 *      settlementAmount. Rows Mollie didn't settle itself (e.g. PayPal —
 *      see the Mollie docs on settlementAmount) are left NULL; the stats
 *      queries fall back to the raw (uncorrected) amount_cents for those,
 *      same as before this migration.
 *
 * Safe to re-run: every write is gated on amount_eur_cents IS NULL.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-donation-eur-cents.mjs
 */

import { createClient } from "@libsql/client";
import { createMollieClient } from "@mollie/api-client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env");
  process.exit(1);
}
const mollieApiKey = process.env.MOLLIE_API_KEY;
if (!mollieApiKey) {
  console.error("Missing MOLLIE_API_KEY in env");
  process.exit(1);
}

const db = createClient({ url, authToken });
const mollie = createMollieClient({ apiKey: mollieApiKey });

async function tryAlter(sql) {
  try {
    await db.execute(sql);
    console.log(`Applied: ${sql}`);
  } catch (e) {
    if (!/duplicate column|already exists/i.test(String(e?.message ?? e))) {
      throw e;
    }
  }
}

await tryAlter(`ALTER TABLE donations ADD COLUMN amount_eur_cents INTEGER`);

const eurResult = await db.execute(
  `UPDATE donations SET amount_eur_cents = amount_cents
   WHERE currency = 'EUR' AND amount_eur_cents IS NULL`,
);
console.log(
  `EUR rows backfilled (no conversion needed): ${eurResult.rowsAffected}`,
);

const pending = await db.execute(
  `SELECT id, mollie_id, amount_cents, currency FROM donations
   WHERE status = 'paid' AND currency != 'EUR' AND amount_eur_cents IS NULL
     AND mollie_id IS NOT NULL`,
);

console.log(`Non-EUR paid rows to resolve via Mollie: ${pending.rows.length}`);

let converted = 0;
let noSettlement = 0;
let failed = 0;

for (const row of pending.rows) {
  const mollieId = String(row.mollie_id);
  try {
    const payment = await mollie.payments.get(mollieId);
    const settlement = payment.settlementAmount;
    if (settlement?.currency === "EUR") {
      const eurCents = Math.round(parseFloat(settlement.value) * 100);
      await db.execute({
        sql: `UPDATE donations SET amount_eur_cents = ? WHERE id = ?`,
        args: [eurCents, row.id],
      });
      converted++;
      console.log(
        `  #${row.id} (${mollieId}): ${row.amount_cents / 100} ${row.currency} -> ${eurCents / 100} EUR`,
      );
    } else {
      noSettlement++;
      console.log(
        `  #${row.id} (${mollieId}): no EUR settlementAmount (method likely settles outside Mollie, e.g. PayPal) — left as-is`,
      );
    }
  } catch (e) {
    failed++;
    console.error(
      `  #${row.id} (${mollieId}): fetch failed — ${e?.message ?? e}`,
    );
  }
}

console.log(
  `\nDone. Converted: ${converted}, no settlement data: ${noSettlement}, failed: ${failed}`,
);
