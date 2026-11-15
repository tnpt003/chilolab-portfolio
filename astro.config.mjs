import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://chilolab.com',
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    sitemap({ filter: (page) => !page.includes('/PageSpeed-Auth-Auditor') }),
  ],
});
