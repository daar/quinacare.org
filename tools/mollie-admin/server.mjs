#!/usr/bin/env node
/**
 * Mollie Admin — local-only admin dashboard for managing customers,
 * payments, subscriptions, and refunds.
 *
 * Usage:
 *   MOLLIE_API_KEY=live_xxx node tools/mollie-admin/server.mjs
 *   # or: node --env-file=.env tools/mollie-admin/server.mjs
 *
 * Opens http://localhost:3333 in your default browser.
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMollieClient } from "@mollie/api-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MOLLIE_ADMIN_PORT || "3333", 10);

// ── Mollie client ──────────────────────────────────────────

const API_KEY = process.env.MOLLIE_API_KEY;
if (!API_KEY) {
  console.error("Missing MOLLIE_API_KEY. Set it in .env or as env var.");
  process.exit(1);
}

const mollieClient = createMollieClient({ apiKey: API_KEY });
const testMode = API_KEY.startsWith("test_");

console.log(`Mollie mode: ${testMode ? "TEST" : "LIVE"}`);

// ── API handlers ───────────────────────────────────────────

/**
 * Derive effective status. Mollie keeps the payment's own status at
 * `paid` for the life of the row, even after chargebacks/refunds, and
 * a refund only counts toward `amountRefunded` once it has *settled*.
 * While a refund is queued/pending/processing, `amountRemaining`
 * drops to zero (preventing a second refund) but `amountRefunded`
 * stays at zero — so reading just those two fields would make the
 * payment look like a plain `paid` row with no refund button, which
 * is exactly the case our admin UI was showing as "nothing happened".
 *
 * The in-flight delta is therefore `amount - amountRemaining - amountRefunded`.
 * Surface it explicitly so the row reads as `refund_pending` until
 * the refund settles, then flips to `refunded` / `partially_refunded`.
 */
function effectiveStatus(p) {
  if (p.amountChargedBack && parseFloat(p.amountChargedBack.value) > 0)
    return "charged_back";
  const total = p.amount ? parseFloat(p.amount.value) : 0;
  const refunded = p.amountRefunded ? parseFloat(p.amountRefunded.value) : 0;
  const remaining = p.amountRemaining
    ? parseFloat(p.amountRemaining.value)
    : total;
  const pending = total - remaining - refunded;
  if (pending > 0.005) return "refund_pending";
  if (refunded > 0) {
    return remaining === 0 ? "refunded" : "partially_refunded";
  }
  return p.status;
}

/**
 * Return the bank-account-holder name from the customer's most
 * recently created valid mandate, or null if none exists. Used to
 * give each row in the Customers table a real donor identity (the
 * customer's `name` is always our placeholder "Quina Care Donor").
 */
async function fetchConsumerName(customerId) {
  const mandates = await mollieClient.customerMandates.page({ customerId });
  const items = [...mandates];
  if (!items.length) return null;
  // The mandate object nests the bank-holder name inside `details`,
  // not at the top level - same shape as a payment object. Reading
  // `m.consumerName` always returns undefined here, which is what
  // made every customer's "Naam consument" column come up empty.
  const sorted = items
    .filter((m) => m.details?.consumerName)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return sorted[0]?.details?.consumerName ?? null;
}

function mapPayment(p) {
  return {
    id: p.id,
    status: effectiveStatus(p),
    mollieStatus: p.status,
    amount: p.amount,
    description: p.description,
    method: p.method,
    createdAt: p.createdAt,
    paidAt: p.paidAt,
    // SEPA Direct Debit payments carry an `incassodatum` on
    // p.details.dueDate — when the bank actually debits the donor.
    // For iDEAL/card/PayPal this is null (the donor was charged at
    // checkout time, so paidAt is the answer instead). Surfacing
    // both lets the UI show "when will this debit clear" for the
    // recurring rows that fire days after their createdAt.
    dueDate: p.details?.dueDate ?? null,
    sequenceType: p.sequenceType,
    customerId: p.customerId,
    subscriptionId: p.subscriptionId,
    settlementAmount: p.settlementAmount,
    amountRefunded: p.amountRefunded,
    amountRemaining: p.amountRemaining,
    amountChargedBack: p.amountChargedBack,
    metadata: p.metadata,
  };
}

