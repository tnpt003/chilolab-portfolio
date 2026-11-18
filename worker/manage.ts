import { deleteUserComments, removeComment } from './comments';
import { baseHeaders, redirect, sameOrigin, type Env } from './env';
import { mailEnabled } from './mail';
import { endSession } from './session';
import {
  getSettings,
  parseWords,
  saveSettings,
  type Moderation,
} from './settings';

// Owner admin panel (WordPress-style dashboard) at /manage/*.
// Reached only after index.ts confirms an owner session or Cloudflare Access.
// Server-rendered, no JavaScript; every stored value is HTML-escaped and every
// write is a same-origin POST form.

export type Admin = {
  /** Shown in the top bar. */
  name: string;
  /** users.id when signed in with an owner account; null for Access/dev. */
  userId: number | null;
};

type Row = Record<string, string | number | null>;

const PER_PAGE = 50;

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

const kinds: Record<string, string> = {
  idea: 'Góp ý',
  bug: 'Báo lỗi',
  other: 'Khác',
};
const reasons: Record<string, string> = {
  profanity: 'Chửi thề',
  insult: 'Xúc phạm',
  hate: 'Thù ghét',
  sexual: 'Tình dục',
  threat: 'Đe dọa',
  spam: 'Spam/quảng cáo',
  link: 'Có đường link',
  blocked: 'Từ bị chặn (cài đặt)',
  manual: 'Duyệt thủ công',
  unchecked: 'AI chưa kiểm tra được',
};
const notices: Record<string, string> = {
  saved: 'Đã lưu cài đặt.',
  approved: 'Đã cho hiện bình luận.',
  removed: 'Đã gỡ bình luận.',
  'feedback-done': 'Đã đánh dấu góp ý là đã xử lý.',
  'feedback-reopen': 'Đã mở lại góp ý.',
  'feedback-delete': 'Đã xóa góp ý.',
  'user-signout': 'Đã đăng xuất tài khoản khỏi mọi thiết bị.',
  'user-delete': 'Đã xóa tài khoản và bình luận của người đó.',
};

// ---------- small HTML helpers ----------

function action(
  back: string,
  op: string,
  id: unknown,
  label: string,
  style: '' | 'danger' | 'secondary' = '',
) {
  return `<form method="post" action="/manage"><input type="hidden" name="op" value="${op}"><input type="hidden" name="id" value="${escape(id)}"><input type="hidden" name="back" value="${escape(back)}"><button${style ? ` class="${style}"` : ''}>${label}</button></form>`;
}

