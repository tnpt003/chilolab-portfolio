// Owner actions in /admin/manage (worker/manage.ts): same-origin only, a
// confirmation step for destructive ones, and owner accounts out of reach.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup } from './harness.ts';

type T = ReturnType<typeof setup>;

async function panel() {
  const t = setup();
  const ownerId = t.addUser('owner@example.com', 'owner');
  const memberId = t.addUser('member@example.com');
  return {
    t,
    ownerId,
    memberId,
    owner: await t.session(ownerId),
    member: await t.session(memberId),
  };
}
const act = (
  t: T,
  cookie: string,
  fields: Record<string, string> | [string, string][],
  origin?: string,
) =>
  t.call('/admin/manage', {
    cookie,
    origin,
    form: new URLSearchParams(fields),
  });
const user = (t: T, id: number) =>
  t.db.prepare('SELECT role, blocked_at FROM users WHERE id = ?').get(id) as
    { role: string; blocked_at: string | null } | undefined;
const sessions = (t: T, id: number) =>
  (
    t.db
      .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
      .get(id) as { n: number }
  ).n;

test('a POST from another origin is refused, even with the owner cookie', async () => {
  const { t, owner, memberId } = await panel();
  const response = await act(
    t,
    owner,
    { do: `user-block:${memberId}`, confirmed: '1' },
    'https://evil.example',
  );
  assert.equal(response.status, 403);
  assert.equal(user(t, memberId)!.blocked_at, null);
});

test('a member cannot run owner actions', async () => {
  const { t, member, memberId } = await panel();
  const other = t.addUser('other@example.com');
  const response = await act(t, member, {
    do: `user-block:${other}`,
    confirmed: '1',
  });
  assert.equal(response.status, 403);
  assert.equal(user(t, other)!.blocked_at, null);
  assert.equal(user(t, memberId)!.role, 'member');
});

test('blocking asks for confirmation first, then blocks and signs out', async () => {
  const { t, owner, memberId } = await panel();
  const ask = await act(t, owner, { do: `user-block:${memberId}` });
  assert.equal(ask.status, 200);
  assert.match(await ask.text(), /name="confirmed" value="1"/);
  assert.equal(user(t, memberId)!.blocked_at, null);

  const done = await act(t, owner, {
    do: `user-block:${memberId}`,
    confirmed: '1',
  });
  assert.equal(done.status, 303);
  assert.ok(user(t, memberId)!.blocked_at);
  assert.equal(sessions(t, memberId), 0);
  const log = t.db.prepare('SELECT action FROM admin_log').all() as {
    action: string;
  }[];
  assert.deepEqual(
    log.map((row) => row.action),
    ['user-block'],
  );
});

test('owner accounts cannot be blocked or deleted', async () => {
  const { t, owner, ownerId, memberId } = await panel();
  const second = t.addUser('owner2@example.com', 'owner');
  for (const op of ['user-block', 'user-delete'])
    for (const id of [ownerId, second])
      await act(t, owner, { do: `${op}:${id}`, confirmed: '1' });
  // Account actions are one at a time; the bulk form refuses them.
  const bulk = await act(t, owner, [
    ['do', 'bulk'],
    ['bulk', 'user-delete'],
    ['confirmed', '1'],
    ['ids', String(second)],
  ]);
  assert.equal(bulk.status, 400);
  await act(t, owner, { do: `user-delete:${memberId}`, confirmed: '1' });
  assert.equal(user(t, ownerId)!.role, 'owner');
  assert.equal(user(t, ownerId)!.blocked_at, null);
  assert.equal(user(t, second)!.blocked_at, null);
  assert.equal(sessions(t, ownerId), 1, 'the owner stays signed in');
  assert.equal(user(t, memberId), undefined, 'the member was deleted');
});

test('the owner cannot sign themself out of every device by accident', async () => {
  const { t, owner, ownerId } = await panel();
  await act(t, owner, { do: `user-signout:${ownerId}` });
  assert.equal(sessions(t, ownerId), 1);
});

test('no panel action changes a role', async () => {
  const { t, owner, memberId } = await panel();
  for (const name of ['user-role', 'role', 'user-promote', 'promote'])
    for (const value of [`${name}:${memberId}`, `${name}:${memberId}:owner`]) {
      const response = await act(t, owner, {
        do: value,
        role: 'owner',
        confirmed: '1',
      });
      assert.equal(response.status, 400, value);
    }
  // Saving settings with a stray role field changes nothing either.
  await act(t, owner, {
    do: 'settings:comments',
    role: 'owner',
    user: String(memberId),
  });
  assert.equal(user(t, memberId)!.role, 'member');
  assert.equal(
    (
      t.db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'")
        .get() as { n: number }
    ).n,
    1,
  );
});

test('deleting a member removes their sessions and subscriptions but keeps feedback anonymous', async () => {
  const { t, owner, memberId } = await panel();
  t.db
    .prepare(
      "INSERT INTO subscriptions (user_id, project, locale, unsubscribe_token) VALUES (?, 'pet-desktop', 'vi', 'tok-123456789012345678')",
    )
    .run(memberId);
  t.db
    .prepare(
      "INSERT INTO feedback (project, kind, summary, message, locale, user_id) VALUES ('pet-desktop', 'bug', 'abc', 'hello there', 'vi', ?)",
    )
    .run(memberId);
  await act(t, owner, { do: `user-delete:${memberId}`, confirmed: '1' });
  assert.equal(user(t, memberId), undefined);
  assert.equal(sessions(t, memberId), 0);
  assert.equal(
    (
      t.db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get() as {
        n: number;
      }
    ).n,
    0,
  );
  const feedback = t.db.prepare('SELECT user_id FROM feedback').get() as {
    user_id: number | null;
  };
  assert.equal(feedback.user_id, null);
});

test('settings are saved and logged', async () => {
  const { t, owner } = await panel();
  const response = await act(t, owner, {
    do: 'settings:comments',
    commentMaxLength: '500',
  });
  assert.equal(response.status, 303);
  const row = t.db
    .prepare("SELECT value FROM settings WHERE key = 'commentMaxLength'")
    .get() as { value: string } | undefined;
  assert.equal(row?.value, '500');
});
