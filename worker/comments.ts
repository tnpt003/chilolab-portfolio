import { asLocale, json, readJson, text, underLimit, type Env } from './env';
import { notifyHeld } from './mail';
import { moderate } from './moderation';
import { currentUser } from './session';
import { COMMENT_MAX, getSettings, type Settings } from './settings';

// Threaded comments, one reply level (like YouTube). A project page shows the
// comments of every version plus its own; a version page shows only its own.
// 10 threads per page. Deleting a comment that still has replies keeps a
// text-less placeholder so the thread stays readable; otherwise it is removed.

export const PAGE_SIZE = 10;
const MAX_REPLIES = 50;

type Row = {
  id: number;
  project: string;
  version: string | null;
  parent_id: number | null;
  user_id: number | null;
  author: string | null;
  display_name: string | null;
  author_role: 'member' | 'owner' | null;
  body: string;
  moderation_reason: string | null;
  status: 'published' | 'held' | 'deleted' | 'removed';
  created_at: string;
  edited_at: string | null;
};

export type Allowed = (
  project: string,
  version: string | null,
) => Promise<boolean>;

function serialize(row: Row, me: number, moderator = false) {
  const visible = row.status === 'published' || row.status === 'held';
  return {
    id: row.id,
    author: visible ? (row.display_name ?? row.author ?? null) : null,
    owner: visible && row.author_role === 'owner',
    mine: row.user_id !== null && row.user_id === me,
    reason: moderator && row.status === 'held' ? row.moderation_reason : null,
    state: row.status,
    body: visible ? row.body : null,
    version: row.version,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

/** Visitor limits from /admin/manage/settings; the owner is exempt. */
async function limitError(
  env: Env,
  settings: Settings,
  userId: number,
  message: string,
  isNew: boolean,
) {
  if (message.length > settings.commentMaxLength)
    return json({ error: 'too_long', max: settings.commentMaxLength }, 400);
  if (isNew && settings.commentsPerHour > 0) {
    const since = new Date(Date.now() - 3600_000)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z');
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?',
    )
      .bind(userId, since)
      .first<{ n: number }>();
    if (Number(row?.n ?? 0) >= settings.commentsPerHour)
      return json({ error: 'hourly_limit' }, 429);
  }
  return null;
}

const placeholders = (count: number) => Array(count).fill('?').join(', ');

/** Removes deleted/removed placeholders that no longer have any replies. */
async function prune(env: Env, ids: number[]) {
  if (!ids.length) return;
  await env.DB.prepare(
    `DELETE FROM comments WHERE id IN (${placeholders(ids.length)})
     AND status IN ('deleted', 'removed')
     AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = comments.id)`,
  )
    .bind(...ids)
    .run();
}

/** Author delete ('deleted') or owner delete ('removed'). */
export async function removeComment(
  env: Env,
  id: number,
  status: 'deleted' | 'removed',
) {
  const row = await env.DB.prepare(
    `SELECT id, parent_id, (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) AS replies
     FROM comments c WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; parent_id: number | null; replies: number }>();
  if (!row) return;
  if (row.replies > 0)
    await env.DB.prepare(
      `UPDATE comments SET status = ?, body = '', moderation_reason = NULL, edited_at = NULL
       WHERE id = ?`,
    )
      .bind(status, id)
      .run();
  else {
    await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    if (row.parent_id) await prune(env, [row.parent_id]);
  }
}

/** Account deletion: drop the user's text everywhere, keep others' threads. */
export async function deleteUserComments(env: Env, userId: number) {
  const { results: replies } = await env.DB.prepare(
    'SELECT DISTINCT parent_id FROM comments WHERE user_id = ? AND parent_id IS NOT NULL',
  )
    .bind(userId)
    .all<{ parent_id: number }>();
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM comments WHERE user_id = ? AND parent_id IS NOT NULL',
    ).bind(userId),
    env.DB.prepare(
      `UPDATE comments SET status = 'deleted', body = '', user_id = NULL, author = NULL,
         moderation_reason = NULL, edited_at = NULL
       WHERE user_id = ? AND parent_id IS NULL
         AND EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = comments.id)`,
    ).bind(userId),
    env.DB.prepare(
      'DELETE FROM comments WHERE user_id = ? AND parent_id IS NULL',
    ).bind(userId),
  ]);
  await prune(
    env,
    replies.map(({ parent_id }) => parent_id),
  );
}

async function list(request: Request, env: Env, allowed: Allowed) {
  const url = new URL(request.url);
  const project = url.searchParams.get('project') ?? '';
  const version = url.searchParams.get('version') || null;
  if (!(await allowed(project, version)))
    return json({ error: 'unknown_project' }, 404);
  const page = Math.max(
    1,
    Math.min(1000, Number(url.searchParams.get('page')) || 1),
  );
  const [user, settings] = await Promise.all([
    currentUser(request, env),
    getSettings(env),
  ]);
  const me = user?.id ?? -1;
  // The owner also sees held comments, to approve or remove them in place.
  const mod = user?.role === 'owner' ? 1 : 0;

  const scope = version ? 'c.project = ? AND c.version = ?' : 'c.project = ?';
  const scopeArgs = version ? [project, version] : [project];
  const visibleReply = `(r.status = 'published' OR (r.status = 'held' AND (r.user_id = ? OR ? = 1)))`;
  const visibleThread = `c.parent_id IS NULL AND (
      c.status = 'published' OR (c.status = 'held' AND (c.user_id = ? OR ? = 1))
      OR (c.status IN ('deleted', 'removed') AND EXISTS (
        SELECT 1 FROM comments r WHERE r.parent_id = c.id AND ${visibleReply})))`;

  const [threads, count, total] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(
      `SELECT c.*, u.display_name, u.role AS author_role FROM comments c LEFT JOIN users u ON u.id = c.user_id
       WHERE ${scope} AND ${visibleThread}
       ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
    ).bind(...scopeArgs, me, mod, me, mod, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM comments c WHERE ${scope} AND ${visibleThread}`,
    ).bind(...scopeArgs, me, mod, me, mod),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM comments c WHERE ${scope} AND c.status = 'published'`,
    ).bind(...scopeArgs),
  ]);

  const rows = threads.results as unknown as Row[];
  const ids = rows.map((row) => row.id);
  const replies = ids.length
    ? (
        await env.DB.prepare(
          `SELECT r.*, u.display_name, u.role AS author_role FROM comments r LEFT JOIN users u ON u.id = r.user_id
           WHERE r.parent_id IN (${placeholders(ids.length)}) AND ${visibleReply}
           ORDER BY r.created_at, r.id`,
        )
          .bind(...ids, me, mod)
          .all<Row>()
      ).results
    : [];

  const threadCount = Number(count.results[0]?.n ?? 0);
  return json({
    page,
    pages: Math.max(1, Math.ceil(threadCount / PAGE_SIZE)),
    threads: threadCount,
    total: Number(total.results[0]?.n ?? 0),
    signedIn: me !== -1,
    moderator: mod === 1,
    open: settings.commentsOpen || mod === 1,
    maxLength: mod === 1 ? COMMENT_MAX : settings.commentMaxLength,
    comments: rows.map((row) => ({
      ...serialize(row, me, mod === 1),
      replies: replies
        .filter((reply) => reply.parent_id === row.id)
        .slice(0, MAX_REPLIES)
        .map((reply) => serialize(reply, me, mod === 1)),
    })),
  });
}

