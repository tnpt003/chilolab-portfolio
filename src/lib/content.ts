import { getCollection } from 'astro:content';
export type Locale = 'vi' | 'en';
export const locales: Locale[] = ['vi', 'en'];
export function pathFor(locale: Locale, slug = '') {
  const base = locale === 'en' ? '/en' : '';
  return slug ? `${base}/${slug}` : base || '/';
}
// Keep CMS/loading decisions here, outside page templates.
export async function listProjects(locale: Locale) {
  const all = await getCollection('projects');
  const published = all.filter(({ data }) => !data.draft);
  for (const { data } of published) {
    for (const translation of locales) {
      const matches = published.filter(
        ({ data: candidate }) =>
          candidate.slug === data.slug && candidate.locale === translation,
      );
      if (matches.length !== 1)
        throw new Error(
          `Project ${data.slug} must have exactly one published ${translation} translation.`,
        );
    }
  }
  const entries = published.filter(({ data }) => data.locale === locale);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

/** About-page copy for a locale, from src/content/profile/<locale>.yml. */
export async function getProfile(locale: Locale) {
  const entries = await getCollection('profile');
  for (const language of locales)
    if (entries.filter(({ data }) => data.locale === language).length !== 1)
      throw new Error(`Profile needs exactly one ${language} file.`);
  const [vi, en] = locales.map(
    (language) => entries.find(({ data }) => data.locale === language)!.data,
  );
  if (vi.toeicScore !== en.toeicScore || vi.toeicYear !== en.toeicYear)
    throw new Error('TOEIC score and year must match in both profile files.');
  return entries.find(({ data }) => data.locale === locale)!.data;
}

/**
 * Interface text for a locale, from src/content/ui/<locale>.yml (CMS:
 * Chữ giao diện). Placeholders such as {n} must be the same in both languages.
 */
export async function getUi(locale: Locale) {
  const entries = await getCollection('ui');
  const byLocale = (language: Locale) => {
    const found = entries.filter(({ data }) => data.locale === language);
    if (found.length !== 1)
      throw new Error(`Interface text needs exactly one ${language} file.`);
    return found[0].data;
  };
  const marks = (text: string) => [...text.matchAll(/{w+}/g)].sort().join();
  const compare = (vi: unknown, en: unknown, path: string) => {
    if (typeof vi === 'string' && typeof en === 'string') {
      if (marks(vi) !== marks(en))
        throw new Error(`Placeholders differ between vi and en at ${path}.`);
    } else if (vi && en && typeof vi === 'object' && typeof en === 'object')
      for (const key of Object.keys(vi))
        compare(
          (vi as Record<string, unknown>)[key],
          (en as Record<string, unknown>)[key],
          `${path}.${key}`,
        );
  };
  compare(byLocale('vi'), byLocale('en'), 'ui');
  return byLocale(locale);
}
