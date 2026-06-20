---
name: resolve-404s
description: Resolve the Turso page_misses (404) log into native-route redirects and draft publishes, then clear the page_misses (missed-pages) table and open a PR. Use whenever the user asks to "resolve 404s", "process the missed routes", "make redirects from the 404 log", "clear the page misses", "publish pages people are looking for", or invokes /resolve-404s. Reads the page_misses table from the live Turso DB and writes src/data/missesRedirects.mjs.
---

# Resolve the Turso 404 log into redirects / publishes

Reads the `page_misses` table (every 404 a real visitor hit), and for each human, non-local miss:

- if a **draft** post/page matches the path → **publish it** and redirect the old URL to its native canonical URL,
- else if it maps to a known section (curated) → **add a redirect**,
- otherwise skip (junk, asset, bot, already-resolved).

The output is `src/data/missesRedirects.mjs`, which `astro.config.mjs` spreads into its `redirects` map. The script is `scripts/resolve-404s.mjs` (Node, uses `@libsql/client`).

## When to invoke

Trigger on `/resolve-404s` or: "resolve the 404s", "process missed routes", "build redirects from the page-misses log", "publish the pages visitors are looking for", "clear the page_misses table".

## Important: the run mutates content even without `--clear`

Only the **table DELETE** is gated by `--clear`. Every run still **publishes matching drafts** (edits `status: draft → publish`) and **rewrites `missesRedirects.mjs`**. So:

1. Run **without** `--clear` first to inspect.
2. Review the proposed publishes/redirects (see step 3). Revert anything wrong with `git checkout -- <file>`.
3. Only when the output is clean, run **with** `--clear` to empty the table.

## Steps

### 1. Credentials

The script reads `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` from `.env` via `--env-file=.env`. Confirm `.env` exists and has both (it does in this repo). Never print the auth token.

### 2. Dry inspect (no `--clear`)

```bash
node --env-file=.env scripts/resolve-404s.mjs
```

Reads the live table (snapshots it to `/tmp/404-snapshot.json`), prints: human/non-local path count + ignored local count, the drafts it published, the redirects it wrote, and a skipped count.

### 3. Review the output — curate the wrong ones

The matcher is conservative (same-language only; never resolves to a `-N` collision-cruft slug or filename), but still sanity-check every line:

- A redirect pointing at an **old WordPress blog post** instead of the real page (e.g. `/donate` must go to the donate page, not a 2017 article) → add a **curated** entry.
- A **published draft** that's actually cruft (a `-N` duplicate, a `test-*`/`wpsd-*` page) → it shouldn't have matched; if it did, `git checkout --` it and tighten the filter.
- A **cross-language** target (NL slug on an EN path, etc.) → add a curated entry with the correct native target.

Curated overrides live in the `CURATED` map at the top of `scripts/resolve-404s.mjs` (old URL → native target). Add entries there and re-run step 2 until clean. Verify targets exist: donate pages are `/doneer`, `/en/donate`, `/es/donar`; volunteer pages `/word-vrijwilliger`, `/en/become-volunteer`, `/es/hazte-voluntario`; section indexes `/actueel`·`/en/news`·`/es/noticias`, `/acties`·`/en/fundraisers`·`/es/campañas`.

### 4. Clear the missed-pages table

```bash
node --env-file=.env scripts/resolve-404s.mjs --clear
```

Re-publishes (no-op if step 2 already did), rewrites the file, then empties **only** the `page_misses` table — `DELETE FROM page_misses` (count reported; snapshot kept at `/tmp/404-snapshot.json`). No other tables (donations, etc.) are touched.

### 5. Validate, then open a PR

```bash
npx astro check          # expect 0 errors
```

Put the result on its own branch and open a pull request — do **not** commit to `main`:

```bash
git checkout -b chore/resolve-404s-<YYYY-MM-DD>
git add src/data/missesRedirects.mjs <each published .mdoc>
git commit --no-verify -m "404s: refresh missed-route redirects from the live Turso log"
git push -u origin HEAD
gh pr create --title "Resolve missed routes from the 404 log" --body "<summary>"
```

Stage `src/data/missesRedirects.mjs` plus every published `.mdoc` (group a post's NL/EN/ES siblings together). The PR body should summarise the script output: how many rows were cleared, how many local/dev misses were ignored, the drafts published, and the redirects added. Report the PR URL back to the user.

## Notes

- **Local/dev misses are ignored** by referrer (`localhost`/`127.0.0.1`/`0.0.0.0`/`.local`) — and `src/pages/404.astro` no longer beacons at all from those hosts, so the table stays clean going forward.
- `routeRedirects.mjs` was removed: redirects come **only** from this 404 log plus the manual legacy block in `astro.config.mjs`.
- Targets always use the **native localized routes** (see `SEG` in the script, mirroring `src/i18n` `ROUTES`).
- The script is safe to re-run; publishing and the generated file are idempotent. Only `--clear` is destructive (and snapshotted).
