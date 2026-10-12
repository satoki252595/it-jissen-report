import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://satoki252595.github.io',
  base: '/it-jissen-report',
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
});
