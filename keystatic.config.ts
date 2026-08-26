import { config, collection } from "@keystatic/core";
import { createNewsSchema } from "./src/lib/keystatic/news-schema";

type NewsLang = "nl" | "en" | "es";

const newsDir = (lang: NewsLang) => `src/content/news/${lang}/**` as const;

// Sort collection entries newest-first by the year encoded in their slug.
const parseSlugForSort = (slug: string) =>
  String(Number.MAX_SAFE_INTEGER - new Date(slug.split("/")[0]).getTime());

const newsCollection = (lang: NewsLang, label: string) =>
  collection({
    label,
    slugField: "title",
    columns: ["title", "date"],
    parseSlugForSort,
    path: newsDir(lang),
    entryLayout: "content",
    format: { extension: "mdoc", contentField: "content" },
    schema: createNewsSchema(lang),
  });

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
    newsNl: newsCollection("nl", "Nieuws (NL)"),
    newsEn: newsCollection("en", "News (EN)"),
    newsEs: newsCollection("es", "Noticias (ES)"),
  },
});
