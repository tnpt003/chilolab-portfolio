---
title: Pet Desktop
slug: pet-desktop
locale: vi
description: Một chú mèo nhỏ sống ngay trên desktop Windows của bạn. Bế, vuốt ve, cho ăn, thay đồ cho mèo; lúc nào thích thì dắt mèo đi phiêu lưu đánh slime. App tự cập nhật khi có bản mới.
kind: pet
order: 1
stack: ['C#', 'WPF', '.NET 10', 'Python']
featuredVersion: '1.5.2'
downloadNote: 'Bộ cài chưa được ký số, nên trình duyệt và Windows có thể cảnh báo lúc tải và lúc chạy. Cứ giữ file lại và chạy tiếp; không cần quyền admin.'
install:
  - icon: download
    title: 'Tải bộ cài'
    text: 'Bấm nút **Tải Pet Desktop** ở trên để tải `PetComputer-win-Setup.exe`. Muốn chạy không cần cài thì chọn bản Portable (.zip).'
  - icon: archive
    title: 'Giữ file lại'
    text: 'Nếu trình duyệt báo file ít người tải, bấm **Keep** (Chrome) hoặc **… → Keep → Show more → Keep anyway** (Edge).'
  - icon: shield
    title: 'Chạy bộ cài'
    text: 'Mở file vừa tải. Nếu Windows báo "Windows protected your PC", bấm **More info → Run anyway**.'
  - icon: cat
    title: 'Gặp Chilo'
    text: 'Mèo tự mở ra trên desktop. App tự cập nhật, nên có bản mới cũng không cần tải lại.'
preview:
  image: ../../../assets/pet-battle-hub.png
  alt: Giao diện chọn chế độ phiêu lưu và chiến đấu trong Pet Desktop.
  caption: Ảnh ứng dụng thật — bản phát triển 1.5, có thể khác bản phát hành.
video: /media/pet-promo.mp4
gallery:
  - image: ../../../assets/pet-gallery/fishing.png
    alt: Mèo Chilo ngồi câu cá bên hồ nhỏ ở góc desktop.
  - image: ../../../assets/pet-gallery/cooking.png
    alt: Mèo Chilo nấu ăn bên nồi đang sôi trên bếp lửa.
  - image: ../../../assets/pet-gallery/portal.png
    alt: Cổng dịch chuyển màu tím hiện bên cạnh mèo, có nhãn Click to enter.
  - image: ../../../assets/pet-gallery/chapter-map.png
    alt: Bản đồ Chương 1 The Slime Invasion với năm màn chơi, đang chọn màn Break through.
  - image: ../../../assets/pet-gallery/battle.png
    alt: Mèo Chilo được nhấc khỏi mặt đất trong lúc slime tràn lên từ đáy màn hình.
  - image: ../../../assets/pet-gallery/victory.png
    alt: Bảng chiến thắng sau khi hạ Slime King, kèm thời gian, số slime đã hạ và các nâng cấp của lượt chơi.
---

## Một người bạn nhỏ trên desktop

Pet Desktop đưa chú mèo Chilo lên desktop Windows của bạn. Mèo tự đi dạo, câu cá, nấu ăn ngay trên màn hình. Bạn có thể nhấc mèo lên, kéo thả, vuốt ve, cho ăn, chơi cùng mèo, và đổi ngoại hình, phụ kiện cho mèo.

Chế độ chiến đấu là phần thêm, chơi hay không tùy bạn: desktop biến thành nơi phiêu lưu với slime, kỹ năng và trang bị. Không đánh nhau thì mèo vẫn ở đó làm bạn với bạn trên desktop.

## Công nghệ

Mình viết Pet Desktop bằng C# / WPF trên .NET 10, kèm một dịch vụ hành vi bằng Python (không bắt buộc). Chuyển động, tương tác, hoạt ảnh và chiến đấu đều chạy bằng C#, nên dịch vụ Python có tắt thì mèo vẫn hoạt động bình thường.
