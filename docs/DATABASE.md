# Dữ liệu người dùng (Cloudflare D1)

Thiết lập Cloudflare, Google, Resend, Email Routing từng bước: [SETUP-CLOUDFLARE-EMAIL.md](SETUP-CLOUDFLARE-EMAIL.md).

Nội dung do chủ site viết (dự án, phiên bản) vẫn là Markdown và sửa qua CMS ([CMS.md](CMS.md)). D1 chỉ chứa dữ liệu **khách truy cập** tạo ra:

| Tính năng                | Bảng                                                    | Ở đâu                                                          |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------- |
| Tài khoản khách (Google) | `users`, `sessions`                                     | `/user/login`, `/user/account` (`/user` → `/user/login`)       |
| Bình luận theo luồng     | `comments`                                              | Mỗi trang phiên bản; trang dự án gộp tất cả                    |
| Góp ý / báo lỗi          | `feedback`                                              | `/<dự-án>/feedback`; đọc ở `/admin/manage/feedback`            |
| Lượt bấm tải             | `downloads`                                             | Chỉ ở `/admin/manage/downloads`; một bộ đếm mỗi file mỗi ngày  |
| Nhật ký quản trị         | `admin_log`                                             | `/admin/manage/log` (chỉ chủ site)                             |
| Cài đặt site             | `settings`                                              | `/admin/manage/settings` (chỉ chủ site)                        |
| Email báo bản mới        | `subscriptions`, `release_notices`, `notice_deliveries` | Chọn ở `/user/account#updates`; gửi ở `/admin/manage/releases` |
| Báo lỗi app (đang tắt)   | `crash_reports`                                         | `POST /api/crash-reports`; đọc ở `/admin/manage/crashes`       |

Không lưu IP, user agent hay mật khẩu Google. Chính sách công khai: `/privacy`.

## Bình luận

- Cần đăng nhập. Trả lời một cấp; trả lời một phản hồi sẽ vào cùng luồng kèm `@tên`.
- Trang dự án hiện bình luận của mọi phiên bản + của chính nó, có nhãn `vX.Y.Z`. 10 luồng/trang; mỗi luồng hiện 3 phản hồi, còn lại sau nút "Xem thêm".
- Sửa: hiện nhãn "đã sửa", kiểm duyệt lại. Xóa: không có phản hồi → xóa hẳn; có phản hồi → còn dòng "đã bị xóa", nội dung bị xóa khỏi D1. Gỡ từ `/admin/manage` → "đã bị quản trị viên gỡ".
- Xóa tài khoản: xóa phiên, tài khoản, mọi phản hồi và nội dung bình luận của người đó (theo quy tắc trên).
- Kiểm duyệt (`worker/moderation.ts`): danh sách từ (khớp nguyên từ) rồi model `@cf/aisingapore/gemma-sea-lion-v4-27b-it` trên Workers AI. Bị gắn cờ → `held`: chỉ người viết thấy, chủ site duyệt ở `/admin/manage`. Chê sản phẩm / báo lỗi không bị giữ. AI lỗi hoặc hết quota → vẫn hiện, gắn lý do `unchecked`.
- Bình luận bị giữ được báo qua email cho chủ site (xem mục Email), và hiện ở `/admin/manage`.

## Chủ site (owner)

- Cột `users.role` (`member` | `owner`), chỉ đặt bằng SQL, không có API nào đổi được:
  `npx wrangler d1 execute chilolab --remote --command "UPDATE users SET role = 'owner' WHERE email = '<email>'"` (đăng nhập Google một lần trước để có tài khoản).
- Owner có nhãn "Tác giả", không qua AI kiểm duyệt, thấy bình luận đang bị giữ ngay trong danh sách và có nút Duyệt / Gỡ cho mọi bình luận.

## Trang quản trị (`/admin/manage`)

Đăng nhập ở `/user/login` bằng tài khoản owner (Google hoặc mã email) rồi mở `/admin/manage`. Chưa đăng nhập → chuyển tới `/user/login?return=/admin/manage`; tài khoản thường → 403. Địa chỉ cũ `/manage…` chuyển hướng 301 sang `/admin/manage…`. (`/admin` vẫn là Sveltia CMS.)

Giao diện cố ý khác hẳn trang khách: nền tối, điểm nhấn hổ phách, thanh "QUẢN TRỊ" cố định, favicon và tiêu đề tab riêng (`worker/manage-ui.ts`). Khi owner xem website, một dải "Chế độ chủ site" màu hổ phách hiện trên cùng với số việc đang chờ; khách không thấy (xem mục Bảo mật).

