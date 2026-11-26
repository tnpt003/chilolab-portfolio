import {
  asLocale,
  json,
  readJson,
  randomToken,
  underLimit,
  type Env,
  type Locale,
} from './env';
import { mailEnabled, sendBatch, type Mail } from './mail';
import { currentUser } from './session';

// "Email me about new versions" (data roadmap, phase 2).
// - Signed-in visitors pick projects on their account page (/api/subscriptions).
// - The owner announces a released version at /admin/manage/releases; that
//   opens a release_notices row and deliverNotices() sends it in batches,
//   at most NOTICE_DAILY emails a day, then again from the daily cron until
//   every subscriber has one.
// - Every email links to /user/unsubscribe#<token> and carries the
//   List-Unsubscribe headers, so mail apps can offer one-click unsubscribe.

/** Site address for links in emails (the cron has no request to read it from). */
export const SITE = 'https://chilolab.com';
/** Resend free tier: 100 emails a day, shared with sign-in codes and alerts. */
export const NOTICE_DAILY = 80;

type Copy = { title: string; summary?: string; path: string };
export type Release = {
  version: string;
  releasedAt?: string;
  vi: Copy;
  en: Copy;
};
export type Catalog = Record<
  string,
  { vi: Copy; en: Copy; releases: Release[] }
>;

let cache: { at: number; data: Catalog } | undefined;

/** Projects and released versions, generated at build time (releases.json). */
export async function catalog(env: Env): Promise<Catalog> {
  if (cache && Date.now() - cache.at < 300_000) return cache.data;
  const response = await env.ASSETS.fetch(new URL('/releases.json', SITE));
  if (!response.ok) throw new Error(`releases.json: HTTP ${response.status}`);
  const data = (await response.json()) as Catalog;
  cache = { at: Date.now(), data };
  return data;
}

const stamp = (time = Date.now()) =>
  new Date(time).toISOString().replace(/\.\d+Z$/, 'Z');

// ---------- visitor API ----------

async function list(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT project FROM subscriptions WHERE user_id = ? ORDER BY project',
  )
    .bind(user.id)
    .all<{ project: string }>();
  return json({ projects: results.map((row) => row.project) });
}

async function change(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  if (!(await underLimit(env, `user:${user.id}`)))
    return json({ error: 'rate_limited' }, 429);
  const body = await readJson(request);
  const project = String(body?.project ?? '');
  const locale = asLocale(body?.locale);
  if (!locale || typeof body?.subscribed !== 'boolean')
    return json({ error: 'invalid' }, 400);
  if (!(await catalog(env))[project]) return json({ error: 'invalid' }, 400);
  if (body.subscribed)
    await env.DB.prepare(
      `INSERT INTO subscriptions (user_id, project, locale, unsubscribe_token)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, project) DO UPDATE SET locale = excluded.locale`,
    )
      .bind(user.id, project, locale, randomToken())
      .run();
  else
    await env.DB.prepare(
      'DELETE FROM subscriptions WHERE user_id = ? AND project = ?',
    )
      .bind(user.id, project)
      .run();
  return json({ project, subscribed: body.subscribed });
}

const readToken = (value: unknown) =>
  typeof value === 'string' && /^[\w-]{20,100}$/.test(value) ? value : null;

/**
 * Cancels one subscription by the token in its emails. Answers the page at
 * /user/unsubscribe (JSON) and one-click unsubscribe from mail apps (a POST
 * to the List-Unsubscribe address, token in the query). The token is the
 * only key, so this route takes requests from other origins too.
 */
async function unsubscribe(request: Request, env: Env) {
  const url = new URL(request.url);
  const type = request.headers.get('Content-Type') ?? '';
  const body = type.includes('application/json')
    ? await readJson(request)
    : null;
  const token = readToken(url.searchParams.get('token') ?? body?.token);
  if (!token) return json({ error: 'invalid' }, 400);
  const row = await env.DB.prepare(
    'DELETE FROM subscriptions WHERE unsubscribe_token = ? RETURNING project',
  )
    .bind(token)
    .first<{ project: string }>();
  if (!row) return json({ error: 'not_found' }, 404);
  const locale = asLocale(body?.locale) ?? 'vi';
  const names = (await catalog(env).catch(() => ({}) as Catalog))[row.project];
  return json({
    status: 'unsubscribed',
    project: row.project,
    title: names?.[locale].title ?? row.project,
  });
}

/** Handles /api/subscriptions*. Returns null for other paths. */
export async function subscriptions(request: Request, env: Env, path: string) {
  if (path === '/api/subscriptions/unsubscribe' && request.method === 'POST')
    return unsubscribe(request, env);
  if (path !== '/api/subscriptions') return null;
  if (request.method === 'GET') return list(request, env);
  if (request.method === 'PUT') return change(request, env);
  return json({ error: 'method_not_allowed' }, 405);
}

