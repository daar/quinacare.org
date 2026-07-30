import { config, collection, fields } from "@keystatic/core";
import { block, wrapper } from "@keystatic/core/content-components";

// Register all custom markdoc tags with empty schemas so Keystatic's
// parser doesn't throw "Missing component definition" errors on
// existing .mdoc content. Attributes are not mapped — they remain in
// the raw file and are preserved when Keystatic saves the entry.
const contentComponents = {
  image: block({ label: "Afbeelding", schema: {} }),
  "image-row": wrapper({ label: "Afbeeldingenrij", schema: {} }),
  "gallery-image": block({ label: "Galerij-afbeelding", schema: {} }),
  gallery: wrapper({ label: "Galerij", schema: {} }),
  video: block({ label: "Video", schema: {} }),
  download: block({ label: "Download", schema: {} }),
  "csv-download": block({ label: "CSV Download", schema: {} }),
  streetview: block({ label: "Streetview", schema: {} }),
  "quote-block": block({ label: "Citaat", schema: {} }),
  "profile-section": wrapper({ label: "Profielsectie", schema: {} }),
  "cta-banner": block({ label: "CTA-banner", schema: {} }),
  "feature-card": block({ label: "Feature-kaart", schema: {} }),
  "hero-banner": block({ label: "Hero-banner", schema: {} }),
  section: wrapper({ label: "Sectie", schema: {} }),
  "team-grid": wrapper({ label: "Teamgrid", schema: {} }),
  "team-member": wrapper({ label: "Teamlid", schema: {} }),
  "partner-grid": block({ label: "Partnergrid", schema: {} }),
  "tier-grid": wrapper({ label: "Donatie-niveaugrid", schema: {} }),
  "tier-card": block({ label: "Donatie-niveaukaart", schema: {} }),
  "yura-tiers": block({ label: "Yura-niveaus", schema: {} }),
  "contact-cards": block({ label: "Contactkaarten", schema: {} }),
  "foundation-details": block({ label: "Stichtingsgegevens", schema: {} }),
  "contact-form": block({ label: "Contactformulier", schema: {} }),
  "annual-reports": block({ label: "Jaarverslagen", schema: {} }),
  "report-card": block({ label: "Jaarverslagkaart", schema: {} }),
  "download-card": block({ label: "Downloadkaart", schema: {} }),
  comment: wrapper({ label: "Commentaar", schema: {} }),
};

const newsSchema = {
  title: fields.text({ label: "Titel" }),
  slug: fields.text({ label: "Slug" }),
  date: fields.date({ label: "Datum" }),
  status: fields.select({
    label: "Status",
    options: [
      { label: "Gepubliceerd", value: "publish" },
      { label: "Concept", value: "draft" },
    ],
    defaultValue: "publish",
  }),
  pinned: fields.checkbox({
    label: "Vastgepind op homepage",
    defaultValue: false,
  }),
  author: fields.text({ label: "Auteur" }),
  excerpt: fields.text({ label: "Samenvatting", multiline: true }),
  categories: fields.array(fields.text({ label: "Categorie" }), {
    label: "Categorieën",
    itemLabel: (props) => props.fields.value.value ?? "Categorie",
  }),
  translationKey: fields.text({ label: "Vertaalsleutel (NL slug)" }),
  language: fields.text({ label: "Taal" }),
  featured_image: fields.image({
    label: "Uitgelichte afbeelding",
    directory: "src/assets/media/cms",
    publicPath: "../../../../assets/media/cms/",
  }),
  featured_image_caption: fields.text({ label: "Bijschrift afbeelding" }),
  featured_image_copyright: fields.text({ label: "Copyright afbeelding" }),
  content: fields.markdoc({ label: "Inhoud" }),
};

export default config({
  storage:
    process.env.NODE_ENV === "production"
      ? { kind: "github", repo: "daar/quinacare.org" }
      : { kind: "local" },
  ui: {
    brand: { name: "Quina Care CMS" },
  },
  collections: {
    newsNl: collection({
      label: "Nieuws (NL)",
      slugField: "slug",
      columns: ["title", "date"],
      parseSlugForSort: (slug) =>
        String(
          Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime(),
        ),
      path: "src/content/news/nl/**",
      entryLayout: "content",
      format: { extension: "mdoc", contentField: "content" },
      schema: newsSchema,
    }),
    newsEn: collection({
      label: "News (EN)",
      slugField: "slug",
      columns: ["title", "date"],
      parseSlugForSort: (slug) =>
        String(
          Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime(),
        ),
      path: "src/content/news/en/**",
      entryLayout: "content",
      format: { extension: "mdoc", contentField: "content" },
      schema: newsSchema,
    }),
    newsEs: collection({
      label: "Noticias (ES)",
      slugField: "slug",
      columns: ["title", "date"],
      parseSlugForSort: (slug) =>
        String(
          Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime(),
        ),
      path: "src/content/news/es/**",
      entryLayout: "content",
      format: { extension: "mdoc", contentField: "content" },
      schema: newsSchema,
    }),
  },
});
