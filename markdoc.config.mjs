import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";
import { fields } from "@keystatic/core";
import { contentComponents } from "./src/lib/keystatic/content-components";

/**
 * Bridge between Keystatic and Astro Markdoc:
 * - createMarkdocConfig generates the Markdoc attribute schemas from the
 *   Keystatic field definitions in src/lib/keystatic/content-components.ts.
 * - The `render` option maps each tag to its Astro component.
 * - The `comment` tag stays separate because it needs a custom transform
 *   (dropping its content) that Keystatic can't express.
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
      // Comment has no render component; the transform below drops its content.
    },
  },
});

export default defineMarkdocConfig({
  ...ksConfig,
  tags: {
    ...ksConfig.tags,
    // {% comment %}…{% /comment %} drops its content at transform time so
    // editors can keep TODO/parked-content blocks in .mdoc files without
    // them appearing on the site.
    comment: {
      ...ksConfig.tags?.comment,
      attributes: {},
      transform() {
        return null;
      },
    },
  },
});
