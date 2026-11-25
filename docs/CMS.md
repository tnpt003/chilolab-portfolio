# Quản lý nội dung bằng CMS

ChiloLab dùng [Sveltia CMS](https://sveltiacms.app/), một CMS miễn phí chạy trên Git. CMS chỉ là giao diện soạn thảo: nó đọc và ghi đúng các file Markdown trong `src/content/`, nên không cần database, hosting CMS hay tài khoản trả phí. Markdown vẫn là nguồn nội dung chính thức.

- Trang quản trị: `public/admin/index.html` → `/admin/index.html`.
- Cấu hình: `public/admin/config.yml` (các collection, trường, gợi ý nhập liệu).
- Script CMS được ghim phiên bản `0.264.0` kèm mã SRI. Trang admin có `noindex` và bị chặn trong `robots.txt`.

## Cách dùng trên máy (không cần đăng nhập)

Cần trình duyệt Chromium (Chrome, Edge). Firefox/Safari không hỗ trợ chế độ này.

1. Trong thư mục Portfolio chạy `npm.cmd run dev`.
2. Mở `http://localhost:4321/admin/index.html`.
3. Bấm **Work with Local Repository**, chọn thư mục `Portfolio` và cho phép sửa file.
4. Soạn hoặc sửa nội dung rồi bấm Save. CMS ghi thẳng vào file Markdown; xem kết quả ở tab website đang chạy dev.
5. Kiểm tra (`npm.cmd run format`, `npm.cmd run verify`), xem diff rồi tự commit/push bằng Git.

Sau khi đổi `config.yml` hoặc pull thay đổi mới, tải lại trang CMS.

## Đăng phiên bản mới cho Pet Desktop

1. Mở **Pet Desktop — Phiên bản (VI)** → New. Điền phiên bản (ví dụ `1.5.1`), tiêu đề, tóm tắt, trạng thái, thứ tự (`151`) và nội dung.
2. Mở **Pet Desktop — Versions (EN)** và tạo bản dịch cùng phiên bản. Giữ trạng thái, thứ tự và ngày phát hành giống hệt bản tiếng Việt. Build sẽ báo lỗi nếu thiếu bản dịch hoặc dữ liệu lệch nhau.
3. Khi bản đã thật sự lên GitHub Releases: chọn **Đã phát hành**, nhập ngày phát hành thật, link Setup.exe và Portable theo đúng tag, ví dụ:
   - `https://github.com/tnpt003/Pet-Computer/releases/download/v1.5.2/PetComputer-win-Setup.exe`
   - `https://github.com/tnpt003/Pet-Computer/releases/download/v1.5.2/PetComputer-win-Portable.zip`
4. Khối **Tải xuống** trên `/pet-desktop` tự lấy bản đã phát hành mới nhất có link tải; không cần sửa trang dự án.

Chưa muốn công khai thì bật **Nháp**. Muốn viết trước về bản đang làm thì chọn **Đang phát triển** hoặc **Xem trước** và để trống ngày/link tải. Chi tiết quy tắc ở [VERSIONS.md](VERSIONS.md).

## Sửa trang dự án

Collection **Dự án (VI)** và **Projects (EN)** sửa mô tả, ảnh, video và nội dung `/pet-desktop`. Ảnh tải lên được lưu vào `src/assets/`. Tạo dự án mới vẫn làm bằng file (xem [EDITING.md](EDITING.md)) vì cần thêm loại minh họa trong code.

## Sửa trang Về mình

Collection **Về mình / About** có hai form: **Về mình (VI)** và **About (EN)**. Mọi chữ trên trang `/about` (lời chào, kinh nghiệm, cách làm việc, kỹ năng, hành trình, khóa học, ngoại ngữ, liên hệ) và đoạn giới thiệu ngắn ở trang chủ đều nằm ở đây; file thật là `src/content/profile/vi.yml` và `en.yml`.

- Sửa cả hai form để hai ngôn ngữ nói cùng một điều.
- Điểm và năm TOEIC phải giống hệt ở hai bản; build báo lỗi nếu khác. Ảnh chứng chỉ (đã che thông tin cá nhân) vẫn đặt bằng file, xem `src/assets/certificates/README.md`.
- Mốc phát hành Pet Desktop trong hành trình tự lấy từ ghi chú phiên bản, không thêm tay.
- Không ghi tên khách hàng (NDA) và không ghi ngày học khóa Athena.

## Sửa chữ giao diện (trang chủ, menu, footer, bình luận, góp ý)

Collection **Chữ giao diện** có hai form **Chữ giao diện (VI)** và **Interface text (EN)**, mỗi form chia nhóm: Trang chủ, menu, footer · Bình luận · Form góp ý · Đăng nhập & tài khoản · Số lượt tải. File thật là `src/content/ui/vi.yml` và `en.yml`.

- Mỗi ô có gợi ý "VD (VI): …" là câu tiếng Việt lúc chuyển sang CMS, để biết ô đó hiện ở đâu.
- Giữ nguyên các chỗ trong ngoặc nhọn như `{n}`, `{email}`, `{page}`: web thay chúng bằng số hoặc email thật. Build báo lỗi nếu bản VI và EN khác nhau ở các chỗ này, hoặc nếu một ô bị để trống.
- Trang quyền riêng tư (`/privacy`) vẫn sửa bằng file `src/components/PrivacyPage.astro`, vì đây là nội dung pháp lý đi kèm EULA của Pet Desktop.

## Dùng CMS online bằng tài khoản owner (Gmail)

Trên chilolab.com, `/admin` chỉ mở cho phiên đăng nhập owner (`users.role = 'owner'`), giống `/admin/manage`. Không cần tài khoản GitHub riêng trong trình duyệt: Worker (`worker/cms.ts`) giữ một GitHub token dạng secret và chỉ trao nó cho phiên owner.

Thiết lập một lần:

1. Tạo GitHub fine-grained token: Settings → Developer settings → Fine-grained tokens. Repository access: **Only select repositories** → `tnpt003/chilolab-portfolio`. Permissions: **Contents: Read and write** (Metadata: Read tự bật). Đặt hạn dùng (ví dụ 90 ngày) và ghi nhớ ngày gia hạn.
2. Lưu vào Worker: `npx wrangler secret put CMS_GITHUB_TOKEN` rồi dán token (hoặc Cloudflare dashboard → Worker → Settings → Variables and Secrets). Không đưa token vào mã nguồn hay `.dev.vars` được commit.
3. Deploy như thường lệ.

Dùng hằng ngày:

1. Đăng nhập tại `/user/login` bằng Gmail owner (hoặc mã email).
2. Mở `https://chilolab.com/admin` → bấm **Sign In with GitHub**. Cửa sổ nhỏ mở `/api/cms/auth`, kiểm tra phiên owner và trả token cho CMS; không có trang đăng nhập GitHub nào.
3. Soạn và Save: mỗi lần Save là một commit lên `main`, Workers Builds build lại website.

Người không phải owner mở `/admin` bị chuyển sang trang đăng nhập (hoặc nhận 403 nếu đã đăng nhập bằng tài khoản thường); `/api/cms/auth` trả lỗi và không lộ token. Token hết hạn hoặc bị thu hồi thì tạo token mới và chạy lại bước 2. Phiên owner hết hạn sau 7 ngày.

## Nâng cấp phiên bản CMS

Đổi số phiên bản trong `src` của `public/admin/index.html`, tính lại SRI rồi thay giá trị `integrity`:

```sh
curl -sL https://unpkg.com/@sveltia/cms@<phiên-bản>/dist/sveltia-cms.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Cập nhật cả URL schema ở dòng đầu `config.yml`.
