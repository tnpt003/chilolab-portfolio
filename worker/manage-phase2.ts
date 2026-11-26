import type { Env } from './env';
import { mailEnabled } from './mail';
import {
  bulkBar,
  button,
  checkbox,
  escape,
  filters,
  formStart,
  pageNumber,
  pager,
  PER_PAGE,
  select,
  table,
  tabs,
  when,
  type Row,
} from './manage-ui';
import { catalog, NOTICE_DAILY, sentToday } from './releases';
import { getSettings } from './settings';

// Admin pages for the data roadmap's phase 2: release emails and crash
// reports. Writes go through post() in worker/manage.ts like every other page.

const count = (rows: Row[], key: string, field = 'status') =>
  Number(rows.find((row) => row[field] === key)?.n ?? 0);

export async function releasesPage(env: Env, back: string) {
  const [data, used, [subs, notices]] = await Promise.all([
    catalog(env),
    sentToday(env),
    env.DB.batch<Row>([
      env.DB.prepare(
        `SELECT s.project, COUNT(*) AS n FROM subscriptions s
           JOIN users u ON u.id = s.user_id
          WHERE u.blocked_at IS NULL GROUP BY s.project`,
      ),
      env.DB.prepare(
        `SELECT n.*, (SELECT COUNT(*) FROM notice_deliveries d WHERE d.notice_id = n.id) AS sent
           FROM release_notices n`,
      ),
    ]),
  ]);
  const enabled = mailEnabled(env);
  const subscribers = (project: string) =>
    count(subs!.results, project, 'project');
  const sections = Object.entries(data).map(([project, names]) => {
    const n = subscribers(project);
    const rows = names.releases.map((release) => {
      const notice = notices!.results.find(
        (row) => row.project === project && row.version === release.version,
      );
      let state: string;
      let action = '';
      if (!notice) {
        state = '<span class="tag">Chưa gửi</span>';
        action =
          n && enabled
            ? `<details class="note"><summary>Gửi email…</summary><p class="hint">Gửi tới ${n} người đăng ký, mỗi người một email riêng bằng ngôn ngữ họ chọn, kèm tóm tắt và link tới trang phiên bản. Không thu hồi được sau khi gửi.</p>${button(`notice-send:${project}@${release.version}`, `Có, gửi ${n} email`)}</details>`
            : `<small>${enabled ? 'Chưa có ai đăng ký.' : 'Chưa có RESEND_API_KEY.'}</small>`;
      } else if (!notice.finished_at) {
        state = `<span class="tag warn">Đang gửi: ${escape(notice.sent)} đã gửi</span><br><small>Bắt đầu ${when(notice.created_at)}</small>`;
        action = button(`notice-stop:${notice.id}`, 'Dừng gửi', 'ghost');
      } else
        state = `<span class="tag ok">Đã gửi ${escape(notice.sent)} email</span><br><small>Xong ${when(notice.finished_at)}</small>`;
      return `<tr><td><a href="${escape(release.vi.path)}">v${escape(release.version)}</a></td><td>${escape(release.vi.title)}</td><td>${escape(release.releasedAt ?? '—')}</td><td>${state}</td><td class="ops">${action}</td></tr>`;
    });
    return `<section class="box"><h2>${escape(names.vi.title)} · ${n} người đăng ký</h2>${table(
      ['Phiên bản', 'Tiêu đề', 'Ngày phát hành', 'Trạng thái', ''],
      rows,
      'Dự án này chưa có bản nào ở trạng thái "Đã phát hành".',
    )}</section>`;
  });
  return `<h1>Email báo bản mới</h1>
<p class="intro">Người dùng đã đăng nhập chọn dự án muốn nhận tin ở trang Tài khoản. Chỉ bản "Đã phát hành" (không phải nháp) mới gửi được. Mỗi ngày gửi tối đa ${NOTICE_DAILY} email (Resend miễn phí 100/ngày, phần còn lại để dành cho mã đăng nhập và cảnh báo); phần chưa gửi hết sẽ tự gửi tiếp lúc 02:00 hôm sau. Mỗi email có link hủy nhận.</p>
${enabled ? '' : '<div class="notice warn"><p>Chưa có <code>RESEND_API_KEY</code>, nên chưa gửi được email nào.</p></div>'}
<p>Hôm nay đã gửi <strong>${used}</strong>/${NOTICE_DAILY} email báo bản mới.</p>
${formStart(back)}${sections.join('')}</form>`;
}

