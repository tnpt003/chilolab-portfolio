import { deleteUserComments, removeComment } from './comments';
import { redirect, sameOrigin, text, type Env } from './env';
import { getStats, statsProjects } from './github';
import { mailEnabled } from './mail';
import { crashesPage, releasesPage } from './manage-phase2';
import { catalog, deliverNotices } from './releases';
import {
  barChart,
  bulkBar,
  button,
  checkbox,
  csv,
  escape,
  feedbackStates,
  filters,
  formStart,
  htmlHeaders,
  kinds,
  layout,
  pageNumber,
  pager,
  PER_PAGE,
  query,
  reasons,
  searchField,
  select,
  table,
  tabs,
  when,
  type Admin,
  type Badges,
  type Row,
} from './manage-ui';
import { ADMIN_HINT, cookie, endSession } from './session';
import {
  clampInt,
  COMMENT_MAX,
  getSettings,
  parseWords,
  saveSettings,
  type Settings,
} from './settings';

// Owner admin panel at /admin/manage/*. index.ts lets a request in only after it
// confirms an owner account session (or the localhost dev bypass); anything
// else fails closed. The old /manage address redirects here.
// No JavaScript: every write is a same-origin POST, destructive operations
// ask for confirmation first, and each change is written to admin_log.

export type { Admin };

const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const notices: Record<string, string> = {
  saved: 'Đã lưu cài đặt.',
  unchanged: 'Không có gì thay đổi.',
  approve: 'Đã cho hiện bình luận.',
  remove: 'Đã gỡ bình luận.',
  reply: 'Đã đăng trả lời.',
  'fb-new': 'Đã chuyển góp ý về "Chưa xử lý".',
  'fb-progress': 'Đã chuyển góp ý sang "Đang xử lý".',
  'fb-done': 'Đã đánh dấu góp ý là đã xử lý.',
  'fb-delete': 'Đã xóa góp ý.',
  note: 'Đã lưu ghi chú.',
  'user-signout': 'Đã đăng xuất tài khoản khỏi mọi thiết bị.',
  'user-block': 'Đã khóa tài khoản.',
  'user-unblock': 'Đã mở khóa tài khoản.',
  'user-delete': 'Đã xóa tài khoản và bình luận của người đó.',
  'nothing-selected': 'Chưa chọn mục nào hoặc chưa chọn thao tác.',
  'reply-empty': 'Nội dung trả lời trống hoặc quá dài.',
  'notice-send':
    'Đã bắt đầu gửi email báo bản mới. Tải lại trang sau ít phút để xem số đã gửi.',
  'notice-exists': 'Bản này đã được gửi hoặc đang gửi.',
  'notice-stop': 'Đã dừng gửi email cho bản này.',
  'crash-done': 'Đã đánh dấu báo lỗi là đã xem.',
  'crash-new': 'Đã đánh dấu báo lỗi là chưa xem.',
  'crash-delete': 'Đã xóa báo lỗi.',
};
const warnings = new Set([
  'nothing-selected',
  'reply-empty',
  'unchanged',
  'notice-exists',
]);

// ---------- admin log ----------

const actionLabels: Record<string, string> = {
  approve: 'Cho hiện bình luận',
  remove: 'Gỡ bình luận',
  reply: 'Trả lời bình luận',
  'fb-new': 'Góp ý → chưa xử lý',
  'fb-progress': 'Góp ý → đang xử lý',
  'fb-done': 'Góp ý → đã xử lý',
  'fb-delete': 'Xóa góp ý',
  note: 'Ghi chú góp ý',
  'user-signout': 'Đăng xuất người dùng',
  'user-block': 'Khóa tài khoản',
  'user-unblock': 'Mở khóa tài khoản',
  'user-delete': 'Xóa tài khoản',
  'notice-send': 'Gửi email báo bản mới',
  'notice-stop': 'Dừng gửi email bản mới',
  'crash-done': 'Báo lỗi app → đã xem',
  'crash-new': 'Báo lỗi app → chưa xem',
  'crash-delete': 'Xóa báo lỗi app',
  settings: 'Đổi cài đặt',
  export: 'Xuất CSV',
};

async function log(
  env: Env,
  admin: Admin,
  action: string,
  target: string,
  detail = '',
) {
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO admin_log (actor, action, target, detail) VALUES (?, ?, ?, ?)',
      ).bind(admin.name, action, target, detail.slice(0, 500)),
      env.DB.prepare(
        `DELETE FROM admin_log WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-365 days')`,
      ),
    ]);
  } catch (error) {
    // Before migration 0006 the table does not exist; the action still ran.
    console.error('admin_log', error);
  }
}

// ---------- shared pieces ----------

const commentSelect = `SELECT c.*, u.display_name, u.email, u.role AS author_role
  FROM comments c LEFT JOIN users u ON u.id = c.user_id`;

function where(row: Row) {
  const target = row.version
    ? `/${row.project}/versions/${row.version}`
    : `/${row.project}`;
  return `<a href="${escape(target)}#comments">${escape(row.project)}${row.version ? ` v${escape(row.version)}` : ''}</a>${row.parent_id ? '<br><small>trả lời</small>' : ''}`;
}

function who(row: Row) {
  if (!row.display_name) return escape(row.author ?? '—');
  const name = row.user_id
    ? `<a href="/admin/manage/users/${escape(row.user_id)}">${escape(row.display_name)}</a>`
    : escape(row.display_name);
  return `${name}${row.author_role === 'owner' ? ' <span class="tag ok">Tác giả</span>' : ''}<br><small>${escape(row.email)}</small>`;
}

const reasonTag = (row: Row) =>
  row.moderation_reason
    ? `<span class="tag">${escape(reasons[String(row.moderation_reason)] ?? row.moderation_reason)}</span> `
    : '';

function commentRow(row: Row, pick = true) {
  const held = row.status === 'held';
  const ops =
    (held ? button(`approve:${row.id}`, 'Cho hiện') : '') +
    `<a class="button-link ghost" href="/admin/manage/comments/${escape(row.id)}">Luồng / trả lời</a>` +
    button(`remove:${row.id}`, 'Gỡ…', 'danger');
  return `<tr${held ? ' class="held"' : ''}>${pick ? `<td class="pick">${checkbox(row.id, `Chọn bình luận #${row.id}`)}</td>` : ''}<td>${held ? '<span class="tag warn">Bị giữ</span><br>' : ''}${when(row.created_at)}${row.edited_at ? '<br><small>đã sửa</small>' : ''}</td><td>${where(row)}</td><td>${who(row)}</td><td class="body">${reasonTag(row)}${escape(row.body)}</td><td class="ops">${ops}</td></tr>`;
}

const commentHeadings = (pick = true) => [
  ...(pick ? ['<span class="sr-only">Chọn</span>'] : []),
  'Thời gian',
  'Ở đâu',
  'Người viết',
  'Nội dung (lý do)',
  '',
];

