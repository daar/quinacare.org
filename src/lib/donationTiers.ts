import type { TranslationKey } from "../i18n";

export interface DonationTier {
  amount: number;
  /** FontAwesome class, e.g. "fa-solid fa-stethoscope". */
  icon: string;
  /**
   * i18n keys for the tier card's heading and body. Pointing at the
   * shared `donation.*` keys (rather than carrying inline locale
   * blocks) keeps the cards in lockstep with the donation form's
   * impact-swap copy in DonationFormCard - a single source of truth
   * lives in src/i18n/index.ts. Touch the i18n key and both the
   * /donate impact text AND the tier cards update together.
   */
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}

export const donationTiers: DonationTier[] = [
  {
    amount: 25,
    icon: "fa-solid fa-stethoscope",
    titleKey: "donation.consultation",
    descriptionKey: "donation.consultationDesc",
  },
  {
    amount: 50,
    icon: "fa-solid fa-baby",
    titleKey: "donation.prenatal",
    descriptionKey: "donation.prenatalDesc",
  },
  {
    amount: 100,
    icon: "fa-solid fa-syringe",
    titleKey: "donation.surgery",
    descriptionKey: "donation.surgeryDesc",
  },
  {
    amount: 250,
    icon: "fa-solid fa-truck-medical",
    titleKey: "donation.equipment",
    descriptionKey: "donation.equipmentDesc",
  },
];

/**
 * Pick the tier matching a donation amount: the highest tier whose
 * threshold is ≤ amount. Returns null for amounts below the lowest tier.
 */
export function tierForAmount(amount: number): DonationTier | null {
  for (let i = donationTiers.length - 1; i >= 0; i--) {
    if (amount >= donationTiers[i].amount) return donationTiers[i];
  }
  return null;
}