async function create(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  allowed: Allowed,
) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  const settings = await getSettings(env);
  if (!settings.commentsOpen && user.role !== 'owner')
    return json({ error: 'closed' }, 403);
  if (!(await underLimit(env, `user:${user.id}`)))
    return json({ error: 'rate_limited' }, 429);
  const body = await readJson(request);
  const message = text(body?.body, 1, COMMENT_MAX);
  const locale = asLocale(body?.locale);
  const project = String(body?.project ?? '');
  let version =
    typeof body?.version === 'string' && body.version ? body.version : null;
  let parentId: number | null = null;
  if (!message || !locale) return json({ error: 'invalid' }, 400);
  if (user.role !== 'owner') {
    const limited = await limitError(env, settings, user.id, message, true);
    if (limited) return limited;
  }

  if (body?.parentId !== undefined && body.parentId !== null) {
    const parent = await env.DB.prepare(
      'SELECT id, parent_id, project, version, status FROM comments WHERE id = ?',
    )
      .bind(Number(body.parentId))
      .first<{
        id: number;
        parent_id: number | null;
        project: string;
        version: string | null;
        status: string;
      }>();
    if (!parent || parent.project !== project)
      return json({ error: 'invalid' }, 400);
    const top = parent.parent_id
      ? await env.DB.prepare(
          'SELECT id, version, status FROM comments WHERE id = ?',
        )
          .bind(parent.parent_id)
          .first<{ id: number; version: string | null; status: string }>()
      : parent;
    if (!top || top.status !== 'published' || parent.status !== 'published')
      return json({ error: 'invalid' }, 400);
    parentId = top.id;
    version = top.version;
  } else if (!(await allowed(project, version)))
    return json({ error: 'invalid' }, 400);

  const verdict =
    user.role === 'owner'
      ? ({ held: false, reason: null } as const)
      : await moderate(env, message, settings);
  const row = await env.DB.prepare(
    `INSERT INTO comments (project, version, parent_id, user_id, body, locale, status, moderation_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(
      project,
      version,
      parentId,
      user.id,
      message,
      locale,
      verdict.held ? 'held' : 'published',
      verdict.reason,
    )
    .first<Row>();
  if (verdict.held && settings.notifyHeld)
    ctx.waitUntil(
      notifyHeld(env, new URL(request.url).origin, {
        project,
        version,
        author: user.displayName,
        body: message,
        reason: verdict.reason,
      }).catch((error) => console.error('notify failed', error)),
    );
  return json(
    {
      comment: serialize(
        { ...row!, display_name: user.displayName, author_role: user.role },
        user.id,
      ),
    },
    201,
  );
}

async function edit(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  id: number,
) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  if (!(await underLimit(env, `user:${user.id}`)))
    return json({ error: 'rate_limited' }, 429);
  const message = text((await readJson(request))?.body, 1, COMMENT_MAX);
  if (!message) return json({ error: 'invalid' }, 400);
  const settings = await getSettings(env);
  if (!settings.commentsOpen && user.role !== 'owner')
    return json({ error: 'closed' }, 403);
  if (user.role !== 'owner') {
    const limited = await limitError(env, settings, user.id, message, false);
    if (limited) return limited;
  }
  const row = await env.DB.prepare(
    'SELECT user_id, status FROM comments WHERE id = ?',
  )
    .bind(id)
    .first<{ user_id: number | null; status: string }>();
  if (
    !row ||
    row.user_id !== user.id ||
    !['published', 'held'].includes(row.status)
  )
    return json({ error: 'not_found' }, 404);
  const verdict =
    user.role === 'owner'
      ? ({ held: false, reason: null } as const)
      : await moderate(env, message, settings);
  const updated = await env.DB.prepare(
    `UPDATE comments SET body = ?, status = ?, moderation_reason = ?, edited_at = ?
     WHERE id = ? RETURNING *`,
  )
    .bind(
      message,
      verdict.held ? 'held' : 'published',
      verdict.reason,
      new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      id,
    )
    .first<Row>();
  if (verdict.held && updated && settings.notifyHeld)
    ctx.waitUntil(
      notifyHeld(env, new URL(request.url).origin, {
        project: updated.project,
        version: updated.version,
        author: user.displayName,
        body: message,
        reason: verdict.reason,
      }).catch((error) => console.error('notify failed', error)),
    );
  return json({
    comment: serialize(
      { ...updated!, display_name: user.displayName, author_role: user.role },
      user.id,
    ),
  });
}

async function destroy(request: Request, env: Env, id: number) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  const row = await env.DB.prepare(
    'SELECT user_id, status FROM comments WHERE id = ?',
  )
    .bind(id)
    .first<{ user_id: number | null; status: string }>();
  const own = row?.user_id === user.id;
  if (
    !row ||
    (!own && user.role !== 'owner') ||
    !['published', 'held'].includes(row.status)
  )
    return json({ error: 'not_found' }, 404);
  await removeComment(env, id, own ? 'deleted' : 'removed');
  return json({ status: own ? 'deleted' : 'removed' });
}

/** Owner only: publish a comment that moderation held back. */
async function approve(request: Request, env: Env, id: number) {
  const user = await currentUser(request, env);
  if (user?.role !== 'owner') return json({ error: 'not_found' }, 404);
  await env.DB.prepare(
    `UPDATE comments SET status = 'published', moderation_reason = NULL
     WHERE id = ? AND status = 'held'`,
  )
    .bind(id)
    .run();
  return json({ status: 'published' });
}

/** Handles /api/comments and /api/comments/:id. Returns null otherwise. */
export function comments(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  path: string,
  allowed: Allowed,
) {
  if (path === '/api/comments') {
    if (request.method === 'GET') return list(request, env, allowed);
    if (request.method === 'POST') return create(request, env, ctx, allowed);
    return json({ error: 'method_not_allowed' }, 405);
  }
  const match = /^\/api\/comments\/(\d{1,12})(\/approve)?$/.exec(path);
  if (!match) return null;
  const id = Number(match[1]);
  if (match[2])
    return request.method === 'POST'
      ? approve(request, env, id)
      : json({ error: 'method_not_allowed' }, 405);
  if (request.method === 'PATCH') return edit(request, env, ctx, id);
  if (request.method === 'DELETE') return destroy(request, env, id);
  return json({ error: 'method_not_allowed' }, 405);
}
