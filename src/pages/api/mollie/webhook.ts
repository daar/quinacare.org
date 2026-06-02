export const prerender = false;

import type { APIRoute } from "astro";
import { createMollieClient } from "@mollie/api-client";
import {
  updateDonationStatus,
  getDonationByMollieId,
  insertDonation,
  setMollieId,
  logEvent,
  type DonationContext,
  type DonationFrequency,
} from "../../../lib/donations";
import { reportError } from "../../../lib/errors";
import { donationDescription } from "../../../lib/currency";

const SOURCE = "api/mollie/webhook";

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
      const previousStatus = existing.status;
      await updateDonationStatus(
        paymentId,
        payment.status,
        payment.customerId,
      ).catch((err) =>
        reportError(SOURCE, "updateDonationStatus failed", err, { paymentId }),
      );
      if (existing.id != null) {
        await logEvent({
          donationId: existing.id,
          type: "webhook",
          source: "webhook",
          mollieStatus: payment.status,
          previousStatus,
          payload: {
            paymentId,
            hasSubscription: Boolean(payment.subscriptionId),
          },
        });
      }
    } else if (payment.subscriptionId) {
      // Subscription payment without a donation record — create one
      const freq = ((): DonationFrequency => {
        if (meta.frequency === "yearly") return "yearly";
        if (meta.frequency === "quarterly") return "quarterly";
        return "monthly";
      })();
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
          await logEvent({
            donationId,
            type: "webhook",
            source: "webhook",
            mollieStatus: payment.status,
            previousStatus: "pending",
            payload: { paymentId, subscriptionPayment: true },
          });
        } catch (err) {
          reportError(SOURCE, "create subscription donation failed", err, {
            paymentId,
          });
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
        reportError(SOURCE, "updateDonationStatus failed", err, { paymentId }),
      );
    }

    // Create subscription for recurring first payments. Isolated from
    // the outer try/catch on purpose: a Mollie error here (mandate
    // still pending validation, customer mismatch, etc.) used to fail
    // the entire webhook with a generic 500 and an opaque "webhook
    // handler error" row — leaving the donor with a paid first payment
    // and no recurring subscription. We log it explicitly and absorb
    // the failure so Mollie doesn't retry the whole webhook forever.
    if (
      payment.status === "paid" &&
      !payment.subscriptionId &&
      meta.amount &&
      payment.customerId &&
      (meta.frequency === "monthly" ||
        meta.frequency === "quarterly" ||
        meta.frequency === "yearly")
    ) {
      const customerId = payment.customerId;
      try {
        // Guard against duplicate subscriptions: check if the customer
        // already has one. Treat the page() call's failure separately
        // so we don't silently create a duplicate when the list call
        // errors.
        const subs = await mollieClient.customerSubscriptions.page({
          customerId,
        });
        const hasActiveSub = [...subs].some(
          (s: { status: string }) =>
            s.status === "active" || s.status === "pending",
        );

        if (!hasActiveSub) {
          const origin = new URL(request.url).origin;
          const subscriptionWebhook = `${origin}/api/mollie/webhook`;
          const interval =
            meta.frequency === "monthly"
              ? "1 month"
              : meta.frequency === "quarterly"
                ? "3 months"
                : "12 months";

          // Defer the first recurring charge by one full interval.
          // Mollie's default startDate is "today", and the first
          // recurring SEPA-DD payment fires on the startDate — which
          // would double-charge the donor the same day they just
          // completed the first (iDEAL) payment. Anchor startDate to
          // today + 1 interval so the donor sees exactly one charge
          // per period, starting one period from now.
          const startDate = new Date();
          if (meta.frequency === "monthly") {
            startDate.setMonth(startDate.getMonth() + 1);
          } else if (meta.frequency === "quarterly") {
            startDate.setMonth(startDate.getMonth() + 3);
          } else {
            startDate.setFullYear(startDate.getFullYear() + 1);
          }
          const startDateStr = startDate.toISOString().slice(0, 10);

          // Route through the shared description helper so the
          // subscription's description (which Mollie reuses verbatim
          // on every recurring payment it fires) matches the first
          // payment's description byte-for-byte. Falls back to "nl"
          // if locale wasn't stamped on the original metadata - rare,
          // but the old payment-meta interface didn't always set it.
          await mollieClient.customerSubscriptions.create({
            customerId,
            amount: { currency, value: meta.amount },
            interval,
            startDate: startDateStr,
            description: donationDescription({
              amount: parseFloat(meta.amount),
              locale: meta.locale ?? "nl",
              frequency: meta.frequency as "monthly" | "quarterly" | "yearly",
            }),
            webhookUrl: subscriptionWebhook,
            metadata: {
              frequency: meta.frequency,
              amount: meta.amount,
              currency,
              locale: meta.locale,
              context: meta.context,
            },
          });
          console.log(
            `[Mollie] Subscription created for ${customerId} (${interval}, starts ${startDateStr})`,
          );
        }
      } catch (subErr) {
        // Common cause: SEPA-DD mandate from the first iDEAL/bancontact
        // payment is still in "pending" status when we get here, and
        // Mollie rejects subscription creation with "no valid mandate".
        // The mandate flips to valid within minutes; a follow-up
        // mandate webhook (or a small retry job) will reconcile.
        reportError(SOURCE, "customerSubscriptions.create failed", subErr, {
          paymentId,
          customerId,
          frequency: meta.frequency,
          amount: meta.amount,
          currency,
        });
      }
    }

    console.log(`[Mollie] Payment ${paymentId}: ${payment.status}`, meta);

    return new Response("OK", { status: 200 });
  } catch (err: unknown) {
    reportError(SOURCE, "webhook handler error", err, { paymentId });
    return new Response("Error", { status: 500 });
  }
};
