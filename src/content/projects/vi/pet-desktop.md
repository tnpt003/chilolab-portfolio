---
title: Pet Desktop
slug: pet-desktop
locale: vi
description: Một chú mèo hoạt hình sống trên desktop Windows. Bế, vuốt ve, cho ăn, thay đồ cho mèo; khi muốn thì đưa mèo đi phiêu lưu đánh slime. Bản cài tự cập nhật.
kind: pet
order: 1
stack: ['C#', 'WPF', '.NET 10', 'Python']
featuredVersion: '1.5.2'
preview:
  image: ../../../assets/pet-battle-hub.png
  alt: Giao diện chọn chế độ phiêu lưu và chiến đấu trong Pet Desktop.
  caption: Ảnh ứng dụng thật — bản phát triển 1.5, có thể khác bản phát hành.
video: /media/pet-intro.mp4
---

## Một người bạn nhỏ trên desktop

Pet Desktop mang một chú mèo hoạt hình lên desktop Windows. Bạn có thể nhấc, kéo thả, vuốt ve, cho ăn và chơi cùng mèo; tùy chỉnh ngoại hình và phụ kiện.

Chế độ chiến đấu là phần tùy chọn: desktop trở thành không gian phiêu lưu với slime, kỹ năng và trang bị. Khi không tham gia chiến đấu, mèo vẫn là người bạn đồng hành trên desktop.

## Công nghệ

Dự án được xây bằng C# / WPF trên .NET 10, với dịch vụ hành vi Python tùy chọn. Chuyển động, tương tác, hoạt ảnh và chiến đấu được xử lý bằng C#; mèo vẫn có hành vi cục bộ khi dịch vụ Python không hoạt động.

## Cài đặt

1. Tải bộ cài `PetComputer-win-Setup.exe` ở nút phía trên rồi chạy; không cần quyền admin.
2. Nếu Windows SmartScreen báo "Windows protected your PC", bấm **More info → Run anyway**. Bộ cài chưa được ký số.
3. Mèo tự mở ra. Bản đã cài tự cập nhật, nên không cần tải lại khi có bản mới.

Bản Portable (.zip) dành cho người muốn chạy từ thư mục mà không cài đặt.
