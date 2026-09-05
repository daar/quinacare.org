// Import newsletter subscribers from exported CSVs into Turso.
//
// The lists were exported from the old WordPress site; this brings them
// into the `subscribers` table the current newsletter form writes to.
//
// The CSVs hold personal data, so they are NOT kept in this repo — pass
// their paths on the command line and keep the files outside the repo.
//
// Idempotent: `email` is UNIQUE, and inserts use ON CONFLICT DO NOTHING,
// so re-running never duplicates anyone and never overwrites the locale
// or signup date of someone who is already subscribed.
//
// Only rows whose status is "Subscribed" are imported. Anything else is
// counted and skipped — importing someone who opted out would be wrong.
//
// Usage:
//   node --env-file=.env scripts/import-subscribers.mjs nl=/path/nl.csv en=/path/en.csv
//   node --env-file=.env scripts/import-subscribers.mjs nl=/path/nl.csv --apply
//
// Without --apply nothing is written: it reports what would change.

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const inputs = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => {
    const [locale, ...rest] = a.split("=");
    const path = rest.join("=");
    if (!locale || !path) {
      console.error(`Bad argument "${a}" — expected <locale>=<path.csv>`);
      process.exit(1);
    }
    return { locale, path };
  });

if (inputs.length === 0) {
  console.error(
    "Nothing to import. Usage: node --env-file=.env scripts/import-subscribers.mjs nl=/path/nl.csv [en=/path/en.csv] [--apply]",
  );
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error(
    "Turso not configured: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (use --env-file=.env).",
  );
  process.exit(1);
}
const db = createClient({ url, authToken });

// The export is semicolon-separated with a UTF-8 BOM, and quotes fields
// that contain a separator.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) =>
      Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])),
    );
}

// "15-2-2026 15:11" -> "2026-02-15 15:11:00". Returns null when the shape
// is not what we expect, so the caller can fall back to now().
function parseDate(value) {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{2})/.exec(
    (value || "").trim(),
  );
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  const p = (n) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)} ${p(h)}:${p(mi)}:00`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Collect candidates across every file first, so a person listed in two
// lists is imported once rather than fighting over their locale.
const candidates = new Map(); // email -> { email, locale, created_at }
let totalRows = 0;
let notSubscribed = 0;
let invalid = 0;
let dupeWithinFiles = 0;
let undated = 0;

for (const { locale, path } of inputs) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  let kept = 0;
  for (const r of rows) {
    totalRows++;
    const status = r["Estado"] ?? "";
    if (status !== "Subscribed") {
      notSubscribed++;
      continue;
    }
    const email = (r["Correo electrónico"] ?? "").toLowerCase().trim();
    if (!EMAIL.test(email)) {
      invalid++;
      continue;
    }
    if (candidates.has(email)) {
      dupeWithinFiles++;
      continue;
    }
    const created = parseDate(r["Creado el"]);
    if (!created) undated++;
    candidates.set(email, { email, locale, created_at: created });
    kept++;
  }
  console.log(`  ${path}  (${locale})  ${rows.length} rows, ${kept} usable`);
}

// Which of them does the database already know?
const existing = new Set(
  (await db.execute("SELECT lower(email) AS email FROM subscribers")).rows.map(
    (r) => r.email,
  ),
);
const toInsert = [...candidates.values()].filter((c) => !existing.has(c.email));
const already = candidates.size - toInsert.length;

console.log(`
rows read              ${totalRows}
  skipped, not "Subscribed"  ${notSubscribed}
  skipped, invalid email     ${invalid}
  skipped, duplicate in file ${dupeWithinFiles}
unique subscribers     ${candidates.size}
  already in database        ${already}
  new, would be inserted     ${toInsert.length}
    of those, no usable date ${undated} (created_at falls back to now)

database has ${existing.size} subscribers before this run`);

const byLocale = {};
for (const c of toInsert) byLocale[c.locale] = (byLocale[c.locale] ?? 0) + 1;
console.log(
  "new by locale:",
  Object.entries(byLocale)
    .map(([l, n]) => `${l}=${n}`)
    .join("  ") || "none",
);

if (!APPLY) {
  console.log("\nDry run. Nothing was written. Re-run with --apply to import.");
  process.exit(0);
}

let inserted = 0;
for (const c of toInsert) {
  const res = c.created_at
    ? await db.execute({
        sql: `INSERT INTO subscribers (email, locale, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING`,
        args: [c.email, c.locale, c.created_at],
      })
    : await db.execute({
        sql: `INSERT INTO subscribers (email, locale) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`,
        args: [c.email, c.locale],
      });
  inserted += res.rowsAffected;
}

const after = await db.execute("SELECT COUNT(*) AS c FROM subscribers");
console.log(
  `\nInserted ${inserted} subscriber(s). Table now holds ${after.rows[0].c}.`,
);
