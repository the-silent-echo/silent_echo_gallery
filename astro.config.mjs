// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
// Static output — Cloudflare Pages serves the pre-built HTML files directly.
// No adapter needed for static sites; the adapter is only required for SSR.
export default defineConfig({
  output: 'static',

  // Replace with your actual Cloudflare Pages URL after first deploy
  site: 'https://your-nft-gallery.pages.dev',

  adapter: cloudflare()
});