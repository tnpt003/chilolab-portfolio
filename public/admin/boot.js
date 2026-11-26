// Signs Sveltia CMS in with the owner's site session, so /admin needs no
// "Sign In with GitHub" click: /api/cms/token (worker/cms.ts) returns the
// CMS_GITHUB_TOKEN secret to an owner session only, and Sveltia picks up the
// account cached under "sveltia-cms.user" when it starts. If the request
// fails, the CMS still loads and the sign-in button (popup) remains.
//
// Sveltia CMS is pinned with Subresource Integrity. To upgrade, change the
// version and recompute the hash (see docs/CMS.md).
const CMS_SRC = 'https://unpkg.com/@sveltia/cms@0.264.0/dist/sveltia-cms.js';
const CMS_INTEGRITY =
  'sha384-nXK/TrW1zvoqO7/l1W1waX3rDZgUlvE9E6bbW8BEUd/56zTeT7PQSk7Pxb+i6tJN';
const USER_KEY = 'sveltia-cms.user';

async function cacheOwnerToken() {
  try {
    const response = await fetch('/api/cms/token', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return;
    const { token } = await response.json();
    if (typeof token !== 'string' || !token) return;
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    } catch {}
    // Keep Sveltia's cached profile when it already holds this token;
    // otherwise (first visit, signed out, rotated token) store it afresh.
    if (cached?.backendName === 'github' && cached.token === token) return;
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ backendName: 'github', token }),
    );
  } catch {}
}

function loadCms() {
  const script = document.createElement('script');
  script.src = CMS_SRC;
  script.integrity = CMS_INTEGRITY;
  script.crossOrigin = 'anonymous';
  document.body.append(script);
}

cacheOwnerToken().finally(loadCms);
