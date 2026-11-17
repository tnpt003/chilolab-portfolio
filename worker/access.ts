import type { Env } from './env';

// Cloudflare Access puts a signed JWT on every request it lets through.
// Verifying it here means /manage stays closed even if the Access
// application is misconfigured or the Worker is reached another way.
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

type Key = JsonWebKey & { kid?: string };
let cache: { team: string; at: number; keys: Key[] } | undefined;

function decode(part: string) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function keys(team: string, refresh: boolean) {
  if (!refresh && cache?.team === team && Date.now() - cache.at < 3600_000)
    return cache.keys;
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) return [];
  const body = (await response.json()) as { keys?: Key[] };
  cache = { team, at: Date.now(), keys: body.keys ?? [] };
  return cache.keys;
}

/** Returns the signed-in email, or null when the request is not allowed. */
export async function adminIdentity(request: Request, env: Env) {
  const host = new URL(request.url).hostname;
  if (
    env.ADMIN_DEV_BYPASS === '1' &&
    (host === 'localhost' || host === '127.0.0.1')
  )
    return 'local-dev';

  const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(
    /\/+$/,
    '',
  );
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!team || !env.ACCESS_AUD || !token) return null;

  try {
    const [head, body, signature] = token.split('.');
    if (!head || !body || !signature) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(head))) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;

    let jwk = (await keys(team, false)).find((key) => key.kid === header.kid);
    jwk ??= (await keys(team, true)).find((key) => key.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(signature),
      new TextEncoder().encode(`${head}.${body}`),
    );
    if (!valid) return null;

    const claims = JSON.parse(new TextDecoder().decode(decode(body))) as {
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
      email?: string;
    };
    const now = Date.now() / 1000;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(env.ACCESS_AUD)) return null;
    if (claims.iss !== `https://${team}`) return null;
    if (typeof claims.exp !== 'number' || claims.exp < now) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > now + 60) return null;
    return claims.email ?? 'access-user';
  } catch {
    return null;
  }
}
