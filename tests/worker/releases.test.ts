// New version emails (worker/releases.ts): at most NOTICE_DAILY a day, never
// twice to the same person, never to blocked accounts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverNotices, NOTICE_DAILY } from '../../worker/releases.ts';
import { setup } from './harness.ts';

type T = ReturnType<typeof setup>;

function subscribers(t: T, count: number) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = t.addUser(`s${i}@example.com`);
    t.db
      .prepare(
        "INSERT INTO subscriptions (user_id, project, locale, unsubscribe_token) VALUES (?, 'pet-desktop', 'en', ?)",
      )
      .run(id, `unsub-${i}`);
    ids.push(id);
  }
  t.db
    .prepare(
      "INSERT INTO release_notices (project, version) VALUES ('pet-desktop', '1.5.2')",
    )
    .run();
  return ids;
}
const mailed = (t: T) =>
  t.outbound
    .filter((call) => call.url === 'https://api.resend.com/emails/batch')
    .flatMap((call) => call.body as { to: string[] }[]);
const delivered = (t: T) =>
  (
    t.db.prepare('SELECT COUNT(*) AS n FROM notice_deliveries').get() as {
      n: number;
    }
  ).n;

test(`sends at most ${NOTICE_DAILY} emails a day, then waits`, async () => {
  const t = setup();
  subscribers(t, 130);
  const first = await deliverNotices(t.env as never);
  assert.equal(first.sent, NOTICE_DAILY);
  assert.equal(mailed(t).length, NOTICE_DAILY);
  assert.equal(delivered(t), NOTICE_DAILY);

  const again = await deliverNotices(t.env as never);
  assert.equal(again.sent, 0, 'the second press the same day sends nothing');
  assert.equal(mailed(t).length, NOTICE_DAILY);
});

test('the next day finishes the rest without repeating anyone', async () => {
  const t = setup();
  subscribers(t, 130);
  await deliverNotices(t.env as never);
  // Move yesterday's deliveries out of today's budget.
  t.db
    .prepare("UPDATE notice_deliveries SET sent_at = '2000-01-01T00:00:00Z'")
    .run();
  const next = await deliverNotices(t.env as never);
  assert.equal(next.sent, 50);
  const addresses = mailed(t).map((mail) => mail.to[0]);
  assert.equal(new Set(addresses).size, 130);
  const notice = t.db
    .prepare('SELECT finished_at FROM release_notices')
    .get() as { finished_at: string | null };
  assert.ok(notice.finished_at);
});

test('blocked accounts get no email', async () => {
  const t = setup();
  const [blocked] = subscribers(t, 3);
  t.db
    .prepare(
      "UPDATE users SET blocked_at = '2026-01-01T00:00:00Z' WHERE id = ?",
    )
    .run(blocked);
  await deliverNotices(t.env as never);
  const addresses = mailed(t).map((mail) => mail.to[0]);
  assert.deepEqual(addresses.sort(), ['s1@example.com', 's2@example.com']);
});

test('a Resend failure records nothing, so the next run retries', async () => {
  const t = setup();
  subscribers(t, 5);
  t.failResend();
  const result = await deliverNotices(t.env as never);
  assert.equal(result.sent, 0);
  assert.equal(delivered(t), 0);
});

test('every email carries a one-click unsubscribe', async () => {
  const t = setup();
  subscribers(t, 1);
  await deliverNotices(t.env as never);
  const [mail] = mailed(t) as unknown as {
    headers: Record<string, string>;
    text: string;
  }[];
  assert.equal(
    mail.headers['List-Unsubscribe-Post'],
    'List-Unsubscribe=One-Click',
  );
  assert.match(mail.headers['List-Unsubscribe'], /token=unsub-0/);
  assert.match(mail.text, /\/user\/unsubscribe#unsub-0/);
});

test('no mail key, no emails', async () => {
  const t = setup({ env: { RESEND_API_KEY: undefined } });
  subscribers(t, 3);
  const result = await deliverNotices(t.env as never);
  assert.equal(result.skipped, 'no RESEND_API_KEY');
  assert.equal(t.outbound.length, 0);
});
