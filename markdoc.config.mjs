import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";
import { fields } from "@keystatic/core";
import { contentComponents } from "./src/lib/keystatic/content-components";

/**
 * Brug tussen Keystatic en Astro Markdoc:
 * - createMarkdocConfig genereert de Markdoc attribute-schema's uit de
 *   Keystatic field-definities in src/lib/keystatic-content-components.ts.
 * - De `render` optie koppelt elke tag aan het juiste Astro component.
 * - De `comment` tag blijft apart omdat die een custom transform nodig heeft
 *   (inhoud weggooien) die Keystatic niet kan uitdrukken.
 */
const ksConfig = fields.markdoc.createMarkdocConfig({
  components: contentComponents,
  render: {
    tags: {
      image: component("./src/components/markdoc/Image.astro"),
      "image-row": component("./src/components/markdoc/Row.astro"),
      gallery: component("./src/components/markdoc/Gallery.astro"),
      "gallery-image": component("./src/components/markdoc/GalleryImage.astro"),
      video: component("./src/components/markdoc/Video.astro"),
      streetview: component("./src/components/markdoc/StreetView.astro"),
      download: component("./src/components/markdoc/Download.astro"),
      "csv-download": component("./src/components/markdoc/CsvDownload.astro"),
      "download-card": component("./src/components/markdoc/DownloadCard.astro"),
      "report-card": component(
        "./src/components/markdoc/AnnualReportCard.astro",
      ),
      "annual-reports": component(
        "./src/components/markdoc/AnnualReports.astro",
      ),
      section: component("./src/components/markdoc/Section.astro"),
      "hero-banner": component("./src/components/markdoc/HeroBanner.astro"),
      "cta-banner": component("./src/components/markdoc/CtaBanner.astro"),
      "feature-card": component("./src/components/markdoc/FeatureCard.astro"),
      "quote-block": component("./src/components/markdoc/QuoteBlock.astro"),
      "profile-section": component(
        "./src/components/markdoc/ProfileSection.astro",
      ),
      "team-grid": component("./src/components/markdoc/TeamGrid.astro"),
      "team-member": component("./src/components/markdoc/TeamMember.astro"),
      "partner-grid": component("./src/components/markdoc/PartnerGrid.astro"),
      "tier-grid": component("./src/components/markdoc/TierGrid.astro"),
      "tier-card": component("./src/components/markdoc/TierCard.astro"),
      "yura-tiers": component("./src/components/markdoc/YuraTiers.astro"),
      "contact-cards": component("./src/components/markdoc/ContactCards.astro"),
      "foundation-details": component(
        "./src/components/markdoc/FoundationDetails.astro",
      ),
      "contact-form": component("./src/components/markdoc/ContactForm.astro"),
      // comment heeft geen render-component; inhoud valt weg via de transform hieronder
    },
  },
});

export default defineMarkdocConfig({
  ...ksConfig,
  tags: {
    ...ksConfig.tags,
    // {% comment %}…{% /comment %} — gooit de inhoud weg bij transform zodat
    // redacteurs TODO/parked-content blokken in .mdoc kunnen bewaren zonder
    // dat ze op de site verschijnen.
    comment: {
      ...ksConfig.tags?.comment,
      attributes: {},
      transform() {
        return null;
      },
    },
  },
});
