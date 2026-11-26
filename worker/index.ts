import { devIdentity } from './access';
import { auth } from './auth';
import { cmsAuth, cmsPage } from './cms';
import { comments } from './comments';
import { addCrashReport } from './crashes';
import {
  deleteUpload,
  MAX_FILE,
  readUpload,
  storeUpload,
  type Upload,
} from './files';
import {
  asLocale,
  baseHeaders,
  json,
  optional,
  readJson,
  redirect,
  sameOrigin,
  text,
  underLimit,
  type Env,
} from './env';
import { downloadStats } from './github';
import { notifyFeedback } from './mail';
import { manage } from './manage';
import { scheduled } from './maintenance';
import { media } from './media';
import { subscriptions } from './releases';
import { human } from './turnstile';
import { currentUser } from './session';
import { getSettings } from './settings';

type Allowlist = {
  projects: string[];
  versions: Record<string, string[]>;
  downloads: Record<string, Record<string, string[]>>;
};
let allowlist: { at: number; data: Allowlist } | undefined;

/** Projects, versions and files, generated at build time from the content. */
async function allowed(request: Request, env: Env) {
  if (allowlist && Date.now() - allowlist.at < 300_000) return allowlist.data;
  const response = await env.ASSETS.fetch(
    new URL('/allowlist.json', request.url),
  );
  if (!response.ok) throw new Error(`allowlist.json: HTTP ${response.status}`);
  const data = (await response.json()) as Allowlist;
  allowlist = { at: Date.now(), data };
  return data;
}

/**
 * Feedback arrives as JSON, or as multipart form data (a "data" part with
 * the same JSON plus an optional "screenshot" image) when a file is attached.
 */
async function readFeedback(
  request: Request,
): Promise<
  | { body: Record<string, unknown>; upload: Upload | null }
  | { error: string; status: number }
> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.startsWith('multipart/form-data')) {
    const body = await readJson(request);
    return body ? { body, upload: null } : { error: 'invalid', status: 400 };
  }
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_FILE + 64_000)
    return { error: 'file_too_large', status: 413 };
  const form = await request.formData().catch(() => null);
  const data = form?.get('data');
  if (typeof data !== 'string' || data.length > 16_000)
    return { error: 'invalid', status: 400 };
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    return { error: 'invalid', status: 400 };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { error: 'invalid', status: 400 };
  const upload = await readUpload(form!.get('screenshot'));
  if (upload === 'too_large') return { error: 'file_too_large', status: 413 };
  if (upload === 'bad_file') return { error: 'file_type', status: 400 };
  return { body: body as Record<string, unknown>, upload };
}