function table(headings: string[], rows: string[], empty: string) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  return `<div class="table"><table><thead><tr>${headings.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function tabs(
  base: string,
  current: string,
  items: [string, string, number | null][],
) {
  return `<ul class="tabs">${items
    .map(
      ([value, label, count]) =>
        `<li><a href="${base}?status=${value}"${value === current ? ' aria-current="page"' : ''}>${label}${count === null ? '' : ` <span class="count">(${count})</span>`}</a></li>`,
    )
    .join('')}</ul>`;
}

function pager(url: URL, page: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (pages <= 1) return '';
  const link = (target: number, label: string) => {
    const next = new URL(url);
    next.searchParams.set('page', String(target));
    next.searchParams.delete('notice');
    return `<a href="${escape(next.pathname + next.search)}">${label}</a>`;
  };
  return `<nav class="pager" aria-label="Phân trang">${page > 1 ? link(page - 1, '‹ Trước') : ''}<span>Trang ${page}/${pages}</span>${page < pages ? link(page + 1, 'Sau ›') : ''}</nav>`;
}

function search(url: URL, placeholder: string) {
  const status = url.searchParams.get('status');
  return `<form class="search" method="get" action="${escape(url.pathname)}" role="search">${status ? `<input type="hidden" name="status" value="${escape(status)}">` : ''}<label class="sr-only" for="q">Tìm kiếm</label><input id="q" name="q" type="search" maxlength="100" value="${escape(url.searchParams.get('q') ?? '')}" placeholder="${placeholder}"><button class="secondary">Tìm</button></form>`;
}

const pageNumber = (url: URL) =>
  Math.max(1, Math.min(10_000, Number(url.searchParams.get('page')) || 1));

const query = (url: URL) =>
  (url.searchParams.get('q') ?? '').trim().slice(0, 100);

function where(row: Row) {
  const target = row.version
    ? `/${row.project}/versions/${row.version}`
    : `/${row.project}`;
  return `<a href="${escape(target)}#comments">${escape(row.project)}${row.version ? ` v${escape(row.version)}` : ''}</a>${row.parent_id ? '<br><small>trả lời</small>' : ''}`;
}

function who(row: Row) {
  return row.display_name
    ? `${escape(row.display_name)}${row.author_role === 'owner' ? ' <span class="tag ok">Tác giả</span>' : ''}<br><small>${escape(row.email)}</small>`
    : escape(row.author ?? '—');
}

function commentRow(row: Row, back: string) {
  const reason = row.moderation_reason
    ? `<span class="tag">${escape(reasons[String(row.moderation_reason)] ?? row.moderation_reason)}</span> `
    : '';
  const state =
    row.status === 'held' ? '<span class="tag">Bị giữ</span><br>' : '';
  const actions =
    (row.status === 'held' ? action(back, 'approve', row.id, 'Cho hiện') : '') +
    action(back, 'remove-comment', row.id, 'Gỡ', 'danger');
  return `<tr${row.status === 'held' ? ' class="held"' : ''}><td>${state}${escape(row.created_at)}${row.edited_at ? '<br><small>đã sửa</small>' : ''}</td><td>${where(row)}</td><td>${who(row)}</td><td class="body">${reason}${escape(row.body)}</td><td class="ops">${actions}</td></tr>`;
}

function feedbackRow(row: Row, back: string) {
  const ops =
    (row.status === 'new'
      ? action(back, 'feedback-done', row.id, 'Đã xử lý')
      : action(back, 'feedback-reopen', row.id, 'Mở lại', 'secondary')) +
    action(back, 'feedback-delete', row.id, 'Xóa', 'danger');
  return `<tr class="${row.status === 'done' ? 'done' : ''}"><td>${escape(row.created_at)}</td><td>${escape(row.project)} · ${escape(row.locale)}</td><td>${escape(kinds[String(row.kind)] ?? row.kind)}</td><td class="body">${row.summary ? `<strong>${escape(row.summary)}</strong>\n` : ''}${escape(row.message)}</td><td>${escape(row.app_version)}${row.os ? ` · ${escape(row.os)}` : ''}</td><td>${escape(row.contact)}</td><td class="ops">${ops}</td></tr>`;
}

const commentSelect = `SELECT c.*, u.display_name, u.email, u.role AS author_role
  FROM comments c LEFT JOIN users u ON u.id = c.user_id`;

// ---------- pages ----------

type Counts = { held: number; newFeedback: number };

async function counts(env: Env): Promise<Counts> {
  const row = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM comments WHERE status = 'held') AS held,
            (SELECT COUNT(*) FROM feedback WHERE status = 'new') AS newFeedback`,
  ).first<Counts>();
  return {
    held: Number(row?.held ?? 0),
    newFeedback: Number(row?.newFeedback ?? 0),
  };
}

async function dashboard(env: Env, back: string) {
  const [stats, held, feedback, daily] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM users WHERE created_at >= date('now', '-6 days')) AS newUsers,
              (SELECT COUNT(*) FROM comments WHERE status = 'published') AS published,
              (SELECT COUNT(*) FROM comments WHERE status = 'held') AS held,
              (SELECT COUNT(*) FROM feedback WHERE status = 'new') AS feedback,
              (SELECT COALESCE(SUM(count), 0) FROM downloads WHERE day >= date('now', '-29 days')) AS downloads`,
    ),
    env.DB.prepare(
      `${commentSelect} WHERE c.status = 'held' ORDER BY c.created_at LIMIT 5`,
    ),
    env.DB.prepare(
      `SELECT * FROM feedback WHERE status = 'new' ORDER BY created_at DESC LIMIT 5`,
    ),
    env.DB.prepare(
      `SELECT day, SUM(count) AS total FROM downloads WHERE day >= date('now', '-6 days') GROUP BY day ORDER BY day DESC`,
    ),
  ]);
  const s = stats.results[0] ?? {};
  const card = (label: string, value: unknown, href: string, note = '') =>
    `<a class="card" href="${href}"><span class="value">${escape(value ?? 0)}</span><span class="label">${label}</span>${note ? `<small>${note}</small>` : ''}</a>`;
  const settings = await getSettings(env);
  const warnings = [
    !settings.commentsOpen && 'Bình luận mới đang <strong>tắt</strong>.',
    settings.moderation === 'manual' &&
      'Mọi bình luận đang được <strong>giữ chờ duyệt</strong>.',
    !settings.feedbackOpen && 'Form góp ý đang <strong>tắt</strong>.',
    !settings.signups && 'Đang <strong>không nhận</strong> tài khoản mới.',
  ].filter(Boolean);
  return `<h1>Bảng tin</h1>
