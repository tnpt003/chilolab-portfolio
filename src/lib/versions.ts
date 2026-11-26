import { getCollection } from 'astro:content';
import { listProjects, locales, pathFor, type Locale } from './content';

export function versionPath(locale: Locale, project: string, version?: string) {
  return pathFor(locale, `${project}/versions${version ? `/${version}` : ''}`);
}

export async function listVersions(locale: Locale, project: string) {
  const entries = (await getCollection('versions')).filter(
    ({ data }) => !data.draft,
  );
  const projects = await listProjects(locale);
  for (const { data } of entries) {
    if (
      !projects.some(({ data: candidate }) => candidate.slug === data.project)
    )
      throw new Error(`Unknown project in version note: ${data.project}`);
    for (const language of locales) {
      const matches = entries.filter(
        ({ data: candidate }) =>
          candidate.project === data.project &&
          candidate.version === data.version &&
          candidate.locale === language,
      );
      if (matches.length !== 1)
        throw new Error(
          `${data.project} ${data.version} needs exactly one published ${language} version note.`,
        );
      if (
        matches[0].data.status !== data.status ||
        matches[0].data.order !== data.order ||
        matches[0].data.releasedAt !== data.releasedAt
      )
        throw new Error(
          `Version metadata differs between translations: ${data.project} ${data.version}`,
        );
    }
  }
  return entries
    .filter(({ data }) => data.locale === locale && data.project === project)
    .sort(
      (a, b) =>
        b.data.order - a.data.order ||
        b.data.version.localeCompare(a.data.version, 'en', { numeric: true }),
    );
}

/** Newest published release that offers a download, for the product page. */
export async function latestDownload(locale: Locale, project: string) {
  return (await listVersions(locale, project)).find(
    ({ data }) => data.status === 'released' && data.downloadUrl,
  );
}

/**
 * Release shown in the project's download panel: the version chosen in the CMS
 * (featuredVersion), otherwise the newest published release with a download.
 */
export async function featuredDownload(
  locale: Locale,
  project: string,
  featured?: string,
) {
  if (!featured) return latestDownload(locale, project);
  const entry = (await listVersions(locale, project)).find(
    ({ data }) => data.version === featured,
  );
  if (!entry || entry.data.status !== 'released' || !entry.data.downloadUrl)
    throw new Error(
      `${project}: featuredVersion ${featured} must be a released version with a download link.`,
    );
  return entry;
}

/**
 * Turn a pinned GitHub release asset link into the always-latest form, so the
 * download buttons follow new releases without a site rebuild. Version posts
 * keep their pinned links; only the buttons use this. Requires the asset name
 * to stay the same across releases (PetComputer-win-Setup.exe, ...).
 */
export function alwaysLatest(url: string) {
  return url.replace(
    /^(https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/)download\/[^/]+\//,
    '$1latest/download/',
  );
}
