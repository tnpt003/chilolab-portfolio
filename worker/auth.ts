import { deleteUserComments } from './comments';
import { emailLogin } from './email-login';
import { mailEnabled } from './mail';
import { alertOwnerSignIn, countAuth } from './security';
import { getSettings } from './settings';
import {
  json,
  randomToken,
  readJson,
  redirect,
  safeReturn,
  text,
  type Env,
} from './env';
import {
  ADMIN_HINT,
  cookie,
  createSession,
  currentUser,
  endSession,
  readCookie,
} from './session';

// Google sign-in (OpenID Connect authorization code flow with PKCE).
// The ID token comes straight from Google's token endpoint over TLS, so its
// claims are trusted after checking issuer, audience, expiry and email_verified.
// https://developers.google.com/identity/openid-connect/openid-connect

const OAUTH_COOKIE = '__Host-chilolab_oauth';
const loginPath = (locale: string) =>
  locale === 'en' ? '/en/user/login' : '/user/login';

function base64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeClaims(token: string) {
  const part = token.split('.')[1] ?? '';
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return JSON.parse(
    new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
  ) as Record<string, unknown>;
}

async function startGoogle(request: Request, env: Env) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'vi';
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    return redirect(`${loginPath(locale)}?error=unavailable`);
  const state = randomToken(16);
  const verifier = randomToken(32);
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  const back = safeReturn(url.searchParams.get('return'));
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  const payload = btoa(JSON.stringify({ state, verifier, back, locale }));
  return redirect(google.toString(), 302, {
    'Set-Cookie': cookie(OAUTH_COOKIE, payload, 600),
  });
}

