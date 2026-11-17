# Dữ liệu người dùng (Cloudflare D1)

Nội dung do chủ site viết (dự án, phiên bản) vẫn là Markdown và sửa qua CMS ([CMS.md](CMS.md)). D1 chỉ chứa dữ liệu **khách truy cập** tạo ra:

| Tính năng       | Bảng        | Hiển thị                                      |
| --------------- | ----------- | --------------------------------------------- |
| Góp ý / báo lỗi | `feedback`  | Chỉ ở `/manage`                               |
| Bình luận       | `comments`  | Công khai sau khi duyệt ở `/manage`           |
| Lượt bấm tải    | `downloads` | Chỉ ở `/manage`; một bộ đếm mỗi file mỗi ngày |

Không lưu IP, user agent hay cookie. Email liên hệ trong góp ý là tùy chọn.

## Kiến trúc

- `worker/index.ts` chỉ chạy cho `/api/*` và `/manage*` (`run_worker_first` trong `wrangler.jsonc`); mọi trang khác vẫn là file tĩnh.
- `/allowlist.json` sinh lúc build từ nội dung Markdown; API chỉ nhận dự án và phiên bản có trong đó.
- Bình luận và góp ý được Cloudflare Turnstile chống spam. Script Turnstile chỉ tải khi khách bắt đầu điền form.
- Mọi POST phải cùng origin; body tối đa 16 KB; nội dung luôn được hiển thị dạng text (không HTML).
- `/manage` được Cloudflare Access chặn; Worker còn tự kiểm chữ ký JWT của Access và **từ chối mọi truy cập** khi chưa cấu hình `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`.
- Schema ở `migrations/`. Thay đổi schema = thêm file migration mới, không sửa file cũ.

## Chạy trên máy

```sh
cp .dev.vars.example .dev.vars   # secret thử nghiệm của Turnstile + mở /manage trên localhost
npm run db:migrate:local
npm run dev:worker               # build rồi chạy Worker ở http://localhost:8787
```

`/manage` mở được trên localhost nhờ `ADMIN_DEV_BYPASS=1` trong `.dev.vars` (chỉ có tác dụng với hostname localhost/127.0.0.1). `npm run dev` (Astro) không có API: phần bình luận sẽ báo chưa tải được, điều này là bình thường.

## Bật trên Cloudflare (làm một lần)

Làm xong các bước 1–4 **trước** khi merge vào `main`; nếu không, Workers Builds sẽ deploy thất bại vì `database_id` còn là giá trị giữ chỗ.

1. **Tạo database**
   ```sh
   npx wrangler login
   npx wrangler d1 create chilolab
   ```
   Chép `database_id` được in ra vào `wrangler.jsonc`, rồi:
   ```sh
   npm run db:migrate:remote
   ```
2. **Turnstile** — Dashboard → Turnstile → Add widget. Hostname: `chilolab-portfolio.tnpt003.workers.dev` (thêm `chilolab.com` khi có domain), mode Managed.
   - Secret key: `npx wrangler secret put TURNSTILE_SECRET` rồi dán vào.
   - Site key (công khai) nằm trong `.env.production`, được commit. `npm run dev` không đọc file này nên vẫn dùng key thử nghiệm.
3. **Cloudflare Access cho `/manage`** — Zero Trust → Access → Applications → Add → Self-hosted.
   - Domain `chilolab-portfolio.tnpt003.workers.dev`, path `manage`. Thêm một dòng tương tự cho `chilolab.com` khi có domain.
   - Policy: Allow, Include → Emails → email của bạn. Login method: One-time PIN.
   - Chép **Application Audience (AUD) Tag** vào `ACCESS_AUD` và team domain (`<team>.cloudflareaccess.com`, xem ở Zero Trust → Settings) vào `ACCESS_TEAM_DOMAIN` trong `wrangler.jsonc`. Hai giá trị này không phải bí mật.
   - Gói Zero Trust Free có thể yêu cầu thêm phương thức thanh toán khi đăng ký dù không tính phí; kiểm tra trước khi xác nhận.
4. **Deploy** — commit `wrangler.jsonc`, merge vào `main`. Sau deploy: gửi thử một bình luận, mở `/manage` (Access sẽ hỏi email + mã PIN), duyệt bình luận và xem nó hiện trên trang dự án.

Khi thêm migration mới: chạy `npm run db:migrate:remote` trước khi push code dùng schema mới.

## Giới hạn và chi phí

D1, Workers, Turnstile và Access đều có gói miễn phí; trang tĩnh không tính vào lượt gọi Worker. Xem giới hạn hiện hành tại [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) và [Access pricing](https://www.cloudflare.com/plans/zero-trust-services/).

Lượt bấm tải là số lần bấm nút trên site (không đếm tải trực tiếp từ GitHub, không loại trùng); dùng để xem xu hướng, không phải số người dùng chính xác.

## Sao lưu

```sh
npx wrangler d1 export chilolab --remote --output backup.sql
```

Không commit file backup: chúng chứa nội dung và email khách gửi.
