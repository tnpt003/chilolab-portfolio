import { sha256, type Env } from './env';
import { notifyOwner, sendMail } from './mail';
import { readCookie, SESSION_COOKIE } from './session';

// Sign-in watch (docs/DATABASE.md, "Bảo vệ đăng nhập"):
// - countAuth(): hourly counters of sign-in events in D1 (auth_stats), with
//   no email, account or IP. When one kind reaches its alert level within an
//   hour, the owner gets one email.
// - alertOwnerSignIn(): every new session on an owner account emails that
//   account, so a stolen sign-in does not go unnoticed.
// Counting never blocks a sign-in: if D1 or Resend fails, it only logs.

export type AuthEvent =
  | 'code_sent'
  | 'code_wrong'
  | 'code_locked'
  | 'turnstile_failed'
  | 'signin_email'
  | 'signin_google'
  | 'google_failed'
  | 'signup'
  | 'owner_email_refused';

/** Events in one UTC hour that send the owner one alert email. */
export const ALERT_AT: Partial<Record<AuthEvent, number>> = {
  code_wrong: 20,
  code_locked: 5,
  turnstile_failed: 30,
  google_failed: 20,
  signup: 20,
  owner_email_refused: 3,
};

export const authLabels: Record<AuthEvent, string> = {
  code_sent: 'Mã email đã gửi',
  code_wrong: 'Nhập sai mã email',
  code_locked: 'Mã bị khóa (sai 5 lần)',
  turnstile_failed: 'Không qua Turnstile',
  signin_email: 'Đăng nhập bằng mã email',
  signin_google: 'Đăng nhập bằng Google',
  google_failed: 'Đăng nhập Google thất bại',
  signup: 'Tài khoản mới',
  owner_email_refused: 'Thử đăng nhập chủ site bằng email',
};

const hourOf = (time = Date.now()) => new Date(time).toISOString().slice(0, 13);

export async function countAuth(env: Env, kind: AuthEvent) {
  try {
    const row = await env.DB.prepare(
      `INSERT INTO auth_stats (hour, kind, count) VALUES (?, ?, 1)
       ON CONFLICT (hour, kind) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
      .bind(hourOf(), kind)
      .first<{ count: number }>();
    const limit = ALERT_AT[kind];
    if (limit && Number(row?.count) === limit)
      await notifyOwner(env, '[ChiloLab] Bất thường ở trang đăng nhập', [
        `Trong giờ này (UTC) đã có ${limit} lần "${authLabels[kind]}". Có thể ai đó đang dò mã hoặc tạo tài khoản hàng loạt.`,
        'Các lớp chặn vẫn đang chạy: Turnstile, giới hạn mỗi IP và mỗi email, mã khóa sau 5 lần sai. Không cần làm gì nếu số này không tăng tiếp.',
        'Xem số liệu theo giờ tại https://chilolab.com/admin/manage/status#auth. Nếu cần, tắt đăng ký mới ở Cài đặt → Tài khoản, hoặc bật thêm luật chặn trong Cloudflare (docs/DATABASE.md, mục "Bảo vệ đăng nhập").',
      ]);
  } catch (error) {
    console.error('auth stats', error);
  }
}

/** Emails an owner account that it was just signed in to. */
export async function alertOwnerSignIn(
  env: Env,
  request: Request,
  email: string,
) {
  try {
    const cf = (request as { cf?: { country?: string; city?: string } }).cf;
    const place = [cf?.city, cf?.country].filter(Boolean).join(', ');
    const browser = request.headers.get('User-Agent')?.slice(0, 200);
    const time = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    await sendMail(
      env,
      email,
      '[ChiloLab] Có phiên đăng nhập mới vào tài khoản chủ site',
      [
        `Tài khoản chủ site vừa đăng nhập bằng Google lúc ${time} (giờ Việt Nam)${place ? `, từ ${place}` : ''}.`,
        ...(browser ? [`Trình duyệt: ${browser}`] : []),
        'Nếu là bạn thì không cần làm gì.',
        'Nếu không phải bạn: đổi mật khẩu Google và xem lại xác minh 2 bước, rồi mở https://chilolab.com/admin/manage/status#sessions và bấm "Đăng xuất mọi thiết bị khác". Nếu không vào được trang quản trị, xem docs/DATABASE.md, mục "Bảo vệ đăng nhập".',
      ],
    );
  } catch (error) {
    console.error('owner sign-in alert', error);
  }
}

/** Hash of the session token this request carries, if any. */
export async function sessionHash(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  return token && token.length <= 100 ? sha256(token) : null;
}
