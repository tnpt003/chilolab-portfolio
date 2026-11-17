import { adminIdentity } from './access';
import { json, sameOrigin, type Env } from './env';
import { manage } from './manage';

const MAX_BODY = 16 * 1024;
const locales = ['vi', 'en'] as const;

type Allowlist = {
  projects: string[];
  downloads: Record<string, Record<string, string[]>>;
};
let allowlist: { at: number; data: Allowlist } | undefined;

/** Projects and released files, generated at build time from the content. */
async function allowed(request: Request, env: Env) {
  if (allowlist && Date.now() - allowlist.at < 300_000) return allowlist.data;
  const response = await env.ASSETS.fetch(
    new URL('/allowlist.json', request.url),
  );
  const data = (await response.json()) as Allowlist;
  allowlist = { at: Date.now(), data };
  return data;
}

/** Trimmed text without control characters (newlines and tabs kept). */
function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  return clean.length >= min && clean.length <= max ? clean : null;
}

function optional(value: unknown, max: number) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, 1, max);
}

async function readJson(request: Request) {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY)
    return null;
  const body = await request.text();
  if (body.length > MAX_BODY) return null;
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function human(request: Request, env: Env, token: unknown) {
  if (!env.TURNSTILE_SECRET || typeof token !== 'string') return false;
  if (!token || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: form },
  );
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

async function listComments(request: Request, env: Env) {
  const project = new URL(request.url).searchParams.get('project') ?? '';
  if (!(await allowed(request, env)).projects.includes(project))
    return json({ error: 'unknown_project' }, 404);
  const { results } = await env.DB.prepare(
    `SELECT id, author, body, created_at AS createdAt FROM comments
     WHERE project = ? AND status = 'approved'
     ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(project)
    .all();
  return json({ comments: results }, 200, {
    'Cache-Control': 'public, max-age=60',
  });
}

async function addComment(request: Request, env: Env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'invalid' }, 400);
  const project = String(body.project ?? '');
  const author = text(body.author, 1, 60);
  const message = text(body.body, 2, 2000);
  const locale = locales.find((value) => value === body.locale);
  if (
    !author ||
    !message ||
    !locale ||
    !(await allowed(request, env)).projects.includes(project)
  )
    return json({ error: 'invalid' }, 400);
  if (!(await human(request, env, body.token)))
    return json({ error: 'verification_failed' }, 403);
  await env.DB.prepare(
    'INSERT INTO comments (project, author, body, locale) VALUES (?, ?, ?, ?)',
  )
    .bind(project, author, message, locale)
    .run();
  return json({ status: 'pending' }, 201);
}

async function addFeedback(request: Request, env: Env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'invalid' }, 400);
  const project = String(body.project ?? '');
  const kind = ['idea', 'bug', 'other'].find((value) => value === body.kind);
  const message = text(body.message, 5, 4000);
  const contact = optional(body.contact, 200);
  const appVersion = optional(body.appVersion, 40);
  const locale = locales.find((value) => value === body.locale);
  const invalidOptional =
    (body.contact && !contact) || (body.appVersion && !appVersion);
  if (
    !kind ||
    !message ||
    !locale ||
    invalidOptional ||
    !(await allowed(request, env)).projects.includes(project)
  )
    return json({ error: 'invalid' }, 400);
  if (!(await human(request, env, body.token)))
    return json({ error: 'verification_failed' }, 403);
  await env.DB.prepare(
    `INSERT INTO feedback (project, kind, message, contact, app_version, locale)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(project, kind, message, contact, appVersion, locale)
    .run();
  return json({ status: 'received' }, 201);
}

async function countDownload(request: Request, env: Env) {
  const body = await readJson(request);
  const project = String(body?.project ?? '');
  const version = String(body?.version ?? '');
  const kind = String(body?.kind ?? '');
  const files = (await allowed(request, env)).downloads[project]?.[version];
  if (!files?.includes(kind)) return json({ error: 'invalid' }, 400);
  await env.DB.prepare(
    `INSERT INTO downloads (project, version, kind, day, count)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (project, version, kind, day) DO UPDATE SET count = count + 1`,
  )
    .bind(project, version, kind, new Date().toISOString().slice(0, 10))
    .run();
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;

    if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) {
      const admin = await adminIdentity(request, env);
      if (!admin) return new Response('Forbidden', { status: 403 });
      return manage(request, env, admin);
    }

    if (request.method === 'POST' && !sameOrigin(request))
      return json({ error: 'forbidden' }, 403);

    try {
      switch (route) {
        case 'GET /api/comments':
          return await listComments(request, env);
        case 'POST /api/comments':
          return await addComment(request, env);
        case 'POST /api/feedback':
          return await addFeedback(request, env);
        case 'POST /api/downloads':
          return await countDownload(request, env);
      }
    } catch (error) {
      console.error(route, error);
      return json({ error: 'server_error' }, 500);
    }
    if (url.pathname.startsWith('/api/'))
      return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
