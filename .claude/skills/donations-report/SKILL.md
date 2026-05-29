---
name: donations-report
description: Generate a comprehensive Quina Care donations funnel report from the Turso production database. Use whenever the user asks to "analyse donations", "show donations report", "donation status", "where are donors dropping off", "abandonment report", or invokes /donations-report. Supports an optional time window like "last 7 days" or "since 2026-05-01".
---

# Quina Care donations funnel report

Pulls every donation and its donation_events audit trail from the Turso production database, classifies each payment's funnel state and fault path, and prints a readable report.

The script is `scripts/donations-report.py` — pure stdlib Python 3, no `pip install` needed.

## When to invoke

Trigger on any of:

- `/donations-report` (optionally with a window arg like `last 7 days`, `since 2026-05-01`, `between 2026-05-01 and 2026-05-20`)
- "show me the donations report", "analyse donations", "donation status", "donations funnel", "where are donors dropping off", "abandonment report", "payment stats".

## Steps

### 1. Resolve credentials

Look for `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in this order:

1. Process env (`$env:TURSO_DATABASE_URL`).
2. `.claude/skills/donations-report/.env` (one `KEY=VALUE` per line; lines starting with `#` are comments).
3. Ask the user with AskUserQuestion. Offer to save them to `.claude/skills/donations-report/.env` so the next run is hands-off.

**Never print the auth token** back to the user. It's gitignored under `.claude/` but treat it like a secret in conversation.

### 2. Resolve the time window

If the user gave a window, translate to UTC dates and pass as `--since` / `--until`. Today's date is in the system reminder — use it for relative windows.

Examples:

- "last 7 days" → `--since 2026-05-22` (today minus 7 days)
- "since May 1" → `--since 2026-05-01`
- "between May 1 and May 20" → `--since 2026-05-01 --until 2026-05-20`
- (no window) → run without flags = full history

### 3. Run the script

PowerShell (the user's default shell):

```powershell
$env:TURSO_DATABASE_URL = "<url from step 1>"
$env:TURSO_AUTH_TOKEN = "<token from step 1>"
python scripts\donations-report.py [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

If `python` is not on PATH, try `py -3` or the portable Node-style fallback (the repo has used `C:\test\node-v22.22.3-win-x64\node-v22.22.3-win-x64\` for Node — there is no equivalent for Python; if Python is genuinely missing, tell the user to install it from python.org or use `winget install python`).

### 4. Present the report

1. Paste the full script output verbatim in a fenced code block.
2. Below it, add **2–4 sentences of synthesis** pulling out the most striking findings — top fault path, lowest-converting payment method, anything new since the last run if the user mentioned a prior report, etc. Match the analytical depth of the existing donation analyses in this codebase.

### Optional flags the user might ask for

- `--format json` — raw JSON suitable for further programmatic analysis.
- `--verbose` — appends the full per-donation event timeline at the bottom of the text report (useful when debugging a specific row).

## Notes

- `TURSO_DATABASE_URL` accepts either `libsql://…` or `https://…` form; the script converts as needed.
- The script is idempotent and read-only — no UPDATEs, no INSERTs. Safe to run as often as the user wants.
- Output for a few hundred donations is well under 50 KB; comfortable to paste in full.
