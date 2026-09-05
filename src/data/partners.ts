export interface Partner {
  name: string;
  logo: string;
  url?: string;
  premium?: boolean;
}

export const partners: Partner[] = [
  {
    name: "Insulin for Life",
    logo: "/media/2019/11/logo-insulin-for-life.png",
    url: "https://www.insulinforlife.org",
    premium: true,
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
    url: "https://www.usfq.edu.ec/en",
    premium: true,
  },
  {
    name: "Wilde Ganzen",
    logo: "/media/2020/02/WG_logo_RGB_blauw.png",
    url: "https://www.wildeganzen.nl",
    premium: true,
  },
  {
    name: "SSI",
    logo: "/media/2025/01/Logo-SSI.png",
    url: "https://www.sustainablesciences.org",
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
    url: "https://123spaanscursus.nl",
    premium: true,
  },
];

export const sponsors: Partner[] = [
  {
    name: 'Stichting "De Zilveren Rozenkrans"',
    logo: "",
    url: "https://stichting.moment.online/stichting-de-zilveren-rozenkrans",
  },
  {
    name: "W.M. De Hoop Stichting",
    logo: "/media/2019/10/logo-de-hoop.png",
    url: "https://www.wmdehoopstichting.nl",
  },
  {
    name: "Stichting Imelda Nolet",
    logo: "",
    url: "https://stichtingimelda-nolet.nl",
  },
  {
    name: "Bloeddrukmeter Shop",
    logo: "/media/2019/10/bloeddrukmeter-shop.jpg",
    url: "https://bloeddrukmeter.shop",
  },
  {
    name: "Stichting Paulien",
    logo: "/media/2019/10/logo-stichting-paulien.jpg",
    url: "https://www.stichtingpaulien.nl",
  },
  {
    name: "P.J. Rogaar Stichting",
    logo: "",
    url: "http://pjrogaar.nl",
  },
  {
    name: "Stichting Jong",
    logo: "/media/2020/07/logo-jong.png",
    url: "https://stichting-jong.nl",
  },
  {
    name: "Stichting Filadelfia",
    logo: "",
  },
  {
    name: "Hendrik van Dijk Fonds",
    logo: "",
    url: "https://www.vandijkgroep.nl/hendrik-van-dijk-fonds/",
  },
  {
    name: "Emmaüs Bilthoven",
    logo: "/media/2022/09/emmuas-bilthoven.jpg",
    url: "https://emmaus-bilthoven.nl",
  },
  {
    name: "Z-CERT",
    logo: "/media/2021/05/z-cert.png",
    url: "https://z-cert.nl",
  },
  {
    name: "Casterenshoeve",
    logo: "/media/2022/10/Casterenshoeve_logo_FC_pano.png",
    url: "https://casterenshoeve.nl",
  },
  {
    name: "Stichting GNAP",
    logo: "/media/2023/08/GNAP-logo-e1692731023698.png",
    url: "https://stichtinggnap.webnode.nl",
  },
  {
    name: "Stichting De Kastanje",
    logo: "",
    url: "https://stichtingdekastanje.nl",
  },
  {
    name: "Hofstee Stichting",
    logo: "/media/2020/07/hofsteeststichting.png",
    url: "https://hofsteestichting.nl",
  },
  {
    name: "Stichting Salem",
    logo: "/media/2023/10/logo-Salem.jpg",
    url: "https://www.salem-ermelo.nl",
  },
  {
    name: "Struan",
    logo: "/media/2020/07/struan-1.png",
    url: "https://struan.nl",
  },
  {
    name: "Stichting Benevolenta",
    logo: "/media/2025/10/Stichting-Benevolenta.png",
  },
  {
    name: "PJP Stichting",
    logo: "",
    url: "https://stichting.moment.online/stichting-pjp",
  },
  {
    name: "Groningen Groen",
    logo: "/media/2021/04/groningen-groen.png",
  },
  {
    name: "DFF",
    logo: "/media/2026/03/DFF--scaled.png",
    url: "https://dutchflowerfoundation.nl",
  },
  {
    name: "Philips",
    logo: "/media/2020/04/logo-philips.png",
    url: "https://www.philips-foundation.com",
  },
  {
    name: "Schumacher Kramer Stichting",
    logo: "/media/2021/05/LOGO-schumacher-kramer-stichting.png",
    url: "https://skf.nl",
  },
  {
    name: "De Wisselbeker",
    logo: "/media/2019/09/logo-de-wisselbeker.jpg",
    url: "https://wisselbeker.nl",
  },
  {
    name: "Lions International",
    logo: "/media/2019/04/lions-international-150px.png",
    url: "https://lions-nootdorp-pijnacker.nl",
  },
  {
    name: "CW de Boer",
    logo: "/media/2022/12/logo-cw-de-boer.jpg",
    url: "https://www.cwdeboerstichting.nl",
  },
  {
    name: "Pelgrimshoeve Snuffelmarkt",
    logo: "/media/2026/09/logo-pelgrimshoeve-snuffelmarkt.png",
    url: "https://pelgrimshoeve.nl",
  },
];

export const premiumPartners = partners.filter((p) => p.premium);
