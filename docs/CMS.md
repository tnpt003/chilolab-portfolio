# Quản lý nội dung bằng CMS

ChiloLab dùng [Sveltia CMS](https://sveltiacms.app/), một CMS miễn phí chạy trên Git. CMS chỉ là giao diện soạn thảo: nó đọc và ghi đúng các file Markdown trong `src/content/`, nên không cần database, hosting CMS hay tài khoản trả phí. Markdown vẫn là nguồn nội dung chính thức.

- Trang quản trị: `public/admin/index.html` → `/admin/index.html`.
- Cấu hình: `public/admin/config.yml` (các collection, trường, gợi ý nhập liệu).
- Script CMS được ghim phiên bản `0.264.0` kèm mã SRI. Trang admin có `noindex` và bị chặn trong `robots.txt`.

## Cách dùng trên máy (không cần đăng nhập)

Cần trình duyệt Chromium (Chrome, Edge). Firefox/Safari không hỗ trợ chế độ này.

1. Trong thư mục Portfolio chạy `npm.cmd run dev`.
2. Mở `http://localhost:4321/admin/index.html`.
3. Bấm **Work with Local Repository**, chọn thư mục `Portfolio` và cho phép sửa file.
4. Soạn hoặc sửa nội dung rồi bấm Save. CMS ghi thẳng vào file Markdown; xem kết quả ở tab website đang chạy dev.
5. Kiểm tra (`npm.cmd run format`, `npm.cmd run verify`), xem diff rồi tự commit/push bằng Git.

Sau khi đổi `config.yml` hoặc pull thay đổi mới, tải lại trang CMS.

## Đăng phiên bản mới cho Pet Desktop

1. Mở **Pet Desktop — Phiên bản (VI)** → New. Điền phiên bản (ví dụ `1.5.1`), tiêu đề, tóm tắt, trạng thái, thứ tự (`151`) và nội dung.
2. Mở **Pet Desktop — Versions (EN)** và tạo bản dịch cùng phiên bản. Giữ trạng thái, thứ tự và ngày phát hành giống hệt bản tiếng Việt. Build sẽ báo lỗi nếu thiếu bản dịch hoặc dữ liệu lệch nhau.
3. Khi bản đã thật sự lên GitHub Releases: chọn **Đã phát hành**, nhập ngày phát hành thật, link Setup.exe và Portable theo đúng tag, ví dụ:
   - `https://github.com/tnpt003/Pet-Computer/releases/download/v1.5.1/PetComputer-win-Setup.exe`
   - `https://github.com/tnpt003/Pet-Computer/releases/download/v1.5.1/PetComputer-win-Portable.zip`
4. Khối **Tải xuống** trên `/pet-desktop` tự lấy bản đã phát hành mới nhất có link tải; không cần sửa trang dự án.

Chưa muốn công khai thì bật **Nháp**. Muốn viết trước về bản đang làm thì chọn **Đang phát triển** hoặc **Xem trước** và để trống ngày/link tải. Chi tiết quy tắc ở [VERSIONS.md](VERSIONS.md).

## Sửa trang dự án

Collection **Dự án (VI)** và **Projects (EN)** sửa mô tả, ảnh, video và nội dung `/pet-desktop`. Ảnh tải lên được lưu vào `src/assets/`. Tạo dự án mới vẫn làm bằng file (xem [EDITING.md](EDITING.md)) vì cần thêm loại minh họa trong code.

## Dùng CMS online sau khi triển khai (chưa thiết lập)

Repo Portfolio chưa có trên GitHub, nên `backend.repo` trong `config.yml` đang là giá trị giữ chỗ. Khi đã push repo:

1. Đổi `repo:` thành `<owner>/<tên-repo>` thật.
2. Cách đơn giản, miễn phí: tại `/admin/index.html` bấm **Sign In Using Access Token**, dùng GitHub fine-grained token chỉ cấp cho repo Portfolio với quyền Contents: Read and write. Token chỉ lưu trong trình duyệt; không đưa vào mã nguồn.
3. Muốn có nút "Sign In with GitHub": triển khai [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) trên Cloudflare Workers (gói miễn phí) và đặt `base_url`. Bước này cần tạo GitHub OAuth App và tài khoản Cloudflare, nên chỉ làm khi chủ sở hữu quyết định.

Mỗi lần Save ở chế độ online, CMS tạo một commit lên GitHub; CI và Cloudflare Pages sẽ build lại website.

## Nâng cấp phiên bản CMS

Đổi số phiên bản trong `src` của `public/admin/index.html`, tính lại SRI rồi thay giá trị `integrity`:

```sh
curl -sL https://unpkg.com/@sveltia/cms@<phiên-bản>/dist/sveltia-cms.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Cập nhật cả URL schema ở dòng đầu `config.yml`.
