import type { Env } from './env';

/** Verifies a Cloudflare Turnstile token (anti-spam) server-side. */
export async function human(request: Request, env: Env, token: unknown) {
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
