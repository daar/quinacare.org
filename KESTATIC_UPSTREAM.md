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

- `patch-package` patch at `patches/@keystatic+core+0.6.3.patch`
- `patch-package` patch at `patches/@keystatic+astro+5.2.0.patch`
  to inject editor UI guardrails in the active Keystatic page wrapper.
- Route-level Keystatic override at `src/pages/keystatic/[...params].astro`
  to hide the standalone image toolbar button (`button[aria-label="Image"]`).

Plan:

- Keep the patch until upstream supports:
  - default collection sort and column-level rendering/formatting,
  - configurable/disable-able image toolbar actions in the editor.
- Re-evaluate after each Keystatic upgrade.
