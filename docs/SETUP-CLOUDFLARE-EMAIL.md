# Hướng dẫn dựng Cloudflare và email cho ChiloLab (từng bước)

Tài liệu này ghi lại toàn bộ cách đã dựng `chilolab.com` (tháng 11/2026), để làm lại từ đầu, chuyển sang tài khoản khác hoặc sửa khi có sự cố. Repo công khai: ở đây **chỉ ghi tên** secret và nơi lấy, **không bao giờ ghi giá trị** secret hay email cá nhân.

Tài liệu liên quan: [DATABASE.md](DATABASE.md) (dữ liệu, bình luận, bảo mật), [DEPLOYMENT.md](DEPLOYMENT.md), [CMS.md](CMS.md).

## 0. Tổng quan

```text
Porkbun ── đăng ký domain chilolab.com (gia hạn hằng năm)
   │ nameserver
Cloudflare (gói Free)
   ├─ DNS, HTTPS, chuyển www → apex, Web Analytics
   ├─ Worker "chilolab-portfolio": trang tĩnh + API (/api, /manage, /user)
   ├─ D1 "chilolab": tài khoản, bình luận, góp ý, lượt tải, mã đăng nhập
   ├─ Workers AI: kiểm duyệt bình luận
   ├─ Turnstile: chống spam
   ├─ Zero Trust Access: (tùy chọn) lớp khóa thêm cho /manage
   └─ Email Routing: nhận thư contact@chilolab.com → Gmail
Google Cloud ── "Tiếp tục với Google"
Resend ── GỬI mail: mã đăng nhập 6 số, báo bình luận bị giữ
GitHub ── code; push lên main = Cloudflare tự build và deploy
```

**Tài khoản cần có:** Cloudflare, Porkbun, Google Cloud, Resend, GitHub (tất cả dùng gói miễn phí; riêng domain trả tiền hằng năm).

**Công cụ trên máy:** Node theo `.nvmrc`, `npm ci`, rồi `npx wrangler login` (mở trình duyệt, bấm Allow). Kiểm tra: `npx wrangler whoami`.

## 1. Bảng giá trị hiện tại

| Thứ                    | Giá trị / nơi lưu                                                               | Bí mật?                  |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Worker                 | `chilolab-portfolio`                                                            | Không                    |
| Domain                 | `chilolab.com`, `www.chilolab.com` (khai báo ở `routes` trong `wrangler.jsonc`) | Không                    |
| D1                     | `chilolab`, id trong `wrangler.jsonc`                                           | Không                    |
| Turnstile site key     | `.env.production` → `PUBLIC_TURNSTILE_SITE_KEY`                                 | Không (công khai)        |
| `TURNSTILE_SECRET`     | Worker secret                                                                   | **Có**                   |
| Google Client ID       | `wrangler.jsonc` → `GOOGLE_CLIENT_ID`                                           | Không                    |
| `GOOGLE_CLIENT_SECRET` | Worker secret                                                                   | **Có**                   |
| `RESEND_API_KEY`       | Worker secret                                                                   | **Có**                   |
| Người gửi mail         | `wrangler.jsonc` → `MAIL_FROM` = `ChiloLab <no-reply@chilolab.com>`             | Không                    |
| Access team, AUD       | `wrangler.jsonc` → `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`                           | Không                    |
| Tài khoản chủ site     | D1 `users.role = 'owner'` (đặt bằng SQL, mục 11)                                | Email không ghi vào code |

Xem nhanh secret đang có (chỉ hiện tên): `npx wrangler secret list`.

## 2. Domain: Porkbun → Cloudflare

1. Porkbun: mua `chilolab.com`. **Không mua hosting** (bấm _Continue to Domain Management_). Giữ _Contact Privacy_ = "Using Privacy" để ẩn thông tin cá nhân khỏi WHOIS.
2. Cloudflare → **Account home → Onboard a domain** → `chilolab.com` → _Quick scan_ → gói **Free**.
3. Ở bảng DNS quét được: **xóa hết** bản ghi mặc định của Porkbun (A `207.207.210.x`, CNAME `*`/`www` → `uixie.porkbun.com`, MX `fwd*.porkbun.com`, TXT SPF, TXT `_acme-challenge`).
4. Cloudflare đưa 2 nameserver (lần này: `merlin.ns.cloudflare.com`, `zara.ns.cloudflare.com`).
5. Porkbun → domain → **Details**: kiểm tra **DNSSEC = OFF**; **NAMESERVERS** (bút chì) → xóa 4 nameserver Porkbun → dán 2 nameserver Cloudflare → _Submit_. **Không** bấm "Connect" ở mục _Your Cloudflare_.
6. Cloudflare → _I updated my nameservers_ → chờ trạng thái **Active** (vài phút – 24 giờ, có email báo).

