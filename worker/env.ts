export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Secret: `wrangler secret put TURNSTILE_SECRET`. */
  TURNSTILE_SECRET?: string;
  /** e.g. chilolab.cloudflareaccess.com — from Zero Trust settings. */
  ACCESS_TEAM_DOMAIN: string;
  /** Application Audience (AUD) tag of the Access application for /manage. */
  ACCESS_AUD: string;
  /** Local only (.dev.vars): skip Access on localhost. */
  ADMIN_DEV_BYPASS?: string;
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

/** Rejects cross-site POSTs (CSRF and spam from other origins). */
export function sameOrigin(request: Request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
