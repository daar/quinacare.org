export const prerender = false;

import type { APIRoute } from "astro";
import { createMollieClient } from "@mollie/api-client";
import { updateDonationStatus } from "../../../lib/donations";

const mollieApiKey = import.meta.env.MOLLIE_API_KEY;

export const POST: APIRoute = async ({ request }) => {
  if (!mollieApiKey) {
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
    });
  }

  let body: { paymentId: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
    });
  }

  const { paymentId } = body;
  if (!paymentId) {
    return new Response(JSON.stringify({ error: "Missing paymentId" }), {
      status: 400,
    });
  }

  try {
    const mollieClient = createMollieClient({ apiKey: mollieApiKey });
    const payment = (await mollieClient.payments.get(paymentId)) as unknown as {
      status: string;
      customerId?: string;
    };

    await updateDonationStatus(paymentId, payment.status, payment.customerId);

    return new Response(JSON.stringify({ status: payment.status }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    console.error(`[Mollie] Verify error for ${paymentId}:`, message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