| Trang                          | Làm gì                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `/admin/manage`                | Tổng quan: việc chờ, số liệu, lượt tải GitHub, biểu đồ bấm tải 30 ngày, hoạt động quản trị gần đây                         |
| `/admin/manage/comments`       | Chờ duyệt / Đang hiện / Tất cả; lọc theo dự án, phiên bản, lý do, nội dung; chọn nhiều để Cho hiện / Gỡ                    |
| `/admin/manage/comments/<id>`  | Cả luồng bình luận; duyệt, gỡ, trả lời dưới tên owner                                                                      |
| `/admin/manage/feedback`       | Chưa xử lý / Đang xử lý / Đã xử lý; lọc dự án, loại; đổi trạng thái hàng loạt; ghi chú nội bộ; xóa                         |
| `/admin/manage/users`          | Danh sách, tìm kiếm, tab Đã khóa                                                                                           |
| `/admin/manage/users/<id>`     | Thông tin, bình luận, góp ý của một người; đăng xuất mọi nơi, khóa / mở khóa, xóa (không áp dụng cho owner)                |
| `/admin/manage/releases`       | Email báo bản mới: số người đăng ký mỗi dự án, gửi email cho một bản đã phát hành, xem tiến độ, dừng gửi                   |
| `/admin/manage/crashes`        | Báo lỗi app: chưa xem / đã xem, lọc dự án, xem stack trace, xóa                                                            |
| `/admin/manage/downloads`      | Lượt tải thật từ GitHub Releases và lượt bấm tải trên site (theo phiên bản, 30 ngày)                                       |
| `/admin/manage/settings?tab=…` | Tab Bình luận (bật/tắt, kiểm duyệt, từ chặn, độ dài tối đa, số bình luận/giờ), Góp ý, Tài khoản, Email thông báo           |
| `/admin/manage/log`            | Nhật ký quản trị (bảng `admin_log`): ai làm gì, lúc nào; không lưu IP; tự xóa sau một năm                                  |
| `/admin/manage/status`         | Dịch vụ đã cấu hình (Google, Resend, Turnstile, GitHub) và migration D1 đã chạy chưa                                       |
| `/admin/manage/export/*.csv`   | Tải CSV bình luận, góp ý, lượt bấm tải để tự backup (ô bắt đầu bằng `= + - @` được thêm `'` để Excel không chạy công thức) |

Thao tác xóa / gỡ / khóa luôn qua trang xác nhận liệt kê các mục bị ảnh hưởng. Thao tác hàng loạt tối đa 100 mục mỗi lần.

Cài đặt (`worker/settings.ts`, bảng `settings`): thiếu dòng hoặc chưa chạy migration → dùng mặc định (mọi thứ bật, kiểm duyệt AI, 2000 ký tự, không giới hạn theo giờ, email báo bình luận bị giữ bật, email báo góp ý tắt). Kiểm duyệt "Giữ tất cả" gắn lý do `manual`; từ bị chặn thêm gắn lý do `blocked`. Tắt "tài khoản mới" thì Google và mã email đều từ chối email chưa có tài khoản (`registration_closed`). Giới hạn độ dài và số bình luận/giờ không áp dụng cho owner (lỗi API: `too_long`, `hourly_limit`).

Khóa tài khoản (`users.blocked_at`): xóa mọi phiên, đăng nhập bị từ chối (`blocked`), phiên cũ không còn hợp lệ; bình luận và góp ý vẫn giữ. Owner không khóa hay xóa được từ trang quản trị, và quyền owner chỉ đặt bằng lệnh SQL ở trên.

## Email báo bản mới