async function badges(env: Env): Promise<Badges> {
  const row = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM comments WHERE status = 'held') AS held,
            (SELECT COUNT(*) FROM feedback WHERE status = 'new') AS newFeedback`,
  ).first<Badges>();
  // Before migration 0007 the table is missing; the panel still opens.
  const crashes = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM crash_reports WHERE status = 'new'",
  )
    .first<{ n: number }>()
    .catch(() => null);
  return {
    held: Number(row?.held ?? 0),
    newFeedback: Number(row?.newFeedback ?? 0),
    newCrashes: Number(crashes?.n ?? 0),
  };
}

const count = (rows: Row[], key: string, field = 'status') =>
  Number(rows.find((row) => row[field] === key)?.n ?? 0);

// ---------- pages ----------

async function dashboard(env: Env, ctx: ExecutionContext, back: string) {
  const [stats, held, feedback, daily] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM users WHERE created_at >= date('now', '-6 days')) AS newUsers,
              (SELECT COUNT(*) FROM comments WHERE status = 'published') AS published,
              (SELECT COUNT(*) FROM comments WHERE created_at >= date('now', '-6 days') AND status IN ('published', 'held')) AS newComments,
              (SELECT COUNT(*) FROM comments WHERE status = 'held') AS held,
              (SELECT COUNT(*) FROM feedback WHERE status = 'new') AS feedback,
              (SELECT COUNT(*) FROM feedback WHERE status = 'progress') AS progress,
              (SELECT COALESCE(SUM(count), 0) FROM downloads WHERE day >= date('now', '-29 days')) AS clicks`,
    ),
    env.DB.prepare(
      `${commentSelect} WHERE c.status = 'held' ORDER BY c.created_at LIMIT 5`,
    ),
    env.DB.prepare(
      `SELECT * FROM feedback WHERE status = 'new' ORDER BY created_at DESC LIMIT 5`,
    ),
    env.DB.prepare(
      `SELECT day, SUM(count) AS total FROM downloads WHERE day >= date('now', '-29 days') GROUP BY day`,
    ),
  ]);
  // admin_log arrives with migration 0006; the dashboard works without it.
  const recent = await env.DB.prepare(
    'SELECT * FROM admin_log ORDER BY id DESC LIMIT 6',
  )
    .all<Row>()
    .catch(() => ({ results: [] as Row[] }));
  const s = stats.results[0] ?? {};
  const github = await getStats('pet-desktop', ctx);
  const card = (
    label: string,
    value: unknown,
    href: string,
    note = '',
    alert = false,
  ) =>
    `<a class="card${alert ? ' alert' : ''}" href="${href}"><span class="value">${escape(value ?? 0)}</span><span class="label">${label}</span>${note ? `<small>${note}</small>` : ''}</a>`;
  const settings = await getSettings(env);
  const flags = [
    !settings.commentsOpen && 'Bình luận mới đang <strong>tắt</strong>.',
    settings.moderation === 'manual' &&
      'Mọi bình luận đang được <strong>giữ chờ duyệt</strong>.',
    !settings.feedbackOpen && 'Form góp ý đang <strong>tắt</strong>.',
    !settings.signups && 'Đang <strong>không nhận</strong> tài khoản mới.',
  ].filter(Boolean);
  return `<h1>Tổng quan</h1>
<p class="intro">Tình hình website và những việc đang chờ bạn.</p>
${flags.length ? `<div class="notice warn"><p>${flags.join(' ')} <a href="/admin/manage/settings">Đổi trong Cài đặt</a></p></div>` : ''}
<section class="cards" aria-label="Số liệu chính">
${card('Bình luận chờ duyệt', s.held, '/admin/manage/comments?status=held', '', Number(s.held) > 0)}
${card('Góp ý chưa xử lý', s.feedback, '/admin/manage/feedback', `${escape(s.progress ?? 0)} đang xử lý`, Number(s.feedback) > 0)}
${card('Bình luận đang hiện', s.published, '/admin/manage/comments?status=published', `+${escape(s.newComments ?? 0)} trong 7 ngày`)}
${card('Tài khoản khách', s.users, '/admin/manage/users', `+${escape(s.newUsers ?? 0)} trong 7 ngày`)}
${card('Lượt tải Pet Desktop', github ? github.total : '—', '/admin/manage/downloads', 'Theo GitHub Releases')}
${card('Lượt bấm tải (30 ngày)', s.clicks, '/admin/manage/downloads', 'Trên chilolab.com')}
</section>
<div class="columns">
<section class="box wide"><h2>Bình luận chờ duyệt</h2>${formStart(back, 'held')}${table(
    commentHeadings(false),
    held.results.map((row) => commentRow(row, false)),
    'Không có bình luận nào đang bị giữ.',
  )}</form><p><a href="/admin/manage/comments?status=held">Xem tất cả</a></p></section>
<section class="box"><h2>Góp ý mới</h2>${
    feedback.results.length
      ? `<ul class="list">${feedback.results.map((row) => `<li><strong>${escape(row.summary || kinds[String(row.kind)])}</strong> <small>· ${escape(row.project)} · ${when(row.created_at)}</small></li>`).join('')}</ul>`
      : '<p class="empty">Không có góp ý mới.</p>'
  }<p><a href="/admin/manage/feedback">Xem tất cả</a></p></section>
<section class="box"><h2>Lượt bấm tải trên site, 30 ngày</h2>${barChart(30, daily.results, 'Lượt bấm tải mỗi ngày')}</section>
<section class="box"><h2>Hoạt động quản trị gần đây</h2>${
    recent.results.length
      ? `<ul class="list">${recent.results.map((row) => `<li>${escape(actionLabels[String(row.action)] ?? row.action)} <small>· ${escape(row.target)} · ${when(row.at)}</small></li>`).join('')}</ul>`
      : '<p class="empty">Chưa có hoạt động nào.</p>'
  }<p><a href="/admin/manage/log">Xem nhật ký</a></p></section>
</div>`;
}

