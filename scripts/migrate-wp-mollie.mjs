#!/usr/bin/env node
/**
 * One-time migration script: imports WordPress Doneren met Mollie + Paytium
 * payment data from the Excel export into Turso.
 *
 * Usage:  npm run migrate:wp
 * Prereq: backup/mollie-donations-export.xlsx must exist (run extract_mollie_data.py first)
 */

import { createClient } from "@libsql/client";
import XLSX from "xlsx";
import { resolve } from "node:path";

const EXCEL_PATH = resolve("backup/mollie-donations-export.xlsx");

// ── Turso connection ───────────────────────────────────────

function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error("Missing TURSO_DATABASE_URL. Set it in .env");
    process.exit(1);
  }
  return createClient({ url, authToken });
}

// ── Schema migration ───────────────────────────────────────

async function addColumnIfMissing(db, table, column, definition) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((r) => r.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  Added column ${table}.${column}`);
  }
}

async function ensureSchema(db) {
  console.log("Ensuring schema...");

  // Core donations table
  await db.execute(`CREATE TABLE IF NOT EXISTS donations (
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
  )`);

  // Expand donations table
  const donationCols = [
    ["donor_name", "TEXT"],
    ["donor_email", "TEXT"],
    ["donor_phone", "TEXT"],
    ["donor_company", "TEXT"],
    ["donor_message", "TEXT"],
    ["project", "TEXT"],
    ["source", "TEXT NOT NULL DEFAULT 'astro'"],
    ["wp_donation_id", "TEXT"],
    ["mollie_subscription_id", "TEXT"],
    ["settlement_currency", "TEXT"],
    ["settlement_amount_cents", "INTEGER"],
  ];
  for (const [col, def] of donationCols) {
    await addColumnIfMissing(db, "donations", col, def);
  }

  // Donors table
  await db.execute(`CREATE TABLE IF NOT EXISTS donors (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    mollie_customer_id TEXT UNIQUE,
    mode               TEXT,
    name               TEXT,
    email              TEXT,
    locale             TEXT,
    source             TEXT NOT NULL DEFAULT 'astro',
    metadata           TEXT NOT NULL DEFAULT '{}',
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Subscriptions table
  await db.execute(`CREATE TABLE IF NOT EXISTS subscriptions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    mollie_subscription_id  TEXT UNIQUE,
    mollie_customer_id      TEXT,
    mode                    TEXT,
    currency                TEXT NOT NULL DEFAULT 'EUR',
    amount_cents            INTEGER NOT NULL,
    settlement_currency     TEXT,
    settlement_amount_cents INTEGER,
    times                   INTEGER,
    interval                TEXT,
    description             TEXT,
    method                  TEXT,
    status                  TEXT NOT NULL DEFAULT 'active',
    source                  TEXT NOT NULL DEFAULT 'astro',
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Indexes
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_donations_mollie_id ON donations(mollie_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_donations_source ON donations(source)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_donors_mollie_customer_id ON donors(mollie_customer_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(mollie_customer_id)`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
  );

  console.log("Schema ready.\n");
}

// ── Helpers ────────────────────────────────────────────────

function readSheet(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    console.warn(`  Sheet "${sheetName}" not found, skipping.`);
    return [];
  }
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function toAmountCents(value) {
  if (value == null || value === "") return 0;
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(",", "."));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function sanitize(value) {
  if (value == null || value === "" || value === "NULL") return null;
  return String(value).trim();
}

function inferFrequency(subscriptionId, subscriptions) {
  if (!subscriptionId) return "one-time";
  const sub = subscriptions.get(String(subscriptionId));
  if (!sub) return "monthly"; // default for subscription payments
  const interval = sub.sub_interval || sub.interval || "";
  if (interval.includes("12") || interval.includes("year")) return "yearly";
  return "monthly";
}

// ── DMM Payments ───────────────────────────────────────────

async function migrateDmmPayments(db, rows, subMap) {
  console.log(`Importing ${rows.length} DMM payments...`);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const mollieId = sanitize(row.payment_id);
    if (!mollieId) {
      skipped++;
      continue;
    }

    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO donations
              (mollie_id, status, amount_cents, currency, frequency, payment_method,
               locale, context, mollie_customer_id, mollie_subscription_id,
               donor_name, donor_email, donor_phone, donor_company, donor_message,
               project, source, wp_donation_id, settlement_currency, settlement_amount_cents,
               created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mollieId,
          sanitize(row.dm_status) || "unknown",
          toAmountCents(row.dm_amount),
          sanitize(row.dm_currency) || "EUR",
          inferFrequency(row.subscription_id, subMap),
          sanitize(row.payment_method),
          "nl",
          "donate",
          sanitize(row.customer_id),
          sanitize(row.subscription_id),
          sanitize(row.dm_name),
          sanitize(row.dm_email),
          sanitize(row.dm_phone),
          sanitize(row.dm_company),
          sanitize(row.dm_message),
          sanitize(row.dm_project),
          "dmm",
          sanitize(row.id),
          sanitize(row.dm_settlement_currency),
          toAmountCents(row.dm_settlement_amount),
          sanitize(row.time) || new Date().toISOString(),
          sanitize(row.time) || new Date().toISOString(),
        ],
      });
      imported++;
    } catch (err) {
      console.error(`  Error importing DMM payment ${mollieId}:`, err.message);
      skipped++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}`);
}

// ── Paytium Payments ───────────────────────────────────────

async function migratePaytiumPayments(db, rows) {
  console.log(`Importing ${rows.length} Paytium payments...`);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const mollieId = sanitize(row._payment_id);
    if (!mollieId) {
      skipped++;
      continue;
    }

    // Extract donor name/email from varying Paytium field naming
    const donorName =
      sanitize(row["_pt-customer-name"]) ||
      sanitize(row["_pt-field-name-1"]) ||
      sanitize(row["_pt-field-name-3"]) ||
      sanitize(row["_pt-field-name-7"]) ||
      sanitize(row["_pt-field-name-8"]) ||
      sanitize(row["_pt-field-name-9"]);

    const donorEmail =
      sanitize(row["_pt-customer-email"]) ||
      sanitize(row["_pt-field-email-2"]) ||
      sanitize(row["_pt-field-email-4"]) ||
      sanitize(row["_pt-field-email-8"]) ||
      sanitize(row["_pt-field-email-9"]) ||
      sanitize(row["_pt-field-email-10"]);

    const subId = sanitize(row._mollie_subscription_id);
    const frequency = subId ? "monthly" : "one-time";

    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO donations
              (mollie_id, status, amount_cents, currency, frequency, payment_method,
               locale, context, mollie_customer_id, mollie_subscription_id,
               donor_name, donor_email, source, wp_donation_id,
               created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mollieId,
          sanitize(row._status) || sanitize(row.post_status) || "unknown",
          toAmountCents(row._amount),
          sanitize(row._currency) || "EUR",
          frequency,
          sanitize(row._method),
          "nl",
          "donate",
          sanitize(row["_pt-customer-id"]),
          subId,
          donorName,
          donorEmail,
          "paytium",
          sanitize(row.post_id),
          sanitize(row.post_date) || new Date().toISOString(),
          sanitize(row.post_date) || new Date().toISOString(),
        ],
      });
      imported++;
    } catch (err) {
      console.error(
        `  Error importing Paytium payment ${mollieId}:`,
        err.message,
      );
      skipped++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}`);
}

