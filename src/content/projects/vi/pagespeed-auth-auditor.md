---
title: PageSpeed-Auth-Auditor
slug: pagespeed-auth-auditor
locale: vi
description: Ứng dụng QA website trên Windows. Kiểm tra trạng thái từng URL, crawl cả site, đo PageSpeed hoặc Lighthouse kể cả trang cần đăng nhập, rồi xuất mọi kết quả ra Excel.
kind: auditor
order: 2
stack: ['Electron', 'Node.js', 'Lighthouse', 'Puppeteer', 'ExcelJS']
preview:
  image: ../../../assets/auditor-main-screen.png
  alt: Màn hình chính của PageSpeed-Auth-Auditor với bốn bước được đánh số - mở trình duyệt đăng nhập, nhập URL, chọn Desktop hoặc Mobile, chạy kiểm tra.
  caption: Ảnh chụp thật màn hình chính, lấy từ tài liệu hướng dẫn sử dụng của ứng dụng.
---

## PageSpeed-Auth-Auditor

PageSpeed-Auth-Auditor là ứng dụng desktop Electron dành cho quy trình QA website, với ba luồng làm việc:

- Kiểm tra sức khỏe các URL được nhập trực tiếp.
- Crawl từ một URL ban đầu để khám phá trang và tạo báo cáo Site Health.
- Đo các URL Desktop/Mobile đã chọn bằng PageSpeed Insights hoặc Lighthouse.

## Trang công khai và trang cần đăng nhập

PageSpeed Insights phục vụ các trang công khai. Lighthouse là phương thức riêng để đo các trang cần phiên đăng nhập từ Login Browser. Lỗi PageSpeed không tự động chuyển phương thức sang Lighthouse.

## Báo cáo và môi trường

Ứng dụng xuất báo cáo Site Health và kết quả audit dưới dạng Excel, gồm các nhóm điểm Performance, Accessibility, Best Practices và SEO khi có dữ liệu.

Ứng dụng yêu cầu Windows 10 trở lên và Google Chrome. Mã nguồn hiện được phát triển cục bộ; chưa có đường dẫn repository công khai hoặc gói tải xuống được xác nhận tại đây.