${warnings.length ? `<div class="notice warn"><p>${warnings.join(' ')} <a href="/manage/settings">Đổi trong Cài đặt</a></p></div>` : ''}
<section class="cards" aria-label="Tổng quan">
${card('Tài khoản khách', s.users, '/manage/users', `+${escape(s.newUsers ?? 0)} trong 7 ngày`)}
${card('Bình luận đang hiện', s.published, '/manage/comments?status=published')}
${card('Bình luận chờ duyệt', s.held, '/manage/comments?status=held')}
${card('Góp ý chưa xử lý', s.feedback, '/manage/feedback')}
${card('Lượt bấm tải (30 ngày)', s.downloads, '/manage/downloads')}
</section>
<div class="columns">
<section class="box"><h2>Bình luận chờ duyệt</h2>${table(
    ['Thời gian', 'Ở đâu', 'Người viết', 'Nội dung', ''],
    held.results.map((row) => commentRow(row, back)),
    'Không có bình luận nào đang bị giữ.',
  )}<p><a href="/manage/comments?status=held">Xem tất cả →</a></p></section>
<section class="box"><h2>Góp ý mới</h2>${
    feedback.results.length
      ? `<ul class="list">${feedback.results.map((row) => `<li><strong>${escape(row.summary || kinds[String(row.kind)])}</strong> <small>· ${escape(row.project)} · ${escape(row.created_at)}</small></li>`).join('')}</ul>`
      : '<p class="empty">Không có góp ý mới.</p>'
  }<p><a href="/manage/feedback">Xem tất cả →</a></p></section>
<section class="box"><h2>Lượt tải 7 ngày qua</h2>${table(
    ['Ngày (UTC)', 'Lượt bấm tải'],
    daily.results.map(
      (row) =>
        `<tr><td>${escape(row.day)}</td><td>${escape(row.total)}</td></tr>`,
    ),
    'Chưa có lượt tải trong 7 ngày qua.',
  )}</section>
<section class="box"><h2>Lối tắt</h2><ul class="list">
<li><a href="/admin/">Sửa nội dung dự án và phiên bản (Sveltia CMS)</a></li>
<li><a href="/manage/settings">Cài đặt bình luận, góp ý, đăng nhập</a></li>
<li><a href="/">Xem trang web</a></li>
</ul></section>
</div>`;
}

async function commentsPage(env: Env, url: URL, back: string) {
  const status =
    ['held', 'published', 'all'].find(
      (value) => value === url.searchParams.get('status'),
    ) ?? 'held';
  const page = pageNumber(url);
  const q = query(url);
  const filter =
    status === 'all' ? `c.status IN ('published', 'held')` : `c.status = ?`;
  const args: (string | number)[] = status === 'all' ? [] : [status];
  const searchSql = q ? ` AND instr(lower(c.body), lower(?)) > 0` : '';
  if (q) args.push(q);
  const order = status === 'held' ? 'c.created_at' : 'c.created_at DESC';
  const [rows, total, groups] = await env.DB.batch<Row>([
    env.DB.prepare(
      `${commentSelect} WHERE ${filter}${searchSql} ORDER BY ${order}, c.id LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM comments c WHERE ${filter}${searchSql}`,
    ).bind(...args),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM comments GROUP BY status`,
    ),
  ]);
  const count = (key: string) =>
    Number(groups.results.find((row) => row.status === key)?.n ?? 0);
  return `<h1>Bình luận</h1>
<p class="intro">AI hoặc danh sách từ cấm giữ lại bình luận có dấu hiệu xúc phạm; chỉ người viết thấy chúng cho tới khi bạn "Cho hiện". Cách kiểm duyệt đổi ở <a href="/manage/settings">Cài đặt</a>.</p>
<div class="toolbar">${tabs('/manage/comments', status, [
    ['held', 'Chờ duyệt', count('held')],
    ['published', 'Đang hiện', count('published')],
    ['all', 'Tất cả', count('held') + count('published')],
  ])}${search(url, 'Tìm trong nội dung…')}</div>
${table(
  ['Thời gian', 'Ở đâu', 'Người viết', 'Nội dung (lý do)', ''],
  rows.results.map((row) => commentRow(row, back)),
  q ? 'Không tìm thấy bình luận nào.' : 'Không có bình luận nào ở mục này.',
)}
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function feedbackPage(env: Env, url: URL, back: string) {
  const status =
    ['new', 'done', 'all'].find(
      (value) => value === url.searchParams.get('status'),
    ) ?? 'new';
  const page = pageNumber(url);
  const filter = status === 'all' ? '1 = 1' : 'status = ?';
  const args = status === 'all' ? [] : [status];
  const [rows, total, groups] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT * FROM feedback WHERE ${filter} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE ${filter}`).bind(
      ...args,
    ),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM feedback GROUP BY status`,
    ),
  ]);
  const count = (key: string) =>
    Number(groups.results.find((row) => row.status === key)?.n ?? 0);
  return `<h1>Góp ý và báo lỗi</h1>