- Chỉ người đã đăng nhập mới đăng ký được (email đã được Google hoặc mã 6 số xác minh), ở `/user/account#updates`: mỗi dự án một ô chọn, lưu ngay. Trang dự án có link "Nhận email khi có bản mới" tới đó. Ngôn ngữ email là ngôn ngữ của trang lúc chọn.
- Chủ site gửi ở `/admin/manage/releases`: chỉ bản `status: released`, không nháp (đọc từ `/releases.json`, tạo lúc build). Một bản chỉ gửi được một lần (`release_notices` có `UNIQUE (project, version)`).
- Gửi qua Resend batch API, mỗi người một email riêng, tối đa **80 email/ngày** (`NOTICE_DAILY` trong `worker/releases.ts`; 20 còn lại của hạn mức 100/ngày để dành cho mã đăng nhập và cảnh báo). Phần còn lại được cron 02:00 gửi tiếp hôm sau. `notice_deliveries` ghi ai đã nhận, nên gửi lại không bị trùng; bảng này tự xóa 30 ngày sau khi gửi xong.
- Mỗi email có link `/user/unsubscribe#<token>` (token sau dấu `#` nên không vào log hay thống kê) và header `List-Unsubscribe` + `List-Unsubscribe-Post` để Gmail/Outlook hiện nút hủy một chạm (`POST /api/subscriptions/unsubscribe?token=…`). Token chỉ hủy được đúng một đăng ký, không đăng nhập được.
- Xóa tài khoản (tự xóa hoặc chủ site xóa) xóa luôn đăng ký. Tài khoản bị khóa không nhận email.

## Báo lỗi app

Phía server đã có, **đang tắt** (setting `crashReports`). Giao thức cho app, điều kiện để bật và bản nháp cho /privacy + EULA: [CRASH-REPORTS.md](CRASH-REPORTS.md).

## Lượt tải công khai (GitHub)

Trang dự án Pet Desktop và trang chủ hiện số lượt tải, lấy từ `/api/downloads/stats?project=pet-desktop` (`worker/github.ts`): tổng `download_count` của `PetComputer-win-Setup.exe` và `PetComputer-win-Portable.zip` trong mọi release của `tnpt003/Pet-Computer`. File cập nhật tự động (`.nupkg`, `RELEASES`) không tính. GitHub API không cần token (60 lượt/giờ mỗi IP) nên kết quả được cache 1 phút; GitHub lỗi thì dùng số cũ (giữ tối đa 7 ngày). Trang tự lấy lại số mỗi phút khi đang mở. Đổi tên file hay repo phát hành thì sửa `sources` trong `worker/github.ts`.

## Bảo mật

- Worker chỉ chạy cho `/api/*`, `/admin/manage*`, `/manage*` (chỉ để chuyển hướng), `/user`, `/en/user`; trang khác là file tĩnh.
- Dải "Chế độ chủ site": `/admin/manage` và `/api/me` đặt cookie đọc được `__Host-chilolab_admin=1` cho owner; website chỉ gọi `/api/me` khi có cookie này và chỉ hiện dải khi API trả `owner: true`. Cookie không cấp quyền gì; đăng xuất hoặc tài khoản không phải owner sẽ xóa nó.
- `/admin/manage` chỉ mở khi có phiên đăng nhập của tài khoản `role = 'owner'` (hoặc `ADMIN_DEV_BYPASS=1` trên localhost). Ngoài ra luôn từ chối. Cloudflare Access đã bỏ ngày 2026-11-25. Mọi thao tác ghi là form POST cùng origin; trang không có JavaScript.
- Ai chiếm được hộp thư hoặc tài khoản Google của owner sẽ vào được trang quản trị: bật xác minh 2 bước cho cả hai. Đây là lớp khóa duy nhất từ khi bỏ Cloudflare Access.
- Mọi request ghi phải cùng origin; body ≤ 16 KB; nội dung luôn hiển thị dạng text.
- Phiên: cookie `__Host-chilolab_session` (HttpOnly, Secure, SameSite=Lax); D1 chỉ giữ SHA-256 của token. Khách: 30 ngày. Owner: 7 ngày (`OWNER_DAYS` trong `worker/session.ts`), tính từ lúc đăng nhập và kiểm ở mỗi request, nên cả phiên owner cũ hơn 7 ngày cũng hết hiệu lực; hết hạn thì đăng nhập lại ở `/user/login`.
- Google: OAuth code flow + PKCE + `state`; kiểm `iss`, `aud`, `exp`, `email_verified`.
- `WRITE_LIMIT`: 10 lần ghi/phút mỗi tài khoản hoặc IP (bộ lọc thô). Góp ý ẩn danh còn có Turnstile.
- Không có mật khẩu: khách đăng nhập bằng Google hoặc mã 6 số qua email. (Băm mật khẩu đủ mạnh vượt giới hạn 10 ms CPU của gói Free.) Cột `users.password_hash` để trống.

## Chạy trên máy

```sh
cp .dev.vars.example .dev.vars   # Turnstile test secret + mở /admin/manage trên localhost
npm run db:migrate:local
npm run dev:worker               # build rồi chạy Worker ở http://localhost:8787
```

