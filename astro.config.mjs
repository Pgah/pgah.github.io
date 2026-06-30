// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://pgah.github.io',
  integrations: [mdx()],

  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
    },
  },

  adapter: cloudflare(),
});