<p class="intro">Gửi từ form <code>/&lt;dự-án&gt;/feedback</code>. Không hiện công khai.</p>
<div class="toolbar">${tabs('/manage/feedback', status, [
    ['new', 'Chưa xử lý', count('new')],
    ['done', 'Đã xử lý', count('done')],
    ['all', 'Tất cả', count('new') + count('done')],
  ])}</div>
${table(
  [
    'Thời gian',
    'Dự án',
    'Loại',
    'Tiêu đề / nội dung',
    'Phiên bản · Windows',
    'Liên hệ',
    '',
  ],
  rows.results.map((row) => feedbackRow(row, back)),
  'Không có góp ý nào ở mục này.',
)}
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function downloadsPage(env: Env) {
  const [totals, daily] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT project, version, kind, SUM(count) AS total FROM downloads GROUP BY project, version, kind`,
    ),
    env.DB.prepare(
      `SELECT day, SUM(count) AS total FROM downloads WHERE day >= date('now', '-29 days') GROUP BY day ORDER BY day DESC`,
    ),
  ]);
  const rows = totals.results.sort(
    (a, b) =>
      String(a.project).localeCompare(String(b.project)) ||
      String(b.version).localeCompare(String(a.version), 'en', {
        numeric: true,
      }),
  );
  return `<h1>Lượt tải</h1>
<p class="intro">Đếm lượt bấm nút tải trên trang (một bộ đếm mỗi file mỗi ngày), không phải số lượt tải thật từ GitHub.</p>
<div class="columns">
<section class="box"><h2>Theo phiên bản</h2>${table(
    ['Dự án', 'Phiên bản', 'Loại', 'Tổng'],
    rows.map(
      (row) =>
        `<tr><td>${escape(row.project)}</td><td>${escape(row.version)}</td><td>${row.kind === 'setup' ? 'Bộ cài' : 'Portable'}</td><td>${escape(row.total)}</td></tr>`,
    ),
    'Chưa có lượt tải nào được ghi nhận.',
  )}</section>
<section class="box"><h2>30 ngày gần nhất</h2>${table(
    ['Ngày (UTC)', 'Lượt bấm tải'],
    daily.results.map(
      (row) =>
        `<tr><td>${escape(row.day)}</td><td>${escape(row.total)}</td></tr>`,
    ),
    'Chưa có dữ liệu 30 ngày gần nhất.',
  )}</section>
</div>`;
}

async function usersPage(env: Env, url: URL, back: string, admin: Admin) {
  const page = pageNumber(url);
  const q = query(url);
  const filter = q
    ? `WHERE instr(lower(u.email), lower(?)) > 0 OR instr(lower(u.display_name), lower(?)) > 0`
    : '';
  const args = q ? [q, q] : [];
  const [rows, total] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.google_sub IS NOT NULL AS google,
              u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.status IN ('published', 'held')) AS comments,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) AS sessions
       FROM users u ${filter}
       ORDER BY u.role = 'owner' DESC, u.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(...args, PER_PAGE, (page - 1) * PER_PAGE),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users u ${filter}`).bind(...args),
  ]);
  const confirmId = Number(url.searchParams.get('confirm'));
  const confirmRow = rows.results.find((row) => row.id === confirmId);
  const confirm =
    confirmRow && confirmRow.role !== 'owner'
      ? `<div class="notice warn" role="alert"><p>Xóa vĩnh viễn tài khoản <strong>${escape(confirmRow.display_name)}</strong> (${escape(confirmRow.email)}) và nội dung mọi bình luận của người này? Bình luận có người trả lời sẽ còn dòng "đã bị xóa".</p>${action('/manage/users', 'user-delete', confirmRow.id, 'Xóa vĩnh viễn', 'danger')} <a href="/manage/users">Hủy</a></div>`
      : '';
  const body = rows.results.map((row) => {
    const isOwner = row.role === 'owner';
    const self = admin.userId !== null && row.id === admin.userId;
    const ops = [
      !self && Number(row.sessions) > 0
        ? action(back, 'user-signout', row.id, 'Đăng xuất mọi nơi', 'secondary')
        : '',
      !isOwner
        ? `<a class="button-link danger" href="/manage/users?confirm=${escape(row.id)}">Xóa…</a>`
        : '',
    ].join('');
    return `<tr><td>${escape(row.display_name)}${self ? ' <small>(bạn)</small>' : ''}<br><small>${escape(row.email)}</small></td><td>${isOwner ? '<span class="tag ok">Chủ site</span>' : 'Thành viên'}</td><td>${row.google ? 'Google' : 'Mã email'}</td><td>${escape(row.created_at)}</td><td>${escape(row.last_login_at ?? '—')}</td><td>${escape(row.comments)}</td><td class="ops">${ops}</td></tr>`;
  });
  return `<h1>Người dùng</h1>
<p class="intro">Tài khoản tạo khi khách đăng nhập lần đầu (Google hoặc mã email). Quyền chủ site chỉ đặt được bằng SQL (xem <code>docs/DATABASE.md</code>), không đổi được từ đây.</p>
${confirm}
<div class="toolbar">${search(url, 'Tìm theo tên hoặc email…')}</div>
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
  q ? 'Không tìm thấy tài khoản nào.' : 'Chưa có tài khoản nào.',
)}
${pager(url, page, Number(total.results[0]?.n ?? 0))}`;
}

