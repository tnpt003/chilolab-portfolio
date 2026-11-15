# Đăng bài phiên bản sản phẩm

Mỗi sản phẩm có trang danh sách và từng bài riêng:

- `/pet-desktop/versions` và `/pet-desktop/versions/1.5.0`.
- `/pagespeed-auth-auditor/versions` và `/pagespeed-auth-auditor/versions/1.2.0`.
- Bản tiếng Anh thêm `/en` ở đầu đường dẫn. Nút ngôn ngữ giữ đúng bài phiên bản.

## Tạo bài mới

Cách dễ nhất là dùng CMS tại `/admin/index.html` (xem [CMS.md](CMS.md)). Hoặc tạo file ở `src/content/versions/vi/<project>/<version>.md` và bản dịch ở thư mục `en` tương ứng. Dùng bài đang có làm mẫu. Không cần sửa route hay giao diện.

```yaml
---
project: pet-desktop
version: 1.5.1
locale: vi
title: Tiêu đề bản cập nhật
summary: Mô tả ngắn bản này tập trung vào điều gì.
status: development
order: 151
draft: true
---
```

Đặt nội dung Markdown sau frontmatter. Một bài nên giải thích bản này dành cho ai, thay đổi gì, sửa lỗi gì, cách cập nhật và các giới hạn đã biết. Không cần dùng mọi mục nếu không có thay đổi tương ứng.

## Trạng thái

- `development`: đang phát triển hoặc mới có bản local.
- `preview`: xem trước, chưa phải bản chính thức.
- `released`: đã xác minh phát hành; có thể thêm `releasedAt: "2026-11-05"` (ví dụ định dạng, không phải ngày phát hành thật), `downloadUrl` (bộ cài) và `portableUrl` (bản .zip, tùy chọn) trỏ đúng bản này. Bản `released` mới nhất có `downloadUrl` được hiển thị ở khối Tải xuống của trang sản phẩm.
- `draft: true`: ẩn bài khỏi trang và sitemap. Để `false` hoặc bỏ trường khi muốn công khai bài. Trạng thái sản phẩm khác trạng thái bài viết: bài preview có thể công khai dù phần mềm chưa phát hành.

Chỉ bản `released` được khai báo ngày phát hành và link tải. Không dùng URL `releases/latest` cho bài cũ vì link đó thay đổi theo thời gian. `sourceUrl` là tùy chọn, trỏ tới changelog/tài liệu công khai.

`order` lớn hơn xuất hiện trước. Giữ project, version, status, order và releasedAt giống nhau giữa hai bản dịch. Build báo lỗi nếu thiếu bản dịch công khai hoặc project không tồn tại. Không dùng ngày ước đoán.

## Bài được tạo ban đầu

- Pet 1.4.0–1.5.0: tóm tắt release notes trên GitHub Releases (1.4.0 không có ghi chú release nên tóm tắt từ CHANGELOG tại tag v1.5.0). Ngày phát hành lấy theo tiêu đề CHANGELOG; link tải trỏ đúng asset của từng tag, đã kiểm tra tồn tại ngày 2026-11-12.
- Auditor 1.2.0: dựa trên package.json, README và docs/RELEASE-GUIDE.md local. Không công bố đường dẫn máy hay nội dung riêng tư lên bài web; không gán ngày hoặc link tải chưa xác minh.

Sau khi sửa, chạy `npm.cmd run format`, `npm.cmd run verify` và `npm.cmd run test:browser`, rồi xem lại bài trước khi push. Danh sách phiên bản trên trang sản phẩm tự hiển thị ba bài mới nhất theo order.