// ---------- sending ----------

const words = {
  vi: (project: string, release: Release, copy: Copy) => ({
    subject: `${project} ${release.version}: ${copy.title}`,
    intro: `${project} vừa có bản ${release.version}${release.releasedAt ? ` (${release.releasedAt})` : ''}.`,
    more: 'Xem có gì mới và tải về:',
    why: `Bạn nhận email này vì đã đăng ký nhận tin bản mới của ${project} trên ChiloLab. Hủy nhận:`,
  }),
  en: (project: string, release: Release, copy: Copy) => ({
    subject: `${project} ${release.version}: ${copy.title}`,
    intro: `${project} ${release.version} is out${release.releasedAt ? ` (${release.releasedAt})` : ''}.`,
    more: "See what's new and download it:",
    why: `You get this email because you asked ChiloLab to tell you about new versions of ${project}. Unsubscribe:`,
  }),
};

type Recipient = {
  user_id: number;
  email: string;
  locale: Locale;
  unsubscribe_token: string;
};

function compose(
  names: Catalog[string],
  release: Release,
  to: Recipient,
): Mail {
  const locale = to.locale === 'en' ? 'en' : 'vi';
  const copy = release[locale];
  const w = words[locale](names[locale].title, release, copy);
  const page = new URL(copy.path, SITE).href;
  const query = `token=${encodeURIComponent(to.unsubscribe_token)}`;
  // The token sits after #, so it never reaches server logs or page analytics.
  const leave = `${SITE}${locale === 'en' ? '/en' : ''}/user/unsubscribe#${encodeURIComponent(to.unsubscribe_token)}`;
  return {
    to: to.email,
    subject: `[ChiloLab] ${w.subject}`,
    lines: [
      w.intro,
      ...(copy.summary ? [copy.summary] : []),
      `${w.more} ${page}`,
      `${w.why} ${leave}`,
    ],
    headers: {
      'List-Unsubscribe': `<${SITE}/api/subscriptions/unsubscribe?${query}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/** Emails sent for release notices since 00:00 UTC. */
export async function sentToday(env: Env) {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM notice_deliveries WHERE sent_at >= ?',
  )
    .bind(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/**
 * Sends what is still owed for open notices, within today's budget. Safe to
 * call again at any time: who already has an email is recorded.
 */
export async function deliverNotices(env: Env) {
  if (!mailEnabled(env)) return { skipped: 'no RESEND_API_KEY' };
  const { results: open } = await env.DB.prepare(
    'SELECT id, project, version FROM release_notices WHERE finished_at IS NULL ORDER BY id',
  ).all<{ id: number; project: string; version: string }>();
  if (!open.length) return { sent: 0 };
  const data = await catalog(env);
  let budget = NOTICE_DAILY - (await sentToday(env));
  let sent = 0;
  for (const notice of open) {
    const names = data[notice.project];
    const release = names?.releases.find((r) => r.version === notice.version);
    // The version was withdrawn or is no longer marked released: stop.
    if (!names || !release) {
      await env.DB.prepare(
        'UPDATE release_notices SET finished_at = ? WHERE id = ?',
      )
        .bind(stamp(), notice.id)
        .run();
      continue;
    }
    while (budget > 0) {
      const { results } = await env.DB.prepare(
        `SELECT s.user_id, u.email, s.locale, s.unsubscribe_token
           FROM subscriptions s JOIN users u ON u.id = s.user_id
          WHERE s.project = ? AND u.blocked_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM notice_deliveries d
                             WHERE d.notice_id = ? AND d.user_id = s.user_id)
          ORDER BY s.id LIMIT ?`,
      )
        .bind(notice.project, notice.id, Math.min(budget, 100))
        .all<Recipient>();
      if (!results.length) {
        await env.DB.prepare(
          'UPDATE release_notices SET finished_at = ? WHERE id = ?',
        )
          .bind(stamp(), notice.id)
          .run();
        break;
      }
      if (
        !(await sendBatch(
          env,
          results.map((to) => compose(names, release, to)),
        ))
      )
        // Resend refused (quota, outage): try again on the next cron run.
        return { sent, failed: notice.id };
      await env.DB.batch(
        results.map((to) =>
          env.DB.prepare(
            'INSERT OR IGNORE INTO notice_deliveries (notice_id, user_id) VALUES (?, ?)',
          ).bind(notice.id, to.user_id),
        ),
      );
      sent += results.length;
      budget -= results.length;
    }
    if (budget <= 0) break;
  }
  return { sent, budgetLeft: Math.max(0, budget) };
}
