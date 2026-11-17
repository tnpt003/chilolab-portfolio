import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://chilolab.com',
  output: 'static',
  trailingSlash: 'never',
  // Emit scripts as files: the CSP (public/_headers) blocks inline scripts.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [
    sitemap({
      // Sign-in pages are noindex; keep them out of the sitemap.
      filter: (page) =>
        !page.includes('/PageSpeed-Auth-Auditor') && !page.includes('/user/'),
    }),
  ],
});
