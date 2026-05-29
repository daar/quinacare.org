export const prerender = false;

import type { APIRoute } from "astro";
import { createMollieClient } from "@mollie/api-client";
import { getDb, ensureSchema } from "../../../lib/db";
import { logEvent, updateDonationStatus } from "../../../lib/donations";
import { reportError } from "../../../lib/errors";

const SOURCE = "api/cron/reconcile";
const mollieApiKey = import.meta.env.MOLLIE_API_KEY;
const cronSecret = import.meta.env.CRON_SECRET;

const TERMINAL = new Set(["expired", "canceled", "failed"]);

/**
 * Pinpoint where the donor dropped off by looking at which events the
 * donation did and didn't accumulate.
 */
async function classifyAbandonment(
  donationId: number,
  mollieStatus: string,
): Promise<string> {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT event_type FROM donation_events WHERE donation_id = ? ORDER BY id`,
      args: [donationId],
    });
    const types = new Set(result.rows.map((r) => r.event_type as string));
    const hadRedirect = types.has("checkout_redirected");
    const hadReturn = types.has("return_page_loaded");

    if (mollieStatus === "canceled") {
      return hadReturn ? "user_canceled_returned" : "user_canceled_at_mollie";
    }
    if (mollieStatus === "expired") {
      if (hadReturn) return "expired_after_return";
      if (hadRedirect) return "expired_at_checkout";
      return "expired_before_redirect";
    }
    if (mollieStatus === "failed") return "payment_failed";
    return `terminal_${mollieStatus}`;
  } catch (err) {
    reportError(SOURCE, "classifyAbandonment failed", err, { donationId });
    return `terminal_${mollieStatus}`;
  }
}

/**
 * Reconcile stale "pending" donations against Mollie's API. Catches
 * webhook misses so a row can never sit at pending forever silently,
 * and explicitly tags abandonments with a reason classification.
 *
 * Invoked hourly by netlify/functions/cron-reconcile.mts. Authed via a
 * shared secret in the x-cron-secret header so the URL is not callable
 * by the public.
 */
// GET is a low-trust liveness probe — it confirms the endpoint exists
// and shows whether the cron secret is configured server-side, without
// requiring the caller to know the secret. Useful for debugging when
// the Netlify scheduled function isn't observably firing.
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: "api/cron/reconcile",
      cronSecretConfigured: Boolean(cronSecret),
      mollieApiKeyConfigured: Boolean(mollieApiKey),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

export const POST: APIRoute = async ({ request }) => {
  if (!cronSecret) {
    return new Response("Cron not configured", { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!mollieApiKey) {
    return new Response("Payment service not configured", { status: 503 });
  }

  try {
    await ensureSchema();
  } catch (err) {
    reportError(SOURCE, "ensureSchema failed", err);
    return new Response("Schema unavailable", { status: 500 });
  }

  const db = getDb();

  // Stale pendings: created >15 min ago (give the webhook a fair
  // window), <30 days ago (Mollie expires payments after a fortnight
  // anyway), with a mollie_id (no id == no Mollie payment to query).
  // 200-row cap keeps any single run bounded; a backlog clears in a
  // few cycles.
  let result;
  try {
    result = await db.execute({
      sql: `SELECT id, mollie_id, status
            FROM donations
            WHERE status IN ('pending', 'open')
              AND mollie_id IS NOT NULL
              AND created_at < datetime('now', '-15 minutes')
              AND created_at > datetime('now', '-30 days')
            LIMIT 200`,
    });
  } catch (err) {
    reportError(SOURCE, "stale-pending SELECT failed", err);
    return new Response("Query failed", { status: 500 });
  }

  const mollie = createMollieClient({ apiKey: mollieApiKey });
  const stats = {
    checked: 0,
    updated: 0,
    unchanged: 0,
    abandoned: 0,
    errors: 0,
  };

  for (const row of result.rows) {
    const id = row.id as number;
    const mollieId = row.mollie_id as string;
    const previousStatus = row.status as string;
    stats.checked++;
    try {
      const payment = (await mollie.payments.get(mollieId)) as unknown as {
        status: string;
        customerId?: string;
      };
      const changed = payment.status !== previousStatus;
      if (changed) {
        try {
          await updateDonationStatus(
            mollieId,
            payment.status,
            payment.customerId,
          );
          stats.updated++;
        } catch (err) {
          reportError(SOURCE, "updateDonationStatus failed", err, {
            mollieId,
            newStatus: payment.status,
          });
        }
      } else {
        stats.unchanged++;
      }

      await logEvent({
        donationId: id,
        type: "reconciliation",
        source: "cron",
        mollieStatus: payment.status,
        previousStatus,
        payload: { changed },
      });

      // Terminal Mollie statuses mean the donor is not coming back.
      // Log an `abandoned` event with a precise reason so the funnel
      // shows WHERE the drop happened, not just THAT it did.
      if (TERMINAL.has(payment.status)) {
        const reason = await classifyAbandonment(id, payment.status);
        await logEvent({
          donationId: id,
          type: "abandoned",
          source: "cron",
          mollieStatus: payment.status,
          previousStatus,
          payload: { reason },
        });
        stats.abandoned++;
      }
    } catch (err: unknown) {
      stats.errors++;
      reportError(SOURCE, "Mollie API or processing error", err, { mollieId });
      try {
        await logEvent({
          donationId: id,
          type: "reconciliation",
          source: "cron",
          previousStatus,
          payload: {
            error: err instanceof Error ? err.message : "unknown",
          },
        });
      } catch {
        /* logging is best-effort */
      }
    }
  }

  console.log("[Reconcile] done", stats);
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
