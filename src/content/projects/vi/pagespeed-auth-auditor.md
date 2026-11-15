---
title: PageSpeed-Auth-Auditor
slug: pagespeed-auth-auditor
locale: vi
description: Ứng dụng QA trên Windows để kiểm tra sức khỏe website, audit hiệu năng và xuất báo cáo Excel.
kind: auditor
order: 2
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
