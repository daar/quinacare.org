---
name: donations-report
description: Generate a Quina Care donations funnel + KPI dashboard from the Turso production database. By default it writes a self-contained HTML dashboard (inline SVG charts — payment methods, success vs failure, geography/currency, gift size & frequency, daily trend) into reports/donations/. Use whenever the user asks to "analyse donations", "show donations report", "donation status", "donation KPIs", "where are donors dropping off", "abandonment report", or invokes /donations-report. Supports an optional time window like "last 7 days" or "since 2026-05-01".
---

# Quina Care donations report + KPI dashboard

Pulls every donation and its `donation_events` audit trail from the Turso production database, classifies each payment's funnel state and fault path, and renders it.

The script is `scripts/donations-report.py` — pure stdlib Python 3, no `pip install` needed.

**Default output is an HTML dashboard** written to `reports/donations/` (gitignored). It's self-contained (inline SVG charts, no external assets/JS — works offline and prints cleanly to PDF) and covers: KPI strip (totals, conversion, raised per currency, avg/median gift), success-vs-failure, payment-method conversion, geography & currency, gift-size histogram, frequency, daily trend, and fault paths. `--format text` still gives the console funnel report; `--format json` the raw data.

## When to invoke

Trigger on any of:

- `/donations-report` (optionally with a window arg like `last 7 days`, `since 2026-05-01`, `between 2026-05-01 and 2026-05-20`)
- "show me the donations report", "donation KPIs / dashboard", "analyse donations", "donation status", "donations funnel", "where are donors dropping off", "abandonment report", "payment stats".

## Steps

### 1. Resolve credentials

Look for `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in this order:

1. Process env.
2. The repo-root `.env` (this repo keeps the Turso creds there; load with `set -a; . ./.env; set +a`).
3. `.claude/skills/donations-report/.env` (one `KEY=VALUE` per line).
4. Ask the user with AskUserQuestion; offer to save them so the next run is hands-off.

**Never print the auth token** back to the user — treat it as a secret in conversation.

### 2. Resolve the time window

If the user gave a window, translate to UTC dates and pass as `--since` / `--until`. Today's date is in the system reminder — use it for relative windows.

- "last 14 days" → `--since <today−14>`
- "since May 1" → `--since 2026-05-01`
- "between May 1 and May 20" → `--since 2026-05-01 --until 2026-05-20`
- (no window) → full history

### 3. Run the script (bash)

```bash
set -a; . ./.env; set +a          # load Turso creds from repo-root .env
python3 scripts/donations-report.py [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

This writes `reports/donations/donations-<timestamp>.html` and prints the path. If `python3` is missing, tell the user to install it (`python.org` / `apt install python3`).

### 4. Render a PDF (optional) + present

The HTML prints to PDF cleanly. If a headless browser is available, render one next to the HTML:

```bash
HTML=$(ls -t reports/donations/*.html | head -1)
google-chrome --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="${HTML%.html}.pdf" "file://$HTML"
```

(try `chromium` / `chromium-browser` if `google-chrome` is absent; otherwise tell the user to open the HTML and "Save as PDF").

Then:

1. **Send the generated file(s) to the user** with SendUserFile (the HTML, and the PDF if rendered) — the dashboard *is* the deliverable.
2. Add **2–4 sentences of synthesis** of the most striking findings (top fault path, lowest-converting method, currency/geo split, trend spikes). For a quick in-chat funnel table, also run `--format text` and paste that. Match the analytical depth of the existing donation analyses in this codebase.

### Flags

- `--format html|text|json` — default `html`. `text` = console funnel report; `json` = raw data.
- `--out-dir DIR` — change the output folder (default `reports/donations/`).
- `--out FILE` — write to an explicit path.
- `--stdout` — stream html/json to stdout instead of writing a file.
- `--verbose` — append per-donation event timelines (text format only).

## Notes

- `TURSO_DATABASE_URL` accepts either `libsql://…` or `https://…`; the script converts as needed.
- Read-only and idempotent — no UPDATEs/INSERTs. Safe to run as often as wanted.
- `reports/` is gitignored — generated dashboards are artifacts, not committed.
- The HTML has **no external dependencies** (inline `<style>` + inline SVG), so it's CSP-safe, works offline, and renders identically when printed to PDF.
- "Demographics" available from the data = **locale/geography** (nl→Netherlands·EUR, en→USA·USD, es→Ecuador·USD), **frequency**, and **gift size** — there is no personal demographic data (age/gender/name) in the donations table.
