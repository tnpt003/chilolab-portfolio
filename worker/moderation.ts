import type { Env } from './env';
import type { Settings } from './settings';

// Flags abusive comments so they are held for review. Criticism and bug
// complaints are not abuse and must pass. Two layers:
// 1. a small word list (instant, free) plus owner-added words, 2. a
// Southeast-Asian-language model on Workers AI for context. If the model is
// unavailable the comment is published and marked "unchecked" so /admin/manage can
// show it. /admin/manage/settings can switch to the word list only, or hold every
// comment for manual review.

export const MODEL = '@cf/aisingapore/gemma-sea-lion-v4-27b-it';

export type Verdict =
  { held: false; reason: null | 'unchecked' } | { held: true; reason: string };

// Both lists match whole words only, so "đĩa" (disk) or "đụng" (bump) never
// match "đĩ"/"đụ". Accented words keep their diacritics because some become
// harmless words once accents are removed ("lồn" vs "lớn").
const accented = [
  'lồn',
  'buồi',
  'cặc',
  'địt',
  'đéo',
  'đụ',
  'đĩ',
  'đmm',
  'đcm',
  'đm',
  'óc chó',
  'ngu như chó',
  'mẹ mày',
  'má mày',
  'thằng chó',
  'đồ chó',
  'đồ ngu',
  'súc vật',
  'khốn nạn',
  'mất dạy',
];
// Abbreviations and English terms, compared without accents.
const plain = [
  'dm',
  'dmm',
  'dcm',
  'clgt',
  'cmm',
  'dit me',
  'du ma',
  'fuck',
  'fucking',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'retard',
  'kys',
];

const words = (value: string) =>
  ` ${value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ')} `;
const strip = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd');

export function wordList(body: string, extra: string[] = []) {
  const accentedWords = words(body);
  if (accented.some((word) => accentedWords.includes(` ${word} `)))
    return 'profanity';
  const plainWords = words(strip(body));
  if (plain.some((word) => plainWords.includes(` ${word} `)))
    return 'profanity';
  // Owner-added words (/admin/manage/settings), matched as whole words with or
  // without accents.
  if (
    extra.some(
      (word) =>
        accentedWords.includes(words(word)) ||
        plainWords.includes(words(strip(word))),
    )
  )
    return 'blocked';
  if (
    /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:ru|top|xyz|click|bet|vip)\b/i.test(body)
  )
    return 'link';
  return null;
}

const PROMPT = `You moderate comments on a small software website (mostly Vietnamese, some English).
Decide if the comment is ABUSIVE. Abusive means: profanity or slurs, insults or harassment aimed at a person, hate speech, sexual content, threats, or spam/scams/advertising.
NOT abusive: criticism of the software, complaints, bug reports, frustration without insults, questions, or praise.
Answer with exactly one line: "OK" or "FLAG: <profanity|insult|hate|sexual|threat|spam>".`;

export async function moderate(
  env: Env,
  body: string,
  settings: Pick<Settings, 'moderation' | 'blockedWords'>,
): Promise<Verdict> {
  if (settings.moderation === 'manual') return { held: true, reason: 'manual' };
  const listed = wordList(body, settings.blockedWords);
  if (listed) return { held: true, reason: listed };
  if (settings.moderation === 'words') return { held: false, reason: null };
  try {
    const result = (await Promise.race([
      env.AI.run(MODEL as Parameters<Ai['run']>[0], {
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: body.slice(0, 2000) },
        ],
        max_tokens: 12,
        temperature: 0,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000),
      ),
    ])) as {
      response?: unknown;
      choices?: { message?: { content?: string } }[];
    };
    const answer = String(
      result.response ?? result.choices?.[0]?.message?.content ?? '',
    ).trim();
    const flag = /^FLAG\s*:\s*([a-z]+)/i.exec(answer);
    if (flag) return { held: true, reason: flag[1].toLowerCase() };
    if (/^OK\b/i.test(answer)) return { held: false, reason: null };
    return { held: false, reason: 'unchecked' };
  } catch (error) {
    console.error('moderation unavailable', error);
    return { held: false, reason: 'unchecked' };
  }
}
