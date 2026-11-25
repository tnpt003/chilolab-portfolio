import type { Env } from './env';

// Local development only: with ADMIN_DEV_BYPASS=1 in .dev.vars, /admin/manage
// opens on localhost without signing in. Never set it in production; on any
// other host this always refuses. (Cloudflare Access was removed on
// 2026-11-25: the panel now opens only for an owner account session.)

/** Returns a label for the local developer, or null. */
export function devIdentity(request: Request, env: Env) {
  const host = new URL(request.url).hostname;
  return env.ADMIN_DEV_BYPASS === '1' &&
    (host === 'localhost' || host === '127.0.0.1')
    ? 'local-dev'
    : null;
}
