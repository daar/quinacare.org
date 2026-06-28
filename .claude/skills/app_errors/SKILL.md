---
name: app_errors
description: Review the Turso app_errors log (production error capture from src/lib/errors.ts), group recurring failures, action the real ones, then clear ONLY the app_errors table. Use whenever the user asks to "review app errors", "check the error log", "triage production errors", "what's failing in prod", "clear the app_errors table", or invokes /app_errors. Reads/clears the app_errors table on the live Turso DB via scripts/review-app-errors.mjs.
---

# Review and triage the Turso app_errors log

`app_errors` is written by `src/lib/errors.ts` (`reportError`/`logError`) — it is the only window into production failures, since console output is invisible on Netlify. The client also beacons `window.onerror` / `unhandledrejection` into it. This skill reads the table, groups recurring errors, **actions the real ones** (fix a bug, or filter known noise at the source), then empties the table.

The mechanistic part is `scripts/review-app-errors.mjs` (Node, `@libsql/client`). The skill is the judgment layer: deciding what is a genuine app bug versus third-party noise, fixing it, and only then clearing.

## When to invoke

Trigger on `/app_errors` or: "review app errors", "triage the error log", "what's erroring in production", "check app_errors", "clear the app_errors table".

## Important

- **Only `app_errors` is ever cleared.** The script runs `DELETE FROM app_errors` and nothing else — never touch donations, subscribers, page_misses, or any other table.
- **Clear only after actioning.** The review run is read-only; only `--clear` deletes. Do not clear until every group has been triaged and real issues have a fix (committed) or a deliberate "noise, no action" decision.
- **Never print the Turso auth token.** The script reads `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` from `.env` via `--env-file=.env`; never echo them.

## Steps

### 1. Review (read-only)

```bash
node --env-file=.env scripts/review-app-errors.mjs
```

Prints the total row count and distinct groups (by `source` + `level` + a normalised message — ids/numbers/uuids collapsed so the same error groups together), each with its count, first→last seen window, and a sample context.

### 2. Triage each group

Split by `source`:

**Server-side sources are the real signal — investigate these.** They come from `reportError("<source>", …)` in the codebase:

- `api/mollie/webhook`, `api/mollie/create-payment` — payment flow. A one-off `SQLITE_UNKNOWN: … capacity temporarily exceeded` is transient Turso load; recurring webhook errors are real (a donation may not have been recorded — cross-check against the donations table read-only if needed).
- `api/cron/reconcile` — hourly reconcile. `fetch failed` / `ensureSchema failed` is usually a transient network blip at run time; only act if it persists across many runs.
- Any other `api/*` source — trace it to the `reportError` call site and fix the underlying bug.

**Client sources (`client:window.error`, `client:unhandledrejection`) are mostly noise** — browser extensions, in-app WebViews, and third-party scripts injecting into the page. Recognise and dismiss:

- `Script error.` with empty filename/lineno — cross-origin script with no detail; not actionable.
- `__gCrWeb`, `__firefox__`, `DarkReader`, `runtime.sendMessage()`, `WKWebView API client did not respond`, `response.showSearchResults` — browser/extension/WebView globals, not our code.
- `t.entries.at is not a function` from `static.cloudflareinsights.com/beacon.min.js` — Cloudflare's third-party beacon, not ours.
- `InvalidStateError` / `The operation was aborted.` on iOS Safari — usually navigating away mid-request; benign.
- Anything whose `url`/`referer` is `localhost:4321` / `127.0.0.1` — **local dev noise** (e.g. Vite `error loading dynamically imported module`), never a production issue.

A genuine client bug looks different: our own filename in the stack (`/_astro/…`), a real line/column, reproducible across sessions, on a real production URL. Treat those like server bugs — fix them.

### 3. Action

- **Real bug** → fix it in the code, run `npx astro check` (expect 0 errors), and commit (`--no-verify`, atomic per fix). Do not push unless asked.
- **Recurring known-noise client error** → consider filtering it at the source so it stops polluting the table. The client beacon lives in the error-tracking script (search for the `client:window.error` / `client:unhandledrejection` reporter, e.g. `src/components/ViewTracker.astro` or the global error handler); add the message/source to its ignore list (mirror the existing localhost/dev guard). This is the high-leverage fix — it keeps future reviews signal-rich.
- **Transient infra** (Turso capacity, fetch failed) → note it, no code change, unless it recurs heavily.

Summarise the triage for the user: each group → decision (fixed / filtered / noise-no-action / transient).

### 4. Clear app_errors (only after actioning)

```bash
node --env-file=.env scripts/review-app-errors.mjs --clear
```

Re-prints the summary, then runs `DELETE FROM app_errors` and reports the row count deleted. No other table is touched.

## Notes

- The script is safe to re-run; only `--clear` is destructive, and it is scoped to a single `DELETE FROM app_errors`.
- Grouping normalises volatile bits (uuids, hex ids, numbers) so payload-varied repeats of one error collapse into a single group.
- If a fix is committed, prefer clearing the table afterwards so the next review reflects only post-fix reality.