async function commentsPage(env: Env, url: URL, back: string) {
  const status =
    ['held', 'published', 'all'].find(
      (value) => value === url.searchParams.get('status'),
    ) ?? 'held';
  const page = pageNumber(url);
  const q = query(url);
  const place = url.searchParams.get('where') ?? '';
  const reason = url.searchParams.get('reason') ?? '';
  const parts = [
    status === 'all' ? `c.status IN ('published', 'held')` : `c.status = ?`,
  ];
  const args: (string | number)[] = status === 'all' ? [] : [status];
  if (q) {
    parts.push('instr(lower(c.body), lower(?)) > 0');
    args.push(q);
  }
  if (place) {
    const [project, version] = place.split('@');
    parts.push(version ? 'c.project = ? AND c.version = ?' : 'c.project = ?');
    args.push(...(version ? [project!, version] : [project!]));
  }
  if (reason && reasons[reason]) {
    parts.push('c.moderation_reason = ?');
    args.push(reason);
  }
  const filter = parts.join(' AND ');
  const order = status === 'held' ? 'c.created_at' : 'c.created_at DESC';
  const [rows, total, groups, places] = await env.DB.batch<Row>([
    env.DB.prepare(
      `${commentSelect} WHERE ${filter} ORDER BY ${order}, c.id LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM comments c WHERE ${filter}`).bind(
      ...args,
    ),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM comments GROUP BY status`,
    ),
    env.DB.prepare(
      `SELECT DISTINCT project, version FROM comments WHERE status IN ('published', 'held') ORDER BY project, version`,
    ),
  ]);
  const projects = [
    ...new Set(places.results.map((row) => String(row.project))),
  ];
  const placeOptions: [string, string][] = projects.flatMap((project) => [
    [project, `${project} (mọi phiên bản)`] as [string, string],
    ...places.results
      .filter((row) => row.project === project && row.version)
      .map(
        (row) =>
          [`${project}@${row.version}`, `${project} v${row.version}`] as [
            string,
            string,
          ],
      ),
  ]);
  const held = count(groups.results, 'held');
  const published = count(groups.results, 'published');
  return `<h1>Bình luận</h1>
<p class="intro">AI hoặc danh sách từ cấm giữ lại bình luận có dấu hiệu xúc phạm; chỉ người viết thấy chúng cho tới khi bạn "Cho hiện". Cách kiểm duyệt đổi ở <a href="/admin/manage/settings">Cài đặt</a>. <a href="/admin/manage/export/comments.csv">Xuất CSV</a></p>
<div class="toolbar">${tabs(url, 'status', status, [
    ['held', 'Chờ duyệt', held],
    ['published', 'Đang hiện', published],
    ['all', 'Tất cả', held + published],
  ])}${filters(
    url,
    ['status'],
    select('where', 'Ở đâu', place, placeOptions) +
      select(
        'reason',
        'Lý do',
        reason,
        Object.entries(reasons) as [string, string][],
      ) +
      searchField(url, 'Tìm trong nội dung…'),
  )}</div>
${formStart(back)}${bulkBar([
    ['approve', 'Cho hiện'],
    ['remove', 'Gỡ'],
  ])}${table(
    commentHeadings(),
    rows.results.map((row) => commentRow(row)),
    q || place || reason
      ? 'Không tìm thấy bình luận nào khớp bộ lọc.'
      : 'Không có bình luận nào ở mục này.',
  )}</form>
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function threadPage(env: Env, id: number, back: string, admin: Admin) {
  const first = await env.DB.prepare(`${commentSelect} WHERE c.id = ?`)
    .bind(id)
    .first<Row>();
  if (!first) return null;
  const top = first.parent_id
    ? await env.DB.prepare(`${commentSelect} WHERE c.id = ?`)
        .bind(first.parent_id)
        .first<Row>()
    : first;
  if (!top) return null;
  const { results: replies } = await env.DB.prepare(
    `${commentSelect} WHERE c.parent_id = ? ORDER BY c.created_at, c.id`,
  )
    .bind(top.id)
    .all<Row>();
  const item = (row: Row) => {
    const gone = row.status === 'deleted' || row.status === 'removed';
    const state =
      row.status === 'held'
        ? '<span class="tag warn">Bị giữ</span>'
        : row.status === 'deleted'
          ? '<span class="tag info">Người viết đã xóa</span>'
          : row.status === 'removed'
            ? '<span class="tag">Đã gỡ</span>'
            : '';
    const ops = gone
      ? ''
      : (row.status === 'held' ? button(`approve:${row.id}`, 'Cho hiện') : '') +
        button(`remove:${row.id}`, 'Gỡ…', 'danger');
    return `<div class="meta"><strong>${who(row)}</strong> · ${when(row.created_at)}${row.edited_at ? ' · đã sửa' : ''} ${state} ${reasonTag(row)}${row.id === id ? '<span class="tag info">Đang xem</span>' : ''}</div>${gone ? '<p class="text muted">(không còn nội dung)</p>' : `<p class="text">${escape(row.body)}</p>`}${ops}`;
  };
  const canReply = admin.userId !== null && top.status === 'published';
  return `<p><a href="/admin/manage/comments">← Bình luận</a></p>
<h1>Luồng bình luận</h1>
<p class="intro">Ở ${where(top)}. Trả lời ở đây đăng dưới tên tài khoản chủ site, kèm nhãn "Tác giả", không qua kiểm duyệt.</p>
${formStart(back)}<ol class="thread"><li>${item(top)}${
    replies.length
      ? `<ol class="replies">${replies.map((row) => `<li>${item(row)}</li>`).join('')}</ol>`
      : ''
  }</li></ol>
${
  canReply
    ? `<div class="box"><div class="field"><label for="reply">Trả lời luồng này</label><textarea id="reply" name="reply" rows="4" maxlength="${COMMENT_MAX}"></textarea></div>${button(`reply:${top.id}`, 'Đăng trả lời')}</div>`
    : `<p class="muted">${admin.userId === null ? 'Đang mở bằng chế độ dev trên máy, không có tài khoản để đăng trả lời.' : 'Chỉ trả lời được luồng đang hiện công khai.'}</p>`
}</form>`;
}

async function feedbackPage(env: Env, url: URL, back: string) {
  const status =
    ['new', 'progress', 'done', 'all'].find(
      (value) => value === url.searchParams.get('status'),
    ) ?? 'new';
  const page = pageNumber(url);
  const project = url.searchParams.get('project') ?? '';
  const kind = url.searchParams.get('kind') ?? '';
  const parts = [status === 'all' ? '1 = 1' : 'f.status = ?'];
  const args: string[] = status === 'all' ? [] : [status];
  if (project) {
    parts.push('f.project = ?');
    args.push(project);
  }
  if (kind && kinds[kind]) {
    parts.push('f.kind = ?');
    args.push(kind);
  }
  const filter = parts.join(' AND ');
  const [rows, total, groups, projects] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT f.*, u.display_name FROM feedback f LEFT JOIN users u ON u.id = f.user_id
       WHERE ${filter} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM feedback f WHERE ${filter}`).bind(
      ...args,
    ),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM feedback GROUP BY status`,
    ),
    env.DB.prepare(`SELECT DISTINCT project FROM feedback ORDER BY project`),
  ]);
  const body = rows.results.map((row) => {
    const moves = (['new', 'progress', 'done'] as const)
      .filter((state) => state !== row.status)
      .map((state) =>
        button(
          `fb-${state}:${row.id}`,
          state === 'new' ? 'Mở lại' : feedbackStates[state]!,
          state === 'done' ? '' : 'ghost',
        ),
      )
      .join('');
    const note = `<details class="note"><summary>${row.note ? 'Sửa ghi chú' : 'Thêm ghi chú'}</summary><label class="sr-only" for="note-${row.id}">Ghi chú nội bộ</label><textarea id="note-${row.id}" name="note-${row.id}" rows="3" maxlength="2000">${escape(row.note)}</textarea><br>${button(`note:${row.id}`, 'Lưu ghi chú', 'ghost')}</details>`;
    const from = row.user_id
      ? `<br><small>Tài khoản: <a href="/admin/manage/users/${escape(row.user_id)}">${escape(row.display_name ?? `#${row.user_id}`)}</a></small>`
      : '';
    return `<tr class="${row.status === 'done' ? 'done' : ''}"><td class="pick">${checkbox(row.id, `Chọn góp ý #${row.id}`)}</td><td>${when(row.created_at)}<br><span class="tag ${row.status === 'new' ? 'warn' : row.status === 'progress' ? 'info' : 'ok'}">${feedbackStates[String(row.status)] ?? escape(row.status)}</span></td><td>${escape(row.project)} · ${escape(row.locale)}<br><small>${escape(kinds[String(row.kind)] ?? row.kind)}</small></td><td class="body">${row.summary ? `<strong>${escape(row.summary)}</strong>\n` : ''}${escape(row.message)}${row.note ? `\n<small>Ghi chú: ${escape(row.note)}</small>` : ''}${note}</td><td>${escape(row.app_version)}${row.os ? ` · ${escape(row.os)}` : ''}</td><td>${escape(row.contact)}${from}</td><td class="ops">${moves}${button(`fb-delete:${row.id}`, 'Xóa…', 'danger')}</td></tr>`;
  });
  const n = (key: string) => count(groups.results, key);
  return `<h1>Góp ý và báo lỗi</h1>
<p class="intro">Gửi từ form <code>/&lt;dự-án&gt;/feedback</code>. Không hiện công khai; ghi chú chỉ bạn thấy. <a href="/admin/manage/export/feedback.csv">Xuất CSV</a></p>
<div class="toolbar">${tabs(url, 'status', status, [
    ['new', 'Chưa xử lý', n('new')],
    ['progress', 'Đang xử lý', n('progress')],
    ['done', 'Đã xử lý', n('done')],
    ['all', 'Tất cả', n('new') + n('progress') + n('done')],
  ])}${filters(
    url,
    ['status'],
    select(
      'project',
      'Dự án',
      project,
      projects.results.map((row) => [String(row.project), String(row.project)]),
    ) +
      select('kind', 'Loại', kind, Object.entries(kinds) as [string, string][]),
  )}</div>
${formStart(back)}${bulkBar([
    ['fb-progress', 'Chuyển sang đang xử lý'],
    ['fb-done', 'Đánh dấu đã xử lý'],
    ['fb-new', 'Mở lại (chưa xử lý)'],
    ['fb-delete', 'Xóa'],
  ])}${table(
    [
      '<span class="sr-only">Chọn</span>',
      'Thời gian',
      'Dự án',
      'Tiêu đề / nội dung',
      'Phiên bản · Windows',
      'Liên hệ',
      '',
    ],
    body,
    'Không có góp ý nào ở mục này.',
  )}</form>
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function downloadsPage(env: Env, ctx: ExecutionContext) {
  const [totals, daily] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT project, version, kind, SUM(count) AS total FROM downloads GROUP BY project, version, kind`,
    ),
    env.DB.prepare(
      `SELECT day, SUM(count) AS total FROM downloads WHERE day >= date('now', '-29 days') GROUP BY day`,
    ),
  ]);
  const github = await Promise.all(
    statsProjects.map(
      async (project) => [project, await getStats(project, ctx)] as const,
    ),
  );
  const rows = totals.results.sort(
    (a, b) =>
      String(a.project).localeCompare(String(b.project)) ||
      String(b.version).localeCompare(String(a.version), 'en', {
        numeric: true,
      }),
  );
  return `<h1>Lượt tải</h1>
<p class="intro">Hai nguồn khác nhau: <strong>GitHub</strong> đếm số lần file thật sự được tải (cũng là số hiện công khai trên trang dự án); <strong>bấm tải trên site</strong> chỉ đếm lượt bấm nút trên chilolab.com. <a href="/admin/manage/export/downloads.csv">Xuất CSV</a></p>
<div class="columns">
${github
  .map(
    ([project, stats]) =>
      `<section class="box"><h2>${escape(project)} · GitHub Releases</h2>${
        stats
          ? `<p class="big">${escape(stats.total)}</p><dl class="facts">${Object.entries(
              stats.files,
            )
              .map(
                ([file, n]) =>
                  `<dt>${file === 'setup' ? 'Bộ cài (Setup.exe)' : file === 'portable' ? 'Portable (.zip)' : escape(file)}</dt><dd>${escape(n)}</dd>`,
              )
              .join(
                '',
              )}<dt>Kiểm tra lúc</dt><dd>${when(stats.checkedAt)}${stats.stale ? ' <span class="tag warn">GitHub chưa trả lời, đang dùng số cũ</span>' : ''}</dd></dl><p class="hint">Không tính file cập nhật tự động (.nupkg, RELEASES). Cập nhật tối đa mỗi phút.</p>`
          : '<p class="empty">Chưa lấy được số từ GitHub.</p>'
      }</section>`,
  )
  .join('')}
<section class="box"><h2>Bấm tải trên site, 30 ngày</h2>${barChart(30, daily.results, 'Lượt bấm tải mỗi ngày')}</section>
</div>
<section class="box"><h2>Bấm tải trên site, theo phiên bản</h2>${table(
    ['Dự án', 'Phiên bản', 'Loại', 'Tổng'],
    rows.map(
      (row) =>
        `<tr><td>${escape(row.project)}</td><td>${escape(row.version)}</td><td>${row.kind === 'setup' ? 'Bộ cài' : 'Portable'}</td><td>${escape(row.total)}</td></tr>`,
    ),
    'Chưa có lượt bấm tải nào được ghi nhận.',
  )}</section>`;
}

