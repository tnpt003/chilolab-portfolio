// Data rules from AGENTS.md and /privacy: session tokens are stored only as
// hashes, cookies are locked down, and no visitor IP is ever written.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSession } from '../../worker/session.ts';
import { sha256 } from '../../worker/env.ts';
import { setup } from './harness.ts';

const IP = '203.0.113.77';

/** Every text value in every table, for "is this stored anywhere?" checks. */
function everything(db: ReturnType<typeof setup>['db']) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];
  return tables
    .flatMap(({ name }) => db.prepare(`SELECT * FROM "${name}"`).all())
    .flatMap((row) => Object.values(row).map(String))
    .join('\n');
}

test('session cookies are __Host-, HttpOnly, Secure and SameSite=Lax', async () => {
  const t = setup();
  const header = await createSession(
    t.env as never,
    t.addUser('a@example.com'),
  );
  assert.match(header, /^__Host-chilolab_session=[\w-]{40,};/);
  for (const flag of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'])
    assert.ok(header.includes(`; ${flag}`), flag);
});

test('the database keeps only a hash of the session token', async () => {
  const t = setup();
  const header = await createSession(
    t.env as never,
    t.addUser('a@example.com'),
  );
  const token = header.split(';')[0].split('=')[1];
  assert.ok(!everything(t.db).includes(token));
  const row = t.db.prepare('SELECT token_hash FROM sessions').get() as {
    token_hash: string;
  };
  assert.equal(row.token_hash, await sha256(token));
});

test('owner sessions last 7 days, member sessions 30', async () => {
  const t = setup();
  const owner = await createSession(
    t.env as never,
    t.addUser('o@example.com', 'owner'),
  );
  const member = await createSession(
    t.env as never,
    t.addUser('m@example.com'),
  );
  assert.match(owner, /Max-Age=604800;/);
  assert.match(member, /Max-Age=2592000;/);
});

test('no visitor IP is stored by sign-in, feedback, comments or downloads', async () => {
  const t = setup();
  const headers = { 'CF-Connecting-IP': IP };
  const cookie = await t.session(t.addUser('m@example.com'));
  t.db
    .prepare("INSERT INTO settings (key, value) VALUES ('moderation', 'words')")
    .run();

  const calls = [
    () =>
      t.call('/api/auth/email/start', {
        headers,
        body: { email: 'new@example.com', locale: 'vi', token: 'human' },
      }),
    () =>
      t.call('/api/feedback', {
        headers,
        body: {
          project: 'pet-desktop',
          kind: 'bug',
          summary: 'Cat freezes',
          message: 'It stops walking after an hour.',
          locale: 'en',
          token: 'human',
        },
      }),
    () =>
      t.call('/api/comments', {
        headers,
        cookie,
        body: {
          project: 'pet-desktop',
          version: '1.5.2',
          body: 'Nice cat',
          locale: 'en',
        },
      }),
    () =>
      t.call('/api/downloads', {
        headers,
        body: { project: 'pet-desktop', version: '1.5.2', kind: 'setup' },
      }),
  ];
  const statuses = [];
  for (const call of calls) statuses.push((await call()).status);
  assert.deepEqual(statuses, [200, 201, 201, 204]);
  assert.ok(!everything(t.db).includes(IP));
});

test('deleting your own account removes its sessions and subscriptions', async () => {
  const t = setup();
  const id = t.addUser('m@example.com');
  const cookie = await t.session(id);
  await t.session(id); // a second device
  t.db
    .prepare(
      "INSERT INTO subscriptions (user_id, project, locale, unsubscribe_token) VALUES (?, 'pet-desktop', 'vi', 'tok-123456789012345678')",
    )
    .run(id);
  const cross = await t.call('/api/me', {
    method: 'DELETE',
    cookie,
    origin: 'https://evil.example',
  });
  assert.equal(cross.status, 403);

  const response = await t.call('/api/me', { method: 'DELETE', cookie });
  assert.equal(response.status, 200);
  assert.match(response.headers.getSetCookie()[0] ?? '', /Max-Age=0/);
  for (const table of ['users', 'sessions', 'subscriptions'])
    assert.equal(
      (
        t.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
          n: number;
        }
      ).n,
      0,
      table,
    );
});
