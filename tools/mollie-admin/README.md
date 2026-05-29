# Mollie Admin

Local-only admin dashboard for managing Mollie customers, payments, subscriptions, and refunds.

## Usage

```bash
# From the project root:
node --env-file=.env tools/mollie-admin/server.mjs

# Or with explicit key:
MOLLIE_API_KEY=live_xxx node tools/mollie-admin/server.mjs
```

Opens at http://localhost:3333

## Features

- Browse customers with search/filter
- Expand customer to see their subscriptions and payments
- Cancel subscriptions (with confirmation)
- Refund payments — full or partial (with confirmation)
- Browse all payments with search/filter

## Safety

- Binds to 127.0.0.1 only — not accessible from network
- Rejects requests from non-localhost origins
- Confirmation dialogs before all destructive actions
- Not part of the Astro build — completely standalone
