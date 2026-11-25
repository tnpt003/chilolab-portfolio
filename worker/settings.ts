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
  /** Longest comment a visitor may post, in characters (100–2000). */
  commentMaxLength: number;
  /** Comments one visitor may post per hour; 0 means no hourly cap. */
  commentsPerHour: number;
  /** Email the owner when a comment is held. */
  notifyHeld: boolean;
  /** Email the owner when feedback arrives. */
  notifyFeedback: boolean;
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
  commentMaxLength: 2000,
  commentsPerHour: 0,
  notifyHeld: true,
  notifyFeedback: false,
  feedbackOpen: true,
  emailLogin: true,
  signups: true,
};

export const COMMENT_MAX = 2000;
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

/** Integer within [min, max]; anything else gives the fallback. */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const number = Number(value);
  if (value === null || value === '' || !Number.isFinite(number))
    return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
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
    commentMaxLength: clampInt(
      map.commentMaxLength,
      100,
      COMMENT_MAX,
      defaults.commentMaxLength,
    ),
    commentsPerHour: clampInt(
      map.commentsPerHour,
      0,
      500,
      defaults.commentsPerHour,
    ),
    notifyHeld: flag(map.notifyHeld, defaults.notifyHeld),
    notifyFeedback: flag(map.notifyFeedback, defaults.notifyFeedback),
    feedbackOpen: flag(map.feedbackOpen, defaults.feedbackOpen),
    emailLogin: flag(map.emailLogin, defaults.emailLogin),
    signups: flag(map.signups, defaults.signups),
  };
}

const store = (value: Settings[keyof Settings]) =>
  typeof value === 'boolean'
    ? value
      ? '1'
      : '0'
    : Array.isArray(value)
      ? value.join('\n')
      : String(value);

/** Saves only the given keys; returns the keys whose value changed. */
export async function saveSettings(env: Env, changes: Partial<Settings>) {
  const current = await getSettings(env);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const entries = (Object.keys(changes) as (keyof Settings)[]).map(
    (key) => [key, store(changes[key]!)] as const,
  );
  if (entries.length)
    await env.DB.batch(
      entries.map(([key, value]) =>
        env.DB.prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        ).bind(key, value, now),
      ),
    );
  return entries
    .filter(([key, value]) => store(current[key]) !== value)
    .map(([key]) => key);
}
