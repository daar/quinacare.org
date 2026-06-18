import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
  tags: {
    // {% comment %}…{% /comment %} — Markdoc has no built-in block
    // comment; this tag drops its entire subtree at transform time
    // so editors can keep TODO / parked-content blocks in .mdoc
    // files without them appearing on the page.
    comment: {
      attributes: {},
      transform() {
        return null;
      },
    },
    image: {
      render: component("./src/components/markdoc/Image.astro"),
      attributes: {
        src: { type: String, required: true },
        alt: { type: String },
        width: { type: Number },
        height: { type: Number },
        align: { type: String },
        caption: { type: String },
      },
    },
    gallery: {
      render: component("./src/components/markdoc/Gallery.astro"),
      attributes: {
        ariaLabel: { type: String },
      },
    },
    "gallery-image": {
      render: component("./src/components/markdoc/GalleryImage.astro"),
      attributes: {
        src: { type: String, required: true },
        alt: { type: String },
      },
    },
    download: {
      render: component("./src/components/markdoc/Download.astro"),
      attributes: {
        href: { type: String, required: true },
        label: { type: String, required: true },
      },
    },
    "hero-banner": {
      render: component("./src/components/markdoc/HeroBanner.astro"),
      attributes: {
        background: { type: String, required: true },
        label: { type: String },
        title: { type: String, required: true },
        subtitle: { type: String },
      },
    },
    section: {
      render: component("./src/components/markdoc/Section.astro"),
      attributes: {
        label: { type: String },
        title: { type: String },
        subtitle: { type: String },
        background: { type: String },
      },
    },
    "tier-grid": {
      render: component("./src/components/markdoc/TierGrid.astro"),
      attributes: {},
    },
    "tier-card": {
      render: component("./src/components/markdoc/TierCard.astro"),
      attributes: {
        image: { type: String, required: true },
        title: { type: String, required: true },
        price: { type: String, required: true },
        frequency: { type: String, required: true },
        impact: { type: String, required: true },
        yearly: { type: String, required: true },
        href: { type: String, required: true },
        featured: { type: Boolean },
      },
    },
    "yura-tiers": {
      render: component("./src/components/markdoc/YuraTiers.astro"),
      attributes: {},
    },
    "profile-section": {
      render: component("./src/components/markdoc/ProfileSection.astro"),
      attributes: {
        image: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, required: true },
        quote: { type: String },
      },
    },
    "quote-block": {
      render: component("./src/components/markdoc/QuoteBlock.astro"),
      attributes: {
        quote: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, required: true },
        image: { type: String },
      },
    },
    "partner-grid": {
      render: component("./src/components/markdoc/PartnerGrid.astro"),
      attributes: {
        type: { type: String, required: true },
      },
    },
    video: {
      render: component("./src/components/markdoc/Video.astro"),
      attributes: {
        src: { type: String, required: true },
        poster: { type: String },
      },
    },
    "contact-cards": {
      render: component("./src/components/markdoc/ContactCards.astro"),
      attributes: {
        variant: { type: String, required: true },
      },
    },
    "team-grid": {
      render: component("./src/components/markdoc/TeamGrid.astro"),
      attributes: {},
    },
    "team-member": {
      render: component("./src/components/markdoc/TeamMember.astro"),
      attributes: {
        image: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, required: true },
        email: { type: String },
      },
    },
    "foundation-details": {
      render: component("./src/components/markdoc/FoundationDetails.astro"),
      attributes: {},
    },
    "contact-form": {
      render: component("./src/components/markdoc/ContactForm.astro"),
      attributes: {},
    },
    "feature-card": {
      render: component("./src/components/markdoc/FeatureCard.astro"),
      attributes: {
        title: { type: String, required: true },
        icon: { type: String, required: true },
        href: { type: String },
      },
    },
    "cta-banner": {
      render: component("./src/components/markdoc/CtaBanner.astro"),
      attributes: {
        title: { type: String, required: true },
        subtitle: { type: String },
        cta: { type: String, required: true },
        href: { type: String, required: true },
      },
    },
    "annual-reports": {
      render: component("./src/components/markdoc/AnnualReports.astro"),
      attributes: {
        lang: { type: String, required: true },
      },
    },
    "report-card": {
      render: component("./src/components/markdoc/AnnualReportCard.astro"),
      attributes: {
        year: { type: Number, required: true },
        lang: { type: String, required: true },
      },
    },
  },
});
