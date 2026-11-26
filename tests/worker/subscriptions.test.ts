// "Email me about new versions" (worker/releases.ts): signed-in visitors
// subscribe; the token in each email cancels that one subscription.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup } from './harness.ts';

type T = ReturnType<typeof setup>;
const TOKEN = 'unsub-token-0123456789abcdef';

function subscribed(t: T, email = 'm@example.com', token = TOKEN) {
  const id = t.addUser(email);
  t.db
    .prepare(
      "INSERT INTO subscriptions (user_id, project, locale, unsubscribe_token) VALUES (?, 'pet-desktop', 'en', ?)",
    )
    .run(id, token);
  return id;
}
const count = (t: T) =>
  (
    t.db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get() as {
      n: number;
    }
  ).n;

test('one-click unsubscribe from a mail app (no Origin, token in the query)', async () => {
  const t = setup();
  subscribed(t);
  const response = await t.call(
    `/api/subscriptions/unsubscribe?token=${TOKEN}`,
    {
      method: 'POST',
      origin: null,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'unsubscribed');
  assert.equal(count(t), 0);
  assert.deepEqual(
    response.headers.getSetCookie(),
    [],
    'the token signs nobody in',
  );
});

test('the unsubscribe page posts the token as JSON and gets the project name', async () => {
  const t = setup();
  subscribed(t);
  const response = await t.call('/api/subscriptions/unsubscribe', {
    body: { token: TOKEN, locale: 'en' },
  });
  assert.deepEqual(await response.json(), {
    status: 'unsubscribed',
    project: 'pet-desktop',
    title: 'Pet Desktop',
  });
});

test('a token cancels only its own subscription, and only once', async () => {
  const t = setup();
  subscribed(t);
  subscribed(t, 'other@example.com', 'unsub-token-other-000000000');
  const first = await t.call(`/api/subscriptions/unsubscribe?token=${TOKEN}`, {
    method: 'POST',
  });
  assert.equal(first.status, 200);
  const again = await t.call(`/api/subscriptions/unsubscribe?token=${TOKEN}`, {
    method: 'POST',
  });
  assert.equal(again.status, 404);
  assert.equal(count(t), 1);
});

test('malformed tokens are refused without touching the table', async () => {
  const t = setup();
  subscribed(t);
  for (const token of ['', 'short', "x' OR '1'='1' --padding-padding", '%']) {
    const response = await t.call(
      `/api/subscriptions/unsubscribe?token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    assert.equal(response.status, 400, token);
  }
  assert.equal(count(t), 1);
});

test('subscribing needs a session and a same-origin request', async () => {
  const t = setup();
  const body = { project: 'pet-desktop', locale: 'en', subscribed: true };
  assert.equal(
    (await t.call('/api/subscriptions', { method: 'PUT', body })).status,
    401,
  );
  const cookie = await t.session(t.addUser('m@example.com'));
  const cross = await t.call('/api/subscriptions', {
    method: 'PUT',
    body,
    cookie,
    origin: 'https://evil.example',
  });
  assert.equal(cross.status, 403);
  assert.equal(count(t), 0);

  const ok = await t.call('/api/subscriptions', {
    method: 'PUT',
    body,
    cookie,
  });
  assert.equal(ok.status, 200);
  const row = t.db
    .prepare('SELECT unsubscribe_token FROM subscriptions')
    .get() as {
    unsubscribe_token: string;
  };
  assert.match(row.unsubscribe_token, /^[\w-]{40,}$/);
  const list = await (await t.call('/api/subscriptions', { cookie })).json();
  assert.deepEqual(list, { projects: ['pet-desktop'] });
});

test('only released projects can be subscribed to', async () => {
  const t = setup();
  const cookie = await t.session(t.addUser('m@example.com'));
  const response = await t.call('/api/subscriptions', {
    method: 'PUT',
    cookie,
    body: { project: 'pagespeed-auth-auditor', locale: 'en', subscribed: true },
  });
  assert.equal(response.status, 400);
});
