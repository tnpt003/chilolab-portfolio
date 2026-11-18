# Dữ liệu người dùng (Cloudflare D1)

Nội dung do chủ site viết (dự án, phiên bản) vẫn là Markdown và sửa qua CMS ([CMS.md](CMS.md)). D1 chỉ chứa dữ liệu **khách truy cập** tạo ra:

| Tính năng                | Bảng                | Ở đâu                                                    |
| ------------------------ | ------------------- | -------------------------------------------------------- |
| Tài khoản khách (Google) | `users`, `sessions` | `/user/login`, `/user/account` (`/user` → `/user/login`) |
| Bình luận theo luồng     | `comments`          | Mỗi trang phiên bản; trang dự án gộp tất cả              |
| Góp ý / báo lỗi          | `feedback`          | `/<dự-án>/feedback`; chỉ đọc ở `/manage`                 |
| Lượt bấm tải             | `downloads`         | Chỉ ở `/manage`; một bộ đếm mỗi file mỗi ngày            |

Không lưu IP, user agent hay mật khẩu Google. Chính sách công khai: `/privacy`.

## Bình luận

- Cần đăng nhập. Trả lời một cấp; trả lời một phản hồi sẽ vào cùng luồng kèm `@tên`.
- Trang dự án hiện bình luận của mọi phiên bản + của chính nó, có nhãn `vX.Y.Z`. 10 luồng/trang; mỗi luồng hiện 3 phản hồi, còn lại sau nút "Xem thêm".
- Sửa: hiện nhãn "đã sửa", kiểm duyệt lại. Xóa: không có phản hồi → xóa hẳn; có phản hồi → còn dòng "đã bị xóa", nội dung bị xóa khỏi D1. Gỡ từ `/manage` → "đã bị quản trị viên gỡ".
- Xóa tài khoản: xóa phiên, tài khoản, mọi phản hồi và nội dung bình luận của người đó (theo quy tắc trên).
- Kiểm duyệt (`worker/moderation.ts`): danh sách từ (khớp nguyên từ) rồi model `@cf/aisingapore/gemma-sea-lion-v4-27b-it` trên Workers AI. Bị gắn cờ → `held`: chỉ người viết thấy, chủ site duyệt ở `/manage`. Chê sản phẩm / báo lỗi không bị giữ. AI lỗi hoặc hết quota → vẫn hiện, gắn lý do `unchecked`.
- Bình luận bị giữ được báo qua email cho chủ site (xem mục Email), và hiện ở `/manage`.

## Chủ site (owner)

- Cột `users.role` (`member` | `owner`), chỉ đặt bằng SQL, không có API nào đổi được:
  `npx wrangler d1 execute chilolab --remote --command "UPDATE users SET role = 'owner' WHERE email = '<email>'"` (đăng nhập Google một lần trước để có tài khoản).
- Owner có nhãn "Tác giả", không qua AI kiểm duyệt, thấy bình luận đang bị giữ ngay trong danh sách và có nút Duyệt / Gỡ cho mọi bình luận. `/manage` vẫn là nơi xem góp ý và lượt tải.

## Bảo mật

- Worker chỉ chạy cho `/api/*`, `/manage*`, `/user`, `/en/user`; trang khác là file tĩnh.
- Mọi request ghi phải cùng origin; body ≤ 16 KB; nội dung luôn hiển thị dạng text.
- Phiên: cookie `__Host-chilolab_session` (HttpOnly, Secure, SameSite=Lax, 30 ngày); D1 chỉ giữ SHA-256 của token.
- Google: OAuth code flow + PKCE + `state`; kiểm `iss`, `aud`, `exp`, `email_verified`.
- `WRITE_LIMIT`: 10 lần ghi/phút mỗi tài khoản hoặc IP (bộ lọc thô). Góp ý ẩn danh còn có Turnstile.
- `/manage` sau Cloudflare Access + Worker tự kiểm JWT; thiếu cấu hình thì từ chối hết.
- Không có mật khẩu: khách đăng nhập bằng Google hoặc mã 6 số qua email. (Băm mật khẩu đủ mạnh vượt giới hạn 10 ms CPU của gói Free.) Cột `users.password_hash` để trống.

## Chạy trên máy

```sh
cp .dev.vars.example .dev.vars   # Turnstile test secret + mở /manage trên localhost
npm run db:migrate:local
npm run dev:worker               # build rồi chạy Worker ở http://localhost:8787
```