async function addFeedback(request: Request, env: Env, ctx: ExecutionContext) {
  const settings = await getSettings(env);
  if (!settings.feedbackOpen) return json({ error: 'closed' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await underLimit(env, `ip:${ip}`)))
    return json({ error: 'rate_limited' }, 429);
  const read = await readFeedback(request);
  if ('error' in read) return json({ error: read.error }, read.status);
  const { body, upload } = read;
  if (upload && !env.BACKUPS) return json({ error: 'file_unavailable' }, 503);
  const project = String(body.project ?? '');
  const kind = ['idea', 'bug', 'other'].find((value) => value === body.kind);
  const summary = text(body.summary, 3, 120);
  const message = text(body.message, 5, 4000);
  const contact = optional(body.contact, 200);
  const appVersion = optional(body.appVersion, 40);
  const os = optional(body.os, 60);
  const locale = asLocale(body.locale);
  const invalidOptional =
    (body.contact && !contact) ||
    (body.appVersion && !appVersion) ||
    (body.os && !os);
  if (
    !kind ||
    !summary ||
    !message ||
    !locale ||
    invalidOptional ||
    !(await allowed(request, env)).projects.includes(project)
  )
    return json({ error: 'invalid' }, 400);
  if (!(await human(request, env, body.token)))
    return json({ error: 'verification_failed' }, 403);
  const user = await currentUser(request, env);
  const key = upload ? await storeUpload(env, upload) : null;
  try {
    await env.DB.prepare(
      `INSERT INTO feedback (project, kind, summary, message, contact, app_version, os, locale, user_id, file_key, file_type, file_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        project,
        kind,
        summary,
        message,
        contact,
        appVersion,
        os,
        locale,
        user?.id ?? null,
        key,
        upload?.type ?? null,
        upload?.bytes.byteLength ?? null,
      )
      .run();
  } catch (error) {
    // No row points at the image, so do not keep it.
    await deleteUpload(env, key).catch(() => {});
    throw error;
  }
  if (settings.notifyFeedback)
    ctx.waitUntil(
      notifyFeedback(env, new URL(request.url).origin, {
        project,
        kind,
        summary,
        message,
      }).catch((error) => console.error('notify failed', error)),
    );
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
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // The admin panel moved from /manage to /admin/manage on 2026-11-25.
    if (path === '/manage' || path.startsWith('/manage/'))
      return redirect(`/admin${url.pathname}${url.search}`, 301);

    if (
      path.startsWith('/media/') &&
      (request.method === 'GET' || request.method === 'HEAD')
    )
      return media(request, env);

    if (path === '/admin/manage' || path.startsWith('/admin/manage/')) {
      // Only an owner account (users.role = 'owner') signed in at
      // /user/login, or the localhost dev bypass. Anything else is refused:
      // the panel fails closed.
      const user = await currentUser(request, env);
      if (user?.role === 'owner')
        return manage(request, env, ctx, {
          name: user.displayName,
          userId: user.id,
        });
      const identity = devIdentity(request, env);
      if (identity)
        return manage(request, env, ctx, { name: identity, userId: null });
      if (user || request.method !== 'GET')
        return new Response('Forbidden', {
          status: 403,
          headers: {
            ...baseHeaders,
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      return redirect(
        `/user/login?${new URLSearchParams({ return: url.pathname + url.search })}`,
      );
    }

    // Sveltia CMS: opens only for the owner session (worker/cms.ts).
    if (
      path === '/admin' ||
      path === '/admin/index.html' ||
      path === '/admin/config.yml'
    )
      return cmsPage(request, env);
    if (path === '/api/cms/auth' && request.method === 'GET')
      return cmsAuth(request, env);

    // Answered before the same-origin check: the desktop app has no Origin,
    // and mail apps post one-click unsubscribes from their own servers.
    try {
      if (path === '/api/crash-reports' && request.method === 'POST')
        return await addCrashReport(
          request,
          env,
          (await allowed(request, env)).projects,
        );
      if (
        path === '/api/subscriptions/unsubscribe' &&
        request.method === 'POST'
      )
        return (await subscriptions(request, env, path))!;
    } catch (error) {
      console.error(request.method, path, error);
      return json({ error: 'server_error' }, 500);
    }

    if (
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      !sameOrigin(request)
    )
      return json({ error: 'forbidden' }, 403);

    try {
      const isAllowed = async (project: string, version: string | null) => {
        const data = await allowed(request, env);
        if (!data.projects.includes(project)) return false;
        return (
          version === null || Boolean(data.versions[project]?.includes(version))
        );
      };
      const response =
        (await auth(request, env, path)) ??
        (await comments(request, env, ctx, path, isAllowed)) ??
        (await subscriptions(request, env, path));
      if (response) return response;
      if (path === '/api/feedback' && request.method === 'POST')
        return await addFeedback(request, env, ctx);
      if (path === '/api/downloads/stats' && request.method === 'GET')
        return await downloadStats(request, ctx);
      if (path === '/api/downloads' && request.method === 'POST')
        return await countDownload(request, env);
    } catch (error) {
      console.error(request.method, path, error);
      return json({ error: 'server_error' }, 500);
    }
    if (path.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
  // Daily upkeep: cleanup, plus a weekly backup (worker/maintenance.ts).
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      scheduled(controller, env).catch((error) =>
        console.error('scheduled', error),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
