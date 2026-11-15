# Chuẩn bị GitHub public

Repo dự kiến: `tnpt003/chilolab-portfolio`. Chưa tạo hoặc push repo online.

## Đã chuẩn bị

- Git local nhánh main; lockfile npm; CI dùng standard Ubuntu runner.
- .gitignore loại node_modules, dist, .setup, .env và browser reports.
- Skill có giấy phép/nguồn gốc. Media Pet có ghi chú bản quyền riêng trong public/media/CREDITS.md.
- Không copy source Auditor, báo cáo QA hoặc phiên đăng nhập vào portfolio.

## Trước lần push đầu

Chạy `git status --short` và `git ls-files --cached`. Nếu chưa stage thì lệnh thứ hai trống. Chỉ stage source và tài liệu dự định công khai; không dùng force-add cho file đang bị ignore. Tài liệu hiện có tên chủ sở hữu, GitHub và đường dẫn workspace đã cung cấp; đường dẫn local không được nhúng vào nội dung trang công khai.

Chưa đặt giấy phép cho toàn bộ source portfolio vì chủ sở hữu chưa chọn. Public repository cho phép đọc source, không tự động cấp giấy phép MIT cho toàn bộ repo. Không áp giấy phép của skill lên source riêng.

## Kết nối

Nếu không có GitHub CLI, tạo empty repository tên chilolab-portfolio ở github.com/new, chọn Public và không thêm README/gitignore/license vì project đã có. Sau đó dùng Git/GitHub Desktop hoặc CLI đã xác thực để add remote, commit và push main. Không gửi token hoặc mật khẩu vào chat.

Sau khi repo tồn tại, kết nối Cloudflare Pages theo DEPLOYMENT.md. Không cần nâng cấp gói hoặc mua domain trước khi xem bản pages.dev.