async function usersPage(env: Env, url: URL) {
  const page = pageNumber(url);
  const q = query(url);
  const state =
    ['all', 'blocked'].find(
      (value) => value === url.searchParams.get('state'),
    ) ?? 'all';
  const parts: string[] = [];
  const args: string[] = [];
  if (q) {
    parts.push(
      '(instr(lower(u.email), lower(?)) > 0 OR instr(lower(u.display_name), lower(?)) > 0)',
    );
    args.push(q, q);
  }
  if (state === 'blocked') parts.push('u.blocked_at IS NOT NULL');
  const filter = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  const [rows, total, blocked] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.blocked_at, u.google_sub IS NOT NULL AS google,
              u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.status IN ('published', 'held')) AS comments
       FROM users u ${filter}
       ORDER BY u.role = 'owner' DESC, u.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users u ${filter}`).bind(...args),
    env.DB.prepare(
      'SELECT COUNT(*) AS n, (SELECT COUNT(*) FROM users) AS everyone FROM users WHERE blocked_at IS NOT NULL',
    ),
  ]);
  const body = rows.results.map(
    (row) =>
      `<tr><td><a href="/admin/manage/users/${escape(row.id)}">${escape(row.display_name)}</a><br><small>${escape(row.email)}</small></td><td>${row.role === 'owner' ? '<span class="tag ok">Chủ site</span>' : 'Thành viên'}${row.blocked_at ? ' <span class="tag">Đã khóa</span>' : ''}</td><td>${row.google ? 'Google' : 'Mã email'}</td><td>${when(row.created_at)}</td><td>${when(row.last_login_at)}</td><td>${escape(row.comments)}</td><td class="ops"><a class="button-link ghost" href="/admin/manage/users/${escape(row.id)}">Chi tiết</a></td></tr>`,
  );
  const b = blocked.results[0] ?? {};
  return `<h1>Người dùng</h1>
<p class="intro">Tài khoản tạo khi khách đăng nhập lần đầu (Google hoặc mã email). Mở một tài khoản để xem bình luận, góp ý, đăng xuất, khóa hoặc xóa. Quyền chủ site chỉ đặt được bằng SQL (xem <code>docs/DATABASE.md</code>).</p>
<div class="toolbar">${tabs(url, 'state', state, [
    ['all', 'Tất cả', Number(b.everyone ?? 0)],
    ['blocked', 'Đã khóa', Number(b.n ?? 0)],
  ])}${filters(url, ['state'], searchField(url, 'Tìm theo tên hoặc email…'))}</div>
${table(
  [
    'Tên / email',
    'Vai trò',
    'Đăng nhập bằng',
    'Tạo lúc',
    'Lần đăng nhập cuối',
    'Bình luận',
    '',
  ],
  body,
  q ? 'Không tìm thấy tài khoản nào.' : 'Chưa có tài khoản nào ở mục này.',
)}
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function userPage(env: Env, id: number, back: string, admin: Admin) {
  const user = await env.DB.prepare(
    `SELECT u.*, u.google_sub IS NOT NULL AS google,
       (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) AS sessions
     FROM users u WHERE u.id = ?`,
  )
    .bind(id)
    .first<Row>();
  if (!user) return null;
  const [comments, feedback, counts] = await env.DB.batch<Row>([
    env.DB.prepare(
      `${commentSelect} WHERE c.user_id = ? AND c.status IN ('published', 'held') ORDER BY c.created_at DESC LIMIT 50`,
    ).bind(id),
    env.DB.prepare(
      'SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    ).bind(id),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM comments WHERE user_id = ? GROUP BY status`,
    ).bind(id),
  ]);
  const owner = user.role === 'owner';
  const self = admin.userId === id;
  const ops = [
    !self && Number(user.sessions) > 0
      ? button(`user-signout:${id}`, 'Đăng xuất mọi thiết bị', 'ghost')
      : '',
    !owner && !user.blocked_at
      ? button(`user-block:${id}`, 'Khóa tài khoản…', 'danger')
      : '',
    !owner && user.blocked_at ? button(`user-unblock:${id}`, 'Mở khóa') : '',
    !owner ? button(`user-delete:${id}`, 'Xóa vĩnh viễn…', 'danger') : '',
  ].join('');
  return `<p><a href="/admin/manage/users">← Người dùng</a></p>
<h1>${escape(user.display_name)}</h1>
${user.blocked_at ? `<div class="notice danger"><p>Tài khoản bị khóa từ ${when(user.blocked_at)}: không đăng nhập hay bình luận được. Bình luận cũ vẫn giữ nguyên.</p></div>` : ''}
<div class="columns">
<section class="box"><h2>Thông tin</h2><dl class="facts">
<dt>Email</dt><dd>${escape(user.email)}</dd>
<dt>Vai trò</dt><dd>${owner ? '<span class="tag ok">Chủ site</span>' : 'Thành viên'}${self ? ' <small>(bạn)</small>' : ''}</dd>
<dt>Đăng nhập bằng</dt><dd>${user.google ? 'Google' : 'Mã email'}</dd>
<dt>Tạo lúc</dt><dd>${when(user.created_at)}</dd>
<dt>Đăng nhập cuối</dt><dd>${when(user.last_login_at)}</dd>
<dt>Phiên còn hạn</dt><dd>${escape(user.sessions)}</dd>
<dt>Bình luận</dt><dd>${count(counts.results, 'published')} đang hiện · ${count(counts.results, 'held')} bị giữ</dd>
</dl></section>
<section class="box"><h2>Thao tác</h2>${
    owner
      ? '<p class="muted">Tài khoản chủ site không khóa hay xóa được từ đây, để trang quản trị không tự khóa mình.</p>'
      : '<p class="hint">Khóa: không đăng nhập, không bình luận, mọi phiên bị đăng xuất; dữ liệu vẫn giữ và mở khóa được. Xóa: mất tài khoản và nội dung mọi bình luận của người này.</p>'
  }${formStart(back, 'user-ops')}${ops || '<p class="empty">Không có thao tác nào.</p>'}</form></section>
</div>
<section class="box"><h2>Bình luận gần đây</h2>${formStart(back)}${table(
    commentHeadings(false),
    comments.results.map((row) => commentRow(row, false)),
    'Người này chưa có bình luận nào.',
  )}</form></section>
<section class="box"><h2>Góp ý đã gửi khi đăng nhập</h2>${
    feedback.results.length
      ? `<ul class="list">${feedback.results.map((row) => `<li><strong>${escape(row.summary || kinds[String(row.kind)])}</strong> <small>· ${escape(row.project)} · ${feedbackStates[String(row.status)] ?? ''} · ${when(row.created_at)}</small></li>`).join('')}</ul>`
      : '<p class="empty">Không có góp ý nào gắn với tài khoản này.</p>'
  }</section>`;
}

