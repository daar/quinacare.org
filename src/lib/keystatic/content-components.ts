/**
 * Gedeelde definities van Markdoc content-componenten voor Keystatic en Astro.
 *
 * - keystatic.config.ts importeert deze (via src/lib/keystatic/news-schema.ts)
 *   om het CMS-editorschema op te bouwen.
 * - markdoc.config.mjs importeert deze via fields.markdoc.createMarkdocConfig,
 *   waarna de Astro render-componenten worden toegevoegd.
 *
 * Voeg hier een component toe als je zowel in de editor als in Astro iets nieuws
 * wilt ondersteunen. Je hoeft niets op twee plaatsen bij te houden.
 */
import { fields } from "@keystatic/core";
import { block, wrapper } from "@keystatic/core/content-components";

// Handig: een optioneel tekstveld met lege defaultwaarde zodat bestaande
// bestanden die een attribuut weglaten geen validatiefout geven.
const opt = (label: string) => fields.text({ label, defaultValue: "" });

export const contentComponents = {
  // ─── Afbeeldingen ──────────────────────────────────────────────────────────
  image: block({
    label: "Afbeelding",
    schema: {
      src: opt("Bron"),
      alt: opt("Alt-tekst"),
      align: opt("Uitlijning (left / center / right)"),
      caption: opt("Bijschrift"),
    },
  }),
  "image-row": wrapper({
    label: "Afbeeldingenrij",
    schema: {
      cols: opt("Kolommen"),
    },
  }),
  gallery: wrapper({
    label: "Galerij",
    schema: {
      ariaLabel: opt("Aria-label"),
    },
  }),
  "gallery-image": block({
    label: "Galerij-afbeelding",
    schema: {
      src: opt("Bron"),
      alt: opt("Alt-tekst"),
    },
  }),

  // ─── Media ─────────────────────────────────────────────────────────────────
  video: block({
    label: "Video",
    schema: {
      src: opt("Bron"),
      poster: opt("Poster-afbeelding"),
    },
  }),
  streetview: block({
    label: "Street View",
    schema: {
      src: opt("Embed-URL"),
      label: opt("Label"),
    },
  }),

  // ─── Downloads ─────────────────────────────────────────────────────────────
  download: block({
    label: "Download",
    schema: {
      href: opt("Link"),
      label: opt("Label"),
    },
  }),
  "csv-download": block({
    label: "CSV-download",
    schema: {
      href: opt("Bestandspad"),
      label: opt("Label"),
    },
  }),
  "download-card": block({
    label: "Downloadkaart",
    schema: {
      href: opt("Link"),
      label: opt("Label"),
      title: opt("Titel"),
      lang: opt("Taal (nl / en / es)"),
      cover: opt("Cover-afbeelding"),
    },
  }),
  "report-card": block({
    label: "Jaarverslagkaart",
    schema: {
      year: opt("Jaar"),
      lang: opt("Taal (nl / en / es)"),
    },
  }),
  "annual-reports": block({
    label: "Jaarverslagen-overzicht",
    schema: {
      lang: opt("Taal (nl / en / es)"),
    },
  }),

  // ─── Layout / secties ──────────────────────────────────────────────────────
  section: wrapper({
    label: "Sectie",
    schema: {
      label: opt("Label"),
      title: opt("Titel"),
      subtitle: opt("Ondertitel"),
      background: opt("Achtergrond"),
    },
  }),
  "hero-banner": block({
    label: "Hero-banner",
    schema: {
      title: opt("Titel"),
      subtitle: opt("Ondertitel"),
      background: opt("Achtergrond"),
      label: opt("Label"),
    },
  }),
  "cta-banner": block({
    label: "CTA-banner",
    schema: {
      title: opt("Titel"),
      subtitle: opt("Ondertitel"),
      cta: opt("CTA-tekst"),
      href: opt("Link"),
    },
  }),
  "feature-card": block({
    label: "Feature-kaart",
    schema: {
      title: opt("Titel"),
      icon: opt("Icoon"),
      href: opt("Link"),
    },
  }),

  // ─── Citaten / quotes ──────────────────────────────────────────────────────
  "quote-block": block({
    label: "Citaat",
    schema: {
      quote: opt("Citaat"),
      name: opt("Naam"),
      role: opt("Rol"),
      image: opt("Afbeelding"),
    },
  }),

  // ─── Team & profiel ────────────────────────────────────────────────────────
  "profile-section": wrapper({
    label: "Profielsectie",
    schema: {
      image: opt("Afbeelding"),
      name: opt("Naam"),
      role: opt("Rol"),
      quote: opt("Quote"),
    },
  }),
  "team-grid": wrapper({
    label: "Teamgrid",
    schema: {},
  }),
  "team-member": wrapper({
    label: "Teamlid",
    schema: {
      image: opt("Afbeelding"),
      name: opt("Naam"),
      role: opt("Rol"),
      email: opt("E-mailadres"),
    },
  }),

  // ─── Partners / donaties ───────────────────────────────────────────────────
  "partner-grid": block({
    label: "Partnergrid",
    schema: {
      type: opt("Type (main / project / media / …)"),
    },
  }),
  "tier-grid": wrapper({
    label: "Donatie-niveaugrid",
    schema: {},
  }),
  "tier-card": block({
    label: "Donatie-niveaukaart",
    schema: {
      image: opt("Afbeelding"),
      title: opt("Titel"),
      price: opt("Bedrag"),
      frequency: opt("Frequentie"),
      impact: opt("Impact"),
      yearly: opt("Jaarlijks bedrag"),
      href: opt("Link"),
      featured: fields.checkbox({ label: "Uitgelicht", defaultValue: false }),
    },
  }),
  "yura-tiers": block({
    label: "Yura-niveaus",
    schema: {},
  }),

  // ─── Contact / organisatie ─────────────────────────────────────────────────
  "contact-cards": block({
    label: "Contactkaarten",
    schema: {
      variant: opt("Variant"),
    },
  }),
  "foundation-details": block({
    label: "Stichtingsgegevens",
    schema: {},
  }),
  "contact-form": block({
    label: "Contactformulier",
    schema: {},
  }),

  // ─── Overig ────────────────────────────────────────────────────────────────
  comment: wrapper({
    label: "Commentaar (verborgen op site)",
    schema: {},
  }),
};
