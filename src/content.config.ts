import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const actueel = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/actueel' }),
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

export const collections = { actueel };
