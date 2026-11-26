import { baseHeaders, json, randomToken, redirect, type Env } from './env';
import { currentUser } from './session';

// Sveltia CMS (public/admin) signs in through the owner's site account
// instead of a GitHub login: /admin opens only for an owner session, and
// /api/cms/auth hands the CMS a GitHub token kept as a Worker secret
// (CMS_GITHUB_TOKEN, a fine-grained token limited to the site repository).
// The token reaches only the owner's browser, and only this origin's page.

/** The CMS page and its config: owner session only, otherwise sign in. */
export async function cmsPage(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (user?.role === 'owner') return env.ASSETS.fetch(request);
  if (user || request.method !== 'GET')
    return new Response('Forbidden', {
      status: 403,
      headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  return redirect(`/user/login?${new URLSearchParams({ return: '/admin' })}`);
}

/**
 * Token for the owner's /admin page (public/admin/boot.js), so the CMS signs
 * in on its own without the "Sign In with GitHub" popup. Same-origin fetches
 * from an owner session only; everything else gets an error and no token.
 */
export async function cmsToken(request: Request, env: Env) {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return json({ error: 'Forbidden' }, 403);
  const user = await currentUser(request, env);
  if (user?.role !== 'owner') return json({ error: 'Forbidden' }, 403);
  if (!env.CMS_GITHUB_TOKEN)
    return json({ error: 'CMS_GITHUB_TOKEN is not set on the Worker.' }, 503);
  return json({ token: env.CMS_GITHUB_TOKEN });
}

/**
 * Popup opened by the CMS "Sign In with GitHub" button. It follows the
 * Decap/Sveltia popup protocol: announce "authorizing:github", then answer
 * the opener with the result, posted only to this site's origin.
 */
export async function cmsAuth(request: Request, env: Env) {
  const url = new URL(request.url);
  const user = await currentUser(request, env);
  let result: { state: 'success' | 'error'; content: unknown };
  if (user?.role !== 'owner')
    result = {
      state: 'error',
      content: {
        error: 'Sign in at /user/login with the owner account, then retry.',
      },
    };
  else if (url.searchParams.get('provider') !== 'github')
    result = { state: 'error', content: { error: 'Unsupported provider.' } };
  else if (!env.CMS_GITHUB_TOKEN)
    result = {
      state: 'error',
      content: { error: 'CMS_GITHUB_TOKEN is not set on the Worker.' },
    };
  else
    result = {
      state: 'success',
      content: { provider: 'github', token: env.CMS_GITHUB_TOKEN },
    };

  const message = `authorization:github:${result.state}:${JSON.stringify(result.content)}`;
  const nonce = randomToken(16);
  // JSON strings are valid JS literals; escaping "<" keeps the script closed.
  const literal = (value: string) =>
    JSON.stringify(value).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>ChiloLab CMS sign-in</title></head>
<body><p>${result.state === 'success' ? 'Signed in. You can close this window.' : 'Sign-in failed. Close this window and check the CMS.'}</p>
<script nonce="${nonce}">
(() => {
  const origin = ${literal(url.origin)};
  const message = ${literal(message)};
  if (!window.opener) return;
  window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.data !== 'authorizing:github') return;
    window.opener.postMessage(message, origin);
  });
  window.opener.postMessage('authorizing:github', origin);
})();
</script></body></html>`;
  return new Response(html, {
    status: result.state === 'success' ? 200 : 403,
    headers: {
      ...baseHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
      // Same value as the /admin page, so the popup keeps its opener.
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  });
}
