export interface CurrencyConfig {
  code: string;
  symbol: string;
  precision: number;
  thousand: string;
  decimal: string;
  pattern: string; // %s = symbol, %v = value
  presets: number[];
}

export const currencies: Record<string, CurrencyConfig> = {
  nl: {
    code: "EUR",
    symbol: "€",
    precision: 2,
    thousand: ".",
    decimal: ",",
    pattern: "%s %v",
    presets: [25, 50, 100, 250],
  },
  en: {
    code: "USD",
    symbol: "$",
    precision: 2,
    thousand: ",",
    decimal: ".",
    pattern: "%s%v",
    presets: [25, 50, 100, 250],
  },
  es: {
    code: "USD",
    symbol: "$",
    precision: 2,
    thousand: ",",
    decimal: ".",
    pattern: "%s%v",
    presets: [25, 50, 100, 250],
  },
};

export function getCurrency(locale: string): CurrencyConfig {
  return currencies[locale] || currencies.en;
}

/** Payment methods available per locale (order defines display order). */
export const paymentMethodsByLocale: Record<string, string[]> = {
  // NL: iDEAL leads (~70% of NL ecommerce), then Card and PayPal.
  // Google Pay is wired in the UI but disabled until we integrate Mollie's
  // client-side Google Pay button — server-side method:"googlepay" 503s.
  nl: ["ideal", "card", "paypal"],
  // US: Card and PayPal cover the realistic Mollie methods for this market.
  en: ["card", "paypal"],
  // Ecuador: same — Mollie has no native Ecuadorian methods.
  es: ["card", "paypal"],
};

/**
 * Format an amount as currency. The second argument is either:
 *   - a locale string ("nl" / "en" / "es") - looks up that locale's
 *     currency config via getCurrency()
 *   - a CurrencyConfig object - used verbatim
 *
 * NL:    € 50,00  (symbol prefix + space + decimal comma)
 * EN/ES: $50.00   (symbol prefix, decimal dot)
 *
 * Always returns a consistent string for the same (amount, locale)
 * inputs so callers across the frontend, payment-create endpoint,
 * webhook subscription-create, and any future Markdoc/MDX usage
 * never produce two divergent forms of the same price.
 */
export function formatCurrency(
  amount: number,
  localeOrConfig: string | CurrencyConfig,
  showDecimals = true,
): string {
  const config =
    typeof localeOrConfig === "string"
      ? getCurrency(localeOrConfig)
      : localeOrConfig;
  const precision = showDecimals ? config.precision : 0;
  const fixed = Math.abs(amount).toFixed(precision);
  const [intPart, decPart] = fixed.split(".");

  // Add thousand separators
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousand);

  const value =
    precision > 0 && decPart
      ? `${formatted}${config.decimal}${decPart}`
      : formatted;

  const result = config.pattern
    .replace("%s", config.symbol)
    .replace("%v", value);

  return amount < 0 ? `-${result}` : result;
}

/**
 * Localised words used to build payment descriptions. Each language
 * follows its own grammar: Dutch and English put the frequency
 * adjective before the noun ("maandelijkse donatie" / "monthly
 * donation"), Spanish puts it after ("donación mensual"). NL also
 * declines the adjective (-e ending) when it precedes a definite
 * noun, which "donatie" effectively is here.
 *
 * Keep these strings short - the description ends up on bank
 * statements, which truncate around 22 characters on cards. A donor
 * who only sees "Quina Care maandel..." should still recognise it.
 */
const DESCRIPTION_PHRASES = {
  nl: {
    "one-time": "Quina Care donatie",
    monthly: "Quina Care maandelijkse donatie",
    quarterly: "Quina Care driemaandelijkse donatie",
    yearly: "Quina Care jaarlijkse donatie",
    fundraiserNoun: "donatie",
  },
  en: {
    "one-time": "Quina Care donation",
    monthly: "Quina Care monthly donation",
    quarterly: "Quina Care quarterly donation",
    yearly: "Quina Care yearly donation",
    fundraiserNoun: "donation",
  },
  es: {
    "one-time": "Quina Care donación",
    monthly: "Quina Care donación mensual",
    quarterly: "Quina Care donación trimestral",
    yearly: "Quina Care donación anual",
    fundraiserNoun: "donación",
  },
} as const;

/**
 * Build the donor-facing payment description used by both the first
 * payment (created by /api/mollie/create-payment) and the recurring
 * subscription (created by the Mollie webhook). Routing through a
 * single builder is the whole point - without it the first payment
 * read "Quina Care monthly donation €50" while the recurring ones
 * read "Quina Care monthly donation EUR 50.00", because each side
 * stringified the amount on its own.
 *
 * The result is what shows up on the donor's bank statement, in
 * their Mollie email receipt, and in our admin tool's payment
 * tables. Locale drives both the currency formatting AND the words
 * themselves, so a Dutch donor's statement reads in Dutch and a US
 * donor's reads in English.
 *
 *   donationDescription({ amount: 50, frequency: "monthly", locale: "nl" })
 *     => "Quina Care maandelijkse donatie € 50,00"
 *
 *   donationDescription({ amount: 50, frequency: "monthly", locale: "en" })
 *     => "Quina Care monthly donation $50.00"
 *
 *   donationDescription({ amount: 50, frequency: "monthly", locale: "es" })
 *     => "Quina Care donación mensual $50.00"
 *
 *   donationDescription({ amount: 50, locale: "nl", fundraiserTitle: "Putumayo Loop 2026" })
 *     => "Putumayo Loop 2026 - donatie € 50,00"
 */
export function donationDescription(opts: {
  amount: number;
  locale: string;
  frequency?: "one-time" | "monthly" | "quarterly" | "yearly";
  fundraiserTitle?: string;
}): string {
  const phrases =
    DESCRIPTION_PHRASES[opts.locale as keyof typeof DESCRIPTION_PHRASES] ??
    DESCRIPTION_PHRASES.en;
  const label = formatCurrency(opts.amount, opts.locale);
  const title = opts.fundraiserTitle?.trim();
  if (title) return `${title} - ${phrases.fundraiserNoun} ${label}`;
  const freq = opts.frequency ?? "one-time";
  return `${phrases[freq]} ${label}`;
}

/**
 * Parse a formatted currency string back to a number.
 * Strips symbol, thousand separators, and normalizes decimal.
 */
export function parseCurrency(input: string, config: CurrencyConfig): number {
  const cleaned = input
    .replace(config.symbol, "")
    .replaceAll(config.thousand, "")
    .replace(config.decimal, ".")
    .replace(/[^\d.-]/g, "")
    .trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
