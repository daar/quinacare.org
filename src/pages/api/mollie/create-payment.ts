export const prerender = false;

import type { APIRoute } from "astro";
import {
  createMollieClient,
  Locale,
  PaymentMethod,
  SequenceType,
} from "@mollie/api-client";
import { getCurrency } from "../../../lib/currency";
import {
  insertDonation,
  setMollieId,
  logEvent,
  type DonationContext,
  type DonationFrequency,
} from "../../../lib/donations";
import { reportError } from "../../../lib/errors";

const SOURCE = "api/mollie/create-payment";

const mollieApiKey = import.meta.env.MOLLIE_API_KEY;

const methodMap: Record<string, PaymentMethod> = {
  card: PaymentMethod.creditcard,
  ideal: PaymentMethod.ideal,
  paypal: PaymentMethod.paypal,
  // The Mollie API accepts "googlepay" but the SDK enum hasn't caught up
  // (as of @mollie/api-client@4.5.0). Cast the literal until they update.
  googlepay: "googlepay" as PaymentMethod,
};

const localeMap: Record<string, Locale> = {
  nl: Locale.nl_NL,
  en: Locale.en_US,
  es: Locale.es_ES,
};

const validContexts = new Set<DonationContext>([
  "donate",
  "yura-boom",
  "fundraiser",
]);
const validFrequencies = new Set<DonationFrequency>([
  "one-time",
  "monthly",
  "quarterly",
  "yearly",
]);

interface RequestBody {
  amount: number;
  frequency: string;
  method: string;
  locale: string;
  context?: string;
  metadata?: Record<string, unknown>;
  /**
   * Optional override for the Mollie description sent to the payment
   * provider (and onto the donor's bank statement). When non-empty it
   * is used verbatim instead of the auto-built default. Useful for
   * single-campaign pages that need a short, recognisable name to
   * survive the bank-statement truncation cap.
   */
  description?: string;
}

export const POST: APIRoute = async ({ request }) => {
  if (!mollieApiKey) {
    return new Response(
      JSON.stringify({ error: "Payment service not configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const mollieClient = createMollieClient({ apiKey: mollieApiKey });

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

  const mollieLocale = localeMap[locale] || Locale.en_US;
  const currencyConfig = getCurrency(locale);
  const currency = currencyConfig.code;
  const requestOrigin = new URL(request.url).origin;
  const langPrefix = locale === "nl" ? "" : `/${locale}`;

  // Mollie rejects localhost webhook URLs. Two paths:
  //   - Plain `astro dev` on localhost: skip the webhook entirely so
  //     create() doesn't fail, accepting that no callback will fire.
  //   - Dev with a tunnel (ngrok / cloudflared): set
  //     PUBLIC_WEBHOOK_ORIGIN=https://xyz.ngrok-free.app to route
  //     both the webhook AND the return URL through the public tunnel,
  //     so end-to-end recurring testing actually works locally.
  const publicOrigin = import.meta.env.PUBLIC_WEBHOOK_ORIGIN as
    | string
    | undefined;
  const origin = publicOrigin?.trim() || requestOrigin;
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const webhookUrl = isLocal ? undefined : `${origin}/api/mollie/webhook`;

  const isRecurring =
    freq === "monthly" || freq === "quarterly" || freq === "yearly";
  const amountLabel = `${currencyConfig.symbol}${amount}`;
  const fundraiserTitle =
    context === "fundraiser" && typeof metadata?.fundraiser_title === "string"
      ? metadata.fundraiser_title.trim()
      : "";
  // If the caller supplied an explicit description, use it verbatim —
  // this lets single-campaign pages send a short, recognisable name
  // (e.g. "Putumayo Loop 2026") that survives the ~22-char card-
  // statement truncation. Otherwise fall back to the auto-built
  // fundraiser / recurring / default forms.
  const explicitDescription =
    typeof body.description === "string" ? body.description.trim() : "";
  const description = explicitDescription
    ? explicitDescription
    : fundraiserTitle
      ? `${fundraiserTitle} - donation ${amountLabel}`
      : isRecurring
        ? `Quina Care ${freq} donation ${amountLabel}`
        : `Quina Care donation ${amountLabel}`;

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
    reportError(SOURCE, "insertDonation failed", err);
    // Continue without DB — payment still works, webhook will log
  }

  if (donationId) {
    await logEvent({
      donationId,
      type: "created",
      source: "server",
      payload: { context, method, amount, frequency: freq, locale },
    });
  }

  // Build the return URL with the donationId so the return page can
  // verify even when sessionStorage is empty (some iDEAL flows return
  // in a new tab/browser, losing sessionStorage).
  const returnUrl = donationId
    ? `${origin}${langPrefix}/donate/return?context=${context}&donationId=${donationId}`
    : `${origin}${langPrefix}/donate/return?context=${context}`;

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
          reportError(SOURCE, "setMollieId failed", err, {
            paymentId: payment.id,
          }),
        );
        await logEvent({
          donationId,
          type: "mollie_payment_created",
          source: "server",
          mollieStatus: "pending",
          payload: { paymentId: payment.id, recurring: true },
        });
      }

      return new Response(
        JSON.stringify({
          checkoutUrl: payment.getCheckoutUrl(),
          paymentId: payment.id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
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
        reportError(SOURCE, "setMollieId failed", err, {
          paymentId: payment.id,
        }),
      );
      await logEvent({
        donationId,
        type: "mollie_payment_created",
        source: "server",
        mollieStatus: "pending",
        payload: { paymentId: payment.id, recurring: false },
      });
    }

    return new Response(
      JSON.stringify({
        checkoutUrl: payment.getCheckoutUrl(),
        paymentId: payment.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Payment creation failed";
    if (donationId) {
      await logEvent({
        donationId,
        type: "mollie_payment_failed",
        source: "server",
        payload: { error: message },
      });
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
