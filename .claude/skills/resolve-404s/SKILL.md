---
name: resolve-404s
description: Resolve the Turso page_misses (404) log into native-route redirects and draft publishes, then clear the page_misses (missed-pages) table and open or extend a PR. Use whenever the user asks to "resolve 404s", "process the missed routes", "make redirects from the 404 log", "clear the page misses", "publish pages people are looking for", or invokes /resolve-404s. Reads the page_misses table from the live Turso DB and writes src/data/missesRedirects.mjs.
---

# Resolve the Turso 404 log into redirects / publishes

Reads the `page_misses` table (every 404 a real visitor hit), and for each human, non-local miss:

- if a **draft** post/page matches the path → **publish it** and redirect the old URL to its native canonical URL,
- else if it maps to a known section (curated) → **add a redirect**,
- otherwise skip (junk, asset, bot, already-resolved, or a path the live site already serves).

The output is `src/data/missesRedirects.mjs`, which `astro.config.mjs` spreads into its `redirects` map. Two scripts do the mechanical work:

- `scripts/verify-404s.py` — asks the live site which logged paths are **still** broken (Python, stdlib only, read-only).
- `scripts/resolve-404s.mjs` — turns the log into redirects/publishes (Node, `@libsql/client`).

## When to invoke

Trigger on `/resolve-404s` or: "resolve the 404s", "process missed routes", "build redirects from the page-misses log", "publish the pages visitors are looking for", "clear the page_misses table".

## Always verify before you act

A row in `page_misses` says a path failed **once, in the past**. Paths get fixed afterwards — a draft is published, a redirect lands, an endpoint learns to resolve nested paths — and the stale rows stay behind. Acting on the log alone proposes redirects for routes that already work, and a redirect that shadows a working route is worse than doing nothing.

This is not hypothetical: a run once proposed redirecting `/api/qr/acties/putumayo-bootcamp` to a fundraiser page. That endpoint renders a QR page and returns 200 — the log entries predated the fix that taught it nested paths.

So **never** hand-read the log and judge. Run the verifier and act only on what it reports as `broken`.

## Important: the run mutates content even without `--clear`

Only the **table DELETE** is gated by `--clear`. Every run still **publishes matching drafts** (edits `status: draft → publish`) and **rewrites `missesRedirects.mjs`**. So: inspect first, review, and only then clear.

## Steps

### 1. Credentials

Both scripts read `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` from `.env` (the Node one via `--env-file=.env`, the Python one reads `.env` itself). Confirm both are present and real — a placeholder value fails with a confusing HTTP 404 from libsql. Never print the auth token.

### 2. Verify which paths are actually broken

```bash
python3 scripts/verify-404s.py --out /tmp/404-verified.json
```

It reads the log, drops bot rows and local/dev referrers, normalises and de-duplicates the paths (query strings dropped, percent-escapes decoded so `/es/campa%C3%B1as` folds into `/es/campañas`, trailing slashes stripped), requests each one against the live site, and writes JSON:

- `broken` — still failing today. **This is the work list.**
- `working` — already serving 200. Ignore these; they need no redirect.

Read the summary line it prints: `rows_in_log`, how many were skipped as bots, `distinct_paths_checked`, `still_broken`, `already_working`. The reduction is usually large — 81 rows once collapsed to 10 real paths, 2 of which already worked.

Two things to eyeball in `broken`:

- A **non-404 status** is not automatically a fault. `/api/qr` returns `400 {"error":"Missing page path"}` — correct behaviour for a call with no path, not something to redirect.
- A path that is `redirected: true` with status 200 reached its target through an existing redirect; it does not need another one.

### 3. Dry inspect (no `--clear`)

```bash
node --env-file=.env scripts/resolve-404s.mjs --verified /tmp/404-verified.json
```

`--verified` makes the resolver skip every path the verifier found working, so the false positives never reach the file. It prints how many it ignored for that reason, then the usual: human/non-local path count, drafts published, redirects written, skipped count. It snapshots the table to `/tmp/404-snapshot.json`.

If the live table is empty (a previous run cleared it) the resolver falls back to that snapshot — point the verifier at the same input so the two agree:

```bash
python3 scripts/verify-404s.py --snapshot /tmp/404-snapshot.json --out /tmp/404-verified.json
```

### 4. Review the output — curate the wrong ones

Diff `src/data/missesRedirects.mjs` **at key level**, not line level:

