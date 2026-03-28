// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Using static output — Cloudflare Pages serves the pre-built HTML files.
// No server-side rendering needed for a gallery site.
export default defineConfig({
  output: 'static',
  site: 'https://your-nft-gallery.pages.dev', // Replace with your actual domain
});