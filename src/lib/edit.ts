import type { Locale } from './content';

// Links from the public pages into Sveltia CMS (/admin), used by the owner
// bar and the per-section edit buttons in Base.astro. They only appear for
// a confirmed owner session; /admin itself stays owner-only (worker/cms.ts).
// Collection and file names must match public/admin/config.yml.

const cms = (collection: string, entry: string) =>
  `/admin#/collections/${collection}/entries/${encodeURIComponent(entry)}`;

/** Interface text: homepage, menu, footer, buttons. */
export const editUi = (locale: Locale) => cms('ui', `ui_${locale}`);

/** About page and the homepage teaser and facts. */
export const editProfile = (locale: Locale) =>
  cms('profile', `profile_${locale}`);

/** A project page and its homepage row. */
export const editProject = (locale: Locale, slug: string) =>
  cms(`projects_${locale}`, slug);

/** CMS collection per project for version notes. */
const versionCollections: Record<string, string> = {
  'pet-desktop': 'pet_versions',
  'pagespeed-auth-auditor': 'auditor_versions',
};

/** A version note; undefined for a project without a CMS collection. */
export function editVersion(locale: Locale, project: string, id: string) {
  const collection = versionCollections[project];
  // Entry ids are "<locale>/<project>/<file>"; the CMS names entries by file.
  return collection
    ? cms(`${collection}_${locale}`, id.split('/').pop()!)
    : undefined;
}

/** The privacy policy: the website part or the Desktop Pet part. */
export const editPrivacy = (locale: Locale, part: 'site' | 'app') =>
  cms('privacy', `privacy_${part}_${locale}`);
