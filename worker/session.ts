import { randomToken, sha256, type Env } from './env';

// Session cookie: random 256-bit token, HttpOnly, Secure, SameSite=Lax.
// The __Host- prefix pins it to this exact host and path "/".
const COOKIE = '__Host-chilolab_session';
const DAYS = 30;
/** The owner opens /admin/manage, so a stolen owner cookie works for less time. */
export const OWNER_DAYS = 7;
/** Readable hint for the public site's owner bar; never grants access. */
export const ADMIN_HINT = '__Host-chilolab_admin';

/** Same format as the sessions.created_at default, so strings compare. */
const stamp = (time: number) =>
  new Date(time).toISOString().replace(/\.\d+Z$/, 'Z');

export type User = {
  id: number;
  email: string;
  displayName: string;
  role: 'member' | 'owner';
};

export function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSession(env: Env, userId: number) {
  const owner = await env.DB.prepare(
    "SELECT 1 FROM users WHERE id = ? AND role = 'owner'",
  )
    .bind(userId)
    .first();
  const days = owner ? OWNER_DAYS : DAYS;
  const token = randomToken();
  const expires = new Date(Date.now() + days * 86400_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  )
    .bind(await sha256(token), userId, expires)
    .run();
  return cookie(COOKIE, token, days * 86400);
}

export async function currentUser(request: Request, env: Env) {
  const token = readCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.display_name AS displayName, users.role
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?
       AND users.blocked_at IS NULL
       AND (users.role <> 'owner' OR sessions.created_at > ?)`,
  )
    // The created_at check also cuts owner sessions made before the 7-day
    // limit existed, and any session of an account later promoted to owner.
    .bind(
      await sha256(token),
      new Date().toISOString(),
      stamp(Date.now() - OWNER_DAYS * 86400_000),
    )
    .first<User>();
  return row ?? null;
}

export async function endSession(request: Request, env: Env) {
  const token = readCookie(request, COOKIE);
  if (token)
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256(token))
      .run();
  return cookie(COOKIE, '', 0);
}
