# CMS và lộ trình mở rộng ChiloLab

## Quyết định hiện tại: ưu tiên miễn phí

Chủ sở hữu đã chọn hướng free-first và chấp nhận GitHub public. Đợt đầu dùng Markdown trong repo để quản lý nội dung, GitHub Actions để kiểm tra và Cloudflare Worker (static assets) để phục vụ website. WordPress được hoãn; phần đánh giá bên dưới chỉ dành cho tương lai, không phải bước bắt buộc trước khi ra mắt.

Không cần mua hosting CMS, database hoặc plugin. Domain là khoản đăng ký/gia hạn riêng; có thể dùng workers.dev trước. Các gói miễn phí có giới hạn và cần kiểm tra lại khi triển khai: [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) và [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## CMS đang dùng: Sveltia CMS (git-based, miễn phí)

Giao diện soạn thảo tại `/admin/index.html`, ghi trực tiếp vào Markdown trong repo. Không cần hosting, database hay tài khoản trả phí; chạy local không cần đăng nhập. Hướng dẫn: [CMS.md](CMS.md). WordPress bên dưới vẫn là phương án tương lai nếu cần media library lớn hoặc nhiều người viết.

## Đã xác nhận

- Chủ sở hữu: Nguyễn Tấn Phát.
- Frontend: Astro static + TypeScript, song ngữ Việt–Anh.
- Hosting: Cloudflare Worker với static assets cho bản static hiện tại.
- Domain: dự kiến mua chilolab.com tại Porkbun sau setup; chưa mua hoặc cấu hình DNS.
- CMS đang nghiêng về WordPress; chưa cài đặt hay kết nối.

## Đánh giá WordPress

WordPress phù hợp nếu muốn soạn nội dung trực quan, quản lý media và viết bài thường xuyên. Với hai dự án, Markdown hiện có chi phí vận hành thấp hơn. Nhu cầu mở rộng sau này vẫn là lý do hợp lý để chuẩn bị WordPress.

Hướng đề xuất: **WordPress headless + Astro static trên Cloudflare Worker**. WordPress quản lý nội dung; Astro lấy dữ liệu khi build và kiểm soát giao diện. Theme hoặc Elementor không trực tiếp thiết kế giao diện Astro.

```text
Porkbun: đăng ký và gia hạn domain
Cloudflare DNS: DNS sau khi đổi nameserver
chilolab.com: Astro static trên Cloudflare Pages
cms.chilolab.com: WordPress trên hosting PHP + database riêng
WordPress publish → deploy webhook → Astro build → website mới
```

Đây là kiến trúc dự kiến, hostname và webhook chưa được tạo. Website tiếp tục phục vụ bản build đã triển khai khi CMS ngừng hoạt động; build mới phụ thuộc CMS có thể thất bại và cần giữ bản triển khai trước.

WordPress truyền thống cần PHP và MySQL/MariaDB. Không đưa WordPress admin vào dist hoặc coi Pages là hosting PHP. Cloudflare có hướng dẫn xuất WordPress thành static; đó là phương án khác với Astro headless.

## Các đánh đổi

- Hosting WordPress riêng; cập nhật core/plugin, backup database/media và quản lý quyền.
- Publish cần kích hoạt build trước khi nội dung xuất hiện trên website.
- Preview bản nháp cần xác thực riêng; preview WordPress không tự trở thành preview Astro.
- Cần chọn giải pháp ghép bản dịch Việt–Anh và xác minh REST API; chưa chọn plugin đa ngôn ngữ.
- HTML/block Gutenberg cần renderer, lọc HTML an toàn và style phù hợp bên Astro.
- Form, tìm kiếm động và plugin tương tác không tự hoạt động trên frontend static.

## Lộ trình

### Đợt 1: hoàn thiện portfolio

Giữ Markdown có schema và các cặp ngôn ngữ. Thêm media thật, thông tin phát hành, kiểm tra mobile/accessibility và triển khai thử trên pages.dev trước khi mua domain.

Pet: bản phát hành ở https://github.com/tnpt003/Pet-desktop-share (source private từ 21/11/2026). Preview 1.5, cần đối chiếu release notes khi mô tả bản tải xuống. Auditor ở C:/Project VS/PageSpeed-Auth-Auditor, chưa lên GitHub theo chủ sở hữu. Không công khai .env, báo cáo QA hoặc dữ liệu phiên đăng nhập.

### Đợt 2: thử WordPress

1. Chọn hosting phù hợp ngân sách hoặc thử local trước.
2. Tạo loại nội dung Project: slug, locale, title, description, nội dung, order, draft, ảnh/alt text và repo/demo/download URL.
3. Bắt đầu với REST API; thêm GraphQL chỉ khi cần. Chọn cách ghép bản dịch trước khi nhập nội dung.
4. Thử một dự án đủ hai ngôn ngữ, media, draft và đổi slug.
5. Kiểm tra preview, publish webhook; giữ URL webhook trong cấu hình bí mật phía máy chủ.

### Đợt 3: chuyển nguồn dữ liệu

Thay loader ở src/content.config.ts và lớp truy cập src/lib/content.ts, giữ hợp đồng dữ liệu cho components. Chuyển renderer Markdown sang renderer WordPress; không chỉ đổi URL API.

Không âm thầm trộn CMS với Markdown khi API lỗi. Cần timeout, phân trang, schema validation, kiểm tra cặp bản dịch và chính sách build lỗi. Khi ổn định, chọn một nguồn nội dung chính thức.

## Trước khi ra mắt

- Hoàn thiện biography và liên hệ nếu muốn công khai.
- Thay minh họa bằng media thật, duyệt bản dịch và social preview.
- Triển khai theo [DEPLOYMENT.md](DEPLOYMENT.md), rồi mua domain và kiểm tra DNS, HTTPS, canonical, redirect.
- CMS cần thử backup/restore, draft, quyền, webhook và build lỗi trước khi dùng chính thức.

## Tài liệu chính thức

- [Astro + WordPress](https://docs.astro.build/en/guides/cms/wordpress/)
- [WordPress REST API](https://developer.wordpress.org/rest-api/)
- [Yêu cầu hosting WordPress](https://wordpress.org/about/requirements/)
- [Cloudflare: WordPress static export](https://developers.cloudflare.com/pages/how-to/deploy-a-wordpress-site/)
