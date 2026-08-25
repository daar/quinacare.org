# Keystatic Upstream Tracking

We currently use a local patch for collection list behavior in Keystatic.

Reason:

- We need default sorting by `date` (descending, newest first).
- We need locale-aware display in the date column for editors.

Upstream issues:

- https://github.com/Thinkmill/keystatic/issues/1579
- https://github.com/Thinkmill/keystatic/issues/1250
- https://github.com/Thinkmill/keystatic/issues/1578

Local implementation in this repo:

- `patch-package` patch at `patches/@keystatic+core+0.6.3.patch`

Plan:

- Keep the patch until upstream supports default collection sort and column-level rendering/formatting.
- Re-evaluate after each Keystatic upgrade.