async function finishGoogle(request: Request, env: Env) {
  const url = new URL(request.url);
  let saved: { state: string; verifier: string; back: string; locale: string };
  try {
    saved = JSON.parse(atob(readCookie(request, OAUTH_COOKIE) ?? ''));
  } catch {
    return redirect(`${loginPath('vi')}?error=expired`);
  }
  const clear = { 'Set-Cookie': cookie(OAUTH_COOKIE, '', 0) };
  const fail = async (reason: string) => {
    if (reason === 'google') await countAuth(env, 'google_failed');
    return redirect(`${loginPath(saved.locale)}?error=${reason}`, 302, clear);
  };

  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== saved.state)
    return fail(
      url.searchParams.get('error') === 'access_denied'
        ? 'cancelled'
        : 'expired',
    );
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    return fail('unavailable');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: saved.verifier,
    }),
  });
  if (!response.ok) return fail('google');
  const { id_token } = (await response.json()) as { id_token?: string };
  if (!id_token) return fail('google');

  const claims = decodeClaims(id_token);
  const issuerOk =
    claims.iss === 'https://accounts.google.com' ||
    claims.iss === 'accounts.google.com';
  if (
    !issuerOk ||
    claims.aud !== env.GOOGLE_CLIENT_ID ||
    typeof claims.exp !== 'number' ||
    claims.exp < Date.now() / 1000 ||
    typeof claims.sub !== 'string' ||
    typeof claims.email !== 'string' ||
    claims.email_verified !== true
  )
    return fail('google');

  const email = claims.email.toLowerCase();
  const name =
    text(claims.name, 1, 40) ??
    text(email.split('@')[0], 1, 40) ??
    'Người dùng';
  const now = new Date().toISOString();

  let user = await env.DB.prepare(
    'SELECT id, blocked_at, role FROM users WHERE google_sub = ? OR email = ? ORDER BY google_sub = ? DESC LIMIT 1',
  )
    .bind(claims.sub, email, claims.sub)
    .first<{ id: number; blocked_at?: string | null; role?: string }>();
  if (user?.blocked_at) return fail('blocked');
  if (user)
    await env.DB.prepare(
      'UPDATE users SET google_sub = ?, email = ?, last_login_at = ? WHERE id = ?',
    )
      .bind(claims.sub, email, now, user.id)
      .run();
  else if (!(await getSettings(env)).signups)
    return fail('registration_closed');
  else {
    user = await env.DB.prepare(
      `INSERT INTO users (google_sub, email, display_name, last_login_at)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
      .bind(claims.sub, email, name, now)
      .first<{ id: number }>();
    await countAuth(env, 'signup');
  }
  if (!user) return fail('google');
  await countAuth(env, 'signin_google');
  if (user.role === 'owner') await alertOwnerSignIn(env, request, email);

  const headers = new Headers({ Location: safeReturn(saved.back) });
  headers.append('Set-Cookie', clear['Set-Cookie']);
  headers.append('Set-Cookie', await createSession(env, user.id));
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
}

async function me(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (request.method === 'GET') {
    const settings = await getSettings(env);
    // The owner bar on the public site shows what is waiting in /admin/manage.
    const pending =
      user?.role === 'owner'
        ? await env.DB.prepare(
            `SELECT (SELECT COUNT(*) FROM comments WHERE status = 'held') AS held,
                    (SELECT COUNT(*) FROM feedback WHERE status = 'new') AS feedback`,
          ).first<{ held: number; feedback: number }>()
        : null;
    // A readable hint so the public site only asks /api/me when it may be
    // the owner; it grants nothing (the owner bar still checks this answer).
    const hinted = readCookie(request, ADMIN_HINT) !== null;
    const hint = cookie(ADMIN_HINT, '1', 30 * 86400).replace('; HttpOnly', '');
    const clearHint = cookie(ADMIN_HINT, '', 0).replace('; HttpOnly', '');
    const extra: HeadersInit =
      user?.role === 'owner'
        ? { 'Set-Cookie': hint }
        : hinted
          ? { 'Set-Cookie': clearHint }
          : {};
    return json(
      {
        user: user && {
          displayName: user.displayName,
          email: user.email,
          owner: user.role === 'owner',
        },
        ...(pending && {
          pending: {
            held: Number(pending.held),
            feedback: Number(pending.feedback),
          },
        }),
        providers: {
          google: Boolean(env.GOOGLE_CLIENT_ID),
          email: mailEnabled(env) && settings.emailLogin,
        },
      },
      200,
      extra,
    );
  }
  if (!user) return json({ error: 'unauthenticated' }, 401);

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    const name = text(body?.displayName, 2, 40);
    if (!name) return json({ error: 'invalid' }, 400);
    await env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .bind(name, user.id)
      .run();
    return json({ user: { displayName: name, email: user.email } });
  }
  if (request.method === 'DELETE') {
    await deleteUserComments(env, user.id);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      // Also removed by ON DELETE CASCADE; explicit so it never depends on it.
      env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(
        user.id,
      ),
      env.DB.prepare('DELETE FROM notice_deliveries WHERE user_id = ?').bind(
        user.id,
      ),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ]);
    return json({ status: 'deleted' }, 200, {
      'Set-Cookie': await endSession(request, env),
    });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

/** Handles /user, /api/auth/* and /api/me. Returns null for other paths. */
export async function auth(request: Request, env: Env, path: string) {
  if (request.method === 'GET' && (path === '/user' || path === '/en/user'))
    return redirect(`${path}/login`, 301);
  if (path === '/api/auth/google' && request.method === 'GET')
    return startGoogle(request, env);
  if (path === '/api/auth/google/callback' && request.method === 'GET')
    return finishGoogle(request, env);
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const headers = new Headers();
    headers.append('Set-Cookie', await endSession(request, env));
    headers.append(
      'Set-Cookie',
      cookie(ADMIN_HINT, '', 0).replace('; HttpOnly', ''),
    );
    return json({ status: 'signed_out' }, 200, headers);
  }
  if (path === '/api/me') return me(request, env);
  return emailLogin(request, env, path);
}
