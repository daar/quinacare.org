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
    format: { contentField: "content" },
    schema: createNewsSchema(lang),
  });

// Upstream tracking for list sorting/formatting gaps: see KESTATIC_UPSTREAM.md.
export default config({
  locale: "nl-NL",
  // Local mode while developing, GitHub mode on the deployed site.
  //
  // This has to be decided at BUILD time, because the same config is
  // bundled twice: into the browser app and into the Netlify function.
  // `process.env.NODE_ENV` was inlined as "production" for the browser
  // but read at runtime in the function — where Netlify does not set it —
  // so the UI offered "Log in with GitHub" while the API served local
  // mode and answered every /api/keystatic/github/* route with 404
  // "Not Found". import.meta.env.PROD is a constant Vite replaces in both
  // bundles, so the two can no longer disagree.
  storage: import.meta.env.PROD
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