// ── DMM Donors ─────────────────────────────────────────────

async function migrateDmmDonors(db, rows) {
  console.log(`Importing ${rows.length} DMM donors...`);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const customerId = sanitize(row.customer_id);
    if (!customerId) {
      skipped++;
      continue;
    }

    const metadata = JSON.stringify({
      sub_interval: sanitize(row.sub_interval),
      sub_currency: sanitize(row.sub_currency),
      sub_amount: row.sub_amount,
      sub_description: sanitize(row.sub_description),
    });

    try {
      await db.execute({
        sql: `INSERT INTO donors (mollie_customer_id, mode, name, email, locale, source, metadata, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(mollie_customer_id)
              DO UPDATE SET name = COALESCE(excluded.name, name),
                            email = COALESCE(excluded.email, email),
                            updated_at = datetime('now')`,
        args: [
          customerId,
          sanitize(row.customer_mode),
          sanitize(row.customer_name),
          sanitize(row.customer_email),
          sanitize(row.customer_locale),
          "dmm",
          metadata,
        ],
      });
      imported++;
    } catch (err) {
      console.error(`  Error importing donor ${customerId}:`, err.message);
      skipped++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}`);
}

// ── DMM Subscriptions ──────────────────────────────────────

async function migrateDmmSubscriptions(db, rows) {
  console.log(`Importing ${rows.length} DMM subscriptions...`);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const subId = sanitize(row.subscription_id);
    if (!subId) {
      skipped++;
      continue;
    }

    try {
      await db.execute({
        sql: `INSERT INTO subscriptions
              (mollie_subscription_id, mollie_customer_id, mode, currency, amount_cents,
               settlement_currency, settlement_amount_cents, times, interval,
               description, method, status, source, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(mollie_subscription_id)
              DO UPDATE SET status = COALESCE(excluded.status, status),
                            updated_at = datetime('now')`,
        args: [
          subId,
          sanitize(row.customer_id),
          sanitize(row.sub_mode),
          sanitize(row.sub_currency) || "EUR",
          toAmountCents(row.sub_amount),
          sanitize(row.sub_settlement_currency),
          toAmountCents(row.sub_settlement_amount),
          row.sub_times ? parseInt(String(row.sub_times), 10) : null,
          sanitize(row.sub_interval),
          sanitize(row.sub_description),
          sanitize(row.sub_method),
          sanitize(row.sub_status) || "unknown",
          "dmm",
          sanitize(row.created_at) || new Date().toISOString(),
        ],
      });
      imported++;
    } catch (err) {
      console.error(`  Error importing subscription ${subId}:`, err.message);
      skipped++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}`);
}