async function settingsPage(env: Env) {
  const s = await getSettings(env);
  const check = (name: string, on: boolean, label: string, hint: string) =>
    `<div class="field check"><input type="checkbox" id="${name}" name="${name}" value="1"${on ? ' checked' : ''}><label for="${name}">${label}</label><p class="hint">${hint}</p></div>`;
  const radio = (value: Moderation, label: string, hint: string) =>
    `<div class="field check"><input type="radio" id="moderation-${value}" name="moderation" value="${value}"${s.moderation === value ? ' checked' : ''}><label for="moderation-${value}">${label}</label><p class="hint">${hint}</p></div>`;
  const status = (ok: boolean, label: string, hint: string) =>
    `<tr><td>${label}</td><td>${ok ? '<span class="tag ok">Đã cấu hình</span>' : '<span class="tag">Chưa có</span>'}</td><td><small>${hint}</small></td></tr>`;
  return `<h1>Cài đặt</h1>
<form method="post" action="/manage" class="settings">
<input type="hidden" name="op" value="settings">
<input type="hidden" name="back" value="/manage/settings">
<fieldset><legend>Bình luận</legend>
${check('commentsOpen', s.commentsOpen, 'Cho phép bình luận mới', 'Tắt thì khách không viết hay sửa bình luận được; bình luận cũ vẫn hiện. Bạn (chủ site) vẫn viết được.')}
<p class="label">Kiểm duyệt</p>
${radio('ai', 'Danh sách từ + AI (mặc định)', 'Lọc từ cấm, rồi Workers AI đọc ngữ cảnh. Tốn quota AI miễn phí mỗi ngày.')}
${radio('words', 'Chỉ danh sách từ', 'Không gọi AI. Nhanh hơn, nhưng bỏ sót xúc phạm không dùng từ cấm.')}
${radio('manual', 'Giữ tất cả chờ duyệt', 'Mọi bình luận của khách chỉ hiện sau khi bạn duyệt ở mục Bình luận.')}
<div class="field"><label for="blockedWords">Từ bị chặn thêm</label><textarea id="blockedWords" name="blockedWords" rows="5" maxlength="8000" aria-describedby="blockedWords-hint">${escape(s.blockedWords.join('\n'))}</textarea><p class="hint" id="blockedWords-hint">Mỗi dòng một từ hoặc cụm từ (2–40 ký tự, tối đa 200). Khớp nguyên từ, có hoặc không dấu. Cộng thêm vào danh sách có sẵn trong <code>worker/moderation.ts</code>.</p></div>
${check('notifyHeld', s.notifyHeld, 'Gửi email cho tôi khi có bình luận bị giữ', 'Gửi qua Resend tới email tài khoản chủ site. Gói miễn phí: 100 email/ngày.')}
</fieldset>
<fieldset><legend>Góp ý và báo lỗi</legend>
${check('feedbackOpen', s.feedbackOpen, 'Nhận góp ý qua form', 'Tắt thì form <code>/&lt;dự-án&gt;/feedback</code> báo đang tạm đóng.')}
</fieldset>
<fieldset><legend>Đăng nhập và tài khoản</legend>
${check('emailLogin', s.emailLogin, 'Cho đăng nhập bằng mã email', 'Cần thêm secret RESEND_API_KEY. Tắt thì chỉ còn Google. Nếu bạn đăng nhập bằng mã email, hãy chắc chắn còn đăng nhập được bằng Google trước khi tắt.')}
${check('signups', s.signups, 'Cho tạo tài khoản mới', 'Tắt thì chỉ tài khoản đã có đăng nhập được, giống "Anyone can register" của WordPress.')}
</fieldset>
<p><button>Lưu thay đổi</button></p>
</form>
<section class="box"><h2>Tình trạng dịch vụ</h2>
<p class="intro">Chỉ đọc. Secret đặt bằng <code>npx wrangler secret put …</code> hoặc trong Cloudflare Dashboard, không lưu ở đây.</p>
${table(
  ['Dịch vụ', 'Trạng thái', 'Ghi chú'],
  [
    status(
      Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      'Đăng nhập Google',
      'GOOGLE_CLIENT_ID (vars) + GOOGLE_CLIENT_SECRET (secret)',
    ),
    status(
      mailEnabled(env),
      'Gửi email (Resend)',
      'RESEND_API_KEY (secret), người gửi MAIL_FROM',
    ),
    status(
      Boolean(env.TURNSTILE_SECRET),
      'Chống spam (Turnstile)',
      'TURNSTILE_SECRET (secret)',
    ),
    status(
      Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD),
      'Cloudflare Access (tùy chọn)',
      'Lối vào /manage dự phòng ngoài tài khoản chủ site',
    ),
  ],
  '',
)}
</section>`;
}

