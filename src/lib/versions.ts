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

export const versionCopy = {
  vi: {
    heading: 'Phiên bản',
    intro: 'Mỗi bản cập nhật có gì mới, sửa gì, mình ghi lại ở đây.',
    all: 'Tất cả phiên bản',
    read: 'Xem chi tiết phiên bản',
    empty: 'Chưa có bài nào về phiên bản. Có bản cập nhật là mình đăng ở đây.',
    back: 'Về trang sản phẩm',
    source: 'Tài liệu nguồn',
    downloadLatest: 'Tải bản mới nhất',
    portable: 'Bản Portable',
    latestHeading: 'Tải xuống',
    latestInstaller: 'Tải {project} bản mới nhất cho Windows',
    feedback: 'Báo lỗi / góp ý',
    discuss: 'Bình luận về phiên bản này',
    latestNotes: 'Xem có gì mới',
    date: 'Ngày phát hành',
    pending:
      'Đây là ghi chú về phiên bản đang phát triển hoặc xem trước, chưa phải thông báo phát hành công khai.',
    released: 'Đã phát hành',
    preview: 'Bản xem trước',
    development: 'Đang phát triển',
  },
  en: {
    heading: 'Versions',
    intro: 'What’s new and what’s fixed in each update, written down here.',
    all: 'All versions',
    read: 'Read version details',
    empty: 'No version posts yet. I’ll post here when an update comes out.',
    back: 'Back to product',
    source: 'Source documentation',
    downloadLatest: 'Download the latest version',
    portable: 'Portable build',
    latestHeading: 'Download',
    latestInstaller: 'Download the latest {project} for Windows',
    feedback: 'Report a bug / suggest',
    discuss: 'Comment on this version',
    latestNotes: 'See what’s new',
    date: 'Release date',
    pending:
      'These notes describe a development or preview version, not a public release announcement.',
    released: 'Released',
    preview: 'Preview',
    development: 'In development',
  },
} as const;
