import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatCurrency,
  donationDescription,
  getCurrency,
  parseCurrency,
} from "../src/lib/currency.ts";

// ── formatCurrency ─────────────────────────────────────────────────

test("formatCurrency: NL renders symbol-prefix with space and comma decimal", () => {
  assert.equal(formatCurrency(50, "nl"), "€ 50,00");
  assert.equal(formatCurrency(1234.5, "nl"), "€ 1.234,50");
  assert.equal(formatCurrency(0.99, "nl"), "€ 0,99");
});

test("formatCurrency: EN/ES render symbol-prefix tight, dot decimal, comma thousands", () => {
  assert.equal(formatCurrency(50, "en"), "$50.00");
  assert.equal(formatCurrency(1234.5, "en"), "$1,234.50");
  assert.equal(formatCurrency(50, "es"), "$50.00");
});

test("formatCurrency: showDecimals=false drops the fractional part (rounding, not truncating)", () => {
  // Uses Number#toFixed under the hood, which rounds half-away-from-zero.
  // Document that here so a future change to truncation is a deliberate one.
  assert.equal(formatCurrency(50, "nl", false), "€ 50");
  assert.equal(formatCurrency(1234.4, "en", false), "$1,234");
  assert.equal(formatCurrency(1234.5, "en", false), "$1,235");
});

test("formatCurrency: still accepts a CurrencyConfig object for back-compat", () => {
  // Lots of existing Astro callers pass the config from getCurrency().
  // The locale-string overload must not break that path.
  const cc = getCurrency("nl");
  assert.equal(formatCurrency(50, cc), "€ 50,00");
});

test("formatCurrency: unknown locale falls back to the EN config", () => {
  assert.equal(formatCurrency(50, "fr"), formatCurrency(50, "en"));
});

test("formatCurrency: negative amounts prefix the minus sign", () => {
  assert.equal(formatCurrency(-50, "nl"), "-€ 50,00");
  assert.equal(formatCurrency(-50, "en"), "-$50.00");
});

// ── donationDescription ────────────────────────────────────────────
//
// The whole point of this helper is that the first payment (built by
// /api/mollie/create-payment) and the recurring subscription (built
// by the Mollie webhook) emit byte-identical strings for the same
// donation. Each test below pins one of the locale × frequency
// combinations that can actually be produced by our donation form.

test("donationDescription: NL monthly uses declined adjective before noun", () => {
  assert.equal(
    donationDescription({ amount: 50, locale: "nl", frequency: "monthly" }),
    "Quina Care maandelijkse donatie € 50,00",
  );
});

test("donationDescription: NL quarterly + yearly + one-time grammar", () => {
  assert.equal(
    donationDescription({ amount: 30, locale: "nl", frequency: "quarterly" }),
    "Quina Care driemaandelijkse donatie € 30,00",
  );
  assert.equal(
    donationDescription({ amount: 120, locale: "nl", frequency: "yearly" }),
    "Quina Care jaarlijkse donatie € 120,00",
  );
  assert.equal(
    donationDescription({ amount: 50, locale: "nl", frequency: "one-time" }),
    "Quina Care donatie € 50,00",
  );
});

test("donationDescription: EN monthly/quarterly/yearly/one-time", () => {
  assert.equal(
    donationDescription({ amount: 50, locale: "en", frequency: "monthly" }),
    "Quina Care monthly donation $50.00",
  );
  assert.equal(
    donationDescription({ amount: 30, locale: "en", frequency: "quarterly" }),
    "Quina Care quarterly donation $30.00",
  );
  assert.equal(
    donationDescription({ amount: 120, locale: "en", frequency: "yearly" }),
    "Quina Care yearly donation $120.00",
  );
  assert.equal(
    donationDescription({ amount: 50, locale: "en", frequency: "one-time" }),
    "Quina Care donation $50.00",
  );
});

test("donationDescription: ES puts the frequency adjective AFTER the noun", () => {
  assert.equal(
    donationDescription({ amount: 50, locale: "es", frequency: "monthly" }),
    "Quina Care donación mensual $50.00",
  );
  assert.equal(
    donationDescription({ amount: 30, locale: "es", frequency: "quarterly" }),
    "Quina Care donación trimestral $30.00",
  );
  assert.equal(
    donationDescription({ amount: 120, locale: "es", frequency: "yearly" }),
    "Quina Care donación anual $120.00",
  );
  assert.equal(
    donationDescription({ amount: 50, locale: "es", frequency: "one-time" }),
    "Quina Care donación $50.00",
  );
});

test("donationDescription: missing frequency is treated as one-time", () => {
  assert.equal(
    donationDescription({ amount: 50, locale: "nl" }),
    "Quina Care donatie € 50,00",
  );
});

test("donationDescription: fundraiser title wins over the Quina Care prefix and uses the localised noun", () => {
  assert.equal(
    donationDescription({
      amount: 50,
      locale: "nl",
      fundraiserTitle: "Putumayo Run 2026",
    }),
    "Putumayo Run 2026 - donatie € 50,00",
  );
  assert.equal(
    donationDescription({
      amount: 50,
      locale: "en",
      fundraiserTitle: "Putumayo Run 2026",
      // Frequency is ignored when a fundraiser title is set - the
      // fundraiser is the named campaign, donors don't think of it
      // as "monthly fundraiser X", they think "donation to X".
      frequency: "monthly",
    }),
    "Putumayo Run 2026 - donation $50.00",
  );
  assert.equal(
    donationDescription({
      amount: 50,
      locale: "es",
      fundraiserTitle: "Putumayo Run 2026",
    }),
    "Putumayo Run 2026 - donación $50.00",
  );
});

test("donationDescription: whitespace-only fundraiser title is treated as missing", () => {
  assert.equal(
    donationDescription({
      amount: 50,
      locale: "en",
      fundraiserTitle: "   ",
      frequency: "monthly",
    }),
    "Quina Care monthly donation $50.00",
  );
});

test("donationDescription: unknown locale falls back to EN", () => {
  // de isn't a configured locale - the helper should not crash and
  // should produce a sensible English description rather than an
  // empty string or "undefined".
  assert.equal(
    donationDescription({ amount: 50, locale: "de", frequency: "monthly" }),
    donationDescription({ amount: 50, locale: "en", frequency: "monthly" }),
  );
});

test("donationDescription: first-payment vs subscription parity for a NL €50 monthly donation", () => {
  // Reproduces the original bug: create-payment used to emit
  // "Quina Care monthly donation €50" while the webhook's
  // subscription create used "Quina Care monthly donation EUR 50.00".
  // Both paths now route through this helper - same input, same output.
  const fromCreatePayment = donationDescription({
    amount: 50,
    locale: "nl",
    frequency: "monthly",
  });
  const fromWebhook = donationDescription({
    // Webhook reads meta.amount as a "50.00" string and parses it.
    amount: parseFloat("50.00"),
    locale: "nl",
    frequency: "monthly",
  });
  assert.equal(fromCreatePayment, fromWebhook);
  assert.equal(fromCreatePayment, "Quina Care maandelijkse donatie € 50,00");
});

// ── parseCurrency (smoke-test the reverse direction) ──────────────

test("parseCurrency: round-trips through formatCurrency for each locale", () => {
  for (const locale of ["nl", "en", "es"] as const) {
    const cc = getCurrency(locale);
    for (const amount of [0, 1, 50, 1234.5]) {
      const formatted = formatCurrency(amount, cc);
      const parsed = parseCurrency(formatted, cc);
      assert.equal(
        parsed,
        amount,
        `${locale}: ${formatted} should parse back to ${amount}, got ${parsed}`,
      );
    }
  }
});
