import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const actueel_nl = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/actueel/nl' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    status: z.string().optional(),
    slug: z.string().optional(),
    author: z.string().optional(),
    excerpt: z.string().optional(),
    categories: z.array(z.string()).optional(),
    language: z.string().optional(),
    featured_image: z.string().optional(),
  }),
});

const actueel_en = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/actueel/en' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    status: z.string().optional(),
    slug: z.string().optional(),
    author: z.string().optional(),
    excerpt: z.string().optional(),
    categories: z.array(z.string()).optional(),
    language: z.string().optional(),
    featured_image: z.string().optional(),
  }),
});

const actueel_es = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/actueel/es' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    status: z.string().optional(),
    slug: z.string().optional(),
    author: z.string().optional(),
    excerpt: z.string().optional(),
    categories: z.array(z.string()).optional(),
    language: z.string().optional(),
    featured_image: z.string().optional(),
  }),
});

export const collections = {
  'actueel-nl': actueel_nl,
  'actueel-en': actueel_en,
  'actueel-es': actueel_es,
};
