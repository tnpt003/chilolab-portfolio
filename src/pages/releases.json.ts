import type { APIRoute } from 'astro';
import { listProjects, pathFor, type Locale } from '../lib/content';
import { listVersions, versionPath } from '../lib/versions';

// Read by worker/releases.ts: project names and every released version, in
// both languages, for the "new version" emails and /admin/manage/releases.
// Everything here is already public on the version pages.
export const GET: APIRoute = async () => {
  const both = async <T>(get: (locale: Locale) => Promise<T>) => ({
    vi: await get('vi'),
    en: await get('en'),
  });
  const projects = await both(listProjects);
  const data: Record<string, unknown> = {};
  for (const [index, { data: project }] of projects.vi.entries()) {
    const en = projects.en.find(({ data }) => data.slug === project.slug)!.data;
    const versions = await both((locale) => listVersions(locale, project.slug));
    data[project.slug] = {
      order: index,
      vi: { title: project.title, path: pathFor('vi', project.slug) },
      en: { title: en.title, path: pathFor('en', project.slug) },
      releases: versions.vi
        .filter(({ data }) => data.status === 'released')
        .map(({ data: vi }) => {
          const enVersion = versions.en.find(
            ({ data }) => data.version === vi.version,
          )!.data;
          return {
            version: vi.version,
            releasedAt: vi.releasedAt,
            vi: {
              title: vi.title,
              summary: vi.summary,
              path: versionPath('vi', project.slug, vi.version),
            },
            en: {
              title: enVersion.title,
              summary: enVersion.summary,
              path: versionPath('en', project.slug, vi.version),
            },
          };
        }),
    };
  }
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
