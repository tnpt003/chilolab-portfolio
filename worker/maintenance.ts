import type { Env } from './env';
import { OWNER_DAYS } from './session';

// Scheduled upkeep (wrangler.jsonc "triggers"), run once a day:
// - cleanup(): deletes rows that no longer do anything (expired sessions and
//   sign-in codes, owner sessions past the 7-day limit, admin log > 1 year).
// - backup(): once a week, a gzipped JSON copy of the visitor data in the
//   private R2 bucket bound as BACKUPS. Skipped while that binding is absent.
// Restore with scripts/restore-backup.mjs (docs/DATABASE.md).

const stamp = (time: number) =>
  new Date(time).toISOString().replace(/\.\d+Z$/, 'Z');

export async function cleanup(env: Env) {
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(
      new Date(now).toISOString(),
    ),
    // currentUser() already refuses these; this removes the dead rows.
    env.DB.prepare(
      `DELETE FROM sessions WHERE created_at < ?
         AND user_id IN (SELECT id FROM users WHERE role = 'owner')`,
    ).bind(stamp(now - OWNER_DAYS * 86400_000)),
    env.DB.prepare('DELETE FROM email_codes WHERE expires_at < ?').bind(
      new Date(now).toISOString(),
    ),
    env.DB.prepare(
      `DELETE FROM admin_log WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-365 days')`,
    ),
  ]);
  const [sessions, ownerSessions, codes, log] = results.map(
    (result) => result.meta.changes ?? 0,
  );
  return { sessions: sessions + ownerSessions, codes, log };
}

// Short-lived rows are left out: a restored site signs everyone in again.
const SKIP = new Set(['sessions', 'email_codes']);
const KEEP = 12; // weekly copies, about three months
const PAGE = 500;

export async function backup(env: Env, now = new Date()) {
  const bucket = env.BACKUPS;
  if (!bucket) return { skipped: 'no BACKUPS binding' };
  const { results: tables } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
     ORDER BY name`,
  ).all<{ name: string }>();
  const data: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    if (SKIP.has(name) || !/^\w+$/.test(name)) continue;
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM "${name}" ORDER BY rowid LIMIT ? OFFSET ?`,
      )
        .bind(PAGE, offset)
        .all();
      rows.push(...results);
      if (results.length < PAGE) break;
    }
    data[name] = rows;
  }
  const json = JSON.stringify({
    format: 'chilolab-d1-backup',
    version: 1,
    createdAt: now.toISOString(),
    tables: data,
  });
  const gzipped = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  const key = `d1/chilolab-${now.toISOString().slice(0, 10)}.json.gz`;
  await bucket.put(key, gzipped, {
    httpMetadata: { contentType: 'application/gzip' },
    customMetadata: {
      tables: String(Object.keys(data).length),
      rows: String(Object.values(data).reduce((n, rows) => n + rows.length, 0)),
    },
  });
  // Keys sort by date, so everything before the newest KEEP goes.
  const listed = await bucket.list({ prefix: 'd1/' });
  const old = listed.objects
    .map((object) => object.key)
    .sort()
    .slice(0, -KEEP);
  if (old.length) await bucket.delete(old);
  return { key, bytes: gzipped.byteLength, removed: old.length };
}

/**
 * Daily cron at 19:00 UTC (02:00 in Vietnam): cleanup every day, and a
 * backup on the run that falls on Sunday UTC (early Monday in Vietnam).
 */
export async function scheduled(controller: ScheduledController, env: Env) {
  const when = new Date(controller.scheduledTime);
  console.log('cleanup', await cleanup(env));
  if (when.getUTCDay() === 0) console.log('backup', await backup(env, when));
}
