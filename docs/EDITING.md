# Chỉnh nội dung ChiloLab

## Chạy trên máy

Mở terminal trong Portfolio và chạy `npm.cmd run dev`, rồi mở địa chỉ localhost được in ra. Chỉnh file, lưu và xem lại trình duyệt. Dừng bằng Ctrl+C.

## Sửa dự án

- Tiếng Việt: `src/content/projects/vi/`.
- Tiếng Anh: `src/content/projects/en/`.
- Giữ cùng slug cho hai bản dịch; tên thư mục đã phân biệt ngôn ngữ.
- Phần giữa hai dòng `---` là dữ liệu; bên dưới là nội dung bài viết.
- `draft: true` ẩn dự án. Luôn đặt cả hai bản dịch ở cùng trạng thái draft.
- `repoUrl`, `demoUrl`, `downloadUrl` là tùy chọn; bỏ hẳn dòng nếu chưa có link thật.

## Thêm ảnh/video

Ảnh đặt trong `src/assets/`. Trường preview có image (đường dẫn tương đối từ file Markdown), alt (mô tả ảnh theo ngôn ngữ), caption (chú thích). Xem Pet Desktop làm ví dụ. Astro tạo WebP nhiều kích thước khi build.

Video MP4 đặt trong `public/media/`, khai báo `video: /media/ten-video.mp4`. Giữ tên chỉ gồm chữ thường, số và dấu gạch ngang. Video hiển thị có điều khiển, không tự phát. Hiện nội dung chú thích video dành cho Pet Desktop; nếu thêm video cho dự án khác, cần mở rộng schema với caption/label riêng.

Không dùng screenshot chứa tài khoản khách hàng, kết quả audit riêng hoặc thông tin đăng nhập. Ghi nguồn và phiên bản sản phẩm trong chú thích.

## Thêm dự án

Copy một file đang có vào cả hai thư mục ngôn ngữ. Đổi slug, title, description, order và nội dung. `kind` hiện có pet/auditor; muốn có chủ đề thứ ba cần mở rộng schema và visual fallback trước. Có ảnh preview thật thì ảnh được ưu tiên.

## Sửa trang chủ

Nội dung giao diện và giới thiệu nằm trong `src/lib/content.ts`; sửa cả vi/en. Màu nằm trong `src/styles/tokens.css`. Không cần sửa layout để đổi mô tả dự án.

## Kiểm tra và xuất bản

1. `npm.cmd run format`.
2. `npm.cmd run verify`.
3. `npm.cmd run test:browser` nếu đã cài Chromium bằng `npx.cmd playwright install chromium`.
4. Xem lại cả bản Việt/Anh và màn hình điện thoại.
5. Sau khi đã kết nối GitHub và Cloudflare, commit/push sẽ kích hoạt CI và build Pages.

Có thể chỉnh Markdown ngay trên GitHub. Khi commit, CI và Cloudflare vẫn kiểm tra/build lại. Website có thể chưa cập nhật ngay vì phải chờ build thành công.
