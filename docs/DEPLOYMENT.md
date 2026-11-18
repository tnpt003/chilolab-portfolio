# Cloudflare và domain Porkbun

## Trạng thái

Website chạy trên https://chilolab.com (Worker `chilolab-portfolio`, repo GitHub `tnpt003/chilolab-portfolio`). Domain mua ở Porkbun, DNS do Cloudflare quản lý; địa chỉ `workers.dev` đã tắt. Hướng dẫn dựng lại từng bước: [SETUP-CLOUDFLARE-EMAIL.md](SETUP-CLOUDFLARE-EMAIL.md).

## Cloudflare Worker

Chọn Worker thay vì Pages: site là static nên chi phí và tính năng tương đương; Cloudflare ưu tiên Workers cho project mới, và sau này có thể thêm API nhỏ (ví dụ OAuth cho Sveltia CMS) trong cùng Worker. Không cần WordPress hoặc dịch vụ trả phí.

Cấu hình nằm trong `wrangler.jsonc`: phục vụ `./dist`, trả `404.html` cho đường dẫn không tồn tại, bỏ dấu `/` cuối (khớp `trailingSlash: 'never'` của Astro). Worker script (`worker/`) chỉ chạy cho `/api/*` và `/manage*` với D1, xem [DATABASE.md](DATABASE.md); `public/_redirects` và `public/_headers` áp dụng cho static assets.

Workers Builds (dashboard → chilolab-portfolio → Settings → Build):

1. Git repository: `tnpt003/chilolab-portfolio`, production branch `main`. Root directory: để trống.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
3. Node theo `.nvmrc` (24). Chưa cần secret cho bản static.
4. Mỗi lần push lên `main` sẽ build và deploy. GitHub Actions (`ci.yml`) chạy `npm run verify` song song; nó không deploy.
5. Sau deploy, kiểm tra: cả hai ngôn ngữ, trang dự án, 404, redirect viết hoa và header bảo mật.

Thử cấu hình Worker trên máy, không cần đăng nhập: `npm run build` rồi `npx wrangler dev`. Deploy tay (`npx wrangler deploy`) cần `wrangler login` với tài khoản Cloudflare của chủ sở hữu.

Canonical và sitemap nhắm domain đích https://chilolab.com; URL workers.dev không phải production canonical.

## Sau khi mua domain ở Porkbun

1. Thêm chilolab.com thành zone trong Cloudflare.
2. Tại Porkbun, đổi nameserver sang đúng nameserver Cloudflare cấp.
3. Chờ zone active.
4. Worker chilolab-portfolio → Settings → Domains & Routes → thêm Custom domain chilolab.com; Cloudflare tự tạo DNS record và certificate.
5. Nếu dùng www.chilolab.com, thêm hostname đó và cấu hình redirect về apex.
6. Xác minh HTTPS, trang Việt–Anh, /PageSpeed-Auth-Auditor → 301 về lowercase, headers, robots và sitemap.

Domain vẫn đăng ký/gia hạn ở Porkbun; đổi nameserver chuyển nơi quản lý DNS.

## WordPress sau này

cms.chilolab.com là hostname đề xuất, chưa tạo vì chưa có origin. Không trỏ vào Worker của portfolio. Chọn hosting PHP/database, TLS và REST endpoint trước khi nối loader và publish webhook.

## Tài liệu

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/routing/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
