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
    presets: [15, 25, 50, 100],
  },
  en: {
    code: "USD",
    symbol: "$",
    precision: 2,
    thousand: ",",
    decimal: ".",
    pattern: "%s%v",
    presets: [15, 25, 50, 100],
  },
  es: {
    code: "USD",
    symbol: "$",
    precision: 2,
    thousand: ".",
    decimal: ",",
    pattern: "%v %s",
    presets: [15, 25, 50, 100],
  },
};

export function getCurrency(locale: string): CurrencyConfig {
  return currencies[locale] || currencies.en;
}

/** Payment methods available per locale (order defines display order). */
export const paymentMethodsByLocale: Record<string, string[]> = {
  nl: ["ideal", "card", "paypal", "bank"],
  en: ["card", "paypal", "bank"],
  es: ["card", "paypal", "bank"],
};

export function formatCurrency(
  amount: number,
  config: CurrencyConfig,
  showDecimals = true,
): string {
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
