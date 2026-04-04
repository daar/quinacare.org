export const prerender = false;

import type { APIRoute } from "astro";
import { getMollieClient, getWebhookUrl } from "../../../lib/mollie";
import {
  updateDonationStatus,
  getDonationByMollieId,
  insertDonation,
  setMollieId,
  upsertSubscription,
  type DonationContext,
  type DonationFrequency,
} from "../../../lib/donations";

interface PaymentMeta {
  frequency?: string;
  amount?: string;
  currency?: string;
  locale?: string;
  context?: string;
  donationId?: string;
}

export const POST: APIRoute = async ({ request }) => {
  let mollieClient;
  try {
    mollieClient = getMollieClient();
  } catch {
    return new Response("Not configured", { status: 503 });
  }

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
        const webhookUrl = getWebhookUrl(request);
        const interval = meta.frequency === "monthly" ? "1 month" : "12 months";

        const description = `Quina Care ${meta.frequency} donation ${currency} ${meta.amount}`;

        await mollieClient.customerSubscriptions.create({
          customerId,
          amount: { currency, value: meta.amount },
          interval,
          description,
          webhookUrl,
          metadata: {
            frequency: meta.frequency,
            amount: meta.amount,
            currency,
            locale: meta.locale,
            context: meta.context,
          },
        });

        // Track subscription in Turso
        const subList = await mollieClient.customerSubscriptions
          .page({ customerId })
          .catch(() => null);
        if (subList) {
          for (const sub of subList) {
            const s = sub as unknown as {
              id: string;
              status: string;
              amount: { currency: string; value: string };
              interval: string;
              description: string;
              method: string;
            };
            await upsertSubscription({
              mollie_subscription_id: s.id,
              mollie_customer_id: customerId,
              currency: s.amount.currency,
              amount_cents: Math.round(parseFloat(s.amount.value) * 100),
              interval: s.interval,
              description: s.description,
              method: s.method,
              status: s.status,
            }).catch((err) =>
              console.error("[Turso] Failed to upsert subscription:", err),
            );
          }
        }
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
