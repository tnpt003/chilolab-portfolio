import {
  asLocale,
  json,
  readJson,
  safeReturn,
  sha256,
  text,
  underLimit,
  type Env,
} from './env';
import { mailEnabled, sendMail } from './mail';
import { createSession } from './session';
import { getSettings } from './settings';
import { human } from './turnstile';

// Passwordless sign-in / sign-up: a 6-digit code sent by email.
// Codes are stored hashed, expire after 10 minutes and allow 5 attempts.
// Sending needs Turnstile and is limited to one code per minute and five
// per hour for each address, so the form cannot be used to flood inboxes.

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

const stamp = (time = Date.now()) =>
  new Date(time).toISOString().replace(/\.\d+Z$/, 'Z');

function newCode() {
  // 2^32 / 10^6 leaves a negligible modulo bias.
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, '0');
}

function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const readEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const mail = {
  vi: (code: string) => ({
    subject: `Mã đăng nhập ChiloLab: ${code}`,
    lines: [
      `Mã đăng nhập ChiloLab của bạn là: ${code}`,
      'Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với ai.',
      'Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.',
    ],
  }),
  en: (code: string) => ({
    subject: `Your ChiloLab sign-in code: ${code}`,
    lines: [
      `Your ChiloLab sign-in code is: ${code}`,
      'It is valid for 10 minutes. Do not share it with anyone.',
      'If you did not try to sign in, you can ignore this email.',
    ],
  }),
};

async function start(request: Request, env: Env) {
  const settings = await getSettings(env);
  if (!mailEnabled(env) || !settings.emailLogin)
    return json({ error: 'unavailable' }, 503);
  const body = await readJson(request);
  const email = readEmail(body?.email);
  const locale = asLocale(body?.locale) ?? 'vi';
  if (email.length > 254 || !EMAIL.test(email))
    return json({ error: 'invalid_email' }, 400);
  // With sign-ups closed, no code is sent to an address without an account.
  if (
    !settings.signups &&
    !(await env.DB.prepare('SELECT 1 FROM users WHERE email = ?')
      .bind(email)
      .first())
  )
    return json({ error: 'registration_closed' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (
    !(await underLimit(env, `ip:${ip}`)) ||
    !(await underLimit(env, `mail:${email}`))
  )
    return json({ error: 'rate_limited' }, 429);
  if (!(await human(request, env, body?.token)))
    return json({ error: 'verification_failed' }, 403);

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MAX(created_at) AS last FROM email_codes
     WHERE email = ? AND created_at > ?`,
  )
    .bind(email, stamp(Date.now() - 3600_000))
    .first<{ n: number; last: string | null }>();
  if (
    (recent?.n ?? 0) >= 5 ||
    (recent?.last && Date.parse(recent.last) > Date.now() - 60_000)
  )
    return json({ error: 'rate_limited' }, 429);

  const code = newCode();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM email_codes WHERE expires_at < ?').bind(
      stamp(Date.now() - 3600_000),
    ),
    env.DB.prepare(
      'INSERT INTO email_codes (email, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(
      email,
      await sha256(`${email}:${code}`),
      stamp(),
      stamp(Date.now() + TTL_MS),
    ),
  ]);
  const message = mail[locale](code);
  if (!(await sendMail(env, email, message.subject, message.lines)))
    return json({ error: 'mail_failed' }, 502);
  return json({ status: 'sent' });
}

async function verify(request: Request, env: Env) {
  const settings = await getSettings(env);
  if (!mailEnabled(env) || !settings.emailLogin)
    return json({ error: 'unavailable' }, 503);
  const body = await readJson(request);
  const email = readEmail(body?.email);
  const code = String(body?.code ?? '').replace(/\D/g, '');
  if (!EMAIL.test(email) || code.length !== 6)
    return json({ error: 'invalid_code' }, 400);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await underLimit(env, `ip:${ip}`)))
    return json({ error: 'rate_limited' }, 429);

  const row = await env.DB.prepare(
    `SELECT id, code_hash, attempts FROM email_codes
     WHERE email = ? AND expires_at > ? ORDER BY id DESC LIMIT 1`,
  )
    .bind(email, stamp())
    .first<{ id: number; code_hash: string; attempts: number }>();
  if (!row) return json({ error: 'invalid_code' }, 400);
  if (row.attempts >= MAX_ATTEMPTS)
    return json({ error: 'too_many_attempts' }, 429);
  if (!sameHash(await sha256(`${email}:${code}`), row.code_hash)) {
    await env.DB.prepare(
      'UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?',
    )
      .bind(row.id)
      .run();
    return json({ error: 'invalid_code' }, 400);
  }

  await env.DB.prepare('DELETE FROM email_codes WHERE email = ?')
    .bind(email)
    .run();
  const now = stamp();
  let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number }>();
  if (user)
    await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(now, user.id)
      .run();
  else if (!settings.signups)
    return json({ error: 'registration_closed' }, 403);
  else
    user = await env.DB.prepare(
      `INSERT INTO users (email, display_name, last_login_at) VALUES (?, ?, ?) RETURNING id`,
    )
      .bind(email, text(email.split('@')[0], 1, 40) ?? 'Người dùng', now)
      .first<{ id: number }>();
  if (!user) return json({ error: 'server_error' }, 500);
  return json(
    {
      status: 'signed_in',
      return: safeReturn(typeof body?.return === 'string' ? body.return : null),
    },
    200,
    { 'Set-Cookie': await createSession(env, user.id) },
  );
}

/** POST /api/auth/email/start and /api/auth/email/verify. */
export function emailLogin(request: Request, env: Env, path: string) {
  if (request.method !== 'POST') return null;
  if (path === '/api/auth/email/start') return start(request, env);
  if (path === '/api/auth/email/verify') return verify(request, env);
  return null;
}
