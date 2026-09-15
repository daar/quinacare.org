# Keystatic Upstream Tracking

We currently use a local patch for collection list behavior in Keystatic.

Reason:

- We need default sorting by `date` (descending, newest first).
- We need locale-aware display in the date column for editors.
- We need to constrain image insertion/editing UX:
  - hide the standalone image toolbar button,
  - keep image insertion via the insert-block dropdown,
  - keep only `Edit` on image block chrome (no direct upload/delete icons).

Upstream issues:

- https://github.com/Thinkmill/keystatic/issues/1579
- https://github.com/Thinkmill/keystatic/issues/1250
- https://github.com/Thinkmill/keystatic/issues/1578

Local implementation in this repo:

- `patch-package` patch at `patches/@keystatic+core+0.6.9.patch`
- `patch-package` patch at `patches/@keystatic+astro+5.2.0.patch`, which wraps
  the integration's own `/keystatic/[...params]` page in a document that sets
  `translate="no"` (browsers otherwise auto-translate the English-only CMS
  chrome, e.g. rendering "Save" as "Redden" instead of "Opslaan") and carries
  the editor UI guardrails: hiding the standalone image toolbar button
  (`button[aria-label="Image"]`) and the compact 3-icon image popover.

  This used to live in a route-level override at
  `src/pages/keystatic/[...params].astro`. That file declared the same dynamic
  SSR route the integration injects, which Astro only warns about — the built
  page then threw "Could not render `Keystatic`" and production served an empty
  `200`. Patching the integration's page keeps the same customisations with a
  single route. See #92.

Plan:

- Keep the patch until upstream supports:
  - default collection sort and column-level rendering/formatting,
  - configurable/disable-able image toolbar actions in the editor.
- Re-evaluate after each Keystatic upgrade.

Re-evaluated at 0.6.9 (September 2026): still needed. `CollectionTable` continues
to hard-code `column: SLUG` with `direction: 'ascending'`, and the image toolbar
button is still rendered unconditionally from `nodes.image`; no configuration
option for either was found in the package. The patch was regenerated rather than
dropped.

Note that the patch targets content-hashed bundle filenames, so it cannot survive
a version bump on its own: `dist/index-bea09e17.js` in 0.6.3 became
`dist/index-3c244051.js` in 0.6.9. Expect every Keystatic upgrade to fail
`patch-package` at install time and to need the three edits re-applied by hand.
