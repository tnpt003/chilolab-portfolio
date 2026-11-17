import { removeComment } from './comments';
import { baseHeaders, sameOrigin, type Env } from './env';

// Owner page for visitor data. Reached only after adminIdentity() succeeds.
// Server-rendered, no JavaScript; every stored value is HTML-escaped.

type Row = Record<string, string | number | null>;

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
  unchecked: 'AI chưa kiểm tra được',
};

function button(op: string, id: unknown, label: string, danger = false) {
  return `<form method="post" action="/manage"><input type="hidden" name="op" value="${op}"><input type="hidden" name="id" value="${escape(id)}"><button${danger ? ' class="danger"' : ''}>${label}</button></form>`;
}

function table(headings: string[], rows: string[], empty: string) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  return `<div class="table"><table><thead><tr>${headings.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function where(row: Row) {
  const target = row.version
    ? `/${row.project}/versions/${row.version}`
    : `/${row.project}`;
  return `<a href="${escape(target)}">${escape(row.project)}${row.version ? ` v${escape(row.version)}` : ''}</a>${row.parent_id ? ' · trả lời' : ''}`;
}

function who(row: Row) {
  return row.display_name
    ? `${escape(row.display_name)}<br><small>${escape(row.email)}</small>`
    : escape(row.author ?? '—');
}

function commentRow(row: Row, actions: string) {
  const reason = row.moderation_reason
    ? `<span class="tag">${escape(reasons[String(row.moderation_reason)] ?? row.moderation_reason)}</span> `
    : '';
  return `<tr><td>${escape(row.created_at)}${row.edited_at ? '<br><small>đã sửa</small>' : ''}</td><td>${where(row)}</td><td>${who(row)}</td><td class="body">${reason}${escape(row.body)}</td><td class="ops">${actions}</td></tr>`;
}

async function page(env: Env, admin: string) {
  const select = `SELECT c.*, u.display_name, u.email FROM comments c LEFT JOIN users u ON u.id = c.user_id`;
  const [held, recent, feedback, totals, daily, users] =
    await env.DB.batch<Row>([
      env.DB.prepare(`${select} WHERE c.status = 'held' ORDER BY c.created_at`),
      env.DB.prepare(
        `${select} WHERE c.status = 'published' ORDER BY c.created_at DESC LIMIT 100`,
      ),
      env.DB.prepare(
        `SELECT * FROM feedback ORDER BY status = 'done', created_at DESC LIMIT 200`,
      ),
      env.DB.prepare(
        `SELECT project, version, kind, SUM(count) AS total FROM downloads GROUP BY project, version, kind`,
      ),
      env.DB.prepare(
        `SELECT day, SUM(count) AS total FROM downloads WHERE day >= date('now', '-29 days') GROUP BY day ORDER BY day DESC`,
      ),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM users`),
    ]);

  const heldHtml = table(
    ['Thời gian', 'Ở đâu', 'Người viết', 'Nội dung (lý do giữ)', ''],
    held.results.map((row) =>
      commentRow(
        row,
        button('approve', row.id, 'Cho hiện') +
          button('remove-comment', row.id, 'Xóa', true),
      ),
    ),
    'Không có bình luận nào đang bị giữ.',
  );

  const recentHtml = table(
    ['Thời gian', 'Ở đâu', 'Người viết', 'Nội dung', ''],
    recent.results.map((row) =>
      commentRow(row, button('remove-comment', row.id, 'Xóa', true)),
    ),
    'Chưa có bình luận.',
  );

  const feedbackHtml = table(
    [
      'Thời gian',
      'Dự án',
      'Loại',
      'Tiêu đề / nội dung',
      'Phiên bản · Windows',
      'Liên hệ',
      '',
    ],
    feedback.results.map(
      (row) =>
        `<tr class="${row.status === 'done' ? 'done' : ''}"><td>${escape(row.created_at)}</td><td>${escape(row.project)} · ${escape(row.locale)}</td><td>${escape(kinds[String(row.kind)] ?? row.kind)}</td><td class="body"><strong>${escape(row.summary)}</strong>${row.summary ? '\n' : ''}${escape(row.message)}</td><td>${escape(row.app_version)}${row.os ? ` · ${escape(row.os)}` : ''}</td><td>${escape(row.contact)}</td><td class="ops">${row.status === 'new' ? button('feedback-done', row.id, 'Đã xử lý') : ''}${button('feedback-delete', row.id, 'Xóa', true)}</td></tr>`,
    ),
    'Chưa có góp ý.',
  );

  const totalRows = totals.results.sort(
    (a, b) =>
      String(a.project).localeCompare(String(b.project)) ||
      String(b.version).localeCompare(String(a.version), 'en', {
        numeric: true,
      }),
  );
  const downloadsHtml = table(
    ['Dự án', 'Phiên bản', 'Loại', 'Tổng lượt bấm tải'],
    totalRows.map(
      (row) =>
        `<tr><td>${escape(row.project)}</td><td>${escape(row.version)}</td><td>${row.kind === 'setup' ? 'Bộ cài' : 'Portable'}</td><td>${escape(row.total)}</td></tr>`,
    ),
    'Chưa có lượt tải nào được ghi nhận.',
  );
  const dailyHtml = table(
    ['Ngày (UTC)', 'Lượt bấm tải'],
    daily.results.map(
      (row) =>
        `<tr><td>${escape(row.day)}</td><td>${escape(row.total)}</td></tr>`,
    ),
    'Chưa có dữ liệu 30 ngày gần nhất.',
  );

  const newFeedback = feedback.results.filter(
    (row) => row.status === 'new',
  ).length;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Quản lý | ChiloLab</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1240px;padding:1.5rem;color:#1d3540;background:#f8fafb}
