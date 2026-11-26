# Báo lỗi app (crash reports)

Phía website đã sẵn sàng nhưng **đang tắt** (setting `crashReports`, mặc định tắt). App chưa gửi gì. Chỉ bật khi đủ ba điều kiện, theo thứ tự:

1. Bản app có hỏi ý người dùng (mặc định là **không gửi**) đã phát hành. Mã app không nằm trong repo này.
2. EULA.txt của bản đó và trang `/privacy` (CMS → Quyền riêng tư → Ứng dụng) đã mô tả việc gửi báo lỗi. Có bản nháp ở cuối trang này.
3. Bật ở `/admin/manage/settings?tab=feedback` → **Nhận báo lỗi tự động từ app**.

Khi tắt, server trả `403 {"error":"closed"}` và không lưu gì.

## App gửi gì

`POST https://chilolab.com/api/crash-reports`, `Content-Type: application/json`, không cookie. Tối đa 16 KB.

```json
{
  "consent": true,
  "reportId": "b7c0f6a2-3f1e-4c55-9a7e-0d4f8e2b6a11",
  "project": "pet-desktop",
  "appVersion": "1.5.2",
  "os": "Windows 11 23H2",
  "kind": "System.NullReferenceException",
  "message": "Object reference not set to an instance of an object.",
  "stack": "at DesktopPet.Farm.Water() in C:\\Users\\phat\\..."
}
```

| Trường       | Bắt buộc | Quy tắc                                                                                       |
| ------------ | -------- | --------------------------------------------------------------------------------------------- |
| `consent`    | có       | Phải là `true`: app chỉ gửi sau khi người dùng đồng ý. Thiếu → `400`, không lưu               |
| `reportId`   | có       | 16–64 ký tự `[A-Za-z0-9_-]`, ngẫu nhiên cho mỗi sự cố (UUID). Gửi lại cùng id chỉ lưu một lần |
| `project`    | có       | Slug dự án có trên site (`pet-desktop`, `pagespeed-auth-auditor`)                             |
| `appVersion` | có       | Dạng `x.y.z` (có thể thêm `-beta.1`)                                                          |
| `kind`       | có       | Tên lỗi, tối đa 120 ký tự                                                                     |
| `message`    | không    | Tối đa 1000 ký tự                                                                             |
| `stack`      | không    | Tối đa 8000 ký tự                                                                             |
| `os`         | không    | Tối đa 60 ký tự                                                                               |

Trả về `201 {"status":"received"}`. Lỗi: `400 invalid`, `403 closed`, `429 rate_limited` (10 lần/phút mỗi IP, 300 báo cáo/ngày cho cả site). App nên bỏ qua lỗi và không thử lại quá một lần.

App **không** được gửi: tên người dùng Windows, tên máy, nội dung cửa sổ, ảnh nền, file người dùng, tên mèo hay dữ liệu nông trại, hay bất kỳ mã định danh cố định nào của máy hoặc người dùng.

## Server làm gì

- Từ chối request từ trang web khác (có header `Origin` lạ). App không gửi `Origin` nên vẫn vào được.
- Thay tên người dùng trong đường dẫn (`C:\Users\<tên>\`, `/home/<tên>/`) bằng `<user>` và địa chỉ email bằng `<email>` trước khi lưu.
- Không lưu IP (chỉ dùng tạm để giới hạn tần suất), không gắn với tài khoản nào.
- Lưu ở bảng `crash_reports` (D1), xem và xóa ở `/admin/manage/crashes`. Tự xóa sau 90 ngày (`worker/maintenance.ts`).

## Bản nháp cho /privacy (phần Ứng dụng) và EULA

Chỉ dán vào khi bước 1 ở đầu trang đã xong.

> ### Báo lỗi (chỉ khi bạn đồng ý)
>
> Khi app gặp sự cố, app hỏi bạn có muốn gửi báo lỗi không; mặc định là không. Bạn đổi lựa chọn được trong Cài đặt. Nếu đồng ý, app gửi tới chilolab.com: phiên bản app, phiên bản Windows, tên lỗi, thông báo lỗi và vị trí lỗi trong mã. Tên người dùng Windows được xóa khỏi đường dẫn trước khi lưu. Báo lỗi không gắn với tài khoản, không kèm địa chỉ IP, chỉ chủ website đọc được, và tự xóa sau 90 ngày.

> ### Crash reports (only if you agree)
>
> When the app crashes, it asks whether to send a crash report; the default is no. You can change this in Settings. If you agree, the app sends chilolab.com the app version, the Windows version, the error name, the error message and where in the code it happened. Your Windows user name is removed from file paths before saving. Reports are not linked to an account, carry no IP address, are read only by the site owner, and are deleted after 90 days.
