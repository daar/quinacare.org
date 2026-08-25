/**
 * Shared Markdoc content-component definitions for Keystatic and Astro.
 *
 * - keystatic.config.ts imports these (via src/lib/keystatic/news-schema.ts)
 *   to build the CMS editor schema.
 * - markdoc.config.mjs imports these via fields.markdoc.createMarkdocConfig,
 *   after which the Astro render components are added.
 *
 * Add a component here if you want to support something new in both the editor
 * and Astro. You don't need to maintain it in two places.
 */
import { fields } from "@keystatic/core";
import { block, repeating, wrapper } from "@keystatic/core/content-components";

// Handy: an optional text field with an empty default value so that existing
// files that omit an attribute don't produce a validation error.
const opt = (label: string) => fields.text({ label, defaultValue: "" });

export const contentComponents = {
  // ─── Images ────────────────────────────────────────────────────────────────
  image: block({
    label: "Afbeelding",
    schema: {
      src: fields.image({
        label: "Afbeelding",
        directory: "src/assets/media",
        publicPath: "/media/",
      }),
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
  gallery: repeating({
    label: "Galerij",
    schema: {
      ariaLabel: opt("Aria-label"),
    },
    children: ["gallery-image"],
    validation: { children: { min: 1 } },
  }),
  "gallery-image": block({
    label: "Galerij-afbeelding",
    schema: {
      src: fields.image({
        label: "Afbeelding",
        directory: "src/assets/media",
        publicPath: "/media/",
      }),
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

  // ─── Layout / sections ─────────────────────────────────────────────────────
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

  // ─── Quotes ────────────────────────────────────────────────────────────────
  "quote-block": block({
    label: "Citaat",
    schema: {
      quote: opt("Citaat"),
      name: opt("Naam"),
      role: opt("Rol"),
      image: opt("Afbeelding"),
    },
  }),

  // ─── Team & profile ────────────────────────────────────────────────────────
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

  // ─── Partners / donations ──────────────────────────────────────────────────
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

  // ─── Contact / organization ────────────────────────────────────────────────
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

  // ─── Other ─────────────────────────────────────────────────────────────────
  comment: wrapper({
    label: "Commentaar (verborgen op site)",
    schema: {},
  }),
};