## 3. Worker và tự động deploy

1. Cloudflare → **Workers & Pages → chilolab-portfolio → Settings → Build**: repo `tnpt003/chilolab-portfolio`, nhánh `main`, Build command `npm run build`, Deploy command `npx wrangler deploy`.
2. Gắn domain: đã khai báo trong `wrangler.jsonc`:
   ```jsonc
   "routes": [
     { "pattern": "chilolab.com", "custom_domain": true },
     { "pattern": "www.chilolab.com", "custom_domain": true },
   ],
   ```
   Lần deploy đầu, Cloudflare tự tạo bản ghi DNS và chứng chỉ HTTPS. Khi có `routes`, địa chỉ `*.workers.dev` tự tắt (trả 404) — đúng ý muốn.
3. Mọi lần `git push` lên `main` → Cloudflare build và deploy (1–2 phút). Xem ở tab **Deployments**.

## 4. HTTPS và www

1. `chilolab.com` → **SSL/TLS → Edge Certificates** → bật **Always Use HTTPS**.
2. **Rules → Redirect Rules → Create rule** → template **"Redirect from WWW to root"**: Request URL `https://www.*`, Target `https://${1}`, **301**, ✅ **Preserve query string** → _Deploy_.

## 5. Secret của Worker (đọc kỹ — lỗi hay gặp)

Secret phải nằm ở **runtime** của Worker, **không phải** mục _Build → Variables and secrets_ (mục đó chỉ dùng lúc build; Worker không thấy).

Cách chắc chắn nhất, trong terminal của bạn:

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret list          # kiểm tra: phải thấy đủ 3 tên
```

Hoặc dashboard: **Workers & Pages → chilolab-portfolio → Settings → Variables and Secrets** (khối trên cùng) → _Add_ → Type **Secret** → _Deploy_.

Secret giữ nguyên qua các lần deploy. **Không dán secret vào chat, issue, commit hay ảnh chụp.**

## 6. Database D1

```bash
npx wrangler d1 create chilolab        # chỉ khi dựng mới; chép database_id vào wrangler.jsonc
npm run db:migrate:remote              # áp dụng mọi file trong migrations/
```

Quy tắc: thay đổi schema = **thêm** file `migrations/000N_*.sql` (không sửa file cũ), chạy `npm run db:migrate:remote` **ngay trước** khi push code dùng schema đó. Sao lưu: `npx wrangler d1 export chilolab --remote --output backup.sql` (không commit file backup).

## 7. Turnstile (chống spam)

1. Cloudflare → **Turnstile → Add widget**: tên `ChiloLab`, mode **Managed**, pre-clearance **No**.
2. **Hostnames**: `chilolab.com` (thêm domain khác nếu site chạy ở đó).
3. Site key → `.env.production` (`PUBLIC_TURNSTILE_SITE_KEY=...`, được commit). Secret key → `npx wrangler secret put TURNSTILE_SECRET`.
4. Quên secret? Widget → **Settings → Rotate Secret Key**, rồi `secret put` lại.

## 8. Cloudflare Access cho `/manage` (tùy chọn)

Từ khi có trang quản trị, `/manage` mở bằng tài khoản chủ site đăng nhập ở `/user/login` (xem [DATABASE.md](DATABASE.md#trang-quản-trị-manage)). Access chỉ còn là lớp khóa thêm: nếu application Access cho `/manage` còn bật, bạn sẽ phải qua màn hình Access (mã PIN) **trước**, rồi mới tới trang quản trị. Muốn đăng nhập kiểu WordPress (chỉ `/user/login`), xóa application đó: **Zero Trust → Access controls → Applications → … → Delete**. Có thể để nguyên `ACCESS_*` trong `wrangler.jsonc`.

1. Cloudflare → **Zero Trust** (lần đầu: đặt team name, chọn gói Free).
2. **Access controls → Applications → Add → Self-hosted**.
3. **Destination / Public hostname**: Subdomain **để trống**, Domain `chilolab.com`, Path `manage`. (Lỗi đã gặp: ô subdomain còn sót `chilolab-portfolio` → Access bảo vệ nhầm `chilolab-portfolio.chilolab.com`.)
4. **Policy**: tên `Owner`, Action **Allow**, Include → **Emails** → chỉ email của bạn (không dùng "Everyone" hay "Emails ending in").
5. Login method: **One-time PIN** (mặc định với "Accept all available identity providers").
6. Lấy team domain và AUD rồi điền vào `wrangler.jsonc`. Cách nhanh không cần tìm trong dashboard:
   ```bash
   curl -s -o /dev/null -D - https://chilolab.com/manage | grep -i location
   # → https://<team>.cloudflareaccess.com/cdn-cgi/access/login/...?kid=<AUD>
   ```
7. Worker tự kiểm chữ ký Access; Access thiếu hoặc sai → chỉ tài khoản chủ site vào được `/manage`.

## 9. Đăng nhập Google

1. https://console.cloud.google.com → tạo project (`Chilolab`). Bỏ qua banner "Start free trial" — không cần thẻ.
2. **Google Auth Platform → Get started**: App name `ChiloLab`, email hỗ trợ, Audience **External**.
3. **Branding**: Home page `https://chilolab.com`, Privacy policy `https://chilolab.com/privacy`, Authorized domain `chilolab.com`.
4. **Audience → Publish app** (trạng thái **In production**; "Testing" chỉ cho email được thêm tay).
5. **Clients → Create client → Web application**, Authorized redirect URIs:
   - `https://chilolab.com/api/auth/google/callback`
   - `http://localhost:8787/api/auth/google/callback` (thử trên máy)
     Không cần "JavaScript origins"; không tick "AI-powered agent".
