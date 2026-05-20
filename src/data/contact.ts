import type { Lang } from "../i18n";

export interface ContactDetails {
  /** Address shown and used in the mailto: link. */
  email: string;
  /** Human-readable phone number as displayed. */
  phone: string;
  /** Phone in international format for the tel: link, e.g. "+31630366030". */
  phoneHref: string;
  /** Address lines — rendered one below the other. */
  address: string[];
  /** Bank account number (IBAN). */
  bankAccount: string;
}

/**
 * Footer contact details per language. Edit the values here; the footer
 * (and any other consumer) picks the entry matching the active locale.
 */
export const contactByLang: Record<Lang, ContactDetails> = {
  nl: {
    email: "care@quinacare.org",
    phone: "06-30 366 030",
    phoneHref: "+31630366030",
    address: ["IJsvogellaan 76", "2261 DK Leidschendam"],
    bankAccount: "NL44 TRIO 0338 5550 48",
  },
  en: {
    email: "care@quinacare.org",
    phone: "+31 6 30 36 60 30",
    phoneHref: "+31630366030",
    address: ["IJsvogellaan 76", "2261 DK Leidschendam", "The Netherlands"],
    bankAccount: "NL44 TRIO 0338 5550 48 (BIC: TRIONL2U)",
  },
  es: {
    email: "hospitalsanmiguel@quinacare.org",
    phone: "+593 98 015 9182",
    phoneHref: "+593980159182",
    address: ["IJsvogellaan 76", "2261 DK Leidschendam", "Países Bajos"],
    bankAccount: "2100186477 (Banco Pichincha, Ecuador — BIC: PICHECEQ)",
  },
};
