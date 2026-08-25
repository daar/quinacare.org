import { config, collection } from "@keystatic/core";
import { createNewsSchema } from "./src/lib/keystatic/news-schema";

const newsDir = (lang: "nl" | "en" | "es") =>
  `src/content/news/${lang}/**` as const;

// Upstream tracking for list sorting/formatting gaps: see KESTATIC_UPSTREAM.md.
export default config({
  locale: "nl-NL",
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
      slugField: "title",
      columns: ["title", "date"],
      parseSlugForSort: (slug) =>
        String(
          Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime(),
        ),
      path: newsDir("nl"),
      entryLayout: "content",
      format: { extension: "mdoc", contentField: "content" },
      schema: createNewsSchema("nl"),
    }),
    newsEn: collection({
      label: "News (EN)",
      slugField: "title",
      columns: ["title", "date"],
      parseSlugForSort: (slug) =>
        String(
          Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime(),
        ),
      path: newsDir("en"),
      entryLayout: "content",
      format: { extension: "mdoc", contentField: "content" },
      schema: createNewsSchema("en"),
    }),
    newsEs: collection({
      label: "Noticias (ES)",
      slugField: "title",
      columns: ["title", "date"],
      parseSlugForSort: (slug) =>
        String(
          Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime(),
        ),
      path: newsDir("es"),
      entryLayout: "content",
      format: { extension: "mdoc", contentField: "content" },
      schema: createNewsSchema("es"),
    }),
  },
});
