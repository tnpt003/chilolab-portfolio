# Lab DevOps: từ source đến container và rollback

## Mục tiêu

Đã có lần chạy mẫu local thành công, gồm gây lỗi và rollback; xem [DEVOPS-RESULTS.md](DEVOPS-RESULTS.md). Các bước dưới đây để bạn tự thực hành lại.

Dùng chính portfolio để học cách build, triển khai, kiểm tra và khôi phục một ứng dụng. Đây là lab Linux local trên Docker Desktop, không phải bằng chứng đã vận hành production. Cloudflare Pages vẫn là hướng hosting công khai; container này không chạy bên trong Pages.

```text
Source + package-lock
        ↓ npm ci, TypeScript, build, link checks
Docker build stage (Node 24)
        ↓ chỉ copy website đã build
Runtime Linux (Nginx, user không phải root)
        ↓ Docker Compose
http://localhost:8080
        ↓ health + smoke + logs
Chấp nhận bản mới hoặc quay lại image cũ
```

## Những file mới dùng để làm gì?

| File                        | Mục đích                                                        |
| --------------------------- | --------------------------------------------------------------- |
| Dockerfile                  | Công thức đóng gói hai stage: Node build, Nginx phục vụ website |
| .dockerignore               | Chỉ đưa các file cần build vào Docker context                   |
| compose.yaml                | Khai báo container, port, log và giới hạn quyền                 |
| infra/nginx.conf            | Cấu hình HTTP, route, 404, redirect, health                     |
| scripts/write-release.mjs   | Ghi mã bản build vào release.json                               |
| scripts/smoke-container.mjs | Kiểm tra bản đang chạy có đúng release và HTTP hoạt động        |
| infra/compose.failure.yaml  | Cố ý làm healthcheck lỗi để tập khôi phục                       |
| .github/workflows/ci.yml    | Chuẩn bị pipeline kiểm tra và triển khai thử trên runner tạm    |

## Bước 1: xem môi trường

Mở terminal PowerShell trong thư mục Portfolio:

```powershell
docker version
docker compose version
```

Kết quả phải có cả Client và Server. Có Client nhưng thiếu Server nghĩa là Docker Desktop/engine chưa chạy. Dùng Linux containers. Lệnh docker trên Windows đang điều khiển môi trường Linux trong Docker Desktop, không biến website thành ứng dụng Windows.

## Bước 2: build image đầu tiên

```powershell
docker build --build-arg RELEASE_ID=lab-v1 -t chilolab-portfolio:lab-v1 .
```

Image là gói ứng dụng; container là một phiên chạy từ gói đó. Tag lab-v1 giúp chọn lại đúng gói để khôi phục. Node chỉ dùng ở stage build; runtime phục vụ HTML/CSS/ảnh bằng Nginx. npm ci dựa trên lockfile thay vì chọn lại dependency tùy ý.

Base images hiện theo tag Node 24 và Nginx stable-alpine, có thể thay đổi khi upstream cập nhật. Muốn tái tạo chính xác hơn, bước sau là pin digest và có lịch cập nhật; không gọi build hiện tại là hoàn toàn reproducible chỉ vì đã có lockfile.

## Bước 3: triển khai local

```powershell
$env:PORTFOLIO_IMAGE = 'chilolab-portfolio:lab-v1'
docker compose up -d --wait --wait-timeout 60
docker compose ps
```

Mở http://localhost:8080. Port chỉ bind 127.0.0.1, không mở cho toàn mạng. --wait chờ trạng thái healthy; container Running chưa đủ chứng minh ứng dụng sẵn sàng.

```powershell
Invoke-RestMethod http://localhost:8080/healthz
$env:EXPECTED_RELEASE = 'lab-v1'
npm.cmd run test:container
```

Health phải trả release lab-v1. Smoke test kiểm tra các trang, route bài phiên bản, HTTP 404 thật và 301. Health chỉ chứng minh release metadata đang phục vụ được; smoke test kiểm tra thêm nội dung web. Cả hai chưa thay thế kiểm tra trình duyệt hoặc giám sát từ ngoài máy.

## Bước 4: đọc log và quyền runtime

```powershell
docker compose logs --tail 30 portfolio
docker compose exec portfolio id
docker compose exec portfolio nginx -t
docker compose images
```