type Tab = 'comments' | 'feedback' | 'accounts' | 'email';
const settingTabs: [Tab, string][] = [
  ['comments', 'Bình luận'],
  ['feedback', 'Góp ý'],
  ['accounts', 'Tài khoản'],
  ['email', 'Email thông báo'],
];

async function settingsPage(env: Env, url: URL) {
  const tab =
    settingTabs.find(([key]) => key === url.searchParams.get('tab'))?.[0] ??
    'comments';
  const s = await getSettings(env);
  const check = (name: keyof Settings, label: string, hint: string) =>
    `<div class="field check"><input type="checkbox" id="${name}" name="${name}" value="1"${s[name] ? ' checked' : ''}><label for="${name}">${label}</label><p class="hint">${hint}</p></div>`;
  const radio = (value: Settings['moderation'], label: string, hint: string) =>
    `<div class="field check"><input type="radio" id="moderation-${value}" name="moderation" value="${value}"${s.moderation === value ? ' checked' : ''}><label for="moderation-${value}">${label}</label><p class="hint">${hint}</p></div>`;
  const number = (
    name: keyof Settings,
    label: string,
    min: number,
    max: number,
    hint: string,
  ) =>
    `<div class="field"><label for="${name}">${label}</label><input type="number" id="${name}" name="${name}" min="${min}" max="${max}" value="${escape(s[name])}" aria-describedby="${name}-hint"><p class="hint" id="${name}-hint">${hint}</p></div>`;
  const mail = mailEnabled(env)
    ? ''
    : '<div class="notice warn"><p>Chưa có <code>RESEND_API_KEY</code>, nên chưa gửi được email nào. Xem <a href="/admin/manage/status">Tình trạng dịch vụ</a>.</p></div>';
  const forms: Record<Tab, string> = {
    comments: `<fieldset><legend>Bình luận</legend>
${check('commentsOpen', 'Cho phép bình luận mới', 'Tắt thì khách không viết hay sửa bình luận được; bình luận cũ vẫn hiện. Bạn (chủ site) vẫn viết được.')}
<p class="label">Kiểm duyệt</p>
${radio('ai', 'Danh sách từ + AI (mặc định)', 'Lọc từ cấm, rồi Workers AI đọc ngữ cảnh. Tốn quota AI miễn phí mỗi ngày.')}
${radio('words', 'Chỉ danh sách từ', 'Không gọi AI. Nhanh hơn, nhưng bỏ sót xúc phạm không dùng từ cấm.')}
${radio('manual', 'Giữ tất cả chờ duyệt', 'Mọi bình luận của khách chỉ hiện sau khi bạn duyệt ở mục Bình luận.')}
<div class="field"><label for="blockedWords">Từ bị chặn thêm</label><textarea id="blockedWords" name="blockedWords" rows="5" maxlength="8000" aria-describedby="blockedWords-hint">${escape(s.blockedWords.join('\n'))}</textarea><p class="hint" id="blockedWords-hint">Mỗi dòng một từ hoặc cụm từ (2–40 ký tự, tối đa 200). Khớp nguyên từ, có hoặc không dấu. Cộng thêm vào danh sách có sẵn trong <code>worker/moderation.ts</code>.</p></div>
${number('commentMaxLength', 'Độ dài tối đa của một bình luận (ký tự)', 100, COMMENT_MAX, `Từ 100 đến ${COMMENT_MAX}. Không áp dụng cho bạn.`)}
${number('commentsPerHour', 'Số bình luận tối đa mỗi người trong một giờ', 0, 500, '0 là không giới hạn theo giờ (vẫn còn giới hạn chống spam 10 lần ghi mỗi phút). Không áp dụng cho bạn.')}
</fieldset>`,
    feedback: `<fieldset><legend>Góp ý và báo lỗi</legend>
${check('feedbackOpen', 'Nhận góp ý qua form', 'Tắt thì form <code>/&lt;dự-án&gt;/feedback</code> báo đang tạm đóng.')}
${check('crashReports', 'Nhận báo lỗi tự động từ app', 'Chỉ bật khi bản app có hỏi ý người dùng đã phát hành, và /privacy cùng EULA đã mô tả việc này (docs/CRASH-REPORTS.md). Tắt thì server từ chối mọi báo lỗi.')}
</fieldset>`,
    accounts: `<fieldset><legend>Đăng nhập và tài khoản</legend>
${check('emailLogin', 'Cho đăng nhập bằng mã email', 'Cần secret RESEND_API_KEY. Tắt thì chỉ còn Google. Nếu bạn đăng nhập bằng mã email, hãy chắc chắn còn đăng nhập được bằng Google trước khi tắt.')}
${check('signups', 'Cho tạo tài khoản mới', 'Tắt thì chỉ tài khoản đã có đăng nhập được, giống "Anyone can register" của WordPress.')}
</fieldset>`,
    email: `${mail}<fieldset><legend>Email gửi cho bạn</legend>
<p class="hint">Gửi qua Resend tới email của tài khoản chủ site. Gói miễn phí: 100 email/ngày.</p>
${check('notifyHeld', 'Khi có bình luận bị giữ', 'Kèm nội dung, lý do và đường dẫn tới trang.')}
${check('notifyFeedback', 'Khi có góp ý hoặc báo lỗi mới', 'Kèm tiêu đề, nội dung và đường dẫn tới mục Góp ý.')}
</fieldset>`,
  };
  return `<h1>Cài đặt</h1>
<p class="intro">Mỗi tab lưu riêng. Mọi thay đổi được ghi vào <a href="/admin/manage/log">Nhật ký</a>.</p>
<div class="settings-tabs">${tabs(
    url,
    'tab',
    tab,
    settingTabs.map(([key, label]) => [key, label, null]),
  )}</div>
<form method="post" action="/admin/manage" class="settings">
<input type="hidden" name="back" value="/admin/manage/settings?tab=${tab}">
${forms[tab]}
<p>${button(`settings:${tab}`, 'Lưu thay đổi')}</p>
</form>`;
}