```bash
git diff src/data/missesRedirects.mjs
```

The generated file is Prettier-formatted by the script itself, so a clean run produces no formatting churn and the diff shows only real key changes. If you ever do see wrapping-only noise (an entry moving between one and two lines), that is a false positive — ignore it, and check that the script's formatting step ran.

Then sanity-check every remaining line. The matcher is conservative (same-language only; never resolves to a `-N` collision-cruft slug), but still:

- A redirect pointing at an **old WordPress blog post** instead of the real page (e.g. `/donate` must go to the donate page, not a 2017 article) → add a **curated** entry.
- A **published draft** that is actually cruft (a `-N` duplicate, a `test-*`/`wpsd-*` page) → `git checkout --` it and tighten the filter.
- A **cross-language** target (NL slug on an EN path, etc.) → curated entry with the correct native target.
- Before accepting any redirect, confirm the **target** returns 200. `/es/word-vrijwilliger → /es/hazte-voluntario` is only useful if the Spanish page exists.

Curated overrides live in the `CURATED` map at the top of `scripts/resolve-404s.mjs`. Add entries and re-run step 3 until clean. Native routes: donate `/doneer`·`/en/donate`·`/es/donar`; volunteer `/word-vrijwilliger`·`/en/become-volunteer`·`/es/hazte-voluntario`; news `/actueel`·`/en/news`·`/es/noticias`; fundraisers `/acties`·`/en/fundraisers`·`/es/campañas`.

### 5. Clear the missed-pages table

```bash
node --env-file=.env scripts/resolve-404s.mjs --verified /tmp/404-verified.json --clear
```

Re-publishes (no-op if step 3 already did), rewrites the file, then empties **only** the `page_misses` table (count reported; snapshot kept at `/tmp/404-snapshot.json`). No other table is touched.

Rows can arrive between steps, so re-check the diff after this run rather than assuming it matches step 3.

### 6. Validate, then open **or extend** the PR

```bash
npx astro check          # expect 0 errors
```

These PRs carry the **`404-redirects`** label. Before creating anything, look for one already open:

```bash
gh pr list --label "404-redirects" --state open --json number,headRefName
```

**If one is open**, append to it — do not open a second:

```bash
git fetch origin && git checkout <headRefName> && git pull
# redo steps 2-5 on that branch, then:
git add src/data/missesRedirects.mjs <each published .mdoc>
git commit --no-verify -m "404s: refresh missed-route redirects from the live Turso log"
git push
gh pr comment <number> --body "<what this run added>"
```

**If none is open**, create one and label it:

```bash
git checkout -b chore/resolve-404s-<YYYY-MM-DD>
git add src/data/missesRedirects.mjs <each published .mdoc>
git commit --no-verify -m "404s: refresh missed-route redirects from the live Turso log"
git push -u origin HEAD
gh pr create --title "Resolve missed routes from the 404 log" --label "404-redirects" --body "<summary>"
```

Never commit to `main`. Stage `src/data/missesRedirects.mjs` plus every published `.mdoc` (group a post's NL/EN/ES siblings). The PR body should give the verifier's numbers (rows in the log, bots skipped, distinct paths, still broken vs already working), the redirects added, the drafts published, and **anything you dropped and why**. Report the PR URL back to the user.

### 7. What is left for a human

Paths the verifier calls broken but that no redirect can fix — retired WordPress PDFs, a feed the site no longer serves — are content decisions. Collect them, and either add them to the existing open issue about missed routes or raise one and assign it, rather than leaving them only in the PR body.

## Notes

- **Local/dev misses are ignored** by referrer (`localhost`/`127.0.0.1`/`0.0.0.0`/`.local`), and `src/pages/404.astro` no longer beacons from those hosts.
- The verifier is **read-only** and safe to run any time; it never writes to the database.
- `routeRedirects.mjs` was removed: redirects come **only** from this log plus the manual legacy block in `astro.config.mjs`.
- Targets always use the **native localized routes** (see `SEG` in the script, mirroring `src/i18n` `ROUTES`).
- Publishing and the generated file are idempotent. Only `--clear` is destructive (and snapshotted).
- **Redirect generation is cumulative**: each run seeds from the existing `missesRedirects.mjs` and merges in the new resolutions, so a cleared log never drops previously-resolved redirects. To remove a stale redirect, delete its line from `missesRedirects.mjs` directly — and remember the next run will re-add it if the path is still in the log and still broken.
