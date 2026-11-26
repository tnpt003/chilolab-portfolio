// Comments (worker/comments.ts): sign-in required, held comments stay
// hidden from others, and only the author or the owner can remove one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup } from './harness.ts';

type T = ReturnType<typeof setup>;
const LIST = '/api/comments?project=pet-desktop&version=1.5.2';

function words(t: T, extra: Record<string, string> = {}) {
  // The word list only: Workers AI is not available in tests.
  const settings = { moderation: 'words', ...extra };
  for (const [key, value] of Object.entries(settings))
    t.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run(key, value);
}
const post = (t: T, cookie: string | undefined, body: string) =>
  t.call('/api/comments', {
    cookie,
    body: { project: 'pet-desktop', version: '1.5.2', body, locale: 'en' },
  });
const bodies = async (t: T, cookie?: string) =>
  JSON.stringify(await (await t.call(LIST, { cookie })).json());

test('posting needs a session and a known project', async () => {
  const t = setup();
  words(t);
  assert.equal((await post(t, undefined, 'Hello')).status, 401);
  const cookie = await t.session(t.addUser('m@example.com'));
  const unknown = await t.call('/api/comments', {
    cookie,
    body: { project: 'not-a-project', body: 'Hello', locale: 'en' },
  });
  assert.equal(unknown.status, 400);
  const version = await t.call('/api/comments', {
    cookie,
    body: {
      project: 'pet-desktop',
      version: '9.9.9',
      body: 'Hi',
      locale: 'en',
    },
  });
  assert.equal(version.status, 400);
});

test('a blocked word holds the comment; only its author and the owner see it', async () => {
  const t = setup();
  words(t, { notifyHeld: '0' });
  const author = await t.session(t.addUser('a@example.com'));
  const other = await t.session(t.addUser('b@example.com'));
  const owner = await t.session(t.addUser('o@example.com', 'owner'));

  const response = await post(t, author, 'this is shit');
  assert.equal(response.status, 201);
  const row = t.db.prepare('SELECT status FROM comments').get() as {
    status: string;
  };
  assert.equal(row.status, 'held');

  assert.doesNotMatch(await bodies(t), /this is shit/);
  assert.doesNotMatch(await bodies(t, other), /this is shit/);
  assert.match(await bodies(t, author), /this is shit/);
  assert.match(await bodies(t, owner), /this is shit/);
});

test('criticism without abuse is published', async () => {
  const t = setup();
  words(t);
  const cookie = await t.session(t.addUser('a@example.com'));
  await post(t, cookie, 'The update is slow and the cat freezes');
  assert.match(await bodies(t), /the cat freezes/);
});

test('only the owner can approve a held comment', async () => {
  const t = setup();
  words(t, { moderation: 'manual', notifyHeld: '0' });
  const member = await t.session(t.addUser('m@example.com'));
  const owner = await t.session(t.addUser('o@example.com', 'owner'));
  const { comment } = (await (await post(t, member, 'Hold me')).json()) as {
    comment: { id: number };
  };
  const approve = `/api/comments/${comment.id}/approve`;
  assert.equal(
    (await t.call(approve, { method: 'POST', cookie: member })).status,
    404,
  );
  assert.doesNotMatch(await bodies(t), /Hold me/);
  assert.equal(
    (await t.call(approve, { method: 'POST', cookie: owner })).status,
    200,
  );
  assert.match(await bodies(t), /Hold me/);
});

test("a member cannot delete someone else's comment; the owner can", async () => {
  const t = setup();
  words(t);
  const author = await t.session(t.addUser('a@example.com'));
  const other = await t.session(t.addUser('b@example.com'));
  const owner = await t.session(t.addUser('o@example.com', 'owner'));
  const { comment } = (await (await post(t, author, 'Mine')).json()) as {
    comment: { id: number };
  };
  const path = `/api/comments/${comment.id}`;
  assert.equal(
    (await t.call(path, { method: 'DELETE', cookie: other })).status,
    404,
  );
  assert.match(await bodies(t), /Mine/);
  assert.equal(
    (await t.call(path, { method: 'DELETE', cookie: owner })).status,
    200,
  );
  assert.doesNotMatch(await bodies(t), /Mine/);
});

test('the hourly cap stops a member but not the owner', async () => {
  const t = setup();
  words(t, { commentsPerHour: '2' });
  const member = await t.session(t.addUser('m@example.com'));
  const owner = await t.session(t.addUser('o@example.com', 'owner'));
  assert.equal((await post(t, member, 'one')).status, 201);
  assert.equal((await post(t, member, 'two')).status, 201);
  const third = await post(t, member, 'three');
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error, 'hourly_limit');
  for (const body of ['a', 'b', 'c'])
    assert.equal((await post(t, owner, body)).status, 201);
});

test('a write from another origin is refused', async () => {
  const t = setup();
  words(t);
  const cookie = await t.session(t.addUser('m@example.com'));
  const response = await t.call('/api/comments', {
    cookie,
    origin: 'https://evil.example',
    body: {
      project: 'pet-desktop',
      version: '1.5.2',
      body: 'Hi',
      locale: 'en',
    },
  });
  assert.equal(response.status, 403);
  assert.equal(
    (t.db.prepare('SELECT COUNT(*) AS n FROM comments').get() as { n: number })
      .n,
    0,
  );
});