const crashStates: Record<string, string> = {
  new: 'Chưa xem',
  done: 'Đã xem',
};

export async function crashesPage(env: Env, url: URL, back: string) {
  const status =
    ['new', 'done', 'all'].find(
      (value) => value === url.searchParams.get('status'),
    ) ?? 'new';
  const page = pageNumber(url);
  const project = url.searchParams.get('project') ?? '';
  const parts = [status === 'all' ? '1 = 1' : 'status = ?'];
  const args: string[] = status === 'all' ? [] : [status];
  if (project) {
    parts.push('project = ?');
    args.push(project);
  }
  const filter = parts.join(' AND ');
  const [[rows, total, groups, projects], settings] = await Promise.all([
    env.DB.batch<Row>([
      env.DB.prepare(
        `SELECT * FROM crash_reports WHERE ${filter} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
      env.DB.prepare(
        `SELECT COUNT(*) AS n FROM crash_reports WHERE ${filter}`,
      ).bind(...args),
      env.DB.prepare(
        'SELECT status, COUNT(*) AS n FROM crash_reports GROUP BY status',
      ),
      env.DB.prepare(
        'SELECT DISTINCT project FROM crash_reports ORDER BY project',
      ),
    ]),
    getSettings(env),
  ]);
  const body = rows!.results.map(
    (row) =>
      `<tr class="${row.status === 'done' ? 'done' : ''}"><td class="pick">${checkbox(row.id, `Chọn báo lỗi #${row.id}`)}</td><td>${when(row.created_at)}<br><span class="tag ${row.status === 'new' ? 'warn' : 'ok'}">${crashStates[String(row.status)] ?? escape(row.status)}</span></td><td>${escape(row.project)}<br><small>v${escape(row.app_version)}${row.os ? ` · ${escape(row.os)}` : ''}</small></td><td class="body"><strong>${escape(row.kind)}</strong>${row.message ? `\n${escape(row.message)}` : ''}${row.stack ? `<details class="note"><summary>Stack trace</summary><pre>${escape(row.stack)}</pre></details>` : ''}</td><td class="ops">${row.status === 'new' ? button(`crash-done:${row.id}`, 'Đã xem', 'ghost') : button(`crash-new:${row.id}`, 'Đánh dấu chưa xem', 'ghost')}${button(`crash-delete:${row.id}`, 'Xóa…', 'danger')}</td></tr>`,
  );
  const n = (key: string) => count(groups!.results, key);
  return `<h1>Báo lỗi app</h1>
<p class="intro">Báo cáo sự cố app gửi về <code>POST /api/crash-reports</code>, chỉ khi người dùng đã đồng ý trong app. Không lưu IP hay tài khoản; tên người dùng Windows trong đường dẫn được thay bằng <code>&lt;user&gt;</code>. Tự xóa sau 90 ngày. Cách app gửi: <code>docs/CRASH-REPORTS.md</code>.</p>
${settings.crashReports ? '' : '<div class="notice warn"><p>Đang <strong>tắt</strong>: server từ chối mọi báo lỗi. Chỉ bật ở <a href="/admin/manage/settings?tab=feedback">Cài đặt → Góp ý</a> khi bản app có hỏi ý người dùng đã phát hành, và /privacy cùng EULA đã nói về việc này.</p></div>'}
<div class="toolbar">${tabs(url, 'status', status, [
    ['new', 'Chưa xem', n('new')],
    ['done', 'Đã xem', n('done')],
    ['all', 'Tất cả', n('new') + n('done')],
  ])}${filters(
    url,
    ['status'],
    select(
      'project',
      'Dự án',
      project,
      projects!.results.map((row) => [
        String(row.project),
        String(row.project),
      ]),
    ),
  )}</div>
${formStart(back)}${bulkBar([
    ['crash-done', 'Đánh dấu đã xem'],
    ['crash-new', 'Đánh dấu chưa xem'],
    ['crash-delete', 'Xóa'],
  ])}${table(
    [
      '<span class="sr-only">Chọn</span>',
      'Thời gian',
      'Dự án · phiên bản',
      'Lỗi',
      '',
    ],
    body,
    'Không có báo lỗi nào ở mục này.',
  )}</form>
${pager(url, page, Number(total!.results[0]?.n ?? 0))}`;
}
