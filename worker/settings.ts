import type { Env } from './env';

// Site settings, edited by the owner at /manage/settings and stored in the
// D1 table `settings` (migrations/0005_settings.sql). A missing row, or a
// missing table before the migration runs, falls back to the defaults below,
// so behaviour matches the site before settings existed.

export type Moderation = 'ai' | 'words' | 'manual';

export type Settings = {
  /** New comments and replies; existing comments stay visible either way. */
  commentsOpen: boolean;
  /** ai: word list + Workers AI; words: word list only; manual: hold all. */
  moderation: Moderation;
  /** Extra whole-word matches, one per line, on top of the built-in list. */
  blockedWords: string[];
  /** Email the owner when a comment is held. */
  notifyHeld: boolean;
  /** The anonymous feedback / bug report form. */
  feedbackOpen: boolean;
  /** Sign-in with a 6-digit email code (still needs RESEND_API_KEY). */
  emailLogin: boolean;
  /** First sign-in creates an account; off = existing accounts only. */
  signups: boolean;
};

export const defaults: Settings = {
  commentsOpen: true,
  moderation: 'ai',
  blockedWords: [],
  notifyHeld: true,
  feedbackOpen: true,
  emailLogin: true,
  signups: true,
};

const MAX_WORDS = 200;

export function parseWords(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((word) => word.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter(
          (word) =>
            word.length >= 2 && word.length <= 40 && /[\p{L}\p{N}]/u.test(word),
        ),
    ),
  ].slice(0, MAX_WORDS);
}

const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === '1';

export async function getSettings(env: Env): Promise<Settings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = (
      await env.DB.prepare('SELECT key, value FROM settings').all<{
        key: string;
        value: string;
      }>()
    ).results;
  } catch (error) {
    console.error('settings unavailable, using defaults', error);
  }
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const moderation = (['ai', 'words', 'manual'] as const).find(
    (mode) => mode === map.moderation,
  );
  return {
    commentsOpen: flag(map.commentsOpen, defaults.commentsOpen),
    moderation: moderation ?? defaults.moderation,
    blockedWords: parseWords(map.blockedWords ?? ''),
    notifyHeld: flag(map.notifyHeld, defaults.notifyHeld),
    feedbackOpen: flag(map.feedbackOpen, defaults.feedbackOpen),
    emailLogin: flag(map.emailLogin, defaults.emailLogin),
    signups: flag(map.signups, defaults.signups),
  };
}

export async function saveSettings(env: Env, settings: Settings) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const values: Record<string, string> = {
    commentsOpen: settings.commentsOpen ? '1' : '0',
    moderation: settings.moderation,
    blockedWords: settings.blockedWords.join('\n'),
    notifyHeld: settings.notifyHeld ? '1' : '0',
    feedbackOpen: settings.feedbackOpen ? '1' : '0',
    emailLogin: settings.emailLogin ? '1' : '0',
    signups: settings.signups ? '1' : '0',
  };
  await env.DB.batch(
    Object.entries(values).map(([key, value]) =>
      env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).bind(key, value, now),
    ),
  );
}
