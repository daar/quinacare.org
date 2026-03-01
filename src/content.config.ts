import { defineCollection, z, type SchemaContext } from "astro:content";
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
    featured_image: image().optional(),
    featured_image_alt: z.string().optional(),
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

export const collections = {
  "news-nl": news_nl,
  "news-en": news_en,
  "news-es": news_es,
  "pages-nl": pages_nl,
  "pages-en": pages_en,
  "pages-es": pages_es,
};
