import { baseHeaders, sameOrigin, type Env } from './env';

// Admin page for visitor data. Reached only after adminIdentity() succeeds.
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

function button(op: string, id: unknown, label: string, danger = false) {
  return `<form method="post" action="/manage"><input type="hidden" name="op" value="${op}"><input type="hidden" name="id" value="${escape(id)}"><button${danger ? ' class="danger"' : ''}>${label}</button></form>`;
}

function commentRows(rows: Row[], pending: boolean) {
  if (!rows.length) return '<p class="empty">Không có.</p>';
  return `<table><thead><tr><th>Thời gian</th><th>Dự án</th><th>Tên</th><th>Nội dung</th><th></th></tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><td>${escape(row.created_at)}</td><td>${escape(row.project)} · ${escape(row.locale)}</td><td>${escape(row.author)}</td><td class="body">${escape(row.body)}</td><td class="ops">${pending ? button('approve', row.id, 'Duyệt') : ''}${button('delete-comment', row.id, 'Xóa', true)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

async function page(env: Env, admin: string) {
  const [feedback, pending, approved, totals, daily] = await env.DB.batch<Row>([
    env.DB.prepare(
      `SELECT * FROM feedback ORDER BY status = 'done', created_at DESC LIMIT 200`,
    ),
    env.DB.prepare(
      `SELECT * FROM comments WHERE status = 'pending' ORDER BY created_at`,
    ),
    env.DB.prepare(
      `SELECT * FROM comments WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`,
    ),
    env.DB.prepare(
      `SELECT project, version, kind, SUM(count) AS total FROM downloads GROUP BY project, version, kind`,
    ),
    env.DB.prepare(
      `SELECT day, SUM(count) AS total FROM downloads WHERE day >= date('now', '-29 days') GROUP BY day ORDER BY day DESC`,
    ),
  ]);

  const totalRows = (totals.results ?? []).sort(
    (a, b) =>
      String(a.project).localeCompare(String(b.project)) ||
      String(b.version).localeCompare(String(a.version), 'en', {
        numeric: true,
      }),
  );

  const feedbackHtml = feedback.results.length
    ? `<table><thead><tr><th>Thời gian</th><th>Dự án</th><th>Loại</th><th>Nội dung</th><th>Liên hệ</th><th>Phiên bản app</th><th></th></tr></thead><tbody>${feedback.results
        .map(
          (row) =>
            `<tr class="${row.status === 'done' ? 'done' : ''}"><td>${escape(row.created_at)}</td><td>${escape(row.project)} · ${escape(row.locale)}</td><td>${escape(kinds[String(row.kind)] ?? row.kind)}</td><td class="body">${escape(row.message)}</td><td>${escape(row.contact)}</td><td>${escape(row.app_version)}</td><td class="ops">${row.status === 'new' ? button('feedback-done', row.id, 'Đã xử lý') : ''}${button('feedback-delete', row.id, 'Xóa', true)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="empty">Chưa có góp ý.</p>';

  const downloadsHtml = totalRows.length
    ? `<table><thead><tr><th>Dự án</th><th>Phiên bản</th><th>Loại</th><th>Tổng lượt bấm tải</th></tr></thead><tbody>${totalRows
        .map(
          (row) =>
            `<tr><td>${escape(row.project)}</td><td>${escape(row.version)}</td><td>${row.kind === 'setup' ? 'Bộ cài' : 'Portable'}</td><td>${escape(row.total)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="empty">Chưa có lượt tải nào được ghi nhận.</p>';

  const dailyHtml = daily.results.length
    ? `<table><thead><tr><th>Ngày (UTC)</th><th>Lượt bấm tải</th></tr></thead><tbody>${daily.results
        .map(
          (row) =>
            `<tr><td>${escape(row.day)}</td><td>${escape(row.total)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Quản lý dữ liệu | ChiloLab</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1200px;padding:1.5rem;color:#1d3540;background:#f8fafb}
h1{font-size:1.5rem;margin:0}h2{margin-top:2.5rem;font-size:1.15rem}
header{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
.who{color:#5a6b73;font-size:.9rem}
nav a{margin-right:1rem}
.table{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border:1px solid #d7e0e4;padding:.45rem .6rem;text-align:left;vertical-align:top}
th{background:#eef3f5;font-weight:600}
td.body{white-space:pre-wrap;word-break:break-word;max-width:40ch}
td.ops{white-space:nowrap}
tr.done{opacity:.55}
form{display:inline}
button{font:inherit;padding:.25rem .7rem;margin:.1rem;border:1px solid #184b58;background:#184b58;color:#fff;border-radius:.4rem;cursor:pointer}
button.danger{background:#fff;color:#a3261b;border-color:#a3261b}
button:focus-visible,a:focus-visible{outline:3px solid #f0a020;outline-offset:2px}
.empty{color:#5a6b73}
</style>
</head>
<body>
<header><h1>Dữ liệu người dùng — ChiloLab</h1><span class="who">Đăng nhập: ${escape(admin)}</span></header>
<nav><a href="#feedback">Góp ý (${feedback.results.filter((row) => row.status === 'new').length} mới)</a><a href="#pending">Bình luận chờ duyệt (${pending.results.length})</a><a href="#approved">Bình luận đã duyệt</a><a href="#downloads">Lượt tải</a></nav>
<h2 id="feedback">Góp ý và báo lỗi</h2><div class="table">${feedbackHtml}</div>
<h2 id="pending">Bình luận chờ duyệt</h2><div class="table">${commentRows(pending.results, true)}</div>
<h2 id="approved">Bình luận đã duyệt (100 mới nhất)</h2><div class="table">${commentRows(approved.results, false)}</div>
<h2 id="downloads">Lượt bấm tải</h2><div class="table">${downloadsHtml}</div>
${dailyHtml ? `<h2>30 ngày gần nhất</h2><div class="table">${dailyHtml}</div>` : ''}
</body>
</html>`;
}

const statements: Record<string, string> = {
  approve: `UPDATE comments SET status = 'approved' WHERE id = ?`,
  'delete-comment': 'DELETE FROM comments WHERE id = ?',
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
    const sql = statements[String(form.get('op'))];
    const id = Number(form.get('id'));
    if (!sql || !Number.isSafeInteger(id) || id < 1)
      return new Response('Bad request', { status: 400 });
    await env.DB.prepare(sql).bind(id).run();
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
