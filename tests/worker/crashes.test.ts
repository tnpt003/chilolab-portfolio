// Crash reports from the desktop apps (worker/crashes.ts): off by default,
// stored only with consent, and scrubbed of user names and email addresses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrub } from '../../worker/crashes.ts';
import { setup } from './harness.ts';

type T = ReturnType<typeof setup>;
const report = {
  consent: true,
  project: 'pet-desktop',
  appVersion: '1.5.2',
  reportId: 'report-0123456789abcdef',
  kind: 'NullReferenceException',
  message: 'Crash for nguyen.van.a@example.com',
  stack:
    'at Pet.Walk() in C:\\Users\\Nguyen Van A\\AppData\\Local\\Pet\\Walk.cs:line 42',
  os: 'Windows 11',
};
// The app sends no Origin header and no cookie.
const send = (t: T, body: unknown, origin: string | null = null) =>
  t.call('/api/crash-reports', { body, origin });
const turnOn = (t: T) =>
  t.db
    .prepare("INSERT INTO settings (key, value) VALUES ('crashReports', '1')")
    .run();
const stored = (t: T) =>
  t.db.prepare('SELECT * FROM crash_reports').all() as Record<
    string,
    unknown
  >[];

test('crash reports are off until the owner turns them on', async () => {
  const t = setup();
  const response = await send(t, report);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'closed');
  assert.equal(stored(t).length, 0);
});

test('without consent nothing is stored', async () => {
  const t = setup();
  turnOn(t);
  for (const consent of [undefined, false, 'yes', 1]) {
    const response = await send(t, { ...report, consent });
    assert.equal(response.status, 400, String(consent));
  }
  assert.equal(stored(t).length, 0);
});

test('a report is stored without the Windows user name or email', async () => {
  const t = setup();
  turnOn(t);
  const response = await send(t, report);
  assert.equal(response.status, 201);
  const [row] = stored(t);
  const all = JSON.stringify(row);
  assert.doesNotMatch(all, /Nguyen Van A/);
  assert.doesNotMatch(all, /nguyen\.van\.a@example\.com/);
  assert.match(String(row!.stack), /C:\\Users\\<user>\\AppData/);
  assert.match(String(row!.message), /<email>/);
});

test('scrub() covers Windows, macOS and Linux paths', () => {
  assert.equal(scrub('C:/Users/Phat/x.log'), 'C:/Users/<user>/x.log');
  assert.equal(scrub('d:\\users\\A B\\y'), 'd:\\users\\<user>\\y');
  assert.equal(scrub('/Users/phat/Library'), '/Users/<user>/Library');
  assert.equal(scrub('/home/phat/.config'), '/home/<user>/.config');
  assert.equal(scrub('mail me: a.b@c.io'), 'mail me: <email>');
});

test('a retry of the same report is stored once', async () => {
  const t = setup();
  turnOn(t);
  await send(t, report);
  await send(t, report);
  assert.equal(stored(t).length, 1);
});

test('a browser page on another site cannot send reports', async () => {
  const t = setup();
  turnOn(t);
  const response = await send(t, report, 'https://evil.example');
  assert.equal(response.status, 403);
  assert.equal(stored(t).length, 0);
});

test('malformed reports are refused', async () => {
  const t = setup();
  turnOn(t);
  const bad = [
    { project: 'unknown-app' },
    { appVersion: 'latest' },
    { reportId: 'short' },
    { kind: '' },
  ];
  for (const change of bad) {
    const response = await send(t, { ...report, ...change });
    assert.equal(response.status, 400, JSON.stringify(change));
  }
  assert.equal(stored(t).length, 0);
});