// ---------- layout ----------

const menu: [string, string, keyof Counts | null][] = [
  ['/manage', 'Bảng tin', null],
  ['/manage/comments', 'Bình luận', 'held'],
  ['/manage/feedback', 'Góp ý', 'newFeedback'],
  ['/manage/downloads', 'Lượt tải', null],
  ['/manage/users', 'Người dùng', null],
  ['/manage/settings', 'Cài đặt', null],
];

function layout(
  title: string,
  path: string,
  admin: Admin,
  badge: Counts,
  notice: string | null,
  content: string,
) {
  const nav = menu
    .map(([href, label, key]) => {
      const count = key ? badge[key] : 0;
      return `<li><a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}${count ? ` <span class="badge" aria-label="${count} mục mới">${count}</span>` : ''}</a></li>`;
    })
    .join('');
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)} ‹ Quản trị ChiloLab</title>
<style>
*{box-sizing:border-box}
body{font:15px/1.5 system-ui,sans-serif;margin:0;color:#1d2a30;background:#f1f4f5}
a{color:#16606f}
.skip{position:absolute;left:-999px;top:0;background:#fff;padding:.5rem 1rem;z-index:10}.skip:focus{left:.5rem}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;background:#12262d;color:#dbe6ea;padding:.45rem 1rem;font-size:.88rem}
.topbar a{color:#fff;text-decoration:none}.topbar .site{font-weight:700}
.topbar form{display:inline}.topbar button{background:none;border:0;color:#fff;text-decoration:underline;padding:0;margin:0 0 0 .8rem;font:inherit;cursor:pointer}
.shell{display:grid;grid-template-columns:200px 1fr;min-height:calc(100vh - 36px)}
.side{background:#1b343c}
.side ul{list-style:none;margin:0;padding:.6rem 0}
.side a{display:flex;justify-content:space-between;align-items:center;color:#dbe6ea;text-decoration:none;padding:.55rem 1rem;border-left:4px solid transparent}
.side a:hover{background:#244650;color:#fff}
.side a[aria-current=page]{background:#16606f;color:#fff;border-left-color:#f0a020;font-weight:600}
.side .sep{border-top:1px solid #2c4c55;margin:.5rem 0}
.badge{background:#d63b2a;color:#fff;border-radius:1rem;padding:0 .45rem;font-size:.75rem;font-weight:700}
main{padding:1.4rem 1.6rem 3rem;min-width:0}
h1{font-size:1.45rem;margin:0 0 1rem;font-weight:600}h2{font-size:1.05rem;margin:0 0 .8rem}
.intro,.empty,small,.hint{color:#5a6b73}.intro{margin-top:-.4rem;max-width:80ch}
.notice{background:#fff;border-left:4px solid #2e8b57;padding:.2rem 1rem;margin:0 0 1rem;box-shadow:0 1px 1px #0001}
.notice.warn{border-left-color:#f0a020}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.8rem;margin-bottom:1.2rem}
.card{display:flex;flex-direction:column;background:#fff;border:1px solid #d7e0e4;padding:1rem;text-decoration:none;color:inherit;border-radius:.3rem}
.card:hover{border-color:#16606f}.card .value{font-size:1.8rem;font-weight:700;color:#16606f}
.columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:1rem}
.box{background:#fff;border:1px solid #d7e0e4;padding:1rem;border-radius:.3rem;min-width:0;margin-bottom:1rem}
.list{margin:0;padding-left:1.1rem}.list li{margin:.3rem 0}
.toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem;margin-bottom:.8rem}
.tabs{display:flex;flex-wrap:wrap;gap:.2rem .9rem;list-style:none;margin:0;padding:0}
.tabs a{text-decoration:none}.tabs a[aria-current=page]{color:#1d2a30;font-weight:700}
.count{color:#5a6b73;font-weight:400}
.search{display:flex;gap:.3rem}.search input{min-width:14rem}
input[type=search],textarea{font:inherit;padding:.35rem .5rem;border:1px solid #9fb1b8;border-radius:.3rem;background:#fff}
textarea{width:100%;max-width:40rem}
.table{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border-bottom:1px solid #e2e8eb;padding:.55rem .6rem;text-align:left;vertical-align:top}
th{background:#f7f9fa;font-weight:600;border-bottom:1px solid #c8d3d8}
tr.held td{background:#fff8e6}
td.body{white-space:pre-wrap;word-break:break-word;max-width:50ch}
td.ops{white-space:nowrap}
.tag{display:inline-block;background:#fde8e4;color:#7a1d12;border-radius:.3rem;padding:0 .4rem;font-size:.78rem;font-weight:600}
.tag.ok{background:#e2f3e8;color:#1d5e36}
tr.done{opacity:.55}
td form{display:inline}
button,.button-link{font:inherit;font-size:.88rem;display:inline-block;padding:.25rem .7rem;margin:.1rem;border:1px solid #16606f;background:#16606f;color:#fff;border-radius:.3rem;cursor:pointer;text-decoration:none}
button.secondary,.button-link.secondary{background:#fff;color:#16606f}
button.danger,.button-link.danger{background:#fff;color:#a3261b;border-color:#a3261b}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #f0a020;outline-offset:2px}
.pager{display:flex;gap:1rem;margin-top:.8rem}
.settings{background:#fff;border:1px solid #d7e0e4;padding:1rem 1.2rem;border-radius:.3rem;margin-bottom:1rem;max-width:56rem}
fieldset{border:0;border-top:1px solid #e2e8eb;margin:0 0 .6rem;padding:.8rem 0 0}
legend{font-weight:700;font-size:1.05rem;padding-right:.6rem}
.field{margin:.6rem 0}.field>label,.label{display:block;font-weight:600;margin:.4rem 0 .2rem}
.field.check{display:grid;grid-template-columns:auto 1fr;column-gap:.5rem;align-items:baseline}
.field.check label{font-weight:600;margin:0}.field.check .hint{grid-column:2;margin:.1rem 0 0}
.hint{font-size:.85rem;margin:.2rem 0 0}
@media (max-width:760px){.shell{grid-template-columns:1fr}.side ul{display:flex;flex-wrap:wrap;padding:0}.side a{border-left:0;border-bottom:3px solid transparent;padding:.5rem .7rem}.side a[aria-current=page]{border-bottom-color:#f0a020}.side .sep{display:none}main{padding:1rem}}
</style>
</head>
<body>
<a class="skip" href="#main">Bỏ qua tới nội dung</a>
<header class="topbar"><a class="site" href="/">← ChiloLab</a><span>Xin chào, <strong>${escape(admin.name)}</strong>${admin.userId !== null ? `<form method="post" action="/manage/logout"><button>Đăng xuất</button></form>` : ''}</span></header>
<div class="shell">
<nav class="side" aria-label="Quản trị"><ul>${nav}<li class="sep" aria-hidden="true"></li><li><a href="/admin/">Nội dung (CMS)</a></li><li><a href="/user/account">Tài khoản của tôi</a></li></ul></nav>
<main id="main" tabindex="-1">
${notice && notices[notice] ? `<div class="notice" role="status"><p>${notices[notice]}</p></div>` : ''}
${content}
</main>
</div>
</body>
</html>`;
}

// ---------- request handling ----------

const htmlHeaders = {
  ...baseHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Only return to an admin page after a POST. */
function backTo(value: unknown, notice: string) {
  const raw = typeof value === 'string' ? value : '';
  const target = new URL(
    /^\/manage(\/[a-z]+)?(\?[^#\\]*)?$/.test(raw) ? raw : '/manage',
    'https://admin.invalid',
  );
  target.searchParams.delete('confirm');
  target.searchParams.set('notice', notice);
  return target.pathname + target.search;
}

async function post(request: Request, env: Env, admin: Admin) {
  if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData();
  const op = String(form.get('op'));

  if (op === 'settings') {
    const moderation =
      (['ai', 'words', 'manual'] as const).find(
        (value) => value === form.get('moderation'),
      ) ?? 'ai';
    await saveSettings(env, {
      commentsOpen: form.get('commentsOpen') === '1',
      moderation,
      blockedWords: parseWords(
        String(form.get('blockedWords') ?? '').slice(0, 8000),
      ),
      notifyHeld: form.get('notifyHeld') === '1',
      feedbackOpen: form.get('feedbackOpen') === '1',
      emailLogin: form.get('emailLogin') === '1',
      signups: form.get('signups') === '1',
    });
    return redirect(backTo(form.get('back'), 'saved'), 303);
  }

  const id = Number(form.get('id'));
  if (!Number.isSafeInteger(id) || id < 1)
    return new Response('Bad request', { status: 400 });
  let notice = op;
  if (op === 'approve') {
    await env.DB.prepare(
      `UPDATE comments SET status = 'published', moderation_reason = NULL
       WHERE id = ? AND status = 'held'`,
    )
      .bind(id)
      .run();
    notice = 'approved';
  } else if (op === 'remove-comment') {
    await removeComment(env, id, 'removed');
    notice = 'removed';
  } else if (op === 'feedback-done' || op === 'feedback-reopen')
    await env.DB.prepare('UPDATE feedback SET status = ? WHERE id = ?')
      .bind(op === 'feedback-done' ? 'done' : 'new', id)
      .run();
  else if (op === 'feedback-delete')
    await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
  else if (op === 'user-signout') {
    if (id === admin.userId)
      return new Response('Bad request', { status: 400 });
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
      .bind(id)
      .run();
  } else if (op === 'user-delete') {
    // Owner accounts cannot be deleted here, so the panel never locks itself out.
    const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?')
      .bind(id)
      .first<{ role: string }>();
    if (!target || target.role === 'owner')
      return new Response('Bad request', { status: 400 });
    await deleteUserComments(env, id);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
      env.DB.prepare(
        'UPDATE feedback SET user_id = NULL WHERE user_id = ?',
      ).bind(id),
      env.DB.prepare(`DELETE FROM users WHERE id = ? AND role <> 'owner'`).bind(
        id,
      ),
    ]);
  } else return new Response('Bad request', { status: 400 });
  return redirect(backTo(form.get('back'), notice), 303);
}

export async function manage(request: Request, env: Env, admin: Admin) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/manage';

  if (path === '/manage/logout') {
    if (request.method !== 'POST' || !sameOrigin(request))
      return new Response('Method not allowed', { status: 405 });
    return redirect('/', 303, { 'Set-Cookie': await endSession(request, env) });
  }
  if (request.method === 'POST' && path === '/manage')
    return post(request, env, admin);
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', { status: 405 });

  const back =
    path +
    url.search.replace(/([?&])notice=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const pages: Record<string, [string, () => Promise<string>]> = {
    '/manage': ['Bảng tin', () => dashboard(env, back)],
    '/manage/comments': ['Bình luận', () => commentsPage(env, url, back)],
    '/manage/feedback': ['Góp ý', () => feedbackPage(env, url, back)],
    '/manage/downloads': ['Lượt tải', () => downloadsPage(env)],
    '/manage/users': ['Người dùng', () => usersPage(env, url, back, admin)],
    '/manage/settings': ['Cài đặt', () => settingsPage(env)],
  };
  const entry = pages[path];
  if (!entry)
    return new Response('Not found', { status: 404, headers: htmlHeaders });
  const [content, badge] = await Promise.all([entry[1](), counts(env)]);
  return new Response(
    layout(
      entry[0],
      path,
      admin,
      badge,
      url.searchParams.get('notice'),
      content,
    ),
    { headers: htmlHeaders },
  );
}
