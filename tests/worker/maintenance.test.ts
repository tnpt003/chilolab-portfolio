// Daily upkeep (worker/maintenance.ts): cleanup, the weekly R2 backup, and
// the owner alerts when something goes wrong.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import {
  backup,
  cleanup,
  cleanupPhase2,
  scheduled,
} from '../../worker/maintenance.ts';
import { sha256 } from '../../worker/env.ts';
import { bucket, setup } from './harness.ts';

console.log = () => {}; // the cron logs a summary of each step

type T = ReturnType<typeof setup>;
const DAY = 86400_000;
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().replace(/\.\d+Z$/, 'Z');
const count = (t: T, table: string, where = '1') =>
  (
    t.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as {
      n: number;
    }
  ).n;

async function addSession(
  t: T,
  userId: number,
  createdDays: number,
  expiresDays: number,
  name: string,
) {
  t.db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .run(await sha256(name), userId, iso(createdDays), iso(expiresDays));
}

test('cleanup removes expired sessions, stale owner sessions, old codes and log', async () => {
  const t = setup();
  const member = t.addUser('m@example.com');
  const owner = t.addUser('o@example.com', 'owner');
  await addSession(t, member, -31, -1, 'member-expired');
  await addSession(t, member, -10, 20, 'member-live');
  await addSession(t, owner, -8, 1, 'owner-stale');
  await addSession(t, owner, -1, 6, 'owner-live');
  const code = t.db.prepare(
    "INSERT INTO email_codes (email, code_hash, created_at, expires_at) VALUES ('a@example.com', 'h', ?, ?)",
  );
  code.run(iso(-1), iso(-1));
  code.run(iso(0), iso(0.005));
  const log = t.db.prepare(
    "INSERT INTO admin_log (at, actor, action) VALUES (?, 'owner', 'x')",
  );
  log.run(iso(-400));
  log.run(iso(-10));

  assert.deepEqual(await cleanup(t.env as never), {
    sessions: 2,
    codes: 1,
    log: 1,
  });
  const left = t.db
    .prepare('SELECT token_hash FROM sessions ORDER BY created_at')
    .all() as { token_hash: string }[];
  assert.deepEqual(
    left.map((row) => row.token_hash),
    [await sha256('member-live'), await sha256('owner-live')],
  );
  assert.equal(count(t, 'email_codes'), 1);
  assert.equal(count(t, 'admin_log'), 1);
});

test('phase 2 cleanup: crash reports after 90 days, delivery lists 30 days after a notice', async () => {
  const t = setup();
  const crash = t.db.prepare(
    "INSERT INTO crash_reports (report_id, project, app_version, kind, created_at) VALUES (?, 'pet-desktop', '1.5.2', 'X', ?)",
  );
  crash.run('report-old-0000000000', iso(-91));
  crash.run('report-new-0000000000', iso(-10));
  const user = t.addUser('s@example.com');
  const notice = t.db.prepare(
    "INSERT INTO release_notices (project, version, finished_at) VALUES ('pet-desktop', ?, ?) RETURNING id",
  );
  const old = (notice.get('1.0.0', iso(-40)) as { id: number }).id;
  const recent = (notice.get('1.5.2', iso(-5)) as { id: number }).id;
  const delivery = t.db.prepare(
    'INSERT INTO notice_deliveries (notice_id, user_id) VALUES (?, ?)',
  );
  delivery.run(old, user);
  delivery.run(recent, user);

  assert.deepEqual(await cleanupPhase2(t.env as never), {
    crashes: 1,
    deliveries: 1,
  });
  assert.equal(
    count(t, 'crash_reports', "report_id = 'report-new-0000000000'"),
    1,
  );
  assert.equal(count(t, 'notice_deliveries', `notice_id = ${recent}`), 1);
});

test('the backup is gzipped JSON of visitor data, without sessions or sign-in codes', async () => {
  const r2 = bucket();
  const t = setup({ env: { BACKUPS: r2 } });
  const id = t.addUser('m@example.com');
  await t.session(id);
  t.db
    .prepare(
      "INSERT INTO email_codes (email, code_hash, created_at, expires_at) VALUES ('a@b.co', 'h', ?, ?)",
    )
    .run(iso(0), iso(1));
  const result = await backup(t.env as never, new Date('2026-11-22T19:00:00Z'));
  assert.equal(result.key, 'd1/chilolab-2026-11-22.json.gz');
  const data = JSON.parse(
    gunzipSync(r2.objects.get(result.key!)!.bytes).toString('utf8'),
  );
  assert.equal(data.format, 'chilolab-d1-backup');
  assert.equal(data.tables.users.length, 1);
  assert.equal(data.tables.users[0].email, 'm@example.com');
  assert.equal(data.tables.sessions, undefined);
  assert.equal(data.tables.email_codes, undefined);
  assert.ok(data.tables.comments, 'every other table is included');
});

test('the backup keeps the 12 newest weekly copies', async () => {
  const r2 = bucket();
  const t = setup({ env: { BACKUPS: r2 } });
  for (let week = 1; week <= 14; week++)
    await r2.put(
      `d1/chilolab-2026-0${Math.ceil(week / 4)}-${String(week).padStart(2, '0')}.json.gz`,
      new Uint8Array(),
    );
  await r2.put('feedback/keep-me.png', new Uint8Array());
  const result = await backup(t.env as never, new Date('2026-11-22T19:00:00Z'));
  assert.equal(result.removed, 3);
  const keys = [...r2.objects.keys()];
  assert.equal(keys.filter((key) => key.startsWith('d1/')).length, 12);
  assert.ok(keys.includes('d1/chilolab-2026-11-22.json.gz'));
  assert.ok(
    keys.includes('feedback/keep-me.png'),
    'screenshots are never pruned',
  );
});

const run = (t: T, when: string) =>
  scheduled(
    { scheduledTime: Date.parse(when), cron: '0 19 * * *' } as never,
    t.env as never,
  );
const alerts = (t: T) =>
  t
    .resendMails()
    .map(
      (mail) => mail.body as { to: string[]; subject: string; text: string },
    );

test('a quiet weekday run sends no alert', async () => {
  const t = setup({ env: { BACKUPS: bucket() } });
  t.addUser('o@example.com', 'owner');
  await run(t, '2026-11-25T19:00:00Z'); // Wednesday
  assert.deepEqual(alerts(t), []);
});

test('Sunday without the R2 binding emails the owner that the backup was skipped', async () => {
  const t = setup();
  t.addUser('o@example.com', 'owner');
  await run(t, '2026-11-22T19:00:00Z'); // Sunday
  const [mail] = alerts(t);
  assert.deepEqual(mail!.to, ['o@example.com']);
  assert.match(mail!.text, /Backup tuần này bị bỏ qua/);
});

test('Tuesday with no backup in R2 emails the owner', async () => {
  const t = setup({ env: { BACKUPS: bucket() } });
  t.addUser('o@example.com', 'owner');
  await run(t, '2026-11-24T19:00:00Z'); // Tuesday
  assert.match(alerts(t)[0]!.text, /chưa có bản backup/);
});

test('a failing cleanup is reported and the rest still runs', async () => {
  const r2 = bucket();
  const t = setup({ env: { BACKUPS: r2 } });
  t.addUser('o@example.com', 'owner');
  t.db.exec('DROP TABLE admin_log');
  await run(t, '2026-11-22T19:00:00Z'); // Sunday
  assert.match(alerts(t)[0]!.text, /Dọn dữ liệu hằng ngày thất bại/);
  assert.equal(
    [...r2.objects.keys()].filter((key) => key.startsWith('d1/')).length,
    1,
  );
});
