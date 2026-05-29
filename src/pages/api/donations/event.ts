export const prerender = false;

import type { APIRoute } from "astro";
import {
  getDonationById,
  getDonationIdAndStatusByMollieId,
  logEvent,
  type DonationEventType,
} from "../../../lib/donations";
import { reportError } from "../../../lib/errors";

const SOURCE = "api/donations/event";

// Only client-side beacons are accepted here. Server-side events are
// logged directly by the handlers that produce them.
const ALLOWED: ReadonlySet<DonationEventType> = new Set<DonationEventType>([
  "checkout_redirected",
  "return_page_loaded",
]);

interface Body {
  paymentId?: string;
  donationId?: number;
  type?: string;
  payload?: Record<string, unknown>;
}

export const POST: APIRoute = async ({ request }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const { type, paymentId, payload } = body;
  if (!type || !ALLOWED.has(type as DonationEventType)) {
    return new Response("Invalid event type", { status: 400 });
  }

  // Best-effort resolution: prefer the explicit donationId (the return
  // page knows its own id from the redirect query string), fall back to
  // a paymentId lookup (the checkout-redirected beacon only has
  // Mollie's id at hand). Lookup failures must not 500 — beacons are
  // fire-and-forget; an opaque ok is fine if Turso glitches.
  let donationId: number | null = null;
  try {
    if (typeof body.donationId === "number" && body.donationId > 0) {
      const row = await getDonationById(body.donationId);
      if (row) donationId = row.id;
    }
    if (!donationId && paymentId) {
      const row = await getDonationIdAndStatusByMollieId(paymentId);
      if (row) donationId = row.id;
    }
  } catch (err) {
    reportError(SOURCE, "lookup failed", err, {
      paymentId,
      donationId: body.donationId,
    });
    return new Response("OK", { status: 200 });
  }

  if (!donationId) {
    return new Response("Unknown donation", { status: 404 });
  }

  try {
    await logEvent({
      donationId,
      type: type as DonationEventType,
      source: "client",
      payload: {
        ...(payload ?? {}),
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (err) {
    // logEvent has its own try/catch already, this is belt-and-braces.
    reportError(SOURCE, "logEvent threw", err, { donationId, type });
  }

  return new Response("OK", { status: 200 });
};
