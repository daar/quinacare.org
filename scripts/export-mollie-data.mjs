#!/usr/bin/env node
/**
 * Export all Mollie customers and payments to CSV files.
 *
 * Usage:
 *   MOLLIE_API_KEY=live_xxx node scripts/export-mollie-data.mjs
 *
 * Or set MOLLIE_API_KEY in .env and run:
 *   node --env-file=.env scripts/export-mollie-data.mjs
 *
 * Output:
 *   backup/mollie-customers.csv
 *   backup/mollie-payments.csv
 *   backup/mollie-subscriptions.csv
 */

import { createMollieClient } from "@mollie/api-client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const API_KEY = process.env.MOLLIE_API_KEY;
if (!API_KEY) {
  console.error("Missing MOLLIE_API_KEY. Pass it as env var or set in .env");
  process.exit(1);
}

console.log(`Using API key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
console.log(`Mode: ${API_KEY.startsWith("live_") ? "LIVE" : "TEST"}\n`);

const mollieClient = createMollieClient({ apiKey: API_KEY });
const BACKUP_DIR = resolve("backup");
mkdirSync(BACKUP_DIR, { recursive: true });

// ── CSV helpers ────────────────────────────────────────────

function escapeCsv(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filepath, headers, rows) {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  }
  writeFileSync(filepath, lines.join("\n") + "\n", "utf-8");
  console.log(`Wrote ${rows.length} rows to ${filepath}`);
}

// ── Paginate all results ───────────────────────────────────

async function fetchAll(pageFn, label) {
  const results = [];
  let page = await pageFn();
  let pageNum = 1;

  while (true) {
    const items = [...page];
    results.push(...items);
    process.stdout.write(
      `\r  Fetching ${label}... page ${pageNum} (${results.length} total)`,
    );

    if (!page.nextPageCursor) break;
    page = await page.nextPage();
    pageNum++;
  }

  console.log(`\r  Fetched ${results.length} ${label}${" ".repeat(20)}`);
  return results;
}

// ── Export customers ───────────────────────────────────────

async function exportCustomers() {
  console.log("Exporting customers...");
  const customers = await fetchAll(
    () => mollieClient.customers.page({ limit: 250 }),
    "customers",
  );

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    locale: c.locale,
    createdAt: c.createdAt,
    metadata: c.metadata ? JSON.stringify(c.metadata) : "",
  }));

  const headers = ["id", "name", "email", "locale", "createdAt", "metadata"];
  writeCsv(resolve(BACKUP_DIR, "mollie-customers.csv"), headers, rows);
}

// ── Export payments ────────────────────────────────────────

async function exportPayments() {
  console.log("Exporting payments...");
  const payments = await fetchAll(
    () => mollieClient.payments.page({ limit: 250 }),
    "payments",
  );

  const rows = payments.map((p) => ({
    id: p.id,
    status: p.status,
    effectiveStatus: effectiveStatus(p),
    amount_currency: p.amount?.currency,
    amount_value: p.amount?.value,
    amountRefunded_value: p.amountRefunded?.value || "",
    amountRemaining_value: p.amountRemaining?.value || "",
    amountChargedBack_value: p.amountChargedBack?.value || "",
    description: p.description,
    method: p.method,
    mode: p.mode,
    createdAt: p.createdAt,
    paidAt: p.paidAt,
    canceledAt: p.canceledAt,
    expiredAt: p.expiredAt,
    failedAt: p.failedAt,
    customerId: p.customerId,
    subscriptionId: p.subscriptionId,
    settlementAmount_currency: p.settlementAmount?.currency,
    settlementAmount_value: p.settlementAmount?.value,
    metadata: p.metadata ? JSON.stringify(p.metadata) : "",
  }));

  const headers = [
    "id",
    "status",
    "effectiveStatus",
    "amount_currency",
    "amount_value",
    "amountRefunded_value",
    "amountRemaining_value",
    "amountChargedBack_value",
    "description",
    "method",
    "mode",
    "createdAt",
    "paidAt",
    "canceledAt",
    "expiredAt",
    "failedAt",
    "customerId",
    "subscriptionId",
    "settlementAmount_currency",
    "settlementAmount_value",
    "metadata",
  ];
  writeCsv(resolve(BACKUP_DIR, "mollie-payments.csv"), headers, rows);
}

// ── Export subscriptions ───────────────────────────────────

async function fetchAllSubscriptionsRaw() {
  const results = [];
  let url = "https://api.mollie.com/v2/subscriptions?limit=250";
  let pageNum = 1;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.title || "Mollie error");
    const items = data._embedded?.subscriptions || [];
    results.push(...items);
    process.stdout.write(
      `\r  Fetching subscriptions... page ${pageNum} (${results.length} total)`,
    );
    url = data._links?.next?.href || null;
    pageNum++;
  }
  console.log(`\r  Fetched ${results.length} subscriptions${" ".repeat(20)}`);
  return results;
}

async function exportSubscriptions() {
  console.log("Exporting subscriptions...");
  const subs = await fetchAllSubscriptionsRaw();

  const rows = subs.map((s) => ({
    id: s.id,
    customerId: s.customerId,
    status: s.status,
    amount_currency: s.amount?.currency,
    amount_value: s.amount?.value,
    times: s.times,
    timesRemaining: s.timesRemaining,
    interval: s.interval,
    startDate: s.startDate,
    nextPaymentDate: s.nextPaymentDate,
    description: s.description,
    method: s.method,
    mandateId: s.mandateId,
    createdAt: s.createdAt,
    canceledAt: s.canceledAt,
    metadata: s.metadata ? JSON.stringify(s.metadata) : "",
  }));

  const headers = [
    "id",
    "customerId",
    "status",
    "amount_currency",
    "amount_value",
    "times",
    "timesRemaining",
    "interval",
    "startDate",
    "nextPaymentDate",
    "description",
    "method",
    "mandateId",
    "createdAt",
    "canceledAt",
    "metadata",
  ];
  writeCsv(resolve(BACKUP_DIR, "mollie-subscriptions.csv"), headers, rows);
}

// ── Helpers ────────────────────────────────────────────────

/** Chargeback-aware status so CSV reflects true state, not Mollie's raw field. */
function effectiveStatus(p) {
  if (p.amountChargedBack && parseFloat(p.amountChargedBack.value) > 0)
    return "charged_back";
  if (p.amountRefunded && parseFloat(p.amountRefunded.value) > 0) {
    if (!p.amountRemaining || parseFloat(p.amountRemaining.value) === 0)
      return "refunded";
    return "partially_refunded";
  }
  return p.status;
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  await exportCustomers();
  console.log();
  await exportPayments();
  console.log();
  await exportSubscriptions();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nExport failed:", err.message);
  process.exit(1);
});
