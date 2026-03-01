import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newsSchema = ({ image }: { image: () => z.ZodObject<any> }) =>
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

export const collections = {
  "news-nl": news_nl,
  "news-en": news_en,
  "news-es": news_es,
};
