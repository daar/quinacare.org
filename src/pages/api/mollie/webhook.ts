export const prerender = false;

import type { APIRoute } from "astro";
import { createMollieClient } from "@mollie/api-client";
import { updateDonationStatus } from "../../../lib/donations";

const mollieApiKey = import.meta.env.MOLLIE_API_KEY;

interface PaymentMeta {
  frequency?: string;
  amount?: string;
  currency?: string;
  locale?: string;
  context?: string;
  donationId?: string;
}

export const POST: APIRoute = async ({ request }) => {
  if (!mollieApiKey) {
    return new Response("Not configured", { status: 503 });
  }

  const mollieClient = createMollieClient({ apiKey: mollieApiKey });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const paymentId = formData.get("id") as string;
  if (!paymentId) {
    return new Response("Missing payment id", { status: 400 });
  }

  try {
    const payment = (await mollieClient.payments.get(paymentId)) as unknown as {
      status: string;
      metadata: PaymentMeta;
      customerId?: string;
    };

    const meta = payment.metadata || {};
    const currency = meta.currency || "EUR";

    // Update donation status in Turso
    await updateDonationStatus(
      paymentId,
      payment.status,
      payment.customerId,
    ).catch((err) =>
      console.error("[Turso] Failed to update donation status:", err),
    );

    // Create subscription for recurring payments
    if (payment.status === "paid" && meta.amount && payment.customerId) {
      const customerId = payment.customerId;

      if (meta.frequency === "monthly") {
        await mollieClient.customerSubscriptions.create({
          customerId,
          amount: { currency, value: meta.amount },
          interval: "1 month",
          description: `Quina Care monthly donation ${currency} ${meta.amount}`,
        });
      } else if (meta.frequency === "yearly") {
        await mollieClient.customerSubscriptions.create({
          customerId,
          amount: { currency, value: meta.amount },
          interval: "12 months",
          description: `Quina Care yearly donation ${currency} ${meta.amount}`,
        });
      }
    }

    console.log(`[Mollie] Payment ${paymentId}: ${payment.status}`, meta);

    return new Response("OK", { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Webhook processing failed";
    console.error(`[Mollie] Webhook error for ${paymentId}:`, message);
    return new Response("Error", { status: 500 });
  }
};
