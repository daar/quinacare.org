import { config, collection } from "@keystatic/core";
import { newsSchema } from "./src/lib/keystatic/news-schema";

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