Đăng nhập Google trên máy cần `GOOGLE_CLIENT_SECRET` trong `.dev.vars` và redirect URI `http://localhost:8787/api/auth/google/callback` trong Google Cloud. Bản build production dùng Turnstile site key thật, không chạy trên localhost; muốn thử form góp ý thì build với `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`. Workers AI luôn gọi lên Cloudflare (tính vào quota miễn phí).

## Triển khai thay đổi schema

Thêm file mới trong `migrations/`, không sửa file cũ. Áp dụng **ngay trước** khi push code dùng schema mới:

```sh
npm run db:migrate:remote
```

## Cấu hình Cloudflare đã làm

- D1 `chilolab`, `TURNSTILE_SECRET`, Turnstile site key trong `.env.production`.
- Access cho `/manage` (team `bold-night-e762.cloudflareaccess.com`).
- Workers AI, rate limit `WRITE_LIMIT`, Workers Logs (`observability`) trong `wrangler.jsonc`.

## Google sign-in (làm một lần)

1. https://console.cloud.google.com → tạo project `ChiloLab`.
2. **Google Auth Platform → Branding**: tên app ChiloLab, email hỗ trợ; trang chủ `https://chilolab-portfolio.tnpt003.workers.dev`; chính sách `…/privacy`; authorized domain `tnpt003.workers.dev`.
3. **Audience**: External → **Publish app** (chỉ dùng scope cơ bản `openid email profile`).
4. **Clients → Create client → Web application**. Authorized redirect URIs:
   - `https://chilolab-portfolio.tnpt003.workers.dev/api/auth/google/callback`
   - `http://localhost:8787/api/auth/google/callback`
5. Client ID → `GOOGLE_CLIENT_ID` trong `wrangler.jsonc` (công khai). Client secret → Worker secret `GOOGLE_CLIENT_SECRET` (Dashboard → Variables and Secrets → Secret). Không commit secret.
6. Khi có `chilolab.com`: thêm redirect URI và authorized domain mới.

## Email (Resend + Cloudflare Email Routing)

- **Gửi mail** qua Resend (`worker/mail.ts`): mã đăng nhập 6 số cho khách và thông báo cho chủ site khi có bình luận bị giữ (gửi tới email của tài khoản có `role = 'owner'`, không ghi email vào code). Gói free của Resend: 100 mail/ngày, 3.000 mail/tháng.
- **Đăng nhập bằng email** (`worker/email-login.ts`): không mật khẩu. Gửi mã cần Turnstile, tối đa 1 mã/phút và 5 mã/giờ cho mỗi địa chỉ; mã lưu dạng SHA-256, hết hạn 10 phút, 5 lần nhập sai thì khóa. Cùng email với tài khoản Google → cùng một tài khoản.
- Thiếu secret `RESEND_API_KEY` → tùy chọn email tự ẩn, thông báo không gửi; mọi thứ khác vẫn chạy.
- Người gửi: biến `MAIL_FROM` trong `wrangler.jsonc` (`ChiloLab <no-reply@chilolab.com>`).

Thiết lập Resend (một lần):

1. Tạo tài khoản tại https://resend.com → **Domains → Add Domain** → `chilolab.com`.
2. Thêm các bản ghi DNS Resend đưa ra (DKIM `resend._domainkey`, MX + TXT cho `send`) vào Cloudflare DNS, để **DNS only** (mây xám). Chờ Resend báo **Verified**.
3. **API Keys → Create** (quyền _Sending access_, domain `chilolab.com`), rồi `npx wrangler secret put RESEND_API_KEY`.

Email liên hệ `contact@chilolab.com` dùng **Cloudflare Email Routing** (miễn phí, chỉ chuyển tiếp thư đến): Dashboard → `chilolab.com` → **Email → Email Routing** → bật, xác minh địa chỉ đích, thêm quy tắc `contact@` → địa chỉ đích. Email Routing dùng MX ở apex; Resend dùng subdomain `send`, nên hai bên không đụng nhau.

## Sao lưu

```sh
npx wrangler d1 export chilolab --remote --output backup.sql
```

Không commit file backup: chúng chứa email và nội dung khách gửi.

## Giới hạn

D1, Workers, Workers AI (10.000 neuron/ngày), Turnstile, Access đều có gói miễn phí. Xem [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
