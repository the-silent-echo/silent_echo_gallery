/**
 * Content Collections Configuration
 *
 * This file defines the schema for your artwork markdown files.
 * Astro uses this to validate your frontmatter and provide type safety.
 *
 * When you create a new markdown file in src/content/nfts/,
 * the frontmatter must match this schema — Astro will warn you if it doesn't.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const nfts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/nfts' }),
  schema: z.object({
    // Required fields
    title: z.string(),
    artist: z.string(),             // Artist name
    series: z.string().optional(),   // e.g. "Flora Series", "Seascape Studies"
    price: z.number(),              // Price in cryptocurrency
    currency: z.string().default('ETH'),
    date: z.date(),                 // Date created / listed
    image: z.string(),              // Path to display image in /public/images/
    opensea_url: z.string(),         // Link to OpenSea listing

    // Optional fields
    medium: z.string().optional(),        // e.g. "Digital painting on canvas"
    dimensions: z.string().optional(),    // e.g. "4000 × 4000 px"
    year: z.number().optional(),          // Year the work was created
    description: z.string().optional(),   // Short description for SEO/sharing
    status: z.enum(['new', 'sold', 'discount']).nullish(), // Badge label on the card; leave empty, or set to: new | sold | discount
  }),
});

export const collections = { nfts };
