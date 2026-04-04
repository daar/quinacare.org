export const prerender = false;

import type { APIRoute } from "astro";
import { SequenceType } from "@mollie/api-client";
import { getCurrency } from "../../../lib/currency";
import {
  getMollieClient,
  getWebhookUrl,
  methodMap,
  localeMap,
} from "../../../lib/mollie";
import {
  insertDonation,
  setMollieId,
  type DonationContext,
  type DonationFrequency,
} from "../../../lib/donations";

const validContexts = new Set<DonationContext>([
  "donate",
  "yura-boom",
  "fundraiser",
]);
const validFrequencies = new Set<DonationFrequency>([
  "one-time",
  "monthly",
  "yearly",
]);

interface RequestBody {
  amount: number;
  frequency: string;
  method: string;
  locale: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export const POST: APIRoute = async ({ request }) => {
  let mollieClient;
  try {
    mollieClient = getMollieClient();
  } catch {
    return new Response(
      JSON.stringify({ error: "Payment service not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { amount, frequency, method, locale, metadata } = body;
  const context = (
    validContexts.has(body.context as DonationContext) ? body.context : "donate"
  ) as DonationContext;
  const freq = (
    validFrequencies.has(frequency as DonationFrequency)
      ? frequency
      : "one-time"
  ) as DonationFrequency;

  if (!amount || amount < 1 || amount > 50000) {
    return new Response(JSON.stringify({ error: "Invalid amount" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mollieMethod = methodMap[method];
  if (!mollieMethod) {
    return new Response(JSON.stringify({ error: "Invalid payment method" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mollieLocale = localeMap[locale] || localeMap.en;
  const currencyConfig = getCurrency(locale);
  const currency = currencyConfig.code;
  const origin = new URL(request.url).origin;
  const langPrefix = locale === "nl" ? "" : `/${locale}`;
  const returnUrl = `${origin}${langPrefix}/donate/return?context=${context}`;
  const webhookUrl = getWebhookUrl(request);

  const isRecurring = freq === "monthly" || freq === "yearly";
  const description = isRecurring
    ? `Quina Care ${freq} donation ${currencyConfig.symbol}${amount}`
    : `Quina Care donation ${currencyConfig.symbol}${amount}`;

  // Insert pending donation in Turso
  let donationId: number | undefined;
  try {
    donationId = await insertDonation({
      amount_cents: Math.round(amount * 100),
      currency,
      frequency: freq,
      payment_method: method,
      locale,
      context,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error("[Turso] Failed to insert donation:", err);
  }

  try {
    if (isRecurring) {
      const customer = (await mollieClient.customers.create({
        name: "Quina Care Donor",
        locale: mollieLocale,
      })) as unknown as { id: string };

      const payment = (await mollieClient.payments.create({
        amount: { currency, value: amount.toFixed(2) },
        description,
        redirectUrl: returnUrl,
        webhookUrl,
        method: mollieMethod,
        locale: mollieLocale,
        sequenceType: SequenceType.first,
        customerId: customer.id,
        metadata: {
          frequency: freq,
          amount: amount.toFixed(2),
          currency,
          locale,
          context,
          donationId: donationId?.toString() ?? "",
        },
      })) as unknown as { id: string; getCheckoutUrl(): string | null };

      if (donationId) {
        await setMollieId(donationId, payment.id).catch((err) =>
          console.error("[Turso] Failed to set mollie_id:", err),
        );
      }

      return new Response(
        JSON.stringify({
          checkoutUrl: payment.getCheckoutUrl(),
          paymentId: payment.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const payment = (await mollieClient.payments.create({
      amount: { currency, value: amount.toFixed(2) },
      description,
      redirectUrl: returnUrl,
      webhookUrl,
      method: mollieMethod,
      locale: mollieLocale,
      metadata: {
        frequency: "one-time",
        currency,
        locale,
        context,
        donationId: donationId?.toString() ?? "",
      },
    })) as unknown as { id: string; getCheckoutUrl(): string | null };

    if (donationId) {
      await setMollieId(donationId, payment.id).catch((err) =>
        console.error("[Turso] Failed to set mollie_id:", err),
      );
    }

    return new Response(
      JSON.stringify({
        checkoutUrl: payment.getCheckoutUrl(),
        paymentId: payment.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Payment creation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
