// Google sign-in (worker/auth.ts): OpenID Connect code flow with PKCE.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { idToken, sessionCookie, setup } from './harness.ts';

const CLIENT = 'client-123.apps.googleusercontent.com';
type T = ReturnType<typeof setup>;

const google = () =>
  setup({ env: { GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 'shh' } });
const claims = (extra: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: 'google-sub-1',
  email: 'Visitor@Example.com',
  email_verified: true,
  name: 'Visitor',
  ...extra,
});

/** Starts sign-in; returns the state Google would echo and the OAuth cookie. */
async function begin(t: T, back = '/en/pet-desktop') {
  const response = await t.call(
    `/api/auth/google?locale=en&return=${encodeURIComponent(back)}`,
  );
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location')!);
  const set = response.headers.getSetCookie()[0]!;
  return {
    location,
    set,
    state: location.searchParams.get('state')!,
    cookie: set.split(';')[0]!,
  };
}
const finish = (t: T, cookie: string, query: string) =>
  t.call(`/api/auth/google/callback?${query}`, { cookie });

test('start: PKCE S256, a state, and a short-lived locked-down cookie', async () => {
  const t = google();
  const { location, set, state } = await begin(t);
  assert.equal(
    location.origin + location.pathname,
    'https://accounts.google.com/o/oauth2/v2/auth',
  );
  assert.equal(location.searchParams.get('client_id'), CLIENT);
  assert.equal(
    location.searchParams.get('redirect_uri'),
    'https://chilolab.com/api/auth/google/callback',
  );
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(state.length >= 16);
  assert.match(set, /^__Host-chilolab_oauth=/);
  for (const flag of ['Max-Age=600', 'HttpOnly', 'Secure', 'SameSite=Lax'])
    assert.ok(set.includes(flag), flag);
  // The verifier stays in the cookie; only its hash goes to Google.
  const saved = JSON.parse(
    atob(set.split(';')[0]!.split('=').slice(1).join('=')),
  );
  const challenge = createHash('sha256')
    .update(saved.verifier)
    .digest('base64url');
  assert.equal(location.searchParams.get('code_challenge'), challenge);
  assert.ok(!location.href.includes(saved.verifier));
});

test('start without Google credentials says unavailable', async () => {
  const t = setup();
  const response = await t.call('/api/auth/google?locale=en');
  assert.equal(
    response.headers.get('Location'),
    '/en/user/login?error=unavailable',
  );
});

test('a valid callback signs in, links the account and goes back', async () => {
  const t = google();
  const existing = t.addUser('visitor@example.com');
  const { cookie, state } = await begin(t);
  t.googleAnswers({ id_token: idToken(claims()) });
  const response = await finish(t, cookie, `code=abc&state=${state}`);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/en/pet-desktop');
  assert.ok(sessionCookie(response));
  const user = t.db.prepare('SELECT id, google_sub FROM users').all() as {
    id: number;
    google_sub: string;
  }[];
  assert.deepEqual(
    user.map((row) => ({ ...row })),
    [{ id: existing, google_sub: 'google-sub-1' }],
  );
  // The code verifier from the cookie goes to Google with the code.
  const exchange = t.outbound.find((sent) =>
    sent.url.includes('oauth2.googleapis.com'),
  )!;
  const saved = JSON.parse(atob(cookie.split('=').slice(1).join('=')));
  assert.equal(
    (exchange.body as Record<string, string>).code_verifier,
    saved.verifier,
  );
});

test('a wrong or missing state is refused before asking Google', async () => {
  const t = google();
  const { cookie } = await begin(t);
  for (const query of ['code=abc&state=forged', 'code=abc']) {
    const response = await finish(t, cookie, query);
    assert.equal(
      response.headers.get('Location'),
      '/en/user/login?error=expired',
    );
  }
  const noCookie = await finish(t, '', 'code=abc&state=x');
  assert.equal(noCookie.headers.get('Location'), '/user/login?error=expired');
  assert.ok(
    !t.outbound.some((sent) => sent.url.includes('oauth2.googleapis.com')),
  );
  assert.equal(
    (t.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number })
      .n,
    0,
  );
});

test('cancelling at Google is reported as cancelled', async () => {
  const t = google();
  const { cookie, state } = await begin(t);
  const response = await finish(
    t,
    cookie,
    `error=access_denied&state=${state}`,
  );
  assert.equal(
    response.headers.get('Location'),
    '/en/user/login?error=cancelled',
  );
});

test('ID tokens with a bad issuer, audience, expiry or unverified email are refused', async () => {
  const bad = [
    { iss: 'https://evil.example' },
    { aud: 'someone-else' },
    { exp: Math.floor(Date.now() / 1000) - 10 },
    { email_verified: false },
    { email: undefined },
  ];
  for (const extra of bad) {
    const t = google();
    const { cookie, state } = await begin(t);
    t.googleAnswers({ id_token: idToken(claims(extra)) });
    const response = await finish(t, cookie, `code=abc&state=${state}`);
    assert.equal(
      response.headers.get('Location'),
      '/en/user/login?error=google',
      JSON.stringify(extra),
    );
    assert.equal(sessionCookie(response), undefined);
    assert.equal(
      (t.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number })
        .n,
      0,
    );
  }
});

test('Google refusing the code is an error, not a sign-in', async () => {
  const t = google();
  const { cookie, state } = await begin(t);
  t.googleAnswers(null);
  const response = await finish(t, cookie, `code=abc&state=${state}`);
  assert.equal(response.headers.get('Location'), '/en/user/login?error=google');
});

test('blocked accounts and closed sign-ups get no session', async () => {
  const blocked = google();
  const id = blocked.addUser('visitor@example.com');
  blocked.db
    .prepare(
      "UPDATE users SET blocked_at = '2026-01-01T00:00:00Z' WHERE id = ?",
    )
    .run(id);
  let flow = await begin(blocked);
  blocked.googleAnswers({ id_token: idToken(claims()) });
  let response = await finish(
    blocked,
    flow.cookie,
    `code=a&state=${flow.state}`,
  );
  assert.equal(
    response.headers.get('Location'),
    '/en/user/login?error=blocked',
  );
  assert.equal(sessionCookie(response), undefined);

  const closed = google();
  closed.db
    .prepare("INSERT INTO settings (key, value) VALUES ('signups', '0')")
    .run();
  flow = await begin(closed);
  closed.googleAnswers({ id_token: idToken(claims()) });
  response = await finish(closed, flow.cookie, `code=a&state=${flow.state}`);
  assert.equal(
    response.headers.get('Location'),
    '/en/user/login?error=registration_closed',
  );
  assert.equal(
    (
      closed.db.prepare('SELECT COUNT(*) AS n FROM users').get() as {
        n: number;
      }
    ).n,
    0,
  );
});

test('the return path cannot leave the site', async () => {
  const t = google();
  const { cookie, state } = await begin(t, '//evil.example/x');
  t.googleAnswers({ id_token: idToken(claims()) });
  const response = await finish(t, cookie, `code=abc&state=${state}`);
  assert.equal(response.headers.get('Location'), '/');
});
