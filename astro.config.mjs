// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Static output — Cloudflare Pages serves the pre-built HTML files directly.
// No adapter needed for static sites; the adapter is only required for SSR.
export default defineConfig({
  output: 'static',
  site: 'https://your-nft-gallery.pages.dev', // Replace with your actual Cloudflare Pages URL after first deploy
});
