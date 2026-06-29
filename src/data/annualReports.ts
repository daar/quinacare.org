export interface AnnualReport {
  year: number;
  /**
   * Public PDF path per language, served verbatim from public/<lang>/…
   * (nl/jaarverslagen, en/annual-reports, es/informes-anuales).
   */
  files: { nl?: string; en?: string; es?: string };
  /**
   * Cover image per language (a /media/… path under src/assets/media,
   * resolved + optimised by OptimizedImage). Used as the card thumbnail.
   */
  covers: { nl?: string; en?: string; es?: string };
}

// Newest first.
export const annualReports: AnnualReport[] = [
  {
    year: 2025,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2025.pdf",
    },
    covers: {
      nl: "/media/2026/06/Jaarverslag-Quina-Care-2025-pdf.jpg",
    },
  },
  {
    year: 2024,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2024.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2024.pdf",
      es: "/es/informes-anuales/Informe-Anual-Quina-Care-2024.pdf",
    },
    covers: {
      nl: "/media/2025/05/Jaarverslag-Quina-Care-2024.jpg",
      en: "/media/2025/07/Annual-Report-Quina-Care-2024-pdf.jpg",
      es: "/media/2025/07/Informe-Anual-Quina-Care-2024-pdf.jpg",
    },
  },
  {
    year: 2023,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2023.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2023.pdf",
      es: "/es/informes-anuales/Informe-Anual-Quina-Care-2023.pdf",
    },
    covers: {
      nl: "/media/2024/06/Jaarverslag-Quina-Care-2023-pdf.jpg",
      en: "/media/2024/10/Annual-report-2023.png",
      es: "/media/2024/10/Informe-Anual-Quina-Care-2023-pdf.jpg",
    },
  },
  {
    year: 2022,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2022.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2022.pdf",
      es: "/es/informes-anuales/Informe-Anual-Quina-Care-2022.pdf",
    },
    covers: {
      nl: "/media/2023/06/Jaarverslag-Quina-Care-2022-pdf.jpg",
      en: "/media/2023/11/Annual-report-2022.png",
      es: "/media/2023/12/Informe-Anual-Quina-Care-2022-pdf.jpg",
    },
  },
  {
    year: 2021,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2021.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2021.pdf",
    },
    covers: {
      nl: "/media/2022/06/Quina-Care-jaarverslag-2021-pdf.jpg",
      en: "/media/2023/12/Annual-Report-Quina-Care-2021-pdf.jpg",
    },
  },
  {
    year: 2020,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2020.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2020.pdf",
    },
    covers: {
      nl: "/media/2021/07/Quina-Care-Jaarverslag-2020-pdf.jpg",
      en: "/media/2021/08/Quina-Care-Annual-report-2020-pdf.jpg",
    },
  },
  {
    year: 2019,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2019.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2019.pdf",
    },
    covers: {
      nl: "/media/2020/09/Quina-Care-Jaarverslag-2019-pdf.jpg",
      en: "/media/2020/11/Quina-Care-Annual-Report-2019-pdf.jpg",
    },
  },
  {
    year: 2018,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2018.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2018.pdf",
    },
    covers: {
      nl: "/media/2019/06/Stichting-Quina-Care-Jaarverslag-2018-pdf.jpg",
      en: "/media/2019/07/Quina-Care-Annual-report-2018-pdf.jpg",
    },
  },
  {
    year: 2017,
    files: {
      nl: "/nl/jaarverslagen/Jaarverslag-Quina-Care-2017.pdf",
      en: "/en/annual-reports/Annual-Report-Quina-Care-2017.pdf",
    },
    covers: {
      nl: "/media/2018/09/Jaarverslag-2017-Stichting-Quina-Care-pdf.jpg",
      en: "/media/2018/09/Annual-Report-2017-Quina-Care-Foundation-pdf.jpg",
    },
  },
];