async function handleApi(body) {
  const { action } = body;

  switch (action) {
    case "get-mode": {
      return { mode: testMode ? "test" : "live" };
    }

    case "list-customers": {
      const params = { limit: 50 };
      if (body.from) params.from = body.from;
      const page = await mollieClient.customers.page(params);
      const customers = [...page];
      // Fetch each customer's mandates in parallel to surface the
      // SEPA-DD consumer name. The customer's own `name` is the one
      // we assigned at create-payment time ("Quina Care Donor") -
      // useless for identifying who the actual donor is. The mandate
      // holds the bank-account holder name, which is the real donor
      // identity. Best-effort: a per-customer mandate fetch failing
      // (rate limit, gone, etc.) just leaves that row's
      // consumerName null, doesn't break the page.
      const consumerNames = await Promise.all(
        customers.map((c) => fetchConsumerName(c.id).catch(() => null)),
      );
      const items = customers.map((c, i) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        locale: c.locale,
        createdAt: c.createdAt,
        consumerName: consumerNames[i],
      }));
      return { items, nextCursor: page.nextPageCursor || null };
    }

    case "search-customers": {
      if (!body.query) throw new Error("query required");
      const q = body.query.toLowerCase();
      const all = [];
      let p = await mollieClient.customers.page({ limit: 250 });
      while (true) {
        all.push(...p);
        if (!p.nextPageCursor) break;
        p = await p.nextPage();
      }
      // Cheap field filter first: ID / Mollie-stored name / email.
      // Anything that matches up here skips the per-customer
      // mandate fetch entirely.
      const cheapMatch = (c) =>
        (c.id || "").toLowerCase().includes(q) ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q);
      const cheaplyMatched = new Set(all.filter(cheapMatch).map((c) => c.id));
      // For the rest, fetch the SEPA mandate consumer name in
      // parallel and treat it as another searchable field. Without
      // this you couldn't find a donor by their real bank-account
      // name from the search box.
      const others = all.filter((c) => !cheaplyMatched.has(c.id));
      const otherNames = await Promise.all(
        others.map((c) => fetchConsumerName(c.id).catch(() => null)),
      );
      const nameByCustomer = new Map(
        others.map((c, i) => [c.id, otherNames[i]]),
      );
      const items = all
        .filter(
          (c) =>
            cheaplyMatched.has(c.id) ||
            (nameByCustomer.get(c.id) || "").toLowerCase().includes(q),
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          locale: c.locale,
          createdAt: c.createdAt,
          consumerName: nameByCustomer.get(c.id) ?? null,
        }));
      return { items, nextCursor: null };
    }

    case "search-payments": {
      if (!body.query) throw new Error("query required");
      const q = body.query.toLowerCase();
      const all = [];
      let p = await mollieClient.payments.page({ limit: 250 });
      while (true) {
        all.push(...p);
        if (!p.nextPageCursor) break;
        p = await p.nextPage();
      }
      const items = all
        .filter(
          (p) =>
            (p.id || "").toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q) ||
            (p.customerId || "").toLowerCase().includes(q),
        )
        .map(mapPayment);
      return { items, nextCursor: null };
    }

    case "list-payments": {
      const params = { limit: 50 };
      if (body.from) params.from = body.from;
      let page;
      if (body.customerId) {
        // Fetch ALL pages for a single customer (bounded dataset)
        const allItems = [];
        let cPage = await mollieClient.customerPayments.page({
          customerId: body.customerId,
          limit: 250,
        });
        while (true) {
          allItems.push(...cPage);
          if (!cPage.nextPageCursor) break;
          cPage = await cPage.nextPage();
        }
        const items = allItems.map(mapPayment);
        return { items, nextCursor: null };
      } else {
        page = await mollieClient.payments.page(params);
      }
      const items = [...page].map(mapPayment);
      return { items, nextCursor: page.nextPageCursor || null };
    }

    case "list-subscriptions": {
      if (!body.customerId) throw new Error("customerId required");
      const page = await mollieClient.customerSubscriptions.page({
        customerId: body.customerId,
        limit: 50,
      });
      const items = [...page].map((s) => ({
        id: s.id,
        status: s.status,
        amount: s.amount,
        interval: s.interval,
        description: s.description,
        method: s.method,
        createdAt: s.createdAt,
        canceledAt: s.canceledAt,
        nextPaymentDate: s.nextPaymentDate,
      }));
      return { items };
    }

    case "cancel-subscription": {
      if (!body.customerId || !body.subscriptionId)
        throw new Error("customerId and subscriptionId required");
      await mollieClient.customerSubscriptions.cancel(body.subscriptionId, {
        customerId: body.customerId,
      });
      return { ok: true, message: `Canceled ${body.subscriptionId}` };
    }

    case "refund-payment": {
      if (!body.paymentId) throw new Error("paymentId required");
      const payment = await mollieClient.payments.get(body.paymentId);
      const refundAmount =
        body.amount || payment.amountRemaining || payment.amount;
      const refund = await mollieClient.paymentRefunds.create({
        paymentId: body.paymentId,
        amount: refundAmount,
      });
      return {
        ok: true,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
      };
    }

    case "get-customer": {
      if (!body.customerId) throw new Error("customerId required");
      const c = await mollieClient.customers.get(body.customerId);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        locale: c.locale,
        createdAt: c.createdAt,
        metadata: c.metadata,
      };
    }

    case "get-payment": {
      if (!body.paymentId) throw new Error("paymentId required");
      const p = await mollieClient.payments.get(body.paymentId);
      return mapPayment(p);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ── HTTP server ────────────────────────────────────────────

const html = readFileSync(resolve(__dirname, "index.html"), "utf-8");

const server = createServer(async (req, res) => {
  // Only allow localhost
  const host = req.headers.host || "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    res.writeHead(403);
    res.end("Forbidden — localhost only");
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "POST" && req.url === "/api") {
    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const parsed = JSON.parse(body);
      const result = await handleApi(parsed);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nMollie Admin running at http://localhost:${PORT}\n`);
});
