// Passwordless sign-in with a 6-digit email code (worker/email-login.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sha256 } from '../../worker/env.ts';
import { sessionCookie, setup } from './harness.ts';

const EMAIL = 'visitor@example.com';
type T = ReturnType<typeof setup>;

const start = (t: T, email = EMAIL, token = 'human') =>
  t.call('/api/auth/email/start', { body: { email, locale: 'en', token } });
const verify = (t: T, code: string, extra: Record<string, unknown> = {}) =>
  t.call('/api/auth/email/verify', { body: { email: EMAIL, code, ...extra } });

function mailedCodes(t: T) {
  return t.outbound
    .filter((call) => call.url.startsWith('https://api.resend.com/'))
    .map((call) => /\b(\d{6})\b/.exec(JSON.stringify(call.body))![1]);
}
const count = (t: T, table: string) =>
  (t.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

test('a mailed code signs in and creates the account', async () => {
  const t = setup();
  const sent = await start(t);
  assert.equal(sent.status, 200);
  const [code] = mailedCodes(t);
  assert.ok(code);

  const response = await verify(t, code, { return: '/en/pet-desktop' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'signed_in',
    return: '/en/pet-desktop',
  });
  const cookie = sessionCookie(response);
  assert.ok(cookie);
  const me = await (await t.call('/api/me', { cookie })).json();
  assert.equal(JSON.stringify(me).includes(EMAIL), true);
  assert.equal(count(t, 'email_codes'), 0, 'used codes are deleted');
});

test('the code is stored hashed, never in plain text', async () => {
  const t = setup();
  await start(t);
  const [code] = mailedCodes(t);
  const row = t.db.prepare('SELECT * FROM email_codes').get() as Record<
    string,
    unknown
  >;
  assert.ok(!Object.values(row).some((value) => String(value).includes(code)));
  assert.equal(row.code_hash, await sha256(`${EMAIL}:${code}`));
});

test('five wrong codes lock the code, even against the right one', async () => {
  const t = setup();
  await start(t);
  const [code] = mailedCodes(t);
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++)
    assert.equal((await verify(t, wrong)).status, 400);
  const response = await verify(t, code);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, 'too_many_attempts');
  assert.equal(sessionCookie(response), undefined);
});

test('an expired code is refused', async () => {
  const t = setup();
  await start(t);
  const [code] = mailedCodes(t);
  t.db
    .prepare("UPDATE email_codes SET expires_at = '2000-01-01T00:00:00Z'")
    .run();
  assert.equal((await verify(t, code)).status, 400);
});

test('a second code within a minute is refused', async () => {
  const t = setup();
  assert.equal((await start(t)).status, 200);
  const again = await start(t);
  assert.equal(again.status, 429);
  assert.equal(mailedCodes(t).length, 1);
});

test('a failed Turnstile check sends nothing', async () => {
  const t = setup();
  const response = await start(t, EMAIL, 'bot');
  assert.equal(response.status, 403);
  assert.equal(mailedCodes(t).length, 0);
  assert.equal(count(t, 'email_codes'), 0);
});

test('with sign-ups closed, unknown addresses get no code', async () => {
  const t = setup();
  t.db
    .prepare("INSERT INTO settings (key, value) VALUES ('signups', '0')")
    .run();
  const response = await start(t);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'registration_closed');
  assert.equal(mailedCodes(t).length, 0);
});

test('a blocked account gets no session', async () => {
  const t = setup();
  const id = t.addUser(EMAIL);
  t.db
    .prepare(
      "UPDATE users SET blocked_at = '2026-01-01T00:00:00Z' WHERE id = ?",
    )
    .run(id);
  await start(t);
  const response = await verify(t, mailedCodes(t)[0]);
  assert.equal(response.status, 403);
  assert.equal(sessionCookie(response), undefined);
  assert.equal(count(t, 'sessions'), 0);
});

test('sign-in from another origin is refused', async () => {
  const t = setup();
  for (const origin of ['https://evil.example', null]) {
    const response = await t.call('/api/auth/email/start', {
      body: { email: EMAIL, locale: 'en', token: 'human' },
      origin,
    });
    assert.equal(response.status, 403);
  }
  assert.equal(mailedCodes(t).length, 0);
});

test('the return path never leaves the site', async () => {
  for (const target of [
    '//evil.example',
    'https://evil.example',
    '/\\evil.example',
  ]) {
    const t = setup();
    await start(t);
    const response = await verify(t, mailedCodes(t)[0], { return: target });
    assert.equal((await response.json()).return, '/', target);
  }
});
