import { baseHeaders } from './env';

// Look and building blocks of the owner admin panel (/admin/manage).
// Deliberately unlike the public site: dark surfaces, an amber accent and a
// permanent "QUẢN TRỊ" bar, so the owner always knows which side they are on.
// Server-rendered and script-free; every value passes through escape().

export type Admin = {
  /** Shown in the top bar and written to the admin log. */
  name: string;
  /** users.id when signed in with an owner account; null for the dev bypass. */
  userId: number | null;
};

export type Row = Record<string, string | number | null>;

export const PER_PAGE = 50;

export const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

export const kinds: Record<string, string> = {
  idea: 'Góp ý',
  bug: 'Báo lỗi',
  other: 'Khác',
};

export const feedbackStates: Record<string, string> = {
  new: 'Chưa xử lý',
  progress: 'Đang xử lý',
  done: 'Đã xử lý',
};

export const reasons: Record<string, string> = {
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

/** "2026-11-25T08:03:11Z" → "2026-11-25 08:03 UTC". */
export const when = (value: unknown) =>
  value
    ? escape(
        String(value)
          .replace('T', ' ')
          .replace(/:\d\d(\.\d+)?Z$/, ' UTC'),
      )
    : '—';

// ---------- forms ----------

/** A submit button; `value` is "op:id" or "bulk". */
export const button = (
  value: string,
  label: string,
  style: '' | 'danger' | 'ghost' = '',
) =>
  `<button name="do" value="${escape(value)}"${style ? ` class="${style}"` : ''}>${label}</button>`;

/** Opens the single POST form that wraps a page's rows and bulk bar. */
export const formStart = (back: string, id = 'rows') =>
  `<form id="${id}" method="post" action="/admin/manage"><input type="hidden" name="back" value="${escape(back)}">`;

export const checkbox = (id: unknown, label: string) =>
  `<input type="checkbox" name="ids" value="${escape(id)}" aria-label="${escape(label)}">`;

/** Bulk bar: choose an operation, then apply it to the ticked rows. */
export function bulkBar(options: [string, string][]) {
  return `<div class="bulk"><label for="bulk-op">Với các mục đã chọn</label><select id="bulk-op" name="bulk"><option value="">Chọn thao tác…</option>${options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('')}</select>${button('bulk', 'Áp dụng', 'ghost')}</div>`;
}

// ---------- lists ----------

export function table(headings: string[], rows: string[], empty: string) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  return `<div class="table"><table><thead><tr>${headings.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function tabs(
  url: URL,
  key: string,
  current: string,
  items: [string, string, number | null][],
) {
  return `<ul class="tabs">${items
    .map(([value, label, count]) => {
      const next = new URL(url);
      next.searchParams.set(key, value);
      for (const drop of ['page', 'notice', 'confirm'])
        next.searchParams.delete(drop);
      return `<li><a href="${escape(next.pathname + next.search)}"${value === current ? ' aria-current="page"' : ''}>${label}${count === null ? '' : ` <span class="count">${count}</span>`}</a></li>`;
    })
    .join('')}</ul>`;
}

export function pager(url: URL, page: number, total: number) {
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

/** GET filter form; keeps the current tab and resets paging. */
export function filters(url: URL, keep: string[], fields: string) {
  const hidden = keep
    .map((key) => {
      const value = url.searchParams.get(key);
      return value
        ? `<input type="hidden" name="${key}" value="${escape(value)}">`
        : '';
    })
    .join('');
  return `<form class="filters" method="get" action="${escape(url.pathname)}" role="search">${hidden}${fields}<button class="ghost">Lọc</button></form>`;
}

export function select(
  name: string,
  label: string,
  current: string,
  options: [string, string][],
) {
  return `<label class="sr-only" for="f-${name}">${label}</label><select id="f-${name}" name="${name}"><option value="">${label}: tất cả</option>${options
    .map(
      ([value, text]) =>
        `<option value="${escape(value)}"${value === current ? ' selected' : ''}>${escape(text)}</option>`,
    )
    .join('')}</select>`;
}

export const searchField = (url: URL, placeholder: string) =>
  `<label class="sr-only" for="q">Tìm kiếm</label><input id="q" name="q" type="search" maxlength="100" value="${escape(url.searchParams.get('q') ?? '')}" placeholder="${placeholder}">`;

export const pageNumber = (url: URL) =>
  Math.max(1, Math.min(10_000, Number(url.searchParams.get('page')) || 1));

export const query = (url: URL) =>
  (url.searchParams.get('q') ?? '').trim().slice(0, 100);

/** Vertical bar chart drawn with CSS; days with no data show as empty. */
export function barChart(
  days: number,
  rows: Record<string, unknown>[],
  label: string,
) {
  const values = new Map(
    rows.map((row) => [String(row.day), Number(row.total)]),
  );
  const list: [string, number][] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    list.push([day, values.get(day) ?? 0]);
  }
  const max = Math.max(1, ...list.map(([, n]) => n));
  const sum = list.reduce((total, [, n]) => total + n, 0);
  return `<figure class="chart"><div class="bars" role="img" aria-label="${escape(`${label}: tổng ${sum} trong ${days} ngày`)}">${list
    .map(
      ([day, n]) =>
        `<span class="bar" style="--h:${Math.round((n / max) * 100)}%" title="${day}: ${n}"></span>`,
    )
    .join(
      '',
    )}</div><figcaption><span>${list[0]![0]}</span><span>Tổng ${sum} · cao nhất ${max === 1 && sum === 0 ? 0 : max}/ngày</span><span>${list[list.length - 1]![0]}</span></figcaption></figure>`;
}

// ---------- layout ----------

export type Badges = { held: number; newFeedback: number };

type Item = [href: string, label: string, badge?: keyof Badges];
const menu: [group: string, items: Item[]][] = [
  ['', [['/admin/manage', 'Tổng quan']]],
  [
    'Kiểm duyệt',
    [
      ['/admin/manage/comments', 'Bình luận', 'held'],
      ['/admin/manage/feedback', 'Góp ý', 'newFeedback'],
    ],
  ],
  ['Cộng đồng', [['/admin/manage/users', 'Người dùng']]],
  ['Thống kê', [['/admin/manage/downloads', 'Lượt tải']]],
  [
    'Hệ thống',
    [
      ['/admin/manage/settings', 'Cài đặt'],
      ['/admin/manage/log', 'Nhật ký'],
      ['/admin/manage/status', 'Tình trạng dịch vụ'],
    ],
  ],
];

const favicon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f5b545"/><path d="M16 7l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9v-6z" fill="none" stroke="#14181b" stroke-width="2.4" stroke-linejoin="round"/></svg>',
)}`;

const css = `
:root{color-scheme:dark;--bg:#101417;--surface:#171d21;--raised:#1e262b;--line:#2b363c;--text:#e8eef1;--muted:#a3b3ba;--accent:#f5b545;--accent-ink:#1b1400;--link:#ffd27f;--danger:#ff8f80;--ok:#7ddfaa;--warn-bg:#3a2b0c}
*{box-sizing:border-box}
body{font:15px/1.55 system-ui,"Segoe UI",sans-serif;margin:0;color:var(--text);background:var(--bg)}
a{color:var(--link)}
code{background:var(--raised);padding:0 .3rem;border-radius:.25rem;font-size:.9em}
.skip{position:absolute;left:-999px;top:0;background:var(--accent);color:var(--accent-ink);padding:.5rem 1rem;z-index:10}.skip:focus{left:.5rem}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;background:var(--accent);color:var(--accent-ink);padding:.4rem 1rem;font-size:.88rem}
.topbar .mode{display:flex;align-items:center;gap:.6rem;font-weight:800;letter-spacing:.08em}
.topbar .mode span{font-weight:500;letter-spacing:0}
.topbar a,.topbar button{color:var(--accent-ink);font-weight:600}
.topbar .who{display:flex;align-items:center;gap:1rem}
.topbar form{display:inline}.topbar button{background:none;border:0;padding:0;font:inherit;text-decoration:underline;cursor:pointer}
.shell{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 38px)}
.side{background:var(--surface);border-right:1px solid var(--line);padding:.8rem 0}
.side ul{list-style:none;margin:0;padding:0}
.side .group{margin:.9rem 1rem .3rem;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.side a{display:flex;justify-content:space-between;align-items:center;color:var(--text);text-decoration:none;padding:.45rem 1rem;border-left:3px solid transparent}
.side a:hover{background:var(--raised)}
.side a[aria-current=page]{background:var(--raised);border-left-color:var(--accent);color:#fff;font-weight:650}
.side hr{border:0;border-top:1px solid var(--line);margin:.8rem 1rem}
.badge{background:var(--danger);color:#2a0600;border-radius:1rem;padding:0 .45rem;font-size:.75rem;font-weight:800}
main{padding:1.5rem 1.8rem 3rem;min-width:0;max-width:1400px}
h1{font-size:1.5rem;margin:0 0 .4rem;font-weight:700}h2{font-size:1.05rem;margin:0 0 .8rem}
.intro,.empty,small,.hint,.muted{color:var(--muted)}.intro{margin:0 0 1.1rem;max-width:80ch}
.notice{background:var(--raised);border-left:4px solid var(--ok);padding:.5rem 1rem;margin:0 0 1rem;border-radius:.3rem}
.notice p{margin:.2rem 0}
.notice.warn{border-left-color:var(--accent);background:var(--warn-bg)}
.notice.danger{border-left-color:var(--danger)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.8rem;margin-bottom:1.2rem}
.card{display:flex;flex-direction:column;gap:.15rem;background:var(--surface);border:1px solid var(--line);padding:1rem;text-decoration:none;color:inherit;border-radius:.5rem}
.card:hover{border-color:var(--accent)}.card .value{font-size:1.9rem;font-weight:750;color:#fff;font-variant-numeric:tabular-nums}
.card.alert .value{color:var(--accent)}
.columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:1rem}
.box.wide{grid-column:1/-1}
.box{background:var(--surface);border:1px solid var(--line);padding:1rem 1.1rem;border-radius:.5rem;min-width:0;margin-bottom:1rem}
.list{margin:0;padding-left:1.1rem}.list li{margin:.3rem 0}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:.35rem 1rem;margin:0}dl.facts dt{color:var(--muted)}dl.facts dd{margin:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem;margin-bottom:.8rem}
.tabs{display:flex;flex-wrap:wrap;gap:.3rem;list-style:none;margin:0;padding:0}
.tabs a{display:inline-block;text-decoration:none;color:var(--text);padding:.3rem .75rem;border:1px solid var(--line);border-radius:.4rem}
.tabs a[aria-current=page]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:700}
.tabs .count{opacity:.75;font-weight:500}
.filters{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
input[type=search],input[type=number],textarea,select{font:inherit;color:var(--text);padding:.35rem .55rem;border:1px solid #47555c;border-radius:.35rem;background:var(--bg)}
input[type=search]{min-width:14rem}
input[type=number]{width:7rem}
textarea{width:100%;max-width:44rem}
input[type=checkbox],input[type=radio]{accent-color:var(--accent);width:1rem;height:1rem}
.bulk{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:.6rem 0;padding:.5rem .7rem;background:var(--surface);border:1px dashed var(--line);border-radius:.4rem}
.bulk label{font-size:.88rem;color:var(--muted)}
.table{overflow-x:auto;border:1px solid var(--line);border-radius:.5rem}
table{border-collapse:collapse;width:100%;min-width:760px;background:var(--surface)}
th,td{border-bottom:1px solid var(--line);padding:.6rem .65rem;text-align:left;vertical-align:top}
tbody tr:last-child td{border-bottom:0}
th{background:var(--raised);font-weight:650;font-size:.85rem;color:var(--muted)}
tbody tr:hover td{background:#1b2226}
tr.held td{background:#2a2310}
tr.done td{opacity:.6}
td.pick,th.pick{width:2rem}
td.body{white-space:pre-wrap;overflow-wrap:anywhere;min-width:16rem;max-width:52ch}
td.ops{white-space:nowrap}
.tag{display:inline-block;white-space:nowrap;background:#45201b;color:#ffc2b8;border-radius:.3rem;padding:0 .4rem;font-size:.76rem;font-weight:700}
.tag.ok{background:#173b29;color:var(--ok)}
.tag.info{background:#1d3442;color:#9fd8ff}
.tag.warn{background:var(--warn-bg);color:var(--accent)}
button,.button-link{font:inherit;font-size:.86rem;display:inline-block;padding:.28rem .75rem;margin:.1rem;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);font-weight:650;border-radius:.35rem;cursor:pointer;text-decoration:none}
button:hover,.button-link:hover{filter:brightness(1.08)}
button.ghost,.button-link.ghost{background:transparent;color:var(--text);border-color:#56656c}
button.danger,.button-link.danger{background:transparent;color:var(--danger);border-color:var(--danger)}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #7fd0ff;outline-offset:2px}
.pager{display:flex;gap:1rem;margin-top:.8rem}
details.note summary{cursor:pointer;color:var(--link);font-size:.86rem}
details.note textarea{margin:.4rem 0;min-width:18rem}
.thread{list-style:none;margin:0;padding:0}
.thread>li{border:1px solid var(--line);background:var(--surface);border-radius:.5rem;padding:.8rem 1rem;margin-bottom:.6rem}
.thread .replies{list-style:none;margin:.6rem 0 0 1.2rem;padding:0 0 0 1rem;border-left:2px solid var(--line)}
.thread .replies li{padding:.5rem 0}
.thread .meta{font-size:.86rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
.thread .text{white-space:pre-wrap;word-break:break-word;margin:.3rem 0}
.settings-tabs{margin-bottom:1rem}
.settings{background:var(--surface);border:1px solid var(--line);padding:1rem 1.2rem;border-radius:.5rem;margin-bottom:1rem;max-width:56rem}
fieldset{border:0;margin:0;padding:0}
legend{font-weight:700;font-size:1.05rem;margin-bottom:.4rem}
.field{margin:.8rem 0}.field>label,.label{display:block;font-weight:650;margin:.4rem 0 .25rem}
.field.check{display:grid;grid-template-columns:auto 1fr;column-gap:.6rem;align-items:baseline}
.field.check label{font-weight:650;margin:0}.field.check .hint{grid-column:2;margin:.1rem 0 0}
.hint{font-size:.85rem;margin:.25rem 0 0}
.chart{margin:0}
.bars{display:flex;align-items:flex-end;gap:3px;height:140px;padding:.4rem;background:var(--bg);border:1px solid var(--line);border-radius:.4rem}
.bar{flex:1;min-width:3px;height:max(2px,var(--h));background:var(--accent);border-radius:2px 2px 0 0;opacity:.9}
.chart figcaption{display:flex;justify-content:space-between;gap:.5rem;font-size:.8rem;color:var(--muted);margin-top:.3rem}
.big{font-size:2.2rem;font-weight:750;color:#fff;font-variant-numeric:tabular-nums}
.confirm{max-width:48rem}
.confirm ul{margin:.6rem 0 1rem}
@media (max-width:820px){.shell{grid-template-columns:1fr}.side{border-right:0;border-bottom:1px solid var(--line);padding:.3rem 0}.side ul{display:flex;flex-wrap:wrap}.side .group,.side hr{display:none}.side a{border-left:0;border-bottom:3px solid transparent;padding:.45rem .7rem}.side a[aria-current=page]{border-bottom-color:var(--accent)}main{padding:1rem}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

export function layout(
  title: string,
  path: string,
  admin: Admin,
  badges: Badges,
  notice: string,
  content: string,
) {
  const active = (href: string) =>
    href === '/admin/manage'
      ? path === href
      : path === href || path.startsWith(`${href}/`);
  const nav = menu
    .map(
      ([group, items]) =>
        `${group ? `<li class="group" aria-hidden="true">${group}</li>` : ''}${items
          .map(([href, label, key]) => {
            const count = key ? badges[key] : 0;
            return `<li><a href="${href}"${active(href) ? ' aria-current="page"' : ''}>${label}${count ? ` <span class="badge" aria-label="${count} mục cần xử lý">${count}</span>` : ''}</a></li>`;
          })
          .join('')}`,
    )
    .join('');
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f5b545">
<link rel="icon" href="${favicon}">
<title>${escape(title)} · Quản trị ChiloLab</title>
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">Bỏ qua tới nội dung</a>
<header class="topbar"><div class="mode">QUẢN TRỊ <span>chilolab.com · chỉ chủ site thấy trang này</span></div><div class="who"><a href="/">Xem website ↗</a><span>${escape(admin.name)}</span>${admin.userId !== null ? `<form method="post" action="/admin/manage/logout"><button>Đăng xuất</button></form>` : ''}</div></header>
<div class="shell">
<nav class="side" aria-label="Quản trị"><ul>${nav}</ul><hr><ul><li><a href="/admin/">Nội dung dự án (CMS)</a></li><li><a href="/user/account">Tài khoản của tôi</a></li></ul></nav>
<main id="main" tabindex="-1">
${notice}
${content}
</main>
</div>
</body>
</html>`;
}

export const htmlHeaders = {
  ...baseHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Robots-Tag': 'noindex, nofollow',
};

/** One CSV cell; formula-looking text is prefixed so spreadsheets show it as text. */
const cell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function csv(name: string, headings: string[], rows: Row[]) {
  const lines = [
    headings.join(','),
    ...rows.map((row) => headings.map((key) => cell(row[key])).join(',')),
  ];
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      ...baseHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="chilolab-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
