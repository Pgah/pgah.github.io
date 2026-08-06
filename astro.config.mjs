// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://pgah.github.io',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
    },
  },
});