async function logPage(env: Env, url: URL) {
  const page = pageNumber(url);
  const q = query(url);
  const filter = q
    ? 'WHERE instr(lower(action || target || detail), lower(?)) > 0'
    : '';
  const args = q ? [q] : [];
  const [rows, total] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT * FROM admin_log ${filter} ORDER BY id DESC LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_log ${filter}`).bind(
      ...args,
    ),
  ]);
  return `<h1>Nhật ký quản trị</h1>
<p class="intro">Mọi thao tác trong trang này: ai làm, làm gì, lúc nào. Không lưu IP. Tự xóa sau một năm.</p>
<div class="toolbar"><span></span>${filters(url, [], searchField(url, 'Tìm trong nhật ký…'))}</div>
${table(
  ['Thời gian', 'Người làm', 'Thao tác', 'Đối tượng', 'Chi tiết'],
  rows.results.map(
    (row) =>
      `<tr><td>${when(row.at)}</td><td>${escape(row.actor)}</td><td>${escape(actionLabels[String(row.action)] ?? row.action)}</td><td>${escape(row.target)}</td><td class="body">${escape(row.detail)}</td></tr>`,
  ),
  'Chưa có hoạt động nào.',
)}
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function statusPage(env: Env, ctx: ExecutionContext) {
  const service = (ok: boolean, label: string, hint: string) =>
    `<tr><td>${label}</td><td>${ok ? '<span class="tag ok">Đã cấu hình</span>' : '<span class="tag">Chưa có</span>'}</td><td><small>${hint}</small></td></tr>`;
  const schema = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'settings') AS settings,
            (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'admin_log') AS adminLog,
            (SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'blocked_at') AS blocked,
            (SELECT COUNT(*) FROM pragma_table_info('feedback') WHERE name = 'note') AS note,
            (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('subscriptions', 'release_notices', 'notice_deliveries', 'crash_reports')) AS phase2`,
  ).first<Row>();
  const migrated = (value: unknown) => Number(value) > 0;
  const github = await getStats('pet-desktop', ctx);
  return `<h1>Tình trạng dịch vụ</h1>
<p class="intro">Chỉ đọc. Secret đặt bằng <code>npx wrangler secret put …</code> hoặc trong Cloudflare Dashboard, không lưu ở đây.</p>
<section class="box"><h2>Dịch vụ bên ngoài</h2>${table(
    ['Dịch vụ', 'Trạng thái', 'Ghi chú'],
    [
      service(
        Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        'Đăng nhập Google',
        'GOOGLE_CLIENT_ID (vars) + GOOGLE_CLIENT_SECRET (secret)',
      ),
      service(
        mailEnabled(env),
        'Gửi email (Resend)',
        'RESEND_API_KEY (secret), người gửi MAIL_FROM',
      ),
      service(
        Boolean(env.TURNSTILE_SECRET),
        'Chống spam (Turnstile)',
        'TURNSTILE_SECRET (secret)',
      ),
      `<tr><td>Lượt tải GitHub</td><td>${github ? (github.stale ? '<span class="tag warn">Đang dùng số cũ</span>' : '<span class="tag ok">Hoạt động</span>') : '<span class="tag">Không lấy được</span>'}</td><td><small>API công khai của GitHub, không cần token; giới hạn 60 lượt/giờ nên có cache 1 phút.</small></td></tr>`,
    ],
    '',
  )}</section>
<section class="box"><h2>Cơ sở dữ liệu (D1)</h2>${table(
    ['Migration', 'Trạng thái'],
    [
      `<tr><td>0005 · Cài đặt site</td><td>${migrated(schema?.settings) ? '<span class="tag ok">Đã chạy</span>' : '<span class="tag">Chưa chạy</span>'}</td></tr>`,
      `<tr><td>0006 · Khóa tài khoản, ghi chú góp ý, nhật ký</td><td>${migrated(schema?.adminLog) && migrated(schema?.blocked) && migrated(schema?.note) ? '<span class="tag ok">Đã chạy</span>' : '<span class="tag">Chưa chạy</span>'}</td></tr>`,
      `<tr><td>0007 · Email bản mới, báo lỗi app</td><td>${Number(schema?.phase2) === 4 ? '<span class="tag ok">Đã chạy</span>' : '<span class="tag">Chưa chạy</span>'}</td></tr>`,
    ],
    '',
  )}<p class="hint">Chưa chạy thì: <code>npm run db:migrate:remote</code>.</p></section>`;
}

// ---------- CSV export ----------

async function exportCsv(env: Env, name: string, admin: Admin) {
  const queries: Record<string, [string, string[]]> = {
    comments: [
      `SELECT c.id, c.created_at, c.edited_at, c.project, c.version, c.parent_id, c.status, c.moderation_reason, c.locale, u.display_name AS author, c.body
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.status IN ('published', 'held') ORDER BY c.id`,
      [
        'id',
        'created_at',
        'edited_at',
        'project',
        'version',
        'parent_id',
        'status',
        'moderation_reason',
        'locale',
        'author',
        'body',
      ],
    ],
    feedback: [
      `SELECT id, created_at, project, kind, status, summary, message, note, app_version, os, contact, locale FROM feedback ORDER BY id`,
      [
        'id',
        'created_at',
        'project',
        'kind',
        'status',
        'summary',
        'message',
        'note',
        'app_version',
        'os',
        'contact',
        'locale',
      ],
    ],
    downloads: [
      `SELECT day, project, version, kind, count FROM downloads ORDER BY day, project, version, kind`,
      ['day', 'project', 'version', 'kind', 'count'],
    ],
  };
  const entry = queries[name];
  if (!entry) return null;
  const { results } = await env.DB.prepare(entry[0]).all<Row>();
  await log(env, admin, 'export', `${name}.csv`, `${results.length} dòng`);
  return csv(name, entry[1], results);
}

// ---------- writes ----------

type Op = {
  label: string;
  /** Asks "are you sure?" first. */
  destructive?: boolean;
  /** May be applied to several ticked rows at once. */
  bulk?: boolean;
  /** Returns a short description for the log, or null when nothing changed. */
  run: (env: Env, id: number, admin: Admin) => Promise<string | null>;
};

const setFeedback =
  (status: 'new' | 'progress' | 'done') => async (env: Env, id: number) => {
    const done = await env.DB.prepare(
      'UPDATE feedback SET status = ? WHERE id = ? AND status <> ?',
    )
      .bind(status, id, status)
      .run();
    return done.meta.changes ? `góp ý #${id}` : null;
  };

const setCrash = (status: 'new' | 'done') => async (env: Env, id: number) => {
  const done = await env.DB.prepare(
    'UPDATE crash_reports SET status = ? WHERE id = ? AND status <> ?',
  )
    .bind(status, id, status)
    .run();
  return done.meta.changes ? `báo lỗi #${id}` : null;
};

const ops: Record<string, Op> = {
  'notice-stop': {
    label: 'Dừng gửi email bản mới',
    run: async (env, id) => {
      const row = await env.DB.prepare(
        `UPDATE release_notices SET finished_at = ? WHERE id = ? AND finished_at IS NULL
         RETURNING project, version`,
      )
        .bind(stamp(), id)
        .first<{ project: string; version: string }>();
      return row ? `${row.project} v${row.version}` : null;
    },
  },
  'crash-done': { label: 'Đánh dấu đã xem', bulk: true, run: setCrash('done') },
  'crash-new': { label: 'Đánh dấu chưa xem', bulk: true, run: setCrash('new') },
  'crash-delete': {
    label: 'Xóa vĩnh viễn báo lỗi',
    destructive: true,
    bulk: true,
    run: async (env, id) => {
      const done = await env.DB.prepare(
        'DELETE FROM crash_reports WHERE id = ?',
      )
        .bind(id)
        .run();
      return done.meta.changes ? `báo lỗi #${id}` : null;
    },
  },
  approve: {
    label: 'Cho hiện bình luận',
    bulk: true,
    run: async (env, id) => {
      const done = await env.DB.prepare(
        `UPDATE comments SET status = 'published', moderation_reason = NULL
         WHERE id = ? AND status = 'held'`,
      )
        .bind(id)
        .run();
      return done.meta.changes ? `bình luận #${id}` : null;
    },
  },
  remove: {
    label: 'Gỡ bình luận',
    destructive: true,
    bulk: true,
    run: async (env, id) => {
      const row = await env.DB.prepare(
        `SELECT status, substr(body, 1, 120) AS body FROM comments WHERE id = ?`,
      )
        .bind(id)
        .first<{ status: string; body: string }>();
      if (!row || !['published', 'held'].includes(row.status)) return null;
      await removeComment(env, id, 'removed');
      return `bình luận #${id}: ${row.body}`;
    },
  },
  'fb-new': { label: 'Mở lại góp ý', bulk: true, run: setFeedback('new') },
  'fb-progress': {
    label: 'Chuyển góp ý sang đang xử lý',
    bulk: true,
    run: setFeedback('progress'),
  },
  'fb-done': {
    label: 'Đánh dấu góp ý đã xử lý',
    bulk: true,
    run: setFeedback('done'),
  },
  'fb-delete': {
    label: 'Xóa vĩnh viễn góp ý',
    destructive: true,
    bulk: true,
    run: async (env, id) => {
      const done = await env.DB.prepare('DELETE FROM feedback WHERE id = ?')
        .bind(id)
        .run();
      return done.meta.changes ? `góp ý #${id}` : null;
    },
  },
  'user-signout': {
    label: 'Đăng xuất khỏi mọi thiết bị',
    run: async (env, id, admin) => {
      if (id === admin.userId) return null;
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
        .bind(id)
        .run();
      return `tài khoản #${id}`;
    },
  },
  'user-block': {
    label: 'Khóa tài khoản',
    destructive: true,
    run: async (env, id) => {
      const [done] = await env.DB.batch([
        env.DB.prepare(
          `UPDATE users SET blocked_at = ? WHERE id = ? AND role <> 'owner' AND blocked_at IS NULL`,
        ).bind(stamp(), id),
        env.DB.prepare(
          `DELETE FROM sessions WHERE user_id = ? AND user_id IN (SELECT id FROM users WHERE role <> 'owner')`,
        ).bind(id),
      ]);
      return done!.meta.changes ? `tài khoản #${id}` : null;
    },
  },
  'user-unblock': {
    label: 'Mở khóa tài khoản',
    run: async (env, id) => {
      const done = await env.DB.prepare(
        'UPDATE users SET blocked_at = NULL WHERE id = ? AND blocked_at IS NOT NULL',
      )
        .bind(id)
        .run();
      return done.meta.changes ? `tài khoản #${id}` : null;
    },
  },
  'user-delete': {
    label: 'Xóa vĩnh viễn tài khoản',
    destructive: true,
    run: async (env, id) => {
      // Owner accounts cannot be deleted here, so the panel never locks itself out.
      const target = await env.DB.prepare(
        'SELECT role, email FROM users WHERE id = ?',
      )
        .bind(id)
        .first<{ role: string; email: string }>();
      if (!target || target.role === 'owner') return null;
      await deleteUserComments(env, id);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM notice_deliveries WHERE user_id = ?').bind(
          id,
        ),
        env.DB.prepare(
          'UPDATE feedback SET user_id = NULL WHERE user_id = ?',
        ).bind(id),
        env.DB.prepare(
          `DELETE FROM users WHERE id = ? AND role <> 'owner'`,
        ).bind(id),
      ]);
      return `tài khoản #${id}`;
    },
  },
};

