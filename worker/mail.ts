import type { Env } from './env';

// Outgoing email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// RESEND_API_KEY is a Worker secret; without it, email features stay off.

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

export const mailEnabled = (env: Env) => Boolean(env.RESEND_API_KEY);

export async function sendMail(
  env: Env,
  to: string,
  subject: string,
  lines: string[],
) {
  if (!env.RESEND_API_KEY) return false;
  const html = `<div style="font:15px/1.6 system-ui,sans-serif;color:#184b58">${lines
    .map((line) => `<p>${escape(line).replace(/\n/g, '<br>')}</p>`)
    .join('')}</div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject,
      text: lines.join('\n\n'),
      html,
    }),
  });
  if (!response.ok)
    console.error('mail failed', response.status, await response.text());
  return response.ok;
}

/** Emails the site owner (users.role = 'owner'); false if not sent. */
export async function notifyOwner(env: Env, subject: string, lines: string[]) {
  const owner = await env.DB.prepare(
    "SELECT email FROM users WHERE role = 'owner' LIMIT 1",
  ).first<{ email: string }>();
  if (!owner) return false;
  return sendMail(env, owner.email, subject, lines);
}

/** Tells the site owner (users.role = 'owner') about a held comment. */
export async function notifyHeld(
  env: Env,
  origin: string,
  comment: {
    project: string;
    version: string | null;
    author: string;
    body: string;
    reason: string;
  },
) {
  const owner = await env.DB.prepare(
    "SELECT email FROM users WHERE role = 'owner' LIMIT 1",
  ).first<{ email: string }>();
  if (!owner) return;
  const page = comment.version
    ? `${origin}/${comment.project}/versions/${comment.version}#comments`
    : `${origin}/${comment.project}#comments`;
  await sendMail(
    env,
    owner.email,
    `[ChiloLab] Bình luận bị giữ (${comment.reason})`,
    [
      `${comment.author} vừa viết một bình luận bị giữ lại (lý do: ${comment.reason}).`,
      comment.body.slice(0, 600),
      `Trang: ${page}`,
      `Duyệt hoặc gỡ ngay trong trang (khi đăng nhập bằng tài khoản Tác giả) hoặc tại ${origin}/admin/manage`,
    ],
  );
}

/** Tells the site owner about new feedback (setting: notifyFeedback). */
export async function notifyFeedback(
  env: Env,
  origin: string,
  feedback: { project: string; kind: string; summary: string; message: string },
) {
  const owner = await env.DB.prepare(
    "SELECT email FROM users WHERE role = 'owner' LIMIT 1",
  ).first<{ email: string }>();
  if (!owner) return;
  await sendMail(
    env,
    owner.email,
    `[ChiloLab] Góp ý mới: ${feedback.summary.slice(0, 80)}`,
    [
      `Góp ý mới cho ${feedback.project} (loại: ${feedback.kind}).`,
      feedback.message.slice(0, 1200),
      `Xử lý tại ${origin}/admin/manage/feedback`,
    ],
  );
}
