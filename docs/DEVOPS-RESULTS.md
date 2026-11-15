# Kết quả chạy mẫu DevOps lab

Thực hiện ngày 2026-11-05 (Asia/Saigon) trên máy Windows của workspace, với Docker Desktop Linux engine. Đây là kết quả chạy local bởi trợ lý trong phiên làm việc; chủ sở hữu nên tự thực hành lại và giải thích từng bước trước khi dùng làm bằng chứng kỹ năng.

| Bước                 | Kết quả quan sát                                                         |
| -------------------- | ------------------------------------------------------------------------ |
| Kiểm tra engine      | Docker báo OSType linux, có Compose                                      |
| Build lab-v1         | npm ci, Astro/TypeScript và build 15 trang đạt trong Linux               |
| Deploy lab-v1        | Compose báo Healthy; smoke xác nhận release=lab-v1                       |
| Runtime              | uid=101(nginx), nginx -t đạt                                             |
| Build/deploy lab-v2  | Healthy; smoke xác nhận release=lab-v2                                   |
| Cố ý lỗi healthcheck | Override trả false; up --wait exit 1; container unhealthy                |
| Rollback             | Chạy lại base Compose với lab-v1; Healthy, smoke xác nhận release=lab-v1 |
| Dọn lab              | Container và network riêng đã được xóa, giữ hai image local để thực hành |

Smoke kiểm tra health, các trang chính và trang phiên bản, HTTP 404 thật và redirect 301. Filesystem read-only và các giới hạn runtime được khai báo trong Compose; không có claim đã audit toàn diện bảo mật.

## Sự cố gặp khi setup

Lần build đầu timeout TLS khi lấy Dockerfile frontend từ Docker Hub. Bỏ chỉ thị syntax không cần thiết và thử lại build; lần sau tải base images, cài dependency và build thành công. Không tắt xác minh TLS hoặc đổi sang registry không tin cậy.

## Những phần chưa được xác minh

- GitHub Actions chưa chạy online; workflow được chuẩn bị trong repo.
- Chưa có image registry, máy chủ production, external uptime alert hoặc tự động rollback.
- Bài lỗi mô phỏng healthcheck thất bại; không phải bằng chứng về một sự cố production.
- Hai release khác metadata để minh họa đổi phiên bản; chưa có thay đổi tính năng giữa v1 và v2.
- Base images dùng tag di động; pin digest và chính sách cập nhật là bước mở rộng tiếp theo.

Làm lại từng bước theo [DEVOPS-LAB.md](DEVOPS-LAB.md). Website public vẫn có hướng deploy Cloudflare Pages độc lập với lab container.
