# Cloudflare và domain Porkbun

## Trạng thái

Cloudflare là hosting Nguyễn Tấn Phát lựa chọn. Chưa kết nối tài khoản, tạo Pages project, đẩy Portfolio lên GitHub, mua domain hoặc thay DNS. Đây là quy trình chuẩn bị, không xác nhận website đã online.

## Cloudflare Pages

Mục tiêu đợt đầu: GitHub public + Pages Free, Markdown là nguồn nội dung. Không cần WordPress hoặc dịch vụ trả phí. Theo tài liệu kiểm tra ngày 2026-11-05, Pages Free có 500 builds/tháng và giới hạn 25 MiB mỗi asset; video Pet hiện nhỏ hơn 1 MiB. GitHub Actions dùng standard Ubuntu runner cho repo public; không dùng larger runner hoặc lưu artifact dài hạn.

Trước khi tạo repo public, đọc [PUBLIC-REPO.md](PUBLIC-REPO.md). Máy hiện chưa có GitHub CLI; chưa xác minh quyền tài khoản GitHub/Cloudflare. Tên repo đề xuất: `chilolab-portfolio`, không phải repo đã tồn tại.

Astro hiện xuất static; không cần adapter SSR hoặc WordPress để chạy.

1. Đưa riêng Portfolio lên GitHub. Không dùng repo Pet-Computer làm repo portfolio.
2. Tạo Pages project với Git integration, chọn repo Portfolio.
3. Production branch: main. Root directory: thư mục chứa package.json; để trống nếu ở repo root.
4. Build command: npm run verify. Output directory: dist.
5. Node 24 bản patch hiện hành; .nvmrc đã khai báo 24. Chưa cần secret cho bản static.
6. Kiểm tra URL pages.dev: cả hai ngôn ngữ, trang dự án, 404, redirect viết hoa và header bảo mật.

public/_redirects và public/_headers được copy vào dist để Pages xử lý tài nguyên static. Dashboard + Git integration không cần Wrangler. GitHub Actions hiện kiểm tra source, chưa tự deployment.

Canonical và sitemap nhắm domain đích https://chilolab.com; chưa có nghĩa domain đã hoạt động. URL preview không phải production canonical.

## Sau khi mua domain ở Porkbun

1. Thêm chilolab.com thành zone trong Cloudflare.
2. Tại Porkbun, đổi nameserver sang đúng nameserver Cloudflare cấp.
3. Chờ zone active.
4. Trong Pages project → Custom domains → thêm chilolab.com; làm theo hướng dẫn DNS/certificate.
5. Nếu dùng www.chilolab.com, thêm hostname đó vào custom domains và cấu hình redirect về apex.
6. Xác minh HTTPS, trang Việt–Anh, /PageSpeed-Auth-Auditor → 301 về lowercase, headers, robots và sitemap.

Domain vẫn đăng ký/gia hạn ở Porkbun; đổi nameserver chuyển nơi quản lý DNS. Apex domain của Pages cần zone trong tài khoản Cloudflare chứa project. Luôn thêm custom domain qua Pages trước, không chỉ tạo CNAME thủ công.

## WordPress sau này

cms.chilolab.com là hostname đề xuất, chưa tạo vì chưa có origin. Không trỏ vào Pages. Chọn hosting PHP/database, TLS và REST endpoint trước khi nối loader và publish webhook.

## Tài liệu

- https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/redirects/
- https://developers.cloudflare.com/pages/configuration/headers/
