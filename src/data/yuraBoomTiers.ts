// Quina Yura sponsor tiers — single source of truth for the three
// fixed-amount tier cards on the /yura-boom page (Blaadje / Mango /
// Huisje). The image, the amount used by the donation flow, and the
// per-locale display strings all live here so editing copy or prices
// is a one-file change instead of nine (3 cards × 3 languages).
//
// The "Anders" (other) tier is intentionally NOT in here — it has no
// fixed amount and is rendered separately on the page.

import type { Lang } from "../i18n";

export interface YuraBoomTierCopy {
  /** Display name of the tier, e.g. "Blaadje" / "Leaf" / "Hoja". */
  title: string;
  /** Display price string, e.g. "€10" / "€17,50". */
  price: string;
  /** Cadence label shown under the price, e.g. "per maand". */
  frequency: string;
  /** One-sentence impact statement explaining what the donation funds. */
  impact: string;
  /** Yearly-equivalent line, e.g. "€120 per jaar". */
  yearly: string;
}

export interface YuraBoomTier {
  /** Stable identifier, used as the metadata.tier on the Mollie payment. */
  id: "leaf" | "mango" | "house";
  /** Path to the tier's illustration under /public. */
  image: string;
  /**
   * Numeric amount in euros, sent to Mollie as the donation amount.
   * Use a decimal for fractional amounts (e.g. 17.5 for Mango).
   */
  amount: number;
  /**
   * If true, the card renders with the "featured" emphasis (red ring,
   * primary CTA). At most one tier should be featured.
   */
  featured?: boolean;
  /** Per-locale strings. Every supported language must be present. */
  i18n: Record<Lang, YuraBoomTierCopy>;
}

export const yuraBoomTiers: YuraBoomTier[] = [
  {
    id: "leaf",
    image: "/images/yura-boom/leaf.webp",
    amount: 10,
    i18n: {
      nl: {
        title: "Blaadje",
        price: "€10",
        frequency: "per maand",
        impact: "Met uw donatie ondersteund u bijvoorbeeld 3 kinderconsulten.",
        yearly: "€120 per jaar",
      },
      en: {
        title: "Leaf",
        price: "€10",
        frequency: "per month",
        impact:
          "With your donation you support, for example, 3 children's consultations.",
        yearly: "€120 per year",
      },
      es: {
        title: "Hoja",
        price: "€10",
        frequency: "por mes",
        impact: "Con tu donación apoyas, por ejemplo, 3 consultas pediátricas.",
        yearly: "€120 por año",
      },
    },
  },
  {
    id: "mango",
    image: "/images/yura-boom/mango.webp",
    amount: 17.5,
    featured: true,
    i18n: {
      nl: {
        title: "Mango",
        price: "€17,50",
        frequency: "per maand",
        impact:
          "Met uw donatie ondersteund u bijvoorbeeld de begeleiding van een zwangere tijdens haar zwangerschap",
        yearly: "€210 per jaar",
      },
      en: {
        title: "Mango",
        price: "€17.50",
        frequency: "per month",
        impact:
          "With your donation you support, for example, the care of a pregnant woman throughout her pregnancy",
        yearly: "€210 per year",
      },
      es: {
        title: "Mango",
        price: "€17,50",
        frequency: "por mes",
        impact:
          "Con tu donación apoyas, por ejemplo, el seguimiento de una mujer embarazada durante su embarazo",
        yearly: "€210 por año",
      },
    },
  },
  {
    id: "house",
    image: "/images/yura-boom/house.webp",
    amount: 25,
    i18n: {
      nl: {
        title: "Huisje",
        price: "€25",
        frequency: "per maand",
        impact:
          "Met uw donatie ondersteund u bijvoorbeeld een ziekenhuisovernachting voor een patient",
        yearly: "€300 per jaar",
      },
      en: {
        title: "House",
        price: "€25",
        frequency: "per month",
        impact:
          "With your donation you support, for example, an overnight hospital stay for a patient",
        yearly: "€300 per year",
      },
      es: {
        title: "Casita",
        price: "€25",
        frequency: "por mes",
        impact:
          "Con tu donación apoyas, por ejemplo, una noche de hospitalización para un paciente",
        yearly: "€300 por año",
      },
    },
  },
];
