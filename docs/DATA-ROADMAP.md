# Lộ trình dữ liệu dài hạn

Hướng mở rộng phần dữ liệu của ChiloLab (chủ site chọn ngày 2026-11-26). Mỗi giai đoạn chỉ bắt đầu khi có lý do ghi bên dưới; dịch vụ trả phí luôn cần chủ site quyết định rõ.

## Mỗi loại dữ liệu ở đúng chỗ

| Dữ liệu                                                      | Nơi lưu                              | Lý do                                                           |
| ------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------- |
| Nội dung: chữ, ghi chú phiên bản, ảnh nhỏ                    | Git (`src/content/`, sửa bằng CMS)   | Có lịch sử, kiểm tra lúc build, web tĩnh nhanh                  |
| Dữ liệu người dùng tạo: tài khoản, bình luận, góp ý, đăng ký | Cloudflare D1 (`chilolab`)           | Có quan hệ, cần truy vấn và lọc                                 |
| File lớn: video, ảnh gốc, file đính kèm, backup              | Cloudflare R2                        | D1 không chứa file; R2 miễn phí 10 GB, không tính phí tải xuống |
| Số liệu đếm nhiều: lượt tải, lượt xem                        | D1 bây giờ; Analytics Engine khi lớn | Đếm số lượng lớn mà không tốn lượt ghi D1                       |
| Cache: số lượt tải GitHub, cài đặt                           | Cache của Worker; KV khi cần         | Đọc nhanh, không cần chính xác từng giây                        |
| Secret: token, khóa API                                      | Secret của Worker                    | Không bao giờ nằm trong code, Git hay D1                        |

## Giai đoạn

1. **Làm chắc phần đang có** (đang làm, 2026-11-26). Dọn dữ liệu hằng ngày và backup hằng tuần lên R2 riêng tư (`worker/maintenance.ts`, xem DATABASE.md). Mỗi bảng có chính sách lưu giữ khớp với `/privacy`. Migration chỉ thêm file mới, thử bằng `--local` trước `--remote`.
2. **Tính năng cho người dùng Pet Desktop** (khi chủ site muốn). Đăng ký nhận email khi có bản mới (bảng `subscriptions`, gửi qua Resend: 100 mail/ngày ở gói miễn phí). Báo lỗi khi app gặp sự cố, chỉ khi người dùng đồng ý (bảng `crash_reports`; cập nhật `/privacy` và EULA trước). Ảnh chụp lỗi đính kèm góp ý lưu ở R2, D1 chỉ giữ thông tin file.
3. **Media lớn** (khi repo nặng lên vì video, ảnh gốc). Chuyển chúng sang R2, vẫn phục vụ qua `/media/` (Worker đã xử lý đường dẫn này); bảng `media` trong D1 quản lý file. Nội dung vẫn ở Git và trỏ tới file.
4. **Khi lớn hơn nhiều** (chỉ khi cần thật; có thể tốn phí). Số liệu đếm sang Analytics Engine. Tách D1 theo mảng (tài khoản, cộng đồng) khi gần giới hạn dung lượng mỗi database. Postgres (Neon, Supabase) chỉ khi cần truy vấn phức tạp hoặc nhiều người quản trị: đây là quyết định chi phí của chủ site.

## Không đổi qua mọi giai đoạn

- Không lưu IP, không lưu token ở dạng thô; vai trò owner chỉ đặt bằng SQL.
- Thu thập loại dữ liệu mới thì cập nhật `/privacy` trước.
- Backup và file khôi phục chứa email khách: chỉ ở R2 riêng tư hoặc máy chủ site, không commit.
- Không thêm dịch vụ trả phí khi chưa có quyết định rõ ràng.
