import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
const pages = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // public/admin is the CMS app, not a site page (no canonical/sitemap).
    if (
      entry.isDirectory() &&
      dir === fileURLToPath(root) &&
      entry.name === 'admin'
    )
      continue;
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith('.html')) pages.push(path);
  }
}
await walk(fileURLToPath(root));
const routes = new Map();
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const route = file
    .replaceAll('\\', '/')
    .split('/dist/')[1]
    .replace(/\/index\.html$/, '')
    .replace(/^index\.html$/, '')
    .replace(/\.html$/, '');
  routes.set(`/${route}`.replace(/\/$/, '') || '/', html);
}
for (const locale of ['vi', 'en']) {
  const base = locale === 'vi' ? '' : '/en';
  for (const slug of ['', '/pet-desktop', '/pagespeed-auth-auditor']) {
    const route = `${base}${slug}` || '/';
    const html = routes.get(route);
    assert.ok(html, `Missing route: ${route}`);
    assert.match(html, new RegExp(`<html lang="${locale}"`));
    assert.ok(
      html.includes(`rel="canonical" href="https://chilolab.com${route}`),
      `Canonical: ${route}`,
    );
    assert.ok(
      html.includes('hreflang="vi"') && html.includes('hreflang="en"'),
      `Alternates: ${route}`,
    );
    assert.ok(html.includes('id="main"'), `Skip link destination: ${route}`);
  }
}
// Every internal page/fragment link must resolve in the built site.
for (const [route, html] of routes) {
  if (route === '/PageSpeed-Auth-Auditor') continue;
  for (const [, href] of html.matchAll(/href="([^"\s]+)"/g)) {
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    // /api/* is answered by the Worker (worker/index.ts), not a built page.
    if (href.startsWith('/api/')) continue;
    // /manage is the Worker-rendered owner admin panel (worker/manage.ts).
    if (href === '/manage' || href.startsWith('/manage/')) continue;
    if (
      href.startsWith('//') ||
      /\.(?:svg|png|webp|jpg|jpeg|ico|css|js|mp4|pdf)(?:[?#]|$)/i.test(href)
    )
      continue;
    const [pathname, fragment] = href.split('#');
    const target = pathname ? pathname.replace(/\/$/, '') || '/' : route;
    assert.ok(routes.has(target), `${route}: broken link ${href}`);
    if (fragment)
      assert.ok(
        routes.get(target).includes(`id="${fragment}"`),
        `${route}: missing fragment ${href}`,
      );
  }
}
assert.ok(routes.has('/404'), 'Missing 404 page');
assert.ok(
  (await readFile(new URL('sitemap-index.xml', root), 'utf8')).includes(
    'sitemap-0.xml',
  ),
);
const sitemap = await readFile(new URL('sitemap-0.xml', root), 'utf8');
for (const [route, html] of routes) {
  if (route === '/404') continue;
  // Sign-in pages are noindex and stay out of the sitemap.
  if (html.includes('name="robots" content="noindex"')) {
    assert.ok(
      !sitemap.includes(`https://chilolab.com${route}<`),
      `Noindex page in sitemap: ${route}`,
    );
    continue;
  }
  assert.ok(
    sitemap.includes(`https://chilolab.com${route === '/' ? '/' : route}`),
    `Missing sitemap route: ${route}`,
  );
  assert.ok(
    html.includes(`rel="canonical" href="https://chilolab.com${route}`),
    `Wrong canonical: ${route}`,
  );
  assert.ok(
    html.includes('hreflang="vi"') && html.includes('hreflang="en"'),
    `Missing alternates: ${route}`,
  );
}
for (const route of [
  'pet-desktop',
  'pagespeed-auth-auditor',
  'en/pet-desktop',
  'en/pagespeed-auth-auditor',
]) {
  assert.ok(
    sitemap.includes(`https://chilolab.com/${route}`),
    `Sitemap missing ${route}`,
  );
}
console.log(
  `Verified ${routes.size} generated pages, bilingual routes, metadata, internal links and sitemap.`,
);
