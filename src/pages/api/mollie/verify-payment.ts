export const prerender = false;

import type { APIRoute } from "astro";
import { createMollieClient } from "@mollie/api-client";
import {
  getDonationById,
  getDonationIdAndStatusByMollieId,
  logEvent,
  updateDonationStatus,
} from "../../../lib/donations";
import { reportError } from "../../../lib/errors";

const SOURCE = "api/mollie/verify-payment";
const mollieApiKey = import.meta.env.MOLLIE_API_KEY;

interface Body {
  paymentId?: string;
  donationId?: number;
}

export const POST: APIRoute = async ({ request }) => {
  if (!mollieApiKey) {
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
    });
  }

  // Resolve the Mollie payment id from whatever the client sent. The
  // return page may have either the paymentId (sessionStorage) or the
  // donationId (query string from create-payment's redirectUrl).
  let mollieId: string | null = null;
  let donationId: number | null = null;
  let previousStatus: string | null = null;

  try {
    if (body.paymentId) {
      mollieId = body.paymentId;
      const row = await getDonationIdAndStatusByMollieId(mollieId);
      if (row) {
        donationId = row.id;
        previousStatus = row.status;
      }
    } else if (typeof body.donationId === "number" && body.donationId > 0) {
      const row = await getDonationById(body.donationId);
      if (row?.mollie_id) {
        donationId = row.id;
        mollieId = row.mollie_id;
        previousStatus = row.status;
      }
    }
  } catch (err) {
    reportError(SOURCE, "donation lookup failed", err, {
      paymentId: body.paymentId,
      donationId: body.donationId,
    });
    return new Response(JSON.stringify({ error: "Lookup failed" }), {
      status: 500,
    });
  }

  if (!mollieId) {
    return new Response(JSON.stringify({ error: "Unknown payment" }), {
      status: 404,
    });
  }

  try {
    const mollie = createMollieClient({ apiKey: mollieApiKey });
    const payment = (await mollie.payments.get(mollieId)) as unknown as {
      status: string;
      customerId?: string;
    };

    try {
      await updateDonationStatus(mollieId, payment.status, payment.customerId);
    } catch (err) {
      reportError(SOURCE, "updateDonationStatus failed", err, {
        paymentId: mollieId,
      });
    }

    if (donationId) {
      await logEvent({
        donationId,
        type: "verify_payment",
        source: "server",
        mollieStatus: payment.status,
        previousStatus: previousStatus ?? undefined,
        payload: { paymentId: mollieId },
      });
    }

    return new Response(JSON.stringify({ status: payment.status }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification failed";
    reportError(SOURCE, "verify failed", err, { paymentId: mollieId });
    if (donationId) {
      await logEvent({
        donationId,
        type: "verify_payment",
        source: "server",
        previousStatus: previousStatus ?? undefined,
        payload: { error: message, paymentId: mollieId },
      });
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
