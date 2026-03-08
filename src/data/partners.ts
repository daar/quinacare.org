export interface Partner {
  name: string;
  logo: string;
  url?: string;
  premium?: boolean;
}

export const partners: Partner[] = [
  {
    name: "Philips",
    logo: "/media/2020/04/logo-philips.png",
    premium: false,
  },
  {
    name: "Schumacher Kramer Stichting",
    logo: "/media/2021/05/LOGO-schumacher-kramer-stichting.png",
    premium: false,
  },
  {
    name: "Insulin for Life",
    logo: "/media/2019/11/logo-insulin-for-life.png",
    url: "https://www.insulinforlife.org",
    premium: true,
  },
  {
    name: "De Wisselbeker",
    logo: "/media/2019/09/logo-de-wisselbeker.jpg",
    premium: false,
  },
  {
    name: "Lions International",
    logo: "/media/2019/04/lions-international-150px.png",
    premium: false,
  },
  {
    name: "Partin",
    logo: "/media/2019/06/logo-partin-readjust.jpg",
    url: "https://www.partin.nl",
    premium: true,
  },
  {
    name: "USFQ",
    logo: "/media/2025/01/Logo-USFQ.png",
    premium: false,
  },
  {
    name: "Wilde Ganzen",
    logo: "/media/2020/02/WILDE_GANZEN_LOGO_2019_Zonder-pay-off.jpg",
    url: "https://www.wildeganzen.nl",
    premium: true,
  },
  {
    name: "CW de Boer",
    logo: "/media/2022/12/logo-cw-de-boer.jpg",
    premium: false,
  },
  {
    name: "SSI",
    logo: "/media/2025/01/Logo-SSI.png",
    url: "https://www.ssi-surgeon.org",
    premium: true,
  },
  {
    name: "Amsterdam UMC",
    logo: "/media/2024/11/Amsterdam-UMC.png",
    url: "https://www.amsterdamumc.org",
    premium: true,
  },
  {
    name: "123 Spaans",
    logo: "/media/2026/03/123-Spaans.jpg",
    url: "https://www.123spaans.nl",
    premium: true,
  },
];

export const sponsors: Partner[] = [
  {
    name: "Zilveren Rozenkrans",
    logo: "/media/2022/10/zilveren-rozenkrans.png",
  },
  {
    name: "De Hoop",
    logo: "/media/2019/10/logo-de-hoop.png",
  },
  {
    name: "Imelda Nolet",
    logo: "/media/2019/10/name-entry-imelda-nolet.png",
  },
  {
    name: "Bloeddrukmeter Shop",
    logo: "/media/2019/10/bloeddrukmeter-shop.jpg",
  },
  {
    name: "Stichting Paulien",
    logo: "/media/2019/10/logo-stichting-paulien.jpg",
  },
  {
    name: "P.J. Rogaar",
    logo: "/media/2019/10/name-entry-pj-rogaar.png",
  },
  {
    name: "Jong",
    logo: "/media/2020/07/logo-jong.png",
  },
  {
    name: "Filadelfia",
    logo: "/media/2020/09/filadelfia.png",
  },
  {
    name: "Hendrik van Dijk Fonds",
    logo: "/media/2025/11/Hendrik-van-Dijk-Fonds.png",
  },
  {
    name: "Emmaüs Bilthoven",
    logo: "/media/2022/09/emmuas-bilthoven.jpg",
  },
  {
    name: "Z-CERT",
    logo: "/media/2021/05/z-cert.png",
  },
  {
    name: "Casterenshoeve",
    logo: "/media/2022/10/Casterenshoeve_logo_FC_pano.png",
  },
  {
    name: "GNAP",
    logo: "/media/2023/08/GNAP-logo-e1692731023698.png",
  },
  {
    name: "De Kastanje",
    logo: "/media/2021/01/de-kastanje.png",
  },
  {
    name: "Hofstede Stichting",
    logo: "/media/2020/07/hofsteeststichting.png",
  },
  {
    name: "Salem",
    logo: "/media/2023/10/logo-Salem.jpg",
  },
  {
    name: "Struan",
    logo: "/media/2020/07/struan-1.png",
  },
  {
    name: "Stichting Benevolenta",
    logo: "/media/2025/10/Stichting-Benevolenta.png",
  },
  {
    name: "PJP Stichting",
    logo: "/media/2025/11/PJP-Stichting.png",
  },
  {
    name: "Groningen Groen",
    logo: "/media/2021/04/groningen-groen.png",
  },
  {
    name: "DFF",
    logo: "/media/2026/03/DFF--scaled.png",
  },
];

export const premiumPartners = partners.filter((p) => p.premium);
