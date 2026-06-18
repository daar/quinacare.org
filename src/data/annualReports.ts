export interface AnnualReport {
  year: number;
  /**
   * Public PDF path per language, served verbatim from public/<lang>/…
   * (nl/jaarverslagen, en/annual-reports, es/informes-anuales). A year
   * without a given language is simply omitted from that language's page —
   * add the key here (and drop the PDF in the folder) to make it appear.
   */
  files: { nl?: string; en?: string; es?: string };
}

// Newest first.
export const annualReports: AnnualReport[] = [
  {
    year: 2024,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2024.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2024.pdf",
      es: "/es/informes-anuales/Informe-Anual-Quina-Care-2024.pdf",
    },
  },
  {
    year: 2023,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2023.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2023.pdf",
      es: "/es/informes-anuales/Informe-Anual-Quina-Care-2023.pdf",
    },
  },
  {
    year: 2022,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2022.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2022.pdf",
      es: "/es/informes-anuales/Informe-Anual-Quina-Care-2022.pdf",
    },
  },
  {
    year: 2021,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2021.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2021.pdf",
    },
  },
  {
    year: 2020,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2020.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2020.pdf",
    },
  },
  {
    year: 2019,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2019.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2019.pdf",
    },
  },
  {
    year: 2018,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2018.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2018.pdf",
    },
  },
  {
    year: 2017,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2017.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2017.pdf",
    },
  },
];
