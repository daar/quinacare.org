# Working in this repo

## Mechanistic work goes in a fixed script; skills only orchestrate

Anything **deterministic** or that **mutates production state** — clearing a
table, generating a redirect map, publishing content in bulk, talking to the
Turso DB — belongs in a **version-controlled script** under `scripts/`, behind
explicit flags (e.g. `--clear` for destructive steps). Scripts are
reproducible, reviewable in a diff, and free of model variability.

A **skill** (`.claude/skills/<name>/SKILL.md`) is the thin layer on top: it
decides _when_ to run, exercises _judgment_ (curating a wrong redirect,
publish-vs-redirect on an ambiguous path), and handles orchestration (branch →
commit → PR → summary). The skill never re-implements the mechanistic core —
it calls the script.

Rule of thumb: **if a step must produce the same result every time, it’s a
script, not a prompt.** Don’t reach for an MCP server for batch/occasional
maintenance work — that weight only pays off for interactive, multi-client, or
live ad-hoc tooling.

Examples of this pattern already in the repo:

- `scripts/resolve-404s.mjs` + skill `resolve-404s` — resolve the Turso
  `page_misses` log into redirects/publishes, clear the table, open a PR.
- `scripts/donations-report.py` + skill `donations-report` — donations funnel
  report from the Turso production DB (read-only).

## Content conventions

- Posts/pages/fundraisers are NL/EN/ES. When you change one language’s copy,
  change its siblings in the same edit.
- `translationKey` is the **Dutch slug** across all language variants of an
  entry, so the language switcher links them.
- Filenames match the entry’s `slug`. News lives in `src/content/news/<lang>/<year>/`.
- Large media (video) goes in `public/`, never `src/assets/` — bundling big
  files through Vite OOM-kills the Netlify build.
