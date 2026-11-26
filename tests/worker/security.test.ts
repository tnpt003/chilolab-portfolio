// Sign-in protection (worker/security.ts): owner accounts sign in with
// Google only and get an email on every new session; hourly counters alert
// the owner to attacks; the owner can end every other session.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanupAuthStats } from '../../worker/maintenance.ts';
import { ALERT_AT, countAuth } from '../../worker/security.ts';
import { idToken, sessionCookie, setup } from './harness.ts';

type T = ReturnType<typeof setup>;
const OWNER = 'owner@example.com';
const CLIENT = 'client-123.apps.googleusercontent.com';

const mails = (t: T) =>
  t
    .resendMails()
    .map(
      (sent) => sent.body as { to: string[]; subject: string; text: string },
    );
const stat = (t: T, kind: string) =>
  Number(
    (
      t.db
        .prepare('SELECT SUM(count) AS n FROM auth_stats WHERE kind = ?')
        .get(kind) as { n: number | null }
    ).n ?? 0,
  );
const startCode = (t: T, email: string) =>
  t.call('/api/auth/email/start', {
    body: { email, locale: 'vi', token: 'human' },
  });

// ---------- owner: Google only ----------

test('the owner address gets a "use Google" notice, never a code', async () => {
  const t = setup();
  t.addUser(OWNER, 'owner');
  const response = await startCode(t, OWNER);
  // Same answer as for anyone else: the form does not reveal the owner.
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'sent' });
  const [mail] = mails(t);
  assert.deepEqual(mail!.to, [OWNER]);
  assert.match(mail!.text, /chỉ đăng nhập bằng Google/);
  assert.doesNotMatch(mail!.subject + mail!.text, /\b\d{6}\b/);
  assert.equal(stat(t, 'owner_email_refused'), 1);
  assert.equal(stat(t, 'code_sent'), 0);
});

test('no code opens an owner account, and its notices obey the same limits', async () => {
  const t = setup();
  t.addUser(OWNER, 'owner');
  await startCode(t, OWNER);
  assert.equal((await startCode(t, OWNER)).status, 429, 'one per minute');
  for (const code of ['000000', '123456', '999999']) {
    const response = await t.call('/api/auth/email/verify', {
      body: { email: OWNER, code },
    });
    assert.equal(response.status, 400);
    assert.equal(sessionCookie(response), undefined);
  }
  assert.equal(
    (t.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number })
      .n,
    0,
  );
});

test('a member promoted to owner after the code was sent cannot use it', async () => {
  const t = setup();
  const id = t.addUser('soon-owner@example.com');
  await startCode(t, 'soon-owner@example.com');
  const code = /\b(\d{6})\b/.exec(mails(t)[0]!.text)![1];
  t.db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(id);
  const response = await t.call('/api/auth/email/verify', {
    body: { email: 'soon-owner@example.com', code },
  });
  assert.equal(response.status, 400);
  assert.equal(sessionCookie(response), undefined);
});

// ---------- owner sign-in alerts ----------

async function googleSignIn(t: T, email: string, sub: string) {
  const start = await t.call('/api/auth/google?locale=vi');
  const cookie = start.headers.getSetCookie()[0]!.split(';')[0]!;
  const state = new URL(start.headers.get('Location')!).searchParams.get(
    'state',
  );
  t.googleAnswers({
    id_token: idToken({
      iss: 'https://accounts.google.com',
      aud: CLIENT,
      exp: Math.floor(Date.now() / 1000) + 600,
      sub,
      email,
      email_verified: true,
    }),
  });
  return t.call(`/api/auth/google/callback?code=c&state=${state}`, {
    cookie,
    headers: { 'User-Agent': 'TestBrowser/1.0' },
  });
}
const google = () =>
  setup({ env: { GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 's' } });

test('every owner sign-in emails the owner account', async () => {
  const t = google();
  t.addUser(OWNER, 'owner');
  const response = await googleSignIn(t, OWNER, 'owner-sub');
  assert.ok(sessionCookie(response));
  const [mail] = mails(t);
  assert.deepEqual(mail!.to, [OWNER]);
  assert.match(mail!.subject, /phiên đăng nhập mới/);
  assert.match(mail!.text, /TestBrowser\/1\.0/);
  assert.match(mail!.text, /Đăng xuất mọi thiết bị khác/);
  assert.equal(stat(t, 'signin_google'), 1);
});

