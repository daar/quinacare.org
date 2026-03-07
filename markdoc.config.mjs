import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
  tags: {
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
    "cta-banner": {
      render: component("./src/components/markdoc/CtaBanner.astro"),
      attributes: {
        title: { type: String, required: true },
        subtitle: { type: String },
        cta: { type: String, required: true },
        href: { type: String, required: true },
      },
    },
  },
});
