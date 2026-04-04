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

/** Derive effective status: Mollie keeps status=paid even after chargebacks/refunds. */
function effectiveStatus(p) {
  if (p.amountChargedBack && parseFloat(p.amountChargedBack.value) > 0)
    return "charged_back";
  if (p.amountRefunded && parseFloat(p.amountRefunded.value) > 0) {
    if (!p.amountRemaining || parseFloat(p.amountRemaining.value) === 0)
      return "refunded";
    return "partially_refunded";
  }
  return p.status;
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
    case "list-customers": {
      const params = { limit: 50 };
      if (body.from) params.from = body.from;
      const page = await mollieClient.customers.page(params);
      const items = [...page].map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        locale: c.locale,
        createdAt: c.createdAt,
      }));
      return { items, nextCursor: page.nextPageCursor || null };
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
