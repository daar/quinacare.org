export const prerender = false;

import type { APIRoute } from "astro";
import { getMollieClient } from "../../../lib/mollie";
import {
  upsertSubscription,
  getSubscriptionsByCustomerId,
} from "../../../lib/donations";

function isLocal(request: Request): boolean {
  const origin = new URL(request.url).origin;
  return origin.includes("localhost") || origin.includes("127.0.0.1");
}

/**
 * Local-only endpoint for managing Mollie subscriptions.
 * Blocked in production — returns 403.
 *
 * GET  ?customerId=cst_xxx              → list subscriptions
 * POST { action: "cancel", customerId, subscriptionId }  → cancel subscription
 */
export const GET: APIRoute = async ({ request }) => {
  if (!isLocal(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");

  if (!customerId) {
    return new Response(
      JSON.stringify({ error: "Missing customerId query param" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const mollieClient = getMollieClient();
    const subs = await mollieClient.customerSubscriptions.page({ customerId });
    const results = [...subs].map((s) => {
      const sub = s as unknown as {
        id: string;
        status: string;
        amount: { currency: string; value: string };
        interval: string;
        description: string;
        method: string;
        createdAt: string;
        canceledAt?: string;
      };
      return {
        id: sub.id,
        status: sub.status,
        amount: sub.amount,
        interval: sub.interval,
        description: sub.description,
        method: sub.method,
        createdAt: sub.createdAt,
        canceledAt: sub.canceledAt,
      };
    });

    // Also show local DB records
    const dbSubs = await getSubscriptionsByCustomerId(customerId);

    return new Response(
      JSON.stringify({ mollie: results, turso: dbSubs }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list subscriptions";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!isLocal(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { action: string; customerId: string; subscriptionId: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action, customerId, subscriptionId } = body;

  if (action !== "cancel") {
    return new Response(
      JSON.stringify({ error: "Only 'cancel' action is supported" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!customerId || !subscriptionId) {
    return new Response(
      JSON.stringify({ error: "Missing customerId or subscriptionId" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const mollieClient = getMollieClient();
    await mollieClient.customerSubscriptions.cancel(subscriptionId, {
      customerId,
    });

    // Update Turso
    await upsertSubscription({
      mollie_subscription_id: subscriptionId,
      mollie_customer_id: customerId,
      status: "canceled",
    });

    console.log(
      `[Mollie] Canceled subscription ${subscriptionId} for customer ${customerId}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        subscriptionId,
        status: "canceled",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancellation failed";
    console.error(`[Mollie] Cancel error for ${subscriptionId}:`, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