/** Lines describing what a destructive operation is about to touch. */
async function describe(env: Env, op: string, ids: number[]) {
  const marks = ids.map(() => '?').join(', ');
  if (op === 'remove') {
    const { results } = await env.DB.prepare(
      `${commentSelect} WHERE c.id IN (${marks})`,
    )
      .bind(...ids)
      .all<Row>();
    return results.map(
      (row) =>
        `<li><strong>${escape(row.display_name ?? row.author ?? '—')}</strong> ở ${escape(row.project)}${row.version ? ` v${escape(row.version)}` : ''}: ${escape(String(row.body).slice(0, 160))}</li>`,
    );
  }
  if (op === 'crash-delete') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM crash_reports WHERE id IN (${marks})`,
    )
      .bind(...ids)
      .all<Row>();
    return results.map(
      (row) =>
        `<li><strong>${escape(row.kind)}</strong> · ${escape(row.project)} v${escape(row.app_version)} · ${when(row.created_at)}</li>`,
    );
  }
  if (op === 'fb-delete') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM feedback WHERE id IN (${marks})`,
    )
      .bind(...ids)
      .all<Row>();
    return results.map(
      (row) =>
        `<li><strong>${escape(row.summary || kinds[String(row.kind)])}</strong> · ${escape(row.project)} · ${when(row.created_at)}</li>`,
    );
  }
  const { results } = await env.DB.prepare(
    `SELECT id, display_name, email FROM users WHERE id IN (${marks})`,
  )
    .bind(...ids)
    .all<Row>();
  return results.map(
    (row) =>
      `<li><strong>${escape(row.display_name)}</strong> (${escape(row.email)})</li>`,
  );
}

const consequences: Record<string, string> = {
  remove:
    'Nội dung bị xóa khỏi cơ sở dữ liệu. Bình luận có người trả lời sẽ còn dòng "đã bị quản trị viên gỡ".',
  'fb-delete': 'Góp ý bị xóa vĩnh viễn, không khôi phục được.',
  'crash-delete': 'Báo lỗi bị xóa vĩnh viễn, không khôi phục được.',
  'user-block':
    'Người này bị đăng xuất khỏi mọi thiết bị, không đăng nhập hay bình luận được nữa. Dữ liệu vẫn giữ; mở khóa được bất cứ lúc nào.',
  'user-delete':
    'Tài khoản và nội dung mọi bình luận của người này bị xóa vĩnh viễn. Bình luận có người trả lời sẽ còn dòng "đã bị xóa".',
};

