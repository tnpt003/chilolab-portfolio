// /admin/manage must fail closed: only an owner session (or the localhost dev
// bypass) opens it; everyone else is sent to sign in or refused.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup } from './harness.ts';

test('anonymous GET is sent to sign in, with the page to return to', async () => {
  const t = setup();
  const response = await t.call('/admin/manage/comments?page=2');
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location')!, 'https://x');
  assert.equal(location.pathname, '/user/login');
  assert.equal(
    location.searchParams.get('return'),
    '/admin/manage/comments?page=2',
  );
});

test('anonymous POST is refused, not redirected', async () => {
  const t = setup();
  const response = await t.call('/admin/manage', { body: { action: 'x' } });
  assert.equal(response.status, 403);
});

test('a member session is refused', async () => {
  const t = setup();
  const cookie = await t.session(t.addUser('member@example.com'));
  for (const path of [
    '/admin/manage',
    '/admin/manage/users',
    '/admin/manage/settings',
  ]) {
    const response = await t.call(path, { cookie });
    assert.equal(response.status, 403, path);
    assert.doesNotMatch(await response.text(), /member@example\.com/);
  }
});

test('an owner session opens the panel', async () => {
  const t = setup();
  const cookie = await t.session(t.addUser('owner@example.com', 'owner'));
  const response = await t.call('/admin/manage', { cookie });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
});

test('an owner session older than 7 days no longer opens it', async () => {
  const t = setup();
  const owner = t.addUser('owner@example.com', 'owner');
  const cookie = await t.session(owner, { ageDays: 8, expiresInDays: 22 });
  assert.equal((await t.call('/admin/manage', { cookie })).status, 302);
});

test('expired, forged and blocked-owner sessions do not open it', async () => {
  const t = setup();
  const owner = t.addUser('owner@example.com', 'owner');
  const expired = await t.session(owner, { expiresInDays: -1 });
  assert.equal(
    (await t.call('/admin/manage', { cookie: expired })).status,
    302,
  );

  const forged = '__Host-chilolab_session=not-a-real-token';
  assert.equal((await t.call('/admin/manage', { cookie: forged })).status, 302);

  const live = await t.session(owner);
  t.db
    .prepare(
      "UPDATE users SET blocked_at = '2026-01-01T00:00:00Z' WHERE id = ?",
    )
    .run(owner);
  assert.equal((await t.call('/admin/manage', { cookie: live })).status, 302);
});

test('the admin hint cookie alone grants nothing', async () => {
  const t = setup();
  const response = await t.call('/admin/manage', {
    cookie: '__Host-chilolab_admin=1',
  });
  assert.equal(response.status, 302);
});

test('the dev bypass works on localhost only', async () => {
  const t = setup({ env: { ADMIN_DEV_BYPASS: '1' } });
  assert.equal((await t.call('/admin/manage')).status, 302);
  const local = await t.call('/admin/manage', {
    host: 'http://localhost:8787',
  });
  assert.equal(local.status, 200);
});

test('old /manage links redirect permanently to /admin/manage', async () => {
  const t = setup();
  const response = await t.call('/manage/comments?x=1');
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), '/admin/manage/comments?x=1');
});

test('logout needs a same-origin POST', async () => {
  const t = setup();
  const cookie = await t.session(t.addUser('owner@example.com', 'owner'));
  const cross = await t.call('/admin/manage/logout', {
    method: 'POST',
    cookie,
    origin: 'https://evil.example',
  });
  assert.equal(cross.status, 405);
  assert.equal(
    (t.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number })
      .n,
    1,
  );

  const own = await t.call('/admin/manage/logout', { method: 'POST', cookie });
  assert.equal(own.status, 303);
  assert.equal(
    (t.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number })
      .n,
    0,
  );
});

test('every panel page renders against the migrated database', async () => {
  const t = setup();
  const owner = t.addUser('owner@example.com', 'owner');
  const cookie = await t.session(owner);
  const pages = [
    '/admin/manage',
    '/admin/manage/comments',
    '/admin/manage/feedback',
    '/admin/manage/downloads',
    '/admin/manage/users',
    `/admin/manage/users/${owner}`,
    '/admin/manage/releases',
    '/admin/manage/crashes',
    '/admin/manage/settings',
    '/admin/manage/log',
    '/admin/manage/status',
  ];
  for (const path of pages) {
    const response = await t.call(path, { cookie });
    assert.equal(response.status, 200, path);
    // The panel's fallback when a query fails (e.g. a missing migration).
    assert.doesNotMatch(await response.text(), /notice danger/, path);
  }
});