test('member sign-ins send no alert, and new accounts are counted', async () => {
  const t = google();
  await googleSignIn(t, 'new@example.com', 'new-sub');
  assert.deepEqual(mails(t), []);
  assert.equal(stat(t, 'signup'), 1);
  assert.equal(stat(t, 'signin_google'), 1);
});

test('a failed alert email does not block the sign-in', async () => {
  const t = google();
  t.addUser(OWNER, 'owner');
  t.failResend();
  const response = await googleSignIn(t, OWNER, 'owner-sub');
  assert.equal(response.status, 302);
  assert.ok(sessionCookie(response));
});

// ---------- counters and attack alerts ----------

test('wrong codes are counted, and the fifth one counts as a lock', async () => {
  const t = setup();
  await startCode(t, 'm@example.com');
  for (let i = 0; i < 5; i++)
    await t.call('/api/auth/email/verify', {
      body: { email: 'm@example.com', code: '000000' },
    });
  assert.equal(stat(t, 'code_wrong'), 4);
  assert.equal(stat(t, 'code_locked'), 1);
  assert.equal(stat(t, 'code_sent'), 1);
});

test('failed Turnstile checks are counted', async () => {
  const t = setup();
  await t.call('/api/auth/email/start', {
    body: { email: 'm@example.com', locale: 'vi', token: 'bot' },
  });
  assert.equal(stat(t, 'turnstile_failed'), 1);
});

test('crossing an alert level emails the owner once per hour', async () => {
  const t = setup();
  t.addUser(OWNER, 'owner');
  const limit = ALERT_AT.code_wrong!;
  for (let i = 0; i < limit + 5; i++)
    await countAuth(t.env as never, 'code_wrong');
  const alerts = mails(t);
  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0]!.to, [OWNER]);
  assert.match(alerts[0]!.text, new RegExp(`${limit} lần "Nhập sai mã email"`));
});

test('nothing stored by the counters can identify anyone', async () => {
  const t = setup();
  await startCode(t, 'private@example.com');
  const rows = t.db.prepare('SELECT * FROM auth_stats').all();
  assert.deepEqual(
    Object.keys(rows[0]!).sort(),
    ['count', 'hour', 'kind'],
    'only hour, kind and count',
  );
  assert.doesNotMatch(JSON.stringify(rows), /private@example\.com/);
});

test('without the 0009 table, sign-in still works', async () => {
  const t = setup();
  t.db.exec('DROP TABLE auth_stats');
  await startCode(t, 'm@example.com');
  const code = /\b(\d{6})\b/.exec(mails(t)[0]!.text)![1];
  const response = await t.call('/api/auth/email/verify', {
    body: { email: 'm@example.com', code },
  });
  assert.equal(response.status, 200);
  assert.ok(sessionCookie(response));
});

test('the daily cleanup drops counters older than 90 days', async () => {
  const t = setup();
  const insert = t.db.prepare(
    "INSERT INTO auth_stats (hour, kind, count) VALUES (?, 'signup', 1)",
  );
  insert.run('2020-01-01T00');
  insert.run(new Date().toISOString().slice(0, 13));
  assert.deepEqual(await cleanupAuthStats(t.env as never), { authStats: 1 });
});

// ---------- panel ----------

test('the status page shows the counters and this account’s sessions', async () => {
  const t = setup();
  const id = t.addUser(OWNER, 'owner');
  const cookie = await t.session(id);
  await t.session(id);
  await countAuth(t.env as never, 'code_wrong');
  const html = await (await t.call('/admin/manage/status', { cookie })).text();
  assert.match(html, /id="auth"/);
  assert.match(html, /Nhập sai mã email<\/td><td>1</);
  assert.match(html, /đang đăng nhập ở <strong>2<\/strong> nơi/);
  assert.match(html, /value="signout-others"/);
});

test('"sign out every other device" keeps only the current session', async () => {
  const t = setup();
  const id = t.addUser(OWNER, 'owner');
  const cookie = await t.session(id);
  await t.session(id);
  await t.session(id);
  const member = t.addUser('m@example.com');
  await t.session(member);
  const response = await t.call('/admin/manage', {
    cookie,
    form: new URLSearchParams({
      do: 'signout-others',
      back: '/admin/manage/status',
    }),
  });
  assert.equal(response.status, 303);
  const left = (userId: number) =>
    (
      t.db
        .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
        .get(userId) as { n: number }
    ).n;
  assert.equal(left(id), 1);
  assert.equal(left(member), 1, 'other accounts are untouched');
  assert.equal(
    (await t.call('/admin/manage/status', { cookie })).status,
    200,
    'still signed in here',
  );
});
