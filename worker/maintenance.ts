import type { Env } from './env';
import { notifyOwner } from './mail';
import { deliverNotices } from './releases';
import { OWNER_DAYS } from './session';

// Scheduled upkeep (wrangler.jsonc "triggers"), run once a day:
// - cleanup(): deletes rows that no longer do anything (expired sessions and
//   sign-in codes, owner sessions past the 7-day limit, admin log > 1 year).
// - cleanupPhase2(): crash reports after 90 days, and the list of who got a
//   release email 30 days after that notice finished.
// - cleanupAuthStats(): hourly sign-in counters after 90 days.
// - deliverNotices() (worker/releases.ts): the rest of any release email
//   that did not fit in an earlier day's sending budget.
// - backup(): once a week, a gzipped JSON copy of the visitor data in the
//   private R2 bucket bound as BACKUPS. Skipped while that binding is absent.
// - Alerts: if a step fails, the backup is skipped, or (checked each Tuesday
//   UTC) the newest backup is over 8 days old, the owner gets an email
//   through Resend. Without RESEND_API_KEY it only logs.
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

/** Tables from migrations/0007; kept apart so cleanup() runs without them. */
export async function cleanupPhase2(env: Env) {
  const [crashes, deliveries] = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM crash_reports WHERE created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-90 days')`,
    ),
    env.DB.prepare(
      `DELETE FROM notice_deliveries WHERE notice_id IN (
         SELECT id FROM release_notices
          WHERE finished_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days'))`,
    ),
  ]);
  return {
    crashes: crashes!.meta.changes ?? 0,
    deliveries: deliveries!.meta.changes ?? 0,
  };
}

/** Sign-in counters (migrations/0009) older than 90 days. */
export async function cleanupAuthStats(env: Env) {
  const done = await env.DB.prepare('DELETE FROM auth_stats WHERE hour < ?')
    .bind(new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 13))
    .run();
  return { authStats: done.meta.changes ?? 0 };
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

const STALE_DAYS = 8;

/** Age in days of the newest backup in R2, or null when there is none. */
export async function newestBackupAge(env: Env, now = new Date()) {
  if (!env.BACKUPS) return null;
  const listed = await env.BACKUPS.list({ prefix: 'd1/' });
  const newest = listed.objects
    .map((object) => object.uploaded.getTime())
    .reduce((a, b) => Math.max(a, b), 0);
  return newest ? (now.getTime() - newest) / 86400_000 : null;
}

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function alert(env: Env, problem: string) {
  console.error('maintenance alert', problem);
  try {
    await notifyOwner(env, '[ChiloLab] Bảo trì tự động gặp lỗi', [
      problem,
      'Xem chi tiết ở Cloudflare dashboard → Workers → chilolab-portfolio → Logs.',
      'Cách xử lý và khôi phục: docs/DATABASE.md, mục "Bảo trì tự động (cron)".',
    ]);
  } catch (error) {
    console.error('maintenance alert mail', error);
  }
}

/**
 * Daily cron at 19:00 UTC (02:00 in Vietnam): cleanup every day, a backup on
 * the run that falls on Sunday UTC (early Monday in Vietnam), and on Tuesday
 * UTC a check that the newest backup is recent.
 */
export async function scheduled(controller: ScheduledController, env: Env) {
  const when = new Date(controller.scheduledTime);
  try {
    console.log('cleanup', await cleanup(env));
  } catch (error) {
    await alert(env, `Dọn dữ liệu hằng ngày thất bại: ${describe(error)}`);
  }
  try {
    console.log('cleanup phase 2', await cleanupPhase2(env));
    const notices = await deliverNotices(env);
    console.log('release notices', notices);
    if ('failed' in notices)
      await alert(
        env,
        `Resend từ chối gửi email báo bản mới (thông báo #${notices.failed}); sẽ thử lại ở lần chạy sau.`,
      );
  } catch (error) {
    await alert(
      env,
      `Dọn báo lỗi app hoặc gửi email bản mới thất bại (đã chạy migration 0007 chưa?): ${describe(error)}`,
    );
  }
  try {
    console.log('cleanup auth stats', await cleanupAuthStats(env));
  } catch (error) {
    await alert(
      env,
      `Dọn số liệu đăng nhập thất bại (đã chạy migration 0009 chưa?): ${describe(error)}`,
    );
  }
  if (when.getUTCDay() === 0) {
    try {
      const result = await backup(env, when);
      console.log('backup', result);
      if ('skipped' in result)
        await alert(env, `Backup tuần này bị bỏ qua: ${result.skipped}.`);
    } catch (error) {
      await alert(env, `Backup D1 lên R2 thất bại: ${describe(error)}`);
    }
  }
  // Catches a Sunday run that never happened, not only one that failed.
  if (when.getUTCDay() === 2 && env.BACKUPS) {
    try {
      const age = await newestBackupAge(env, when);
      if (age === null)
        await alert(
          env,
          'Bucket chilolab-backups chưa có bản backup nào trong d1/.',
        );
      else if (age > STALE_DAYS)
        await alert(
          env,
          `Bản backup mới nhất đã ${Math.floor(age)} ngày tuổi (quá ${STALE_DAYS} ngày).`,
        );
    } catch (error) {
      await alert(env, `Không kiểm tra được bucket backup: ${describe(error)}`);
    }
  }
}
