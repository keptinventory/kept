---
title: "Gỡ cài đặt"
description: "Xóa Kept và mọi thứ nó đã lưu trữ - sau khi lấy những gì bạn muốn giữ."
sidebar:
  order: 9
---

**Hãy lấy dữ liệu của bạn ra trước.** Khi các volume đã biến mất, không có gì có thể đưa chúng trở lại trừ bản sao lưu.

1. Mỗi chủ sở hữu xuất các địa điểm của họ (**Cài đặt → Xuất**), hoặc giữ bản sao lưu mới nhất và [bộ khôi phục](/vi/admin/recovery-kit/) ở nơi an toàn: chỉ với restic bạn vẫn có thể [đọc danh sách đồ vật của mình](/vi/admin/read-with-restic/) sau này.
2. Dừng và xóa các container **và volume của chúng**, trong thư mục có `.env`:

   ```sh
   docker compose --profile https --profile ollama down --volumes
   ```

   Lệnh này xóa `kept-db` (cơ sở dữ liệu), `kept-data` (các tệp), `kept-config` (khóa và mật khẩu cơ sở dữ liệu đã tạo) và `kept-owner` (mật khẩu đăng nhập của chủ sở hữu); với `compose.full.yaml`, chứng chỉ của Caddy và mô hình của Ollama cũng bị xóa. Nếu không có `--volumes`, dữ liệu vẫn ở lại trên máy.
3. Xóa image: `docker image rm ghcr.io/keptinventory/kept:<version>` (tag bạn đã chạy, hoặc `kept:local` cho bản build của bạn), và `.env` bên cạnh tệp Compose.
4. Bên ngoài máy, hãy xóa những gì bạn đã tự thiết lập cho Kept:
   - **bucket tệp**, với `KEPT_STORAGE=s3` (và các phiên bản cũ của nó, nếu versioning đang bật);
   - **bản sao lưu**: thư mục `restic` trên ổ đĩa sao lưu, tiền tố `restic/` trong bucket sao lưu, hoặc kho chứa trên máy chủ SFTP, và bất kỳ `runs/` và `blobs/` alpha nào ở bên cạnh;
   - cơ sở dữ liệu, nếu nó là của nhà cung cấp: các vai trò `kept_*` và chính cơ sở dữ liệu;
   - bản ghi DNS, tuyến proxy và Tailscale `serve` bạn đã thêm.
