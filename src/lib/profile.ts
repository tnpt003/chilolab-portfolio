import type { ImageMetadata } from 'astro';
import type { IconName } from '../components/Icon.astro';

// Owner constants that are not page copy. The About-page text itself lives in
// src/content/profile/<locale>.yml (edited in the CMS) and is loaded by
// getProfile() in src/lib/content.ts. Client and contact names stay off the
// public site (NDA); the Athena entries are course completions, not
// Cisco/LPI vendor certifications.

// TOEIC image (optional): drop it at src/assets/certificates/toeic.(jpg|jpeg|png|webp)
// after blurring the date of birth, ID number and portrait (see that folder's
// README). The score and year are set in the profile YAML.
const toeicFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/certificates/toeic.{jpg,jpeg,png,webp}',
  { eager: true },
);
export const toeicImage = Object.values(toeicFiles)[0]?.default;

export const githubUrl = 'https://github.com/tnpt003';
export const email = 'contact@chilolab.com';
export const athenaUrl = 'https://athena.edu.vn/';

export type JourneyKind = 'study' | 'work' | 'release';
export const journeyIcons: Record<JourneyKind, IconName> = {
  study: 'graduation',
  work: 'briefcase',
  release: 'download',
};
export interface JourneyEntry {
  kind: JourneyKind;
  year: number;
  date?: string; // ISO (YYYY-MM or YYYY-MM-DD) when the month is known
  label?: string;
  title: string;
  text?: string;
  href?: string;
}
