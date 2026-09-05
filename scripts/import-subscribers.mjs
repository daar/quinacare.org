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
// The exports also contain hand-added rows with every field but the name
// and address left blank; those need --include-blank-status, so importing
// an address with no recorded consent is always a deliberate act.
//
// Someone on both language lists becomes ONE subscriber whose locale is
// the set of their lists ("nl,en"), matching the newsletter form.
//
// Usage:
//   node --env-file=.env scripts/import-subscribers.mjs nl=/path/nl.csv en=/path/en.csv
//   node --env-file=.env scripts/import-subscribers.mjs nl=/path/nl.csv --apply
//
// Without --apply nothing is written: it reports what would change.

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const INCLUDE_BLANK = process.argv.includes("--include-blank-status");
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

// Collect candidates across every file first, so someone listed twice
// becomes one subscriber carrying both languages.
const candidates = new Map(); // email -> { email, locales:Set, created_at }
let totalRows = 0;
let notSubscribed = 0;
let blankStatus = 0;
let invalid = 0;
let alsoOnOtherList = 0;
let dupeWithinFiles = 0;
let undated = 0;

for (const { locale, path } of inputs) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  let kept = 0;
  for (const r of rows) {
    totalRows++;
    const status = r["Estado"] ?? "";
    if (status === "" && INCLUDE_BLANK) {
      blankStatus++;
    } else if (status !== "Subscribed") {
      notSubscribed++;
      continue;
    }
    const email = (r["Correo electrónico"] ?? "").toLowerCase().trim();
    if (!EMAIL.test(email)) {
      invalid++;
      continue;
    }
    const existingCandidate = candidates.get(email);
    if (existingCandidate) {
      if (existingCandidate.locales.has(locale)) dupeWithinFiles++;
      else {
        existingCandidate.locales.add(locale);
        alsoOnOtherList++;
      }
      continue;
    }
    const created = parseDate(r["Creado el"]);
    if (!created) undated++;
    candidates.set(email, {
      email,
      locales: new Set([locale]),
      created_at: created,
    });
    kept++;
  }
  console.log(`  ${path}  (${locale})  ${rows.length} rows, ${kept} usable`);
}

// Which of them does the database already know, and on which lists?
const existing = new Map(
  (
    await db.execute("SELECT lower(email) AS email, locale FROM subscribers")
  ).rows.map((r) => [r.email, new Set(String(r.locale).split(","))]),
);
// New people, and people already here who are missing a language.
const toInsert = [...candidates.values()].filter((c) => !existing.has(c.email));
const toExtend = [...candidates.values()].filter((c) => {
  const have = existing.get(c.email);
  return have && [...c.locales].some((l) => !have.has(l));
});
const already = candidates.size - toInsert.length;

console.log(`
rows read              ${totalRows}
  skipped, not "Subscribed"  ${notSubscribed}
  skipped, invalid email     ${invalid}
  skipped, duplicate in file ${dupeWithinFiles}
unique subscribers     ${candidates.size}
  on more than one list      ${alsoOnOtherList}
  already in database        ${already}
  new, would be inserted     ${toInsert.length}
    of those, no usable date ${undated} (created_at falls back to now)
  existing, would gain a list ${toExtend.length}
${INCLUDE_BLANK ? `  imported with blank status ${blankStatus} (--include-blank-status)` : ""}
database has ${existing.size} subscribers before this run`);

const byLocale = {};
for (const c of toInsert) {
  const key = [...c.locales].join(",");
  byLocale[key] = (byLocale[key] ?? 0) + 1;
}
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

// One statement per language per person: it inserts the person if they
// are new, and otherwise adds the language to the set they already have.
// Re-running changes nothing, which is what makes this safe to repeat.
const MERGE = `
  INSERT INTO subscribers (email, locale, created_at) VALUES (?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET locale =
    CASE
      WHEN ',' || locale || ',' LIKE '%,' || excluded.locale || ',%'
        THEN locale
      ELSE locale || ',' || excluded.locale
    END`;

let written = 0;
for (const c of [...toInsert, ...toExtend]) {
  for (const locale of c.locales) {
    const res = await db.execute({
      sql: MERGE,
      args: [
        c.email,
        locale,
        c.created_at ?? new Date().toISOString().slice(0, 19).replace("T", " "),
      ],
    });
    written += res.rowsAffected;
  }
}

const after = await db.execute("SELECT COUNT(*) AS c FROM subscribers");
const multi = await db.execute(
  "SELECT COUNT(*) AS c FROM subscribers WHERE locale LIKE '%,%'",
);
console.log(
  `\nWrote ${written} row change(s). Table now holds ${after.rows[0].c} subscribers, ${multi.rows[0].c} of them on more than one list.`,
);
