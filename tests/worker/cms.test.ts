// Sveltia CMS sign-in (worker/cms.ts): the CMS_GITHUB_TOKEN secret reaches
// only an owner session on this origin; every other caller gets no token.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup } from './harness.ts';

const SECRET = 'github-token-secret';

async function people() {
  const t = setup();
  return {
    t,
    member: await t.session(t.addUser('member@example.com')),
    owner: await t.session(t.addUser('owner@example.com', 'owner')),
  };
}

test('/admin: anonymous is sent to sign in, a member is refused, the owner gets the CMS', async () => {
  const { t, member, owner } = await people();
  const anonymous = await t.call('/admin');
  assert.equal(anonymous.status, 302);
  assert.equal(
    anonymous.headers.get('Location'),
    '/user/login?return=%2Fadmin',
  );
  assert.equal((await t.call('/admin', { cookie: member })).status, 403);
  assert.equal(
    (await t.call('/admin/config.yml', { cookie: member })).status,
    403,
  );
  const page = await t.call('/admin', { cookie: owner });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), 'asset /admin');
});

test('/api/cms/token hands the token to the owner only', async () => {
  const { t, member, owner } = await people();
  for (const cookie of [undefined, member]) {
    const response = await t.call('/api/cms/token', { cookie });
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), new RegExp(SECRET));
  }
  const response = await t.call('/api/cms/token', {
    cookie: owner,
    headers: { 'Sec-Fetch-Site': 'same-origin' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { token: SECRET });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('/api/cms/token refuses cross-site requests even with an owner cookie', async () => {
  const { t, owner } = await people();
  for (const site of ['cross-site', 'same-site', 'none']) {
    const response = await t.call('/api/cms/token', {
      cookie: owner,
      headers: { 'Sec-Fetch-Site': site },
    });
    assert.equal(response.status, 403, site);
    assert.doesNotMatch(await response.text(), new RegExp(SECRET), site);
  }
});

test('/api/cms/token without the secret says so and leaks nothing', async () => {
  const t = setup({ env: { CMS_GITHUB_TOKEN: undefined } });
  const owner = await t.session(t.addUser('owner@example.com', 'owner'));
  const response = await t.call('/api/cms/token', { cookie: owner });
  assert.equal(response.status, 503);
});

test('/api/cms/auth: the popup carries the token for the owner only', async () => {
  const { t, member, owner } = await people();
  for (const cookie of [undefined, member]) {
    const response = await t.call('/api/cms/auth?provider=github', { cookie });
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), new RegExp(SECRET));
  }
  const other = await t.call('/api/cms/auth?provider=gitlab', {
    cookie: owner,
  });
  assert.equal(other.status, 403);
  assert.doesNotMatch(await other.text(), new RegExp(SECRET));

  const response = await t.call('/api/cms/auth?provider=github', {
    cookie: owner,
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, new RegExp(SECRET));
  // Posted only to this site's origin, never to "*".
  assert.match(html, /const origin = "https:\/\/chilolab\.com"/);
  assert.doesNotMatch(html, /postMessage\([^)]*['"]\*['"]/);
  const csp = response.headers.get('Content-Security-Policy') ?? '';
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  assert.ok(nonce, csp);
  assert.match(html, new RegExp(`<script nonce="${nonce}">`));
});
