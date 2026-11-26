import { json, readJson, text, underLimit, type Env } from './env';
import { getSettings } from './settings';

// Crash reports from the desktop apps (data roadmap, phase 2).
// Off until the owner turns on "crashReports" in /admin/manage/settings, and
// meant to be switched on only once an app release asks the user first and
// /privacy plus the EULA describe it (docs/CRASH-REPORTS.md).
// The app sends JSON with no cookies, so there is no Origin to check; a
// browser page on another site is refused. No IP address or account is
// stored, and Windows user names are cut out of paths before saving.

const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const REPORT_ID = /^[\w-]{16,64}$/;
/** Whole-site cap, so a broken or abused client cannot fill D1. */
const DAILY_CAP = 300;

/** Removes the Windows (or other) user name and email addresses. */
export function scrub(value: string) {
  return (
    value
      // Windows user names may contain spaces: cut up to the next separator.
      .replace(/([a-z]:[\\/]+users[\\/]+)[^\\/\r\n"'<>|:*?]+/gi, '$1<user>')
      .replace(/(\/(?:home|Users)\/)[^/\r\n"']+/g, '$1<user>')
      .replace(/[^\s@"'<>]{1,64}@[^\s@"'<>]{1,190}\.[a-z]{2,}/gi, '<email>')
  );
}

const field = (value: unknown, max: number) => {
  if (value === undefined || value === null || value === '') return null;
  const clean = text(value, 1, max * 4);
  return clean === null ? undefined : scrub(clean).slice(0, max);
};

export async function addCrashReport(
  request: Request,
  env: Env,
  projects: string[],
) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: 'forbidden' }, 403);
  if (!(await getSettings(env)).crashReports)
    return json({ error: 'closed' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await underLimit(env, `crash:${ip}`)))
    return json({ error: 'rate_limited' }, 429);
  const body = await readJson(request);
  // The app must say the user agreed; without it nothing is stored.
  if (!body || body.consent !== true) return json({ error: 'invalid' }, 400);
  const project = String(body.project ?? '');
  const appVersion = String(body.appVersion ?? '');
  const reportId = String(body.reportId ?? '');
  const kind = field(body.kind, 120);
  const message = field(body.message, 1000);
  const stack = field(body.stack, 8000);
  const os = field(body.os, 60);
  if (
    !projects.includes(project) ||
    !VERSION.test(appVersion) ||
    !REPORT_ID.test(reportId) ||
    !kind ||
    message === undefined ||
    stack === undefined ||
    os === undefined
  )
    return json({ error: 'invalid' }, 400);
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM crash_reports WHERE created_at >= ?`,
  )
    .bind(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    .first<{ n: number }>();
  if (Number(today?.n ?? 0) >= DAILY_CAP)
    return json({ error: 'rate_limited' }, 429);
  // The same report sent twice (a retry) is stored once.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO crash_reports (report_id, project, app_version, os, kind, message, stack)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(reportId, project, appVersion, os, kind, message, stack)
    .run();
  return json({ status: 'received' }, 201);
}
