import {
  createMollieClient,
  type MollieClient,
  Locale,
  PaymentMethod,
} from "@mollie/api-client";

let clientInstance: MollieClient | null = null;

export interface MollieConfig {
  apiKey: string;
  testMode: boolean;
  webhookUrl?: string;
}

export function getMollieConfig(): MollieConfig {
  const apiKey = import.meta.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error("MOLLIE_API_KEY is not configured");
  return {
    apiKey,
    testMode: apiKey.startsWith("test_"),
    webhookUrl: import.meta.env.MOLLIE_WEBHOOK_URL || undefined,
  };
}

export function getMollieClient(): MollieClient {
  if (!clientInstance) {
    const { apiKey } = getMollieConfig();
    clientInstance = createMollieClient({ apiKey });
  }
  return clientInstance;
}

/** Derive the webhook URL from config or request origin. Returns undefined for localhost. */
export function getWebhookUrl(request: Request): string | undefined {
  const config = getMollieConfig();
  if (config.webhookUrl) return config.webhookUrl;

  const origin = new URL(request.url).origin;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return undefined;
  }
  return `${origin}/api/mollie/webhook`;
}

export const methodMap: Record<string, PaymentMethod> = {
  card: PaymentMethod.creditcard,
  ideal: PaymentMethod.ideal,
  paypal: PaymentMethod.paypal,
  bank: PaymentMethod.banktransfer,
};

export const localeMap: Record<string, Locale> = {
  nl: Locale.nl_NL,
  en: Locale.en_US,
  es: Locale.es_ES,
};
