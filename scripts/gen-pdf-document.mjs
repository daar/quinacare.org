// Generate newsletter news posts from the PDFs in public/<lang>/<dir>.
//
// For every newsletter PDF it:
//   1. rasterises the first page to a cover JPG under src/assets/media,
//      cropped from the top to A4 portrait (tall single-page newsletters
//      would otherwise produce extremely tall covers),
//   2. writes a published news post (NL/EN/ES) with a general invite
//      body + a {% download-card %} linking the PDF.
//
// Posts of the same newsletter across languages share a slug so the
// language switcher lines them up. Re-running is idempotent: it
// overwrites the covers and posts it manages.
//
// Usage (from the repo root):  node scripts/gen-pdf-document.mjs
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import sharp from "sharp";

// Cover render width and target aspect ratio (A4 portrait).
const COVER_W = 600;
const COVER_H = Math.round(COVER_W * 1.414);

const ROOT = process.cwd();
const dirs = {
  nl: { pubdir: "public/nl/nieuwsbrieven", urldir: "nl/nieuwsbrieven" },
  en: { pubdir: "public/en/newsletters", urldir: "en/newsletters" },
  es: { pubdir: "public/es/boletines", urldir: "es/boletines" },
};

const monthSeg = {
  januari: 1,
  februari: 2,
  maart: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  augustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12,
  january: 1,
  february: 2,
  march: 3,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  october: 10,
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
const monthName = {
  nl: [
    "",
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ],
  en: [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  es: [
    "",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const label = { nl: "Nieuwsbrief", en: "Newsletter", es: "Boletín" };

// Native per-language slug from the canonical (NL-based) slug. The canonical
// stays the cross-language translationKey so the switcher can link variants.
function nativeSlug(slug, lang) {
  if (lang === "en" && slug.startsWith("nieuwsbrief-"))
    return "newsletter-" + slug.slice("nieuwsbrief-".length);
  if (lang === "es" && slug.startsWith("nieuwsbrief-"))
    return "boletin-" + slug.slice("nieuwsbrief-".length);
  return slug;
}

const invite = {
  nl: "Elke paar maanden versturen we een nieuwsbrief met updates over ons werk in Ecuador, de mensen achter de missie en de voortgang van onze projecten. Benieuwd? Download de nieuwsbrief hieronder en lees met ons mee.",
  en: "Every few months we send out a newsletter with updates about our work in Ecuador, the people behind the mission and the progress of our projects. Curious? Download the newsletter below and read along with us.",
  es: "Cada pocos meses enviamos un boletín informativo con novedades sobre nuestro trabajo en Ecuador, las personas detrás de la misión y el avance de nuestros proyectos. ¿Sientes curiosidad? Descarga el boletín a continuación y acompáñanos.",
};
const excerpt = {
  nl: "Elke paar maanden versturen we een nieuwsbrief met updates over ons werk in Ecuador, de mensen achter de missie en de voortgang van onze projecten.",
  en: "Every few months we send out a newsletter with updates about our work in Ecuador, the people behind the mission and the progress of our projects.",
  es: "Cada pocos meses enviamos un boletín informativo con novedades sobre nuestro trabajo en Ecuador, las personas detrás de la misión y el avance de nuestros proyectos.",
};

// Files with no clean month/year in the name, or special semantics.
const special = {
  "Quina-Care-Extra-Nieuwsbrief-Opening-Hospital-San-Miguel.pdf": {
    slug: "nieuwsbrief-opening-hospital-san-miguel",
    year: 2021,
    mm: 12,
    day: 13,
    cardTitle: "Opening Hospital San Miguel",
    postTitle: "Extra nieuwsbrief – Opening Hospital San Miguel",
  },
  "Quina-Care-extra-newsletter.pdf": {
    slug: "newsletter-extra-2022",
    year: 2022,
    mm: 7,
    day: 13,
    cardTitle: "Extra newsletter",
    postTitle: "Extra newsletter",
  },
  "Nieuwsbrief-ES.pdf": {
    slug: "boletin-julio-2024",
    year: 2024,
    mm: 7,
    day: 13,
    cardTitle: "Julio 2024",
    postTitle: "Boletín julio 2024",
  },
  "Nieuwsbrief-3e-kwartaal-2024.pdf": {
    slug: "nieuwsbrief-2024-q3",
    year: 2024,
    mm: 9,
    day: 1,
    cardTitle: "3e kwartaal 2024",
    postTitle: "Nieuwsbrief 3e kwartaal 2024",
  },
  "Newsletter-3rd-Quarter-2024.pdf": {
    slug: "nieuwsbrief-2024-q3",
    year: 2024,
    mm: 9,
    day: 1,
    cardTitle: "Q3 2024",
    postTitle: "Newsletter Q3 2024",
  },
};

function parse(fn) {
  const segs = fn
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .split(/[-_]/);
  let month = null,
    year = null;
  for (const s of segs)
    if (month == null && monthSeg[s] != null) month = monthSeg[s];
  for (const s of segs)
    if (/^20\d\d$/.test(s)) {
      year = parseInt(s);
      break;
    }
  if (year == null)
    for (const s of segs)
      if (/^\d{2}$/.test(s)) {
        year = 2000 + parseInt(s);
        break;
      }
  return { month, year };
}

const posts = [];
for (const [lang, d] of Object.entries(dirs)) {
  const files = fs
    .readdirSync(path.join(ROOT, d.pubdir))
    .filter((f) => f.toLowerCase().endsWith(".pdf"));
  for (const fn of files) {
    let slug,
      year,
      mm,
      day = 1,
      cardTitle,
      postTitle;
    if (special[fn]) {
      ({ slug, year, mm, day, cardTitle, postTitle } = special[fn]);
    } else {
      const { month, year: y } = parse(fn);
      if (!month || !y) {
        console.error("UNPARSED", lang, fn);
        continue;
      }
      year = y;
      mm = month;
      slug = `nieuwsbrief-${year}-${String(mm).padStart(2, "0")}`;
      const mn = monthName[lang][mm];
      cardTitle = `${cap(mn)} ${year}`;
      postTitle =
        lang === "nl"
          ? `Nieuwsbrief ${mn} ${year}`
          : lang === "en"
            ? `Newsletter ${mn} ${year}`
            : `Boletín ${mn} ${year}`;
    }
    const mm2 = String(mm).padStart(2, "0");
    const date = `${year}-${mm2}-${String(day).padStart(2, "0")}`;
    posts.push({
      lang,
      fn,
      year,
      mm2,
      slug,
      date,
      cardTitle,
      postTitle,
      pdfAbs: path.join(ROOT, d.pubdir, fn),
      coverAbs: path.join(
        ROOT,
        `src/assets/media/${year}/${mm2}/${slug}-${lang}.jpg`,
      ),
      coverMediaPath: `/media/${year}/${mm2}/${slug}-${lang}.jpg`,
      featuredRel: `../../../../assets/media/${year}/${mm2}/${slug}-${lang}.jpg`,
      href: `/${d.urldir}/${fn}`,
    });
  }
}

// Read the MediaBox/CropBox (PDF points). pdftocairo rasterises the
// MediaBox, but for these email-to-PDF exports the CropBox is the actual
// visible newsletter — and the email header (date/From/To) lives in the
// surrounding MediaBox margin, outside it. So rendering the CropBox gives
// the real masthead with no email chrome.
function pageBoxes(pdfAbs) {
  const out = execSync(
    `pdfinfo -box -f 1 -l 1 ${JSON.stringify(pdfAbs)}`,
  ).toString();
  const grab = (name) => {
    const m = out.match(
      new RegExp(
        `${name}:\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)`,
      ),
    );
    return m ? m.slice(1, 5).map(Number) : null;
  };
  const media = grab("MediaBox");
  return { media, crop: grab("CropBox") || media };
}

let n = 0;
for (const p of posts) {
  fs.mkdirSync(path.dirname(p.coverAbs), { recursive: true });
  // Pass 1 — render just the CropBox (the visible newsletter) to a temp PNG
  // COVER_W px wide, at whatever natural height it has.
  const { media, crop } = pageBoxes(p.pdfAbs);
  const [mx0, , , my1] = media;
  const [cx0, cy0, cx1, cy1] = crop;
  const dpi = (COVER_W * 72) / (cx1 - cx0); // so the CropBox width maps to COVER_W
  const X = Math.round(((cx0 - mx0) * dpi) / 72);
  const Y = Math.round(((my1 - cy1) * dpi) / 72); // PDF y is bottom-up
  const H = Math.round(((cy1 - cy0) * dpi) / 72);
  const tmpBase = p.coverAbs.replace(/\.jpg$/, ".__full");
  execSync(
    `pdftocairo -png -f 1 -l 1 -r ${dpi} -x ${X} -y ${Y} -W ${COVER_W} -H ${H} -singlefile ${JSON.stringify(p.pdfAbs)} ${JSON.stringify(tmpBase)}`,
  );
  const tmpPng = `${tmpBase}.png`;
  // Pass 2 — crop the top to A4 portrait so tall newsletters don't yield
  // tall covers.
  const meta = await sharp(tmpPng).metadata();
  await sharp(tmpPng)
    .extract({
      left: 0,
      top: 0,
      width: meta.width,
      height: Math.min(COVER_H, meta.height),
    })
    .jpeg({ quality: 82 })
    .toFile(p.coverAbs);
  fs.unlinkSync(tmpPng);
  const dir = path.join(ROOT, `src/content/news/${p.lang}/${p.year}`);
  fs.mkdirSync(dir, { recursive: true });
  const body = `---
title: "${p.postTitle.replace(/"/g, '\\"')}"
date: ${p.date}
status: publish
slug: "${nativeSlug(p.slug, p.lang)}"
translationKey: "${p.slug}"
author: "Quina Care"
excerpt: "${excerpt[p.lang]}"
language: "${p.lang}"
featured_image: "../../../../assets/media/placeholders/newsletter.png"
---

${invite[p.lang]}

{% download-card href="${p.href}" label="${label[p.lang]}" title="${p.cardTitle.replace(/"/g, '\\"')}" lang="${p.lang}" cover="${p.coverMediaPath}" /%}
`;
  fs.writeFileSync(path.join(dir, `${p.slug}.mdoc`), body);
  n++;
}
console.log("Generated", n, "posts and covers");