/** Only return to an admin page after a POST. */
function backTo(value: unknown, notice: string) {
  const raw = typeof value === 'string' ? value : '';
  const target = new URL(
    /^\/admin\/manage(\/[a-z]+(\/\d{1,12})?)?(\?[^#\\]*)?$/.test(raw)
      ? raw
      : '/admin/manage',
    'https://admin.invalid',
  );
  target.searchParams.delete('confirm');
  target.searchParams.set('notice', notice);
  return target.pathname + target.search;
}

const settingKeys: Record<Tab, (keyof Settings)[]> = {
  comments: [
    'commentsOpen',
    'moderation',
    'blockedWords',
    'commentMaxLength',
    'commentsPerHour',
  ],
  feedback: ['feedbackOpen', 'crashReports'],
  accounts: ['emailLogin', 'signups'],
  email: ['notifyHeld', 'notifyFeedback'],
};

function readSetting(
  form: FormData,
  key: keyof Settings,
): Settings[keyof Settings] {
  const value = form.get(key);
  switch (key) {
    case 'moderation':
      return (
        (['ai', 'words', 'manual'] as const).find((mode) => mode === value) ??
        'ai'
      );
    case 'blockedWords':
      return parseWords(String(value ?? '').slice(0, 8000));
    case 'commentMaxLength':
      return clampInt(value, 100, COMMENT_MAX, COMMENT_MAX);
    case 'commentsPerHour':
      return clampInt(value, 0, 500, 0);
    default:
      return value === '1';
  }
}

async function post(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  admin: Admin,
): Promise<Response | { confirm: string; back: string }> {
  if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData();
  const back = form.get('back');
  const action = String(form.get('do') ?? '');
  const bad = () => new Response('Bad request', { status: 400 });

  if (action.startsWith('settings:')) {
    const tab = action.slice(9) as Tab;
    const keys = settingKeys[tab];
    if (!keys) return bad();
    const changes = Object.fromEntries(
      keys.map((key) => [key, readSetting(form, key)]),
    ) as Partial<Settings>;
    const changed = await saveSettings(env, changes);
    if (changed.length)
      await log(env, admin, 'settings', tab, changed.join(', '));
    return redirect(backTo(back, changed.length ? 'saved' : 'unchanged'), 303);
  }

  if (action.startsWith('notice-send:')) {
    const [project = '', version = ''] = action.slice(12).split('@');
    const names = (await catalog(env))[project];
    if (!names?.releases.some((release) => release.version === version))
      return bad();
    const created = await env.DB.prepare(
      'INSERT OR IGNORE INTO release_notices (project, version) VALUES (?, ?)',
    )
      .bind(project, version)
      .run();
    if (!created.meta.changes)
      return redirect(backTo(back, 'notice-exists'), 303);
    await log(env, admin, 'notice-send', `${project} v${version}`);
    ctx.waitUntil(
      deliverNotices(env)
        .then((result) => console.log('release notices', result))
        .catch((error) => console.error('release notices', error)),
    );
    return redirect(backTo(back, 'notice-send'), 303);
  }

  const [name, rawId] = action.split(':');
  const single = Number(rawId);

  if (name === 'reply' || name === 'note') {
    if (!Number.isSafeInteger(single) || single < 1) return bad();
    if (name === 'note') {
      const note = text(form.get(`note-${single}`) ?? '', 0, 2000) ?? '';
      await env.DB.prepare('UPDATE feedback SET note = ? WHERE id = ?')
        .bind(note || null, single)
        .run();
      await log(env, admin, 'note', `góp ý #${single}`, note.slice(0, 200));
      return redirect(backTo(back, 'note'), 303);
    }
    const body = text(form.get('reply'), 1, COMMENT_MAX);
    if (!body || admin.userId === null)
      return redirect(backTo(back, 'reply-empty'), 303);
    const top = await env.DB.prepare(
      'SELECT id, project, version, locale, status, parent_id FROM comments WHERE id = ?',
    )
      .bind(single)
      .first<Row>();
    if (!top || top.parent_id !== null || top.status !== 'published')
      return bad();
    await env.DB.prepare(
      `INSERT INTO comments (project, version, parent_id, user_id, body, locale, status)
       VALUES (?, ?, ?, ?, ?, ?, 'published')`,
    )
      .bind(top.project, top.version, top.id, admin.userId, body, top.locale)
      .run();
    await log(env, admin, 'reply', `bình luận #${single}`, body.slice(0, 200));
    return redirect(backTo(back, 'reply'), 303);
  }

  const bulk = action === 'bulk';
  const opName = bulk ? String(form.get('bulk') ?? '') : (name ?? '');
  const op = ops[opName];
  const ids = bulk
    ? [
        ...new Set(
          form
            .getAll('ids')
            .map(Number)
            .filter((id) => Number.isSafeInteger(id) && id > 0),
        ),
      ].slice(0, 100)
    : Number.isSafeInteger(single) && single > 0
      ? [single]
      : [];
  if (bulk && (!op || !ids.length))
    return redirect(backTo(back, 'nothing-selected'), 303);
  if (!op || !ids.length || (bulk && !op.bulk)) return bad();

  if (op.destructive && form.get('confirmed') !== '1') {
    const items = await describe(env, opName, ids);
    if (!items.length) return redirect(backTo(back, 'nothing-selected'), 303);
    const safeBack = backTo(back, '').replace(/[?&]notice=$/, '');
    const confirm = `<section class="confirm"><h1>Xác nhận: ${op.label.toLowerCase()}</h1>
<div class="notice danger"><p>${consequences[opName] ?? ''}</p></div>
<p>${items.length} mục sẽ bị ảnh hưởng:</p><ul class="list">${items.join('')}</ul>
${formStart(safeBack)}<input type="hidden" name="confirmed" value="1">${
      bulk
        ? `<input type="hidden" name="bulk" value="${escape(opName)}">${ids.map((id) => `<input type="hidden" name="ids" value="${id}">`).join('')}${button('bulk', `Có, ${op.label.toLowerCase()}`, 'danger')}`
        : button(
            `${opName}:${ids[0]}`,
            `Có, ${op.label.toLowerCase()}`,
            'danger',
          )
    } <a class="button-link ghost" href="${escape(safeBack)}">Hủy</a></form></section>`;
    return { confirm, back: safeBack };
  }

  const done: string[] = [];
  for (const id of ids) {
    const result = await op.run(env, id, admin);
    if (result) done.push(result);
  }
  if (done.length)
    await log(
      env,
      admin,
      opName,
      done.length === 1 ? done[0]! : `${done.length} mục`,
      done.length === 1 ? '' : done.join('; '),
    );
  return redirect(
    backTo(
      await landing(env, back, opName, ids),
      done.length ? opName : 'unchanged',
    ),
    303,
  );
}

/** Which detail page an operation can make disappear. */
const removes: Record<string, 'comments' | 'users'> = {
  remove: 'comments',
  'user-delete': 'users',
};

/**
 * After an operation, return to the page it came from, unless that page was
 * the detail of a record that is now gone: then go to its list, not a 404.
 */
async function landing(env: Env, back: unknown, opName: string, ids: number[]) {
  const raw = typeof back === 'string' ? back : '';
  const detail = /^\/admin\/manage\/(comments|users)\/(\d{1,12})(?:\?|$)/.exec(
    raw,
  );
  if (!detail) return back;
  const kind = detail[1] as 'comments' | 'users';
  const id = Number(detail[2]);
  const list = `/admin/manage/${kind}`;
  if (removes[opName] === kind && ids.includes(id)) return list;
  // Removing a reply can also prune the thread being viewed.
  const still = await env.DB.prepare(`SELECT 1 FROM ${kind} WHERE id = ?`)
    .bind(id)
    .first();
  return still ? back : list;
}

// ---------- routing ----------

export async function manage(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  admin: Admin,
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/admin/manage';
  // Lets the public site show the owner bar; /api/me still decides.
  const hint: Record<string, string> =
    admin.userId !== null
      ? {
          'Set-Cookie': `${ADMIN_HINT}=1; Path=/; Max-Age=${30 * 86400}; Secure; SameSite=Lax`,
        }
      : {};
  const render = async (
    title: string,
    content: string,
    notice = '',
    menuPath = path,
  ) =>
    new Response(
      layout(title, menuPath, admin, await badges(env), notice, content),
      { headers: { ...htmlHeaders, ...hint } },
    );

  if (path === '/admin/manage/logout') {
    if (request.method !== 'POST' || !sameOrigin(request))
      return new Response('Method not allowed', { status: 405 });
    const headers = new Headers({ Location: '/', 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', await endSession(request, env));
    headers.append(
      'Set-Cookie',
      cookie(ADMIN_HINT, '', 0).replace('; HttpOnly', ''),
    );
    return new Response(null, { status: 303, headers });
  }

  if (request.method === 'POST' && path === '/admin/manage') {
    const result = await post(request, env, ctx, admin);
    if (result instanceof Response) return result;
    return render(
      'Xác nhận',
      result.confirm,
      '',
      new URL(result.back, 'https://admin.invalid').pathname,
    );
  }
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', { status: 405 });

  const exportMatch = /^\/admin\/manage\/export\/([a-z]+)\.csv$/.exec(path);
  if (exportMatch) {
    const response = await exportCsv(env, exportMatch[1]!, admin);
    if (response) return response;
  }

  const back =
    path +
    url.search.replace(/([?&])notice=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const detail = /^\/admin\/manage\/(comments|users)\/(\d{1,12})$/.exec(path);
  const pages: Record<string, [string, () => Promise<string | null>]> = {
    '/admin/manage': ['Tổng quan', () => dashboard(env, ctx, back)],
    '/admin/manage/comments': ['Bình luận', () => commentsPage(env, url, back)],
    '/admin/manage/feedback': ['Góp ý', () => feedbackPage(env, url, back)],
    '/admin/manage/downloads': ['Lượt tải', () => downloadsPage(env, ctx)],
    '/admin/manage/users': ['Người dùng', () => usersPage(env, url)],
    '/admin/manage/releases': ['Email bản mới', () => releasesPage(env, back)],
    '/admin/manage/crashes': ['Báo lỗi app', () => crashesPage(env, url, back)],
    '/admin/manage/settings': ['Cài đặt', () => settingsPage(env, url)],
    '/admin/manage/log': ['Nhật ký', () => logPage(env, url)],
    '/admin/manage/status': ['Tình trạng dịch vụ', () => statusPage(env, ctx)],
  };
  const entry: [string, () => Promise<string | null>] | undefined = detail
    ? detail[1] === 'comments'
      ? [
          'Luồng bình luận',
          () => threadPage(env, Number(detail[2]), back, admin),
        ]
      : ['Người dùng', () => userPage(env, Number(detail[2]), back, admin)]
    : pages[path];
  const notFound = () =>
    new Response('Not found', { status: 404, headers: htmlHeaders });
  if (!entry) return notFound();

  let content: string | null;
  try {
    content = await entry[1]();
  } catch (error) {
    // Most often: the code is newer than the database (migration not run).
    console.error('manage page', path, error);
    content = `<h1>${escape(entry[0])}</h1><div class="notice danger"><p>Không tải được trang này. Nếu vừa cập nhật code, có thể database chưa chạy migration mới: <code>npm run db:migrate:remote</code>. Xem <a href="/admin/manage/status">Tình trạng dịch vụ</a>.</p></div>`;
  }
  if (content === null) {
    if (!detail) return notFound();
    // A stale link to a removed comment or a deleted account.
    const page = await render(
      entry[0],
      `<h1>Không tìm thấy</h1><p class="intro">Mục này không còn: đã bị gỡ hoặc xóa.</p><p><a class="button-link" href="/admin/manage/${detail[1]}">← Về danh sách</a></p>`,
    );
    return new Response(page.body, { status: 404, headers: page.headers });
  }

  const code = url.searchParams.get('notice') ?? '';
  const notice = notices[code]
    ? `<div class="notice${warnings.has(code) ? ' warn' : ''}" role="status"><p>${notices[code]}</p></div>`
    : '';
  return render(entry[0], content, notice);
}
