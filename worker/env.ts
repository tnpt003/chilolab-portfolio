export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI: Ai;
  /** 10 writes per minute per user or IP; a loose filter, not a guarantee. */
  WRITE_LIMIT: RateLimit;
  /** Secret: `wrangler secret put TURNSTILE_SECRET`. */
  TURNSTILE_SECRET?: string;
  /** e.g. chilolab.cloudflareaccess.com — from Zero Trust settings. */
  ACCESS_TEAM_DOMAIN: string;
  /** Application Audience (AUD) tag of the Access application for /manage. */
  ACCESS_AUD: string;
  /** Local only (.dev.vars): skip Access on localhost. */
  ADMIN_DEV_BYPASS?: string;
  /** Google OAuth client (public id in vars, secret via `wrangler secret`). */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Secret: Resend API key for sign-in codes and owner notifications. */
  RESEND_API_KEY?: string;
  /** Sender, e.g. "ChiloLab <no-reply@chilolab.com>" (domain verified in Resend). */
  MAIL_FROM: string;
}

export const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

export function json(body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      ...extra,
    },
  });
}

export function redirect(
  location: string,
  status = 302,
  extra: HeadersInit = {},
) {
  return new Response(null, {
    status,
    headers: { ...baseHeaders, Location: location, ...extra },
  });
}

/** Rejects cross-site writes (CSRF and spam from other origins). */
export function sameOrigin(request: Request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}

const MAX_BODY = 16 * 1024;

export async function readJson(request: Request) {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY)
    return null;
  const body = await request.text();
  if (body.length > MAX_BODY) return null;
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Trimmed text without control characters (newlines and tabs kept). */
export function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string') return null;
  const clean = value
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return clean.length >= min && clean.length <= max ? clean : null;
}

export function optional(value: unknown, max: number) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, 1, max);
}

export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];
export const asLocale = (value: unknown) =>
  locales.find((locale) => locale === value);

/** Same-site relative path, used for post-login returns. */
export function safeReturn(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '/';
  return value.slice(0, 300);
}

export async function sha256(input: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function underLimit(env: Env, key: string) {
  try {
    return (await env.WRITE_LIMIT.limit({ key })).success;
  } catch {
    return true;
  }
}
