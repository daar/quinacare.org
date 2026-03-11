export const prerender = false;

import type { APIRoute } from "astro";
import { createMollieClient } from "@mollie/api-client";
import {
  updateDonationStatus,
  getDonationByMollieId,
  insertDonation,
  setMollieId,
  type DonationContext,
  type DonationFrequency,
} from "../../../lib/donations";

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
      subscriptionId?: string;
    };

    const meta = payment.metadata || {};
    const currency = meta.currency || "EUR";

    // Check if this payment already has a donation record
    const existing = await getDonationByMollieId(paymentId);

    if (existing) {
      // Known payment — update its status
      await updateDonationStatus(
        paymentId,
        payment.status,
        payment.customerId,
      ).catch((err) =>
        console.error("[Turso] Failed to update donation status:", err),
      );
    } else if (payment.subscriptionId) {
      // Subscription payment without a donation record — create one
      const freq = (
        meta.frequency === "yearly" ? "yearly" : "monthly"
      ) as DonationFrequency;
      const context = (meta.context || "donate") as DonationContext;
      const amountCents = meta.amount
        ? Math.round(parseFloat(meta.amount) * 100)
        : 0;

      if (amountCents > 0) {
        try {
          const donationId = await insertDonation({
            amount_cents: amountCents,
            currency,
            frequency: freq,
            payment_method: "subscription",
            locale: meta.locale || "nl",
            context,
            metadata: { subscriptionId: payment.subscriptionId },
          });
          await setMollieId(donationId, paymentId);
          await updateDonationStatus(
            paymentId,
            payment.status,
            payment.customerId,
          );
        } catch (err) {
          console.error("[Turso] Failed to create subscription donation:", err);
        }
      }
    } else {
      // First-time payment that somehow has no record (e.g. DB was down during creation)
      // Just update — if mollie_id doesn't match, the UPDATE is a no-op
      await updateDonationStatus(
        paymentId,
        payment.status,
        payment.customerId,
      ).catch((err) =>
        console.error("[Turso] Failed to update donation status:", err),
      );
    }

    // Create subscription for recurring first payments
    if (
      payment.status === "paid" &&
      !payment.subscriptionId &&
      meta.amount &&
      payment.customerId &&
      (meta.frequency === "monthly" || meta.frequency === "yearly")
    ) {
      const customerId = payment.customerId;

      // Guard against duplicate subscriptions: check if customer already has one
      const subs = await mollieClient.customerSubscriptions
        .page({ customerId })
        .catch(() => null);
      const hasActiveSub = subs
        ? [...subs].some(
            (s: { status: string }) =>
              s.status === "active" || s.status === "pending",
          )
        : false;

      if (!hasActiveSub) {
        const origin = new URL(request.url).origin;
        const webhookUrl = `${origin}/api/mollie/webhook`;
        const interval = meta.frequency === "monthly" ? "1 month" : "12 months";

        await mollieClient.customerSubscriptions.create({
          customerId,
          amount: { currency, value: meta.amount },
          interval,
          description: `Quina Care ${meta.frequency} donation ${currency} ${meta.amount}`,
          webhookUrl,
          metadata: {
            frequency: meta.frequency,
            amount: meta.amount,
            currency,
            locale: meta.locale,
            context: meta.context,
          },
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
