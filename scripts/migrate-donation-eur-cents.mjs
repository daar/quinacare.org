#!/usr/bin/env node
/**
 * Backfill `donations.amount_eur_cents` — the EUR-converted value of
 * each donation, used everywhere a fundraiser total is summed so a USD
 * donation isn't counted at face value as if it were EUR (issue #169).
 *
 * Going forward this column is populated automatically by the webhook
 * (see src/lib/donations.ts), in the same three tiers this script
 * applies here:
 *
 *   1. EUR rows: amount_eur_cents = amount_cents (trivial, no API call,
 *      no conversion needed).
 *   2. Non-EUR *paid* rows: fetches the payment from Mollie and uses its
 *      settlementAmount — the exact amount Mollie actually settled,
 *      not an estimate.
 *   3. Non-EUR paid rows Mollie didn't settle itself (PayPal is the one
 *      in use here — it settles directly with its own conversion, so
 *      settlementAmount is never present): estimated from the live
 *      EUR->USD rate — the most recently observed real rate from
 *      another donation's own tier-2 conversion — falling back to a
 *      fixed constant only if no such donation exists yet.
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

// Mirrors getCurrentEurToUsdRate() in src/lib/donations.ts — kept as a
// literal duplicate here since this standalone script can't import a
// .ts module. Update both together if the logic changes.
const FALLBACK_EUR_TO_USD_RATE = 1.17;

async function getCurrentEurToUsdRate() {
  const result = await db.execute(
    `SELECT amount_cents * 1.0 / amount_eur_cents AS rate
     FROM donations
     WHERE currency = 'USD' AND amount_eur_cents IS NOT NULL AND amount_eur_cents > 0
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  const rate = result.rows[0]?.rate;
  return typeof rate === "number" && rate > 0 ? rate : FALLBACK_EUR_TO_USD_RATE;
}

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

let settled = 0;
const needsRateEstimate = [];
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
      settled++;
      console.log(
        `  #${row.id} (${mollieId}): ${row.amount_cents / 100} ${row.currency} -> ${eurCents / 100} EUR (tier 2: Mollie settlementAmount)`,
      );
    } else {
      // Tier 3 candidate — Mollie doesn't settle this method itself
      // (e.g. PayPal). Resolved below, after every tier-2 conversion in
      // this batch has been written, so the live rate reflects the most
      // up-to-date real data available.
      needsRateEstimate.push(row);
    }
  } catch (e) {
    failed++;
    console.error(
      `  #${row.id} (${mollieId}): fetch failed — ${e?.message ?? e}`,
    );
  }
}

let estimated = 0;
if (needsRateEstimate.length > 0) {
  const rate = await getCurrentEurToUsdRate();
  console.log(
    `\nTier 3: estimating ${needsRateEstimate.length} row(s) with no Mollie settlementAmount using rate ${rate} (USD per EUR)`,
  );
  for (const row of needsRateEstimate) {
    const eurCents = Math.round(row.amount_cents / rate);
    await db.execute({
      sql: `UPDATE donations SET amount_eur_cents = ? WHERE id = ?`,
      args: [eurCents, row.id],
    });
    estimated++;
    console.log(
      `  #${row.id} (${row.mollie_id}): ${row.amount_cents / 100} ${row.currency} -> ${eurCents / 100} EUR (tier 3: live-rate estimate)`,
    );
  }
}

console.log(
  `\nDone. Settled via Mollie: ${settled}, estimated via live rate: ${estimated}, failed to fetch: ${failed}`,
);
