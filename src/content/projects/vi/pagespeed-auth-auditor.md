---
title: PageSpeed-Auth-Auditor
slug: pagespeed-auth-auditor
locale: vi
description: Ứng dụng QA website trên Windows. Kiểm tra trạng thái từng URL, crawl cả site, đo PageSpeed hoặc Lighthouse kể cả trang cần đăng nhập, rồi xuất mọi kết quả ra Excel.
kind: auditor
order: 2
stack: ['Electron', 'Node.js', 'Lighthouse', 'Puppeteer', 'ExcelJS']
downloadNote: 'App chưa được ký số, nên trình duyệt và Windows có thể cảnh báo lúc tải và lúc chạy. Cứ giữ file lại và chạy tiếp; không cần quyền admin. Cần có Google Chrome.'
install:
  - icon: download
    title: 'Tải bộ cài'
    text: 'Bấm nút **Tải PageSpeed-Auth-Auditor bản mới nhất cho Windows** ở trên để tải `PageSpeed-Auth-Auditor-Setup-win.exe`. Muốn chạy không cần cài thì chọn **Bản Portable**.'
  - icon: archive
    title: 'Giữ file lại'
    text: 'Nếu trình duyệt báo file ít người tải, bấm **Keep** (Chrome) hoặc **… → Keep → Show more → Keep anyway** (Edge).'
  - icon: shield
    title: 'Chạy bộ cài'
    text: 'Mở file vừa tải. Nếu Windows báo "Windows protected your PC", bấm **More info → Run anyway**.'
  - icon: login
    title: 'Mở Login Browser'
    text: 'Trong app, bấm **Open Login Browser**; đăng nhập ở cửa sổ Chrome đó nếu website cần. Xong là kiểm tra URL, crawl hoặc đo tốc độ được. Bản cài tự kiểm tra cập nhật.'
preview:
  image: ../../../assets/auditor-main-screen.png
  alt: Màn hình chính của PageSpeed-Auth-Auditor 1.2.2 với bước 1 mở Login Browser và bước 2 chọn URL, nhập tay hoặc crawl website.
gallery:
  - image: ../../../assets/auditor-gallery/crawl-running.png
    alt: Đang crawl chilolab.com, bảng kết quả hiện trạng thái, mã HTTP và thời gian tải của từng trang, kèm ô lọc kết quả.
  - image: ../../../assets/auditor-gallery/batch-complete.png
    alt: Hết một đợt 12 trang, app hỏi tiếp tục đợt sau hay kết thúc crawl và giữ kết quả.
  - image: ../../../assets/auditor-gallery/export-report.png
    alt: Thông báo đã xuất báo cáo Site Health ra Excel, có nút mở file và mở thư mục.
  - image: ../../../assets/auditor-gallery/audit-completed.png
    alt: Phần đo hiệu năng sau khi chạy xong, với các mục Performance, Accessibility, Best Practices được chọn để xuất.
  - image: ../../../assets/auditor-gallery/restore-prompt.png
    alt: Mở lại app sau khi tắt giữa lúc crawl, app báo tìm thấy phiên crawl đã lưu với 35 kết quả và nút Restore hoặc Discard.
  - image: ../../../assets/auditor-gallery/restored-crawl.png
    alt: Phiên crawl đã khôi phục, có nút Continue Stopped Crawl để crawl tiếp và nút xuất báo cáo.
---

PageSpeed-Auth-Auditor là app desktop (Electron) mình làm cho việc QA website, với ba luồng làm việc:

- Kiểm tra sức khỏe các URL được nhập trực tiếp.
- Crawl từ một URL ban đầu để khám phá trang và tạo báo cáo Site Health.
- Đo các URL Desktop/Mobile đã chọn bằng PageSpeed Insights hoặc Lighthouse.

Ảnh bên dưới là app thật đang crawl chính trang chilolab.com này.

## Trang công khai và trang cần đăng nhập

PageSpeed Insights phục vụ các trang công khai. Lighthouse là phương thức riêng để đo các trang cần phiên đăng nhập từ Login Browser. Lỗi PageSpeed không tự động chuyển phương thức sang Lighthouse.

## Crawl site lớn

Bảng kết quả luôn mượt kể cả khi có hàng nghìn URL: bảng hiện 500 dòng mới nhất, còn file Excel luôn đủ mọi kết quả. Tiến trình crawl được lưu xuống máy liên tục, nên tắt app giữa chừng, app bị treo hay lỡ đóng Login Browser thì lần mở sau vẫn khôi phục được để xuất báo cáo hoặc crawl tiếp.

## Báo cáo và môi trường

Ứng dụng xuất báo cáo Site Health và kết quả audit dưới dạng Excel, gồm các nhóm điểm Performance, Accessibility, Best Practices và SEO khi có dữ liệu.

App cần Windows 10 trở lên và Google Chrome. Bản phát hành nằm ở [repo GitHub công khai](https://github.com/tnpt003/pagespeed-auth-auditor-releases), kèm hướng dẫn từng bước bằng ảnh; repo này chỉ có bản phát hành, không có mã nguồn.