6. Client ID → `GOOGLE_CLIENT_ID` trong `wrangler.jsonc`. Client secret → `npx wrangler secret put GOOGLE_CLIENT_SECRET` (Google chỉ hiện secret lúc tạo; tải JSON dự phòng).
7. Đổi secret: Clients → client → **Add secret** → `secret put` secret mới → vô hiệu hóa secret cũ.
8. Lỗi `redirect_uri_mismatch`: URI phải khớp tuyệt đối; thay đổi có thể mất 5 phút – vài giờ.

## 10. Gửi mail bằng Resend

1. https://resend.com → tạo tài khoản (Free: 100 mail/ngày, 3.000 mail/tháng).
2. **Domains → Add Domain** → `chilolab.com`, region **Tokyo (ap-northeast-1)**.
3. **Auto configure** (đăng nhập Cloudflare, cho phép) hoặc **Manual setup**. Bản ghi cần có:
   | Loại                                                                                                   | Tên                 | Ghi chú          |
   | ------------------------------------------------------------------------------------------------------ | ------------------- | ---------------- |
   | TXT                                                                                                    | `resend._domainkey` | DKIM             |
   | MX + TXT (hoặc CNAME)                                                                                  | `send`              | Thư trả về + SPF |
   | **Không** thêm MX cho chính `chilolab.com` (Resend "receiving") — sẽ tranh với Email Routing ở mục 11. |
4. Chờ **Verified**.
5. **Domains → chilolab.com → Configuration**: _Enable tracking metrics_ **để tắt** (không theo dõi mở/click — khớp trang Quyền riêng tư); _TLS_ giữ **Opportunistic**.
6. **API keys → Create API key**: tên `chilolab-worker`, quyền **Sending access**, domain `chilolab.com` → copy key (chỉ hiện một lần) → `npx wrangler secret put RESEND_API_KEY`.
7. Kiểm tra: `curl -s https://chilolab.com/api/me` → `"email": true`. Trang `/user/login` hiện ô email.

### Gửi thêm loại mail mới từ code

Mọi mail đi qua `sendMail()` trong `worker/mail.ts`:

```ts
import { sendMail } from './mail';

await sendMail(env, 'nguoi-nhan@example.com', 'Tiêu đề', [
  'Đoạn thứ nhất.',
  'Đoạn thứ hai.',
]);
```

- Trả `false` (không ném lỗi) khi thiếu `RESEND_API_KEY` hoặc Resend báo lỗi; lỗi được ghi vào Workers Logs.
- Gửi trong request mà không bắt người dùng chờ: `ctx.waitUntil(sendMail(...))`.
- Người gửi lấy từ `MAIL_FROM`; địa chỉ phải thuộc domain đã Verified trong Resend.
- Gửi cho **chủ site**: đọc email từ `users` có `role = 'owner'` (xem `notifyHeld`), đừng ghi email vào code.
- Giới hạn gói Free: 100 mail/ngày. Mail hàng loạt (bản tin) **không** gửi bằng đường này — dùng tính năng Broadcasts/Audience của Resend và cần trang hủy đăng ký.
- Mail từ domain mới hay vào Spam/Quảng cáo lúc đầu; nên thêm DMARC: DNS → TXT `_dmarc` = `v=DMARC1; p=none;`.

## 11. Nhận mail: `contact@chilolab.com` (Email Routing)

