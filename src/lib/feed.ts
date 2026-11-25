import { listProjects, type Locale } from './content';
import { listVersions, versionPath } from './versions';

const site = 'https://chilolab.com';

/** Path of the version-notes RSS feed for a locale. */
export function feedPath(locale: Locale) {
  return locale === 'en' ? '/en/feed.xml' : '/feed.xml';
}

const escape = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * RSS 2.0 feed of the published version notes. An item carries a pubDate only
 * when its note has a real releasedAt: previews keep no invented date.
 */
export async function versionFeed(locale: Locale) {
  const projects = await listProjects(locale);
  const notes = (
    await Promise.all(
      projects.map(async (project) =>
        (await listVersions(locale, project.data.slug)).map((entry) => ({
          project,
          entry,
        })),
      ),
    )
  )
    .flat()
    .sort(
      (a, b) =>
        (b.entry.data.releasedAt ?? '').localeCompare(
          a.entry.data.releasedAt ?? '',
        ) || b.entry.data.order - a.entry.data.order,
    );
  const vi = locale === 'vi';
  const items = notes.map(({ project, entry: { data } }) => {
    const link = `${site}${versionPath(locale, data.project, data.version)}`;
    return [
      '    <item>',
      `      <title>${escape(`${project.data.title} ${data.version}: ${data.title}`)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <description>${escape(data.summary)}</description>`,
      `      <category>${escape(project.data.title)}</category>`,
      data.releasedAt
        ? `      <pubDate>${new Date(`${data.releasedAt}T00:00:00Z`).toUTCString()}</pubDate>`
        : '',
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n');
  });
  const self = `${site}${feedPath(locale)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${vi ? 'ChiloLab: ghi chú phiên bản' : 'ChiloLab: version notes'}</title>
    <link>${site}${locale === 'en' ? '/en' : '/'}</link>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
    <description>${
      vi
        ? 'Ghi chú phiên bản các phần mềm của ChiloLab.'
        : 'Version notes for the ChiloLab apps.'
    }</description>
    <language>${vi ? 'vi' : 'en'}</language>
${items.join('\n')}
  </channel>
</rss>
`;
}

export function feedResponse(body: string) {
  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