// ── Paytium Subscriptions ──────────────────────────────────

async function migratePaytiumSubscriptions(db, rows) {
  console.log(`Importing ${rows.length} Paytium subscriptions...`);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const subId = sanitize(row._mollie_subscription_id);
    if (!subId) {
      skipped++;
      continue;
    }

    const amount = sanitize(row._subscription_recurring_payment);
    const interval = sanitize(row._subscription_interval);

    try {
      await db.execute({
        sql: `INSERT INTO subscriptions
              (mollie_subscription_id, mollie_customer_id, currency, amount_cents,
               interval, status, source, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(mollie_subscription_id)
              DO UPDATE SET status = COALESCE(excluded.status, status),
                            updated_at = datetime('now')`,
        args: [
          subId,
          sanitize(row["_pt-customer-id"]),
          "EUR",
          toAmountCents(amount),
          interval,
          sanitize(row._subscription_status) || "unknown",
          "paytium",
          sanitize(row.post_date) || new Date().toISOString(),
        ],
      });
      imported++;
    } catch (err) {
      console.error(`  Error importing Paytium sub ${subId}:`, err.message);
      skipped++;
    }
  }

  console.log(`  Imported: ${imported}, Skipped: ${skipped}`);
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  console.log("WordPress → Turso migration\n");
  console.log(`Reading ${EXCEL_PATH}...`);

  const workbook = XLSX.readFile(EXCEL_PATH);
  console.log(`Sheets found: ${workbook.SheetNames.join(", ")}\n`);

  const dmmPayments = readSheet(workbook, "DMM Payments");
  const dmmDonors = readSheet(workbook, "DMM Donors");
  const dmmSubs = readSheet(workbook, "DMM Subscriptions");
  const ptPayments = readSheet(workbook, "Paytium Payments");
  const ptSubs = readSheet(workbook, "Paytium Subscriptions");

  console.log(`DMM Payments:          ${dmmPayments.length}`);
  console.log(`DMM Donors:            ${dmmDonors.length}`);
  console.log(`DMM Subscriptions:     ${dmmSubs.length}`);
  console.log(`Paytium Payments:      ${ptPayments.length}`);
  console.log(`Paytium Subscriptions: ${ptSubs.length}`);
  console.log();

  // Build subscription lookup for frequency inference
  const subMap = new Map();
  for (const row of dmmSubs) {
    const subId = sanitize(row.subscription_id);
    if (subId) subMap.set(subId, row);
  }

  const db = getDb();
  await ensureSchema(db);

  await migrateDmmDonors(db, dmmDonors);
  await migrateDmmSubscriptions(db, dmmSubs);
  await migratePaytiumSubscriptions(db, ptSubs);
  await migrateDmmPayments(db, dmmPayments, subMap);
  await migratePaytiumPayments(db, ptPayments);

  // Final counts
  const countDonations = await db.execute(
    "SELECT COUNT(*) as cnt FROM donations",
  );
  const countDonors = await db.execute("SELECT COUNT(*) as cnt FROM donors");
  const countSubs = await db.execute(
    "SELECT COUNT(*) as cnt FROM subscriptions",
  );

  console.log("\n── Final Turso row counts ──");
  console.log(`donations:     ${countDonations.rows[0].cnt}`);
  console.log(`donors:        ${countDonors.rows[0].cnt}`);
  console.log(`subscriptions: ${countSubs.rows[0].cnt}`);

  // Source breakdown
  const bySource = await db.execute(
    "SELECT source, COUNT(*) as cnt FROM donations GROUP BY source ORDER BY source",
  );
  console.log("\nDonations by source:");
  for (const row of bySource.rows) {
    console.log(`  ${row.source}: ${row.cnt}`);
  }

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