Tìm request, status code và lỗi Nginx trong log. id phải cho thấy user nginx thay vì root. Filesystem container là read-only, /tmp là vùng ghi tạm; capabilities bị bỏ và không cấp quyền mới. Không thêm database vì website chưa cần.

Healthcheck lỗi chỉ đánh dấu unhealthy. Docker Compose không tự rollback và restart policy không tự khởi động lại chỉ vì unhealthy. Cần kiểm tra, quyết định và chạy quy trình khôi phục.

## Bước 5: thử bản thứ hai

```powershell
docker build --build-arg RELEASE_ID=lab-v2 -t chilolab-portfolio:lab-v2 .
$env:PORTFOLIO_IMAGE = 'chilolab-portfolio:lab-v2'
docker compose up -d --wait --wait-timeout 60
$env:EXPECTED_RELEASE = 'lab-v2'
npm.cmd run test:container
```

Ở bài tập này hai bản có cùng giao diện, chỉ khác mã release để dễ kiểm chứng. Trong quy trình thật, dùng commit SHA cho image/release và không ghi đè tag của bản cũ. Không xóa image v1 trước khi kiểm tra bản mới.

## Bước 6: gây lỗi health có kiểm soát

Chỉ chạy với project lab này:

```powershell
docker compose -f compose.yaml -f infra/compose.failure.yaml up -d --force-recreate --wait --wait-timeout 20
docker compose ps
docker compose logs --tail 30 portfolio
```

Lệnh up dự kiến trả lỗi vì healthcheck cố ý luôn thất bại. HTTP có thể vẫn hoạt động; đây là bài tập lỗi readiness, không phải giả định server đã ngừng phục vụ. Đọc log và trạng thái trước khi sửa.

## Bước 7: rollback về v1

```powershell
$env:PORTFOLIO_IMAGE = 'chilolab-portfolio:lab-v1'
docker compose -f compose.yaml up -d --force-recreate --wait --wait-timeout 60
$env:EXPECTED_RELEASE = 'lab-v1'
npm.cmd run test:container
```

Không đưa override failure vào lệnh rollback. release phải trở lại lab-v1 và smoke test phải đạt. Single-container replacement có thể gián đoạn ngắn; đây chưa phải zero-downtime deployment.

## Bước 8: dọn lab

```powershell
docker compose down
Remove-Item Env:PORTFOLIO_IMAGE -ErrorAction SilentlyContinue
Remove-Item Env:EXPECTED_RELEASE -ErrorAction SilentlyContinue
```

Lệnh down chỉ dừng/xóa container và network của project, giữ image để thực hành lại. Không cần docker system prune.

## GitHub Actions: phần nào tự động?

Khi repo được push và Actions chạy, job verify kiểm tra source và trình duyệt. Chỉ khi job đó đạt, job container build image với mã commit, chạy Compose trên Ubuntu runner tạm, smoke test và dọn tài nguyên. Đây là CI + deploy kiểm thử tạm thời; chưa push image lên registry, chưa deploy server production và chưa xác nhận chạy online.

Cloudflare Git integration có pipeline deploy riêng. Workflow này không tự chặn deploy Cloudflare nếu cấu hình Cloudflare chưa có gate tương ứng. Không mô tả CI pass là bằng chứng production đã được triển khai.

## Thu thập bằng chứng để đưa vào portfolio

Sau khi tự làm, ghi lại: commit, mã release v1/v2, health output, smoke output, lỗi cố ý, cách đọc log và kết quả rollback. Chụp pipeline GitHub sau lần chạy thật. Viết bài ngắn: bài toán → kiến trúc → cách kiểm tra → sự cố → khôi phục → giới hạn. Không đưa token vào ảnh.

Lab tiếp theo nên là Linux troubleshooting, giám sát ngoài container và infrastructure as code khi đã có tài nguyên thật cần quản lý. Không cần thêm Kubernetes chỉ để tăng số công cụ.

## Nguồn chính thức

- https://docs.docker.com/guides/nodejs/
- https://docs.docker.com/reference/dockerfile/#healthcheck
- https://docs.docker.com/compose/how-tos/startup-order/
- https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files