h1{font-size:1.5rem;margin:0}h2{margin-top:2.5rem;font-size:1.15rem}
header{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
.who{color:#5a6b73;font-size:.9rem}
nav{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;margin-top:.8rem}
.alert{background:#fde8e4;color:#7a1d12;padding:.15rem .5rem;border-radius:.4rem;font-weight:600}
.table{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border:1px solid #d7e0e4;padding:.45rem .6rem;text-align:left;vertical-align:top}
th{background:#eef3f5;font-weight:600}
td.body{white-space:pre-wrap;word-break:break-word;max-width:46ch}
td.ops{white-space:nowrap}
small{color:#5a6b73}
.tag{display:inline-block;background:#fde8e4;color:#7a1d12;border-radius:.3rem;padding:0 .4rem;font-size:.8rem;font-weight:600}
tr.done{opacity:.55}
form{display:inline}
button{font:inherit;padding:.25rem .7rem;margin:.1rem;border:1px solid #184b58;background:#184b58;color:#fff;border-radius:.4rem;cursor:pointer}
button.danger{background:#fff;color:#a3261b;border-color:#a3261b}
button:focus-visible,a:focus-visible{outline:3px solid #f0a020;outline-offset:2px}
.empty{color:#5a6b73}
</style>
</head>
<body>
<header><h1>Quản lý — ChiloLab</h1><span class="who">Đăng nhập: ${escape(admin)} · ${escape(users.results[0]?.total ?? 0)} tài khoản khách</span></header>
<nav>
<a href="#held">Bị giữ chờ duyệt ${held.results.length ? `<span class="alert">${held.results.length}</span>` : '(0)'}</a>
<a href="#recent">Bình luận gần đây</a>
<a href="#feedback">Góp ý & báo lỗi (${newFeedback} mới)</a>
<a href="#downloads">Lượt tải</a>
</nav>
<h2 id="held">Bình luận bị giữ chờ duyệt</h2>
<p class="empty">AI hoặc danh sách từ cấm đã giữ các bình luận này; chỉ người viết thấy chúng. "Cho hiện" để công khai, "Xóa" để gỡ.</p>
${heldHtml}
<h2 id="recent">Bình luận đang hiện (100 mới nhất)</h2>${recentHtml}
<h2 id="feedback">Góp ý và báo lỗi</h2>${feedbackHtml}
<h2 id="downloads">Lượt bấm tải</h2>${downloadsHtml}
<h2>30 ngày gần nhất</h2>${dailyHtml}
</body>
</html>`;
}

const feedbackStatements: Record<string, string> = {
  'feedback-done': `UPDATE feedback SET status = 'done' WHERE id = ?`,
  'feedback-delete': 'DELETE FROM feedback WHERE id = ?',
};

export async function manage(request: Request, env: Env, admin: string) {
  const url = new URL(request.url);
  if (url.pathname.replace(/\/+$/, '') !== '/manage')
    return new Response('Not found', { status: 404 });

  if (request.method === 'POST') {
    if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });
    const form = await request.formData();
    const op = String(form.get('op'));
    const id = Number(form.get('id'));
    if (!Number.isSafeInteger(id) || id < 1)
      return new Response('Bad request', { status: 400 });
    if (op === 'approve')
      await env.DB.prepare(
        `UPDATE comments SET status = 'published', moderation_reason = NULL
         WHERE id = ? AND status = 'held'`,
      )
        .bind(id)
        .run();
    else if (op === 'remove-comment') await removeComment(env, id, 'removed');
    else if (feedbackStatements[op])
      await env.DB.prepare(feedbackStatements[op]).bind(id).run();
    else return new Response('Bad request', { status: 400 });
    return new Response(null, {
      status: 303,
      headers: { ...baseHeaders, Location: '/manage' },
    });
  }
  if (request.method !== 'GET')
    return new Response('Method not allowed', { status: 405 });

  return new Response(await page(env, admin), {
    headers: {
      ...baseHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