1. Cloudflare → **Compute → Email Service → Email Routing → Onboard Domain** → `chilolab.com` → đồng ý thêm bản ghi (MX `route1/2/3.mx.cloudflare.net`, TXT SPF `include:_spf.mx.cloudflare.net`, có thể có DKIM `cf2024-1._domainkey`).
2. **Destination addresses** → thêm Gmail → bấm link xác minh trong mail → trạng thái **Verified**.
3. Domain `chilolab.com` → **Routing rules → Create routing rule**: Email pattern `contact` @ `chilolab.com`, Action **Send to an email**, Destination = Gmail đã xác minh → _Save_.
4. **Catch-all** để **Disabled** (thư tới địa chỉ khác bị từ chối, bớt spam).
5. Thử: gửi từ **một email khác** Gmail đích tới `contact@chilolab.com`; xem tab **Activity log**.
6. **Email Sending (Beta)** của Cloudflare là dịch vụ gửi cần Workers Paid — **không dùng**, đã dùng Resend.

## 12. Đánh dấu chủ site (nhãn "Tác giả", duyệt/gỡ bình luận tại chỗ)

Đăng nhập trên site một lần (Google hoặc email), rồi:

```bash
npx wrangler d1 execute chilolab --remote --command "UPDATE users SET role = 'owner' WHERE email = '<email của bạn>'"
```

Lệnh chạy trực tiếp trên database; email không vào code. Bỏ quyền: đặt lại `role = 'member'`.

## 13. Web Analytics

Cloudflare tự chèn script `static.cloudflareinsights.com/beacon.min.js` khi domain đi qua Cloudflare. CSP trong `public/_headers` đã cho phép `https://static.cloudflareinsights.com` (script) và `https://cloudflareinsights.com` (connect). Xem số liệu: `chilolab.com` → **Analytics & Logs → Web Analytics**. Muốn tắt: tắt _automatic setup_ ở đó (không cần sửa code). Bật thêm tính năng theo dõi khác → phải cập nhật trang `/privacy`.

## 14. Kiểm tra sau mỗi lần thay đổi

```bash
B=https://chilolab.com
curl -s -o /dev/null -w '%{http_code}\n' $B/                          # 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://chilolab.com/        # 301 → https
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.chilolab.com/x?a=1  # 301 → apex, giữ ?a=1
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $B/manage    # 302 → /user/login?return=%2Fmanage (hoặc cloudflareaccess.com nếu còn Access)
curl -s $B/api/me                                                     # providers google/email = true
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $B/user      # 301 → /user/login
npx wrangler secret list                                              # đủ 3 secret
```

Tra DNS công khai (ví dụ MX của apex):

```bash
curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=chilolab.com&type=MX'
```

## 15. Sự cố đã gặp và cách xử lý

| Triệu chứng                       | Nguyên nhân                                                     | Cách sửa                                                        |
| --------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Form góp ý luôn báo lỗi xác minh  | Secret đặt ở mục _Build_                                        | Đặt lại bằng `wrangler secret put` (mục 5)                      |
| `/admin` (CMS) trắng trang        | CSP chặn unpkg; `/admin/` bị đổi thành `/admin`                 | `public/_headers` có rule cho cả `/admin` và `/admin/*`         |
| Script trang bị chặn              | Astro nhúng script inline, CSP chặn                             | `astro.config.mjs`: `vite.build.assetsInlineLimit: 0`           |
| `/manage` trả 403 cho cả chủ site | Tài khoản chưa có `role = 'owner'`, hoặc Destination Access sai | DATABASE.md → Chủ site; mục 8 bước 3                            |
| Google `redirect_uri_mismatch`    | Thiếu URI hoặc chưa có hiệu lực                                 | Mục 9 bước 5, chờ vài phút                                      |
| Ô đăng nhập email không hiện      | Thiếu `RESEND_API_KEY`                                          | Mục 10 bước 6                                                   |
| Mã đăng nhập không tới            | Spam, hoặc Resend lỗi                                           | Xem Spam; Resend → **Logs**; Workers Logs có dòng `mail failed` |
| `contact@` không nhận             | Chưa xác minh Gmail, hoặc gửi từ chính Gmail đích               | Mục 11 bước 2 và 5                                              |
| Test local chạy bản cũ            | Còn tiến trình `wrangler dev` cũ giữ cổng                       | Dừng terminal cũ hoặc dùng `--port` khác                        |

## 16. Chi phí

| Mục                                                                                                                         | Chi phí                                       |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Domain `chilolab.com` (Porkbun)                                                                                             | Trả hằng năm (xem Porkbun → Renewal)          |
| Cloudflare Free: Workers, D1, Workers AI (10.000 neuron/ngày), Turnstile, Access (≤ 50 người), Email Routing, Web Analytics | 0                                             |
| Google OAuth                                                                                                                | 0                                             |
| Resend Free (100 mail/ngày)                                                                                                 | 0                                             |
| Workers Paid (chỉ nếu cần đăng nhập bằng mật khẩu hoặc vượt giới hạn Free)                                                  | 5 USD/tháng — cần quyết định rõ trước khi bật |
