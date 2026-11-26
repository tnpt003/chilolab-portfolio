---
locale: vi
part: site
title: Chính sách quyền riêng tư
description: ChiloLab và ứng dụng Desktop Pet thu thập dữ liệu gì, vì sao, lưu ở đâu và cách xóa.
lead: ChiloLab là website cá nhân của Nguyễn Tấn Phát. Trang này mô tả đúng những gì website lưu lại, và cách ứng dụng Desktop Pet dùng dữ liệu.
updatedLabel: 'Cập nhật lần cuối:'
updated: 2026-11-26
---

## Dữ liệu được lưu

- **Tài khoản:** khi đăng nhập bằng Google, website nhận mã tài khoản Google, email và tên của bạn. Tên hiển thị có thể đổi trong trang tài khoản. Website không nhận mật khẩu Google. Khi đăng nhập bằng email, website lưu email của bạn; mã 6 số chỉ được lưu dạng mã băm và hết hạn sau 10 phút. Website không dùng mật khẩu.
- **Bình luận:** nội dung, thời gian, trang hoặc phiên bản bạn bình luận. Bình luận hiện công khai kèm tên hiển thị; email không bao giờ hiện công khai.
- **Góp ý và báo lỗi:** nội dung bạn gửi, phiên bản ứng dụng, phiên bản Windows, cách liên hệ nếu bạn tự điền, và ảnh chụp màn hình nếu bạn đính kèm. Chỉ chủ website đọc và xem được. Ảnh lưu trong kho riêng tư của Cloudflare R2 và bị xóa cùng góp ý.
- **Email báo bản mới:** chỉ khi bạn tự chọn trong trang tài khoản. Website lưu dự án bạn chọn, ngôn ngữ của email và thời điểm đăng ký. Email gửi tới địa chỉ của tài khoản. Website ghi lại ai đã nhận mỗi email để không gửi trùng, và xóa ghi chép đó 30 ngày sau khi gửi xong.
- **Lượt tải:** chỉ một bộ đếm theo ngày cho từng tệp, không kèm thông tin về người tải.

## Cookie

Website chỉ dùng cookie để giữ đăng nhập: một cookie phiên (30 ngày) khi bạn đăng nhập và một cookie tạm (10 phút) trong lúc đăng nhập bằng Google. Không có cookie quảng cáo hay theo dõi.

## Kiểm duyệt tự động

Nội dung bình luận được kiểm tra tự động (danh sách từ và mô hình AI của Cloudflare Workers AI) để phát hiện ngôn từ xúc phạm, spam. Bình luận bị phát hiện được giữ lại cho chủ website xem xét trước khi hiện.

## Bên xử lý dữ liệu

- **Cloudflare:** lưu trữ website, cơ sở dữ liệu và bản sao lưu, chống spam cho form góp ý (Turnstile), kiểm duyệt bình luận (Workers AI), thống kê lượt xem trang (Web Analytics — không dùng cookie, không theo dõi từng người).
- **Google:** xác minh đăng nhập khi bạn chọn “Tiếp tục với Google”.
- **Resend:** gửi email chứa mã đăng nhập tới địa chỉ bạn nhập, và email báo bản mới nếu bạn đăng ký.

Địa chỉ IP được dùng tạm thời để giới hạn số lần gửi và chống spam; ChiloLab không lưu địa chỉ IP vào cơ sở dữ liệu.

## Thời gian lưu và cách xóa

- Bạn có thể sửa hoặc xóa bình luận của mình bất cứ lúc nào.
- Bỏ chọn trong [trang tài khoản](/user/account#updates) hoặc bấm link hủy trong email sẽ xóa đăng ký nhận email bản mới ngay.
- Xóa tài khoản trong [trang tài khoản](/user/account) sẽ xóa tên, email, đăng ký nhận email và nội dung mọi bình luận của bạn ngay lập tức.
- Góp ý (cùng ảnh đính kèm) được giữ đến khi chủ website xử lý xong rồi xóa. Muốn xóa sớm hoặc có câu hỏi, hãy gửi qua [trang góp ý](/pet-desktop/feedback).
- Mỗi tuần, cơ sở dữ liệu được sao lưu vào một kho riêng tư chỉ chủ website mở được, để khôi phục khi có sự cố. Mỗi bản sao lưu giữ tối đa 12 tuần, nên dữ liệu đã xóa có thể còn trong bản sao lưu cũ tới 12 tuần rồi mới mất hẳn.
