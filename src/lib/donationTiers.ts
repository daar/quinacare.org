import type { Lang } from "../i18n";

export interface DonationTierCopy {
  title: string;
  description: string;
}

export interface DonationTier {
  amount: number;
  /** FontAwesome class, e.g. "fa-solid fa-stethoscope". */
  icon: string;
  i18n: Record<Lang, DonationTierCopy>;
}

export const donationTiers: DonationTier[] = [
  {
    amount: 25,
    icon: "fa-solid fa-stethoscope",
    i18n: {
      nl: {
        title: "Consult & Diagnostiek",
        description:
          "Met je donatie financier je een volledig consult inclusief laboratoriumonderzoek en medicatie voor een patiënt.",
      },
      en: {
        title: "Consultation & Diagnostics",
        description:
          "With your donation you fund a full consultation including laboratory tests and medication for a patient.",
      },
      es: {
        title: "Consulta y Diagnóstico",
        description:
          "Con tu donación financias una consulta completa incluyendo análisis de laboratorio y medicación para un paciente.",
      },
    },
  },
  {
    amount: 50,
    icon: "fa-solid fa-baby",
    i18n: {
      nl: {
        title: "Prenatale Check-up",
        description:
          "Een volledige medische controle inclusief echo voor een aanstaande moeder, essentieel voor een veilige bevalling.",
      },
      en: {
        title: "Prenatal Check-up",
        description:
          "A complete medical check-up including ultrasound for an expectant mother, essential for a safe delivery.",
      },
      es: {
        title: "Control Prenatal",
        description:
          "Un control médico completo incluyendo ecografía para una futura madre, esencial para un parto seguro.",
      },
    },
  },
  {
    amount: 100,
    icon: "fa-solid fa-syringe",
    i18n: {
      nl: {
        title: "Levensreddende Ingreep",
        description:
          "Draag bij aan de kosten van chirurgische ingrepen en de noodzakelijke nabehandeling in ons ziekenhuis.",
      },
      en: {
        title: "Life-saving Procedure",
        description:
          "Contribute to the costs of surgical procedures and necessary aftercare at our hospital.",
      },
      es: {
        title: "Procedimiento que Salva Vidas",
        description:
          "Contribuye a los costos de procedimientos quirúrgicos y el cuidado posterior necesario en nuestro hospital.",
      },
    },
  },
  {
    amount: 250,
    icon: "fa-solid fa-truck-medical",
    i18n: {
      nl: {
        title: "Apparatuur & Voorraad",
        description:
          "Met je donatie financier je medische apparatuur of essentiële voorraden waar het ziekenhuis maandenlang van profiteert.",
      },
      en: {
        title: "Equipment & Supplies",
        description:
          "With your donation you help fund medical equipment or essential supplies that keep the hospital running for months.",
      },
      es: {
        title: "Equipos y Suministros",
        description:
          "Con tu donación ayudas a financiar equipos médicos o suministros esenciales que mantienen el hospital funcionando durante meses.",
      },
    },
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
