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
- Thông báo qua email về bình luận bị giữ **chưa có**: cần domain riêng (và có thể gói Workers Paid) để gửi mail. Hiện xem ở `/manage` (số đỏ cạnh "Bị giữ chờ duyệt").

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
- Email + mật khẩu **chưa làm**: gói Free giới hạn 10 ms CPU/request, không đủ để băm mật khẩu đủ mạnh (PBKDF2 100k vòng ≈ 12,7 ms trên máy dev); quên mật khẩu cần gửi email. Làm khi có domain + Workers Paid. Cột `users.password_hash` đã có sẵn.

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

## Sao lưu

```sh
npx wrangler d1 export chilolab --remote --output backup.sql
```

Không commit file backup: chúng chứa email và nội dung khách gửi.

## Giới hạn

D1, Workers, Workers AI (10.000 neuron/ngày), Turnstile, Access đều có gói miễn phí. Xem [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
