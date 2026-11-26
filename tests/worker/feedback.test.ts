// Feedback with an optional screenshot (worker/index.ts, worker/files.ts).
// The file type is read from the bytes, the size is capped, and only the
// owner can open the image again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bucket, setup } from './harness.ts';

type T = ReturnType<typeof setup>;
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

const fields = {
  project: 'pet-desktop',
  kind: 'bug',
  summary: 'Cat freezes',
  message: 'It stops walking after an hour.',
  locale: 'en',
  token: 'human',
};
function withFile(
  bytes: Uint8Array,
  type = 'image/png',
  name = 'shot.png',
  data = fields,
) {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  form.append('screenshot', new File([bytes], name, { type }));
  return form;
}
const sendForm = (t: T, form: FormData) => t.call('/api/feedback', { form });
const rows = (t: T) =>
  t.db.prepare('SELECT * FROM feedback').all() as Record<string, unknown>[];
const withBucket = () => {
  const r2 = bucket();
  return { r2, t: setup({ env: { BACKUPS: r2 } }) };
};

test('plain JSON feedback is stored without a file', async () => {
  const t = setup();
  const response = await t.call('/api/feedback', { body: fields });
  assert.equal(response.status, 201);
  const [row] = rows(t);
  assert.equal(row!.summary, 'Cat freezes');
  assert.equal(row!.file_key, null);
});

test('a screenshot is stored privately with the type read from its bytes', async () => {
  const { t, r2 } = withBucket();
  // The browser claims GIF; the bytes say JPEG, and JPEG is what is kept.
  const response = await sendForm(t, withFile(JPEG, 'image/gif', 'x.gif'));
  assert.equal(response.status, 201);
  const [row] = rows(t);
  assert.equal(row!.file_type, 'image/jpeg');
  assert.equal(row!.file_bytes, JPEG.byteLength);
  assert.match(
    String(row!.file_key),
    /^feedback\/\d{4}-\d{2}-\d{2}-[\w-]+\.jpg$/,
  );
  assert.deepEqual([...r2.objects.keys()], [row!.file_key]);
});

test('a file that is not an image is refused, whatever its name says', async () => {
  const { t, r2 } = withBucket();
  const fake = new TextEncoder().encode('<script>alert(1)</script>');
  const response = await sendForm(t, withFile(fake, 'image/png', 'shot.png'));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'file_type');
  assert.equal(rows(t).length, 0);
  assert.equal(r2.objects.size, 0);
});

test('a screenshot over 3 MB is refused', async () => {
  const { t, r2 } = withBucket();
  const big = new Uint8Array(3 * 1024 * 1024 + 1);
  big.set(PNG);
  const response = await sendForm(t, withFile(big));
  assert.equal(response.status, 413);
  assert.equal(rows(t).length, 0);
  assert.equal(r2.objects.size, 0);
});

test('without the R2 binding a screenshot is refused, not dropped silently', async () => {
  const t = setup();
  const response = await sendForm(t, withFile(PNG));
  assert.equal(response.status, 503);
  assert.equal(rows(t).length, 0);
});

test('when saving the row fails, the image is deleted again', async () => {
  const { t, r2 } = withBucket();
  t.db.exec('DROP TABLE feedback');
  const response = await sendForm(t, withFile(PNG));
  assert.equal(response.status, 500);
  assert.equal(r2.objects.size, 0);
});

test('a failed Turnstile check stores neither row nor image', async () => {
  const { t, r2 } = withBucket();
  const response = await sendForm(
    t,
    withFile(PNG, 'image/png', 'a.png', { ...fields, token: 'bot' }),
  );
  assert.equal(response.status, 403);
  assert.equal(rows(t).length, 0);
  assert.equal(r2.objects.size, 0);
});

test('only the owner can open a screenshot, served sandboxed', async () => {
  const { t } = withBucket();
  await sendForm(t, withFile(PNG));
  const id = rows(t)[0]!.id;
  const path = `/admin/manage/files/${id}`;
  assert.equal((await t.call(path)).status, 302);
  const member = await t.session(t.addUser('m@example.com'));
  assert.equal((await t.call(path, { cookie: member })).status, 403);

  const owner = await t.session(t.addUser('o@example.com', 'owner'));
  const response = await t.call(path, { cookie: owner });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.match(
    response.headers.get('Content-Security-Policy') ?? '',
    /sandbox/,
  );
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG);
});

test('feedback can be closed, and other origins are refused', async () => {
  const t = setup();
  const cross = await t.call('/api/feedback', {
    body: fields,
    origin: 'https://evil.example',
  });
  assert.equal(cross.status, 403);
  t.db
    .prepare("INSERT INTO settings (key, value) VALUES ('feedbackOpen', '0')")
    .run();
  const closed = await t.call('/api/feedback', { body: fields });
  assert.equal(closed.status, 403);
  assert.equal((await closed.json()).error, 'closed');
  assert.equal(rows(t).length, 0);
});

test('an unknown project or kind is refused', async () => {
  const t = setup();
  for (const bad of [
    { project: 'nope' },
    { kind: 'praise' },
    { summary: 'x' },
  ]) {
    const response = await t.call('/api/feedback', {
      body: { ...fields, ...bad },
    });
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  assert.equal(rows(t).length, 0);
});