Đăng nhập Google trên máy cần `GOOGLE_CLIENT_SECRET` trong `.dev.vars` và redirect URI `http://localhost:8787/api/auth/google/callback` trong Google Cloud. Bản build production dùng Turnstile site key thật, không chạy trên localhost; muốn thử form góp ý thì build với `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`. Workers AI luôn gọi lên Cloudflare (tính vào quota miễn phí).

## Triển khai thay đổi schema

Thêm file mới trong `migrations/`, không sửa file cũ. Áp dụng **ngay trước** khi push code dùng schema mới:

```sh
npm run db:migrate:remote
```

Migration `0007_releases_crashes.sql` (email bản mới, báo lỗi app) cần chạy trước khi deploy code ngày 2026-11-26; `/admin/manage/status` cho biết đã chạy chưa.

## Cấu hình Cloudflare đã làm

- D1 `chilolab`, `TURNSTILE_SECRET`, Turnstile site key trong `.env.production`.
- Cloudflare Access cho trang quản trị: đã bỏ (2026-11-25). Code không còn kiểm JWT Access; application cũ cho path `manage` cần xóa trong Zero Trust.
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

## Bảo trì tự động (cron)

Worker chạy `worker/maintenance.ts` mỗi ngày lúc 19:00 UTC (02:00 giờ Việt Nam), khai báo ở `triggers.crons` trong `wrangler.jsonc`. Xem log ở Cloudflare dashboard → Worker → Logs (dòng `cleanup` và `backup`).

- **Dọn dữ liệu (mỗi ngày):** xóa phiên đăng nhập hết hạn, phiên owner quá 7 ngày, mã email hết hạn và nhật ký quản trị quá một năm.
- **Backup (mỗi Chủ nhật UTC, tức sáng thứ Hai giờ Việt Nam):** chép mọi bảng trừ `sessions` và `email_codes` thành một file JSON nén `d1/chilolab-YYYY-MM-DD.json.gz` trong bucket R2 riêng tư `chilolab-backups`, giữ 12 bản gần nhất (khoảng 3 tháng). Chưa gắn bucket thì bước này tự bỏ qua.
- **Email cảnh báo:** khi bước dọn dữ liệu hoặc backup báo lỗi, khi backup bị bỏ qua, hoặc khi (kiểm tra mỗi thứ Ba UTC) bản backup mới nhất đã quá 8 ngày, Worker gửi một email qua Resend tới tài khoản owner. Lần kiểm tra thứ Ba bắt được cả trường hợp cron Chủ nhật không chạy. Chưa có `RESEND_API_KEY` thì chỉ ghi log `maintenance alert`.

### Bật backup tự động (một lần; đã làm 2026-11-26)

1. Cloudflare dashboard → **R2** → bật R2. Gói miễn phí: 10 GB lưu trữ; Cloudflare có thể yêu cầu thêm phương thức thanh toán khi bật R2, dù không vượt mức miễn phí thì không bị tính tiền.
2. Tạo bucket riêng tư: `npx wrangler r2 bucket create chilolab-backups`. Không bật public access cho bucket này.
3. Trong `wrangler.jsonc`, bỏ dấu `//` ở dòng `"r2_buckets"`, commit và push.

### Khôi phục

1. Tải file backup: dashboard → R2 → `chilolab-backups` → `d1/`, hoặc `npx wrangler r2 object get chilolab-backups/d1/<tên-file> --remote --file backup.json.gz`.
2. `node scripts/restore-backup.mjs backup.json.gz > restore.sql`
3. Thử trước trên máy: `npx wrangler d1 execute chilolab --local --file restore.sql`.
4. Áp lên server: `npx wrangler d1 execute chilolab --remote --file restore.sql`. Lệnh này thay toàn bộ dữ liệu các bảng có trong backup; mọi người phải đăng nhập lại.

Database phải có đủ migration trước khi khôi phục. D1 còn có Time Travel (khôi phục cả database về một thời điểm trong 30 ngày gần nhất): `npx wrangler d1 time-travel restore chilolab --timestamp <ISO>`.

### Backup thủ công

```sh
npx wrangler d1 export chilolab --remote --output backup.sql
```

Không commit file backup hay `restore.sql`: chúng chứa email và nội dung khách gửi.

## Giới hạn

D1, Workers, Workers AI (10.000 neuron/ngày), Turnstile đều có gói miễn phí. Xem [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
