import type { Locale } from './content';

// Paths and switches for visitor features backed by the Worker API (worker/).
// Their text lives in src/content/ui/<locale>.yml (getUi in content.ts).

export const userPath = (locale: Locale, page: 'login' | 'account') =>
  `${locale === 'en' ? '/en' : ''}/user/${page}`;
export const feedbackPath = (locale: Locale, project: string) =>
  `${locale === 'en' ? '/en' : ''}/${project}/feedback`;
export const privacyPath = (locale: Locale) =>
  locale === 'en' ? '/en/privacy' : '/privacy';

// Projects whose public download count comes from GitHub Releases
// (worker/github.ts keeps the matching repository and file names).
const downloadStatProjects = ['pet-desktop'];
export const hasDownloadStats = (project: string) =>
  downloadStatProjects.includes(project);
