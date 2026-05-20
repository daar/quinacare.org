import { defineCollection, type SchemaContext } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const newsSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    date: z.date(),
    status: z.string().optional(),
    slug: z.string().optional(),
    author: z.string().optional(),
    excerpt: z.string().optional(),
    categories: z.array(z.string()).optional(),
    language: z.string().optional(),
    featured_image: image().optional(),
    featured_image_caption: z.string().optional(),
    featured_image_copyright: z.string().optional(),
  });

const pageSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    category_label: z.string().optional(),
    slug: z.string(),
    layout: z.enum(["article", "landing"]).default("article"),
    // Draft pages are excluded from the production build, so they are
    // unreachable publicly and never reach the Pagefind search index.
    // They remain previewable with `npm run dev`.
    draft: z.boolean().default(false),
    featured_image: image().optional(),
    featured_image_alt: z.string().optional(),
  });

const projectSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    slug: z.string(),
    excerpt: z.string(),
    featured_image: image().optional(),
    featured_image_alt: z.string().optional(),
    date: z.date(),
    status: z.enum(["active", "completed", "upcoming"]).default("active"),
  });

const fundraiserSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    slug: z.string(),
    organizer: z.string(),
    excerpt: z.string(),
    goal_amount: z.number(),
    // Manual offsets added on top of the live Turso totals — cover
    // donations made outside this site, or any missing from the database.
    raised_offset: z.number().default(0),
    backers_offset: z.number().default(0),
    end_date: z.date(),
    featured_image: image().optional(),
    featured_image_alt: z.string().optional(),
    // Draft fundraisers are excluded from the production build — kept out
    // of the listing and unreachable publicly — while staying previewable
    // with `npm run dev`.
    draft: z.boolean().default(false),
  });

const news_nl = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/news/nl" }),
  schema: newsSchema,
});

const news_en = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/news/en" }),
  schema: newsSchema,
});

const news_es = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/news/es" }),
  schema: newsSchema,
});

const pages_nl = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/pages/nl" }),
  schema: pageSchema,
});

const pages_en = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/pages/en" }),
  schema: pageSchema,
});

const pages_es = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/pages/es" }),
  schema: pageSchema,
});

const fundraisers_nl = defineCollection({
  loader: glob({
    pattern: "**/*.mdoc",
    base: "./src/content/fundraisers/nl",
  }),
  schema: fundraiserSchema,
});

const fundraisers_en = defineCollection({
  loader: glob({
    pattern: "**/*.mdoc",
    base: "./src/content/fundraisers/en",
  }),
  schema: fundraiserSchema,
});

const fundraisers_es = defineCollection({
  loader: glob({
    pattern: "**/*.mdoc",
    base: "./src/content/fundraisers/es",
  }),
  schema: fundraiserSchema,
});

const projects_nl = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/projects/nl" }),
  schema: projectSchema,
});

const projects_en = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/projects/en" }),
  schema: projectSchema,
});

const projects_es = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/projects/es" }),
  schema: projectSchema,
});

export const collections = {
  "news-nl": news_nl,
  "news-en": news_en,
  "news-es": news_es,
  "pages-nl": pages_nl,
  "pages-en": pages_en,
  "pages-es": pages_es,
  "projects-nl": projects_nl,
  "projects-en": projects_en,
  "projects-es": projects_es,
  "fundraisers-nl": fundraisers_nl,
  "fundraisers-en": fundraisers_en,
  "fundraisers-es": fundraisers_es,
};
