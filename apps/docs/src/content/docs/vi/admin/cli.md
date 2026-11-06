---
title: CLI của người vận hành
description: kept migrate và kept admin - mỗi lệnh làm gì và cách chạy nó trong Compose.
sidebar:
  order: 7
---

Hình ảnh có lệnh `kept` cho người vận hành máy chủ: các bản di chuyển, đường quay lại khi không ai đăng nhập được, các khóa, sao lưu. `kept admin --help` liệt kê tất cả; mỗi lệnh thay đổi điều gì đều được kiểm toán, và người sở hữu tài khoản bị ảnh hưởng được thông qua email.

## Chạy nó trong Compose

Hầu hết các lệnh cần thông tin đăng nhập của chủ sở hữu cơ sở dữ liệu (`KEPT_OWNER_DATABASE_URL`), chỉ dịch vụ một lần `migrate` nắm giữ; container phục vụ không bao giờ nắm giữ. Điểm vào của nó là `kept`, nên:

```sh
docker compose run --rm migrate admin <command>
```

Hai loại lệnh cần các volume của container phục vụ thay vào đó:

- `recovery-kit` đọc các khóa từ volume cấu hình và in chúng ra ngay cả khi không có cơ sở dữ liệu:
  `docker compose exec kept kept admin recovery-kit`. Với `KEPT_OWNER_DATABASE_URL` (dưới đây) nó cũng nắm giữ kho lưu trữ sao lưu, mật khẩu và thông tin xác thực của nó.
- `token create` cần các khóa và thông tin đăng nhập phục vụ, mà container `kept` có:
  `docker compose exec kept kept admin token create …` ([dưới đây](#mã-thông-báo-từ-máy-chủ)).
- `rotate-key`, `backup`, `restore` và `export` cần các khóa hoặc các tệp cũng như thông tin đăng nhập của chủ sở hữu. Hãy cho dịch vụ `kept` có `KEPT_OWNER_DATABASE_URL` trong một `compose.override.yaml` ([như với sao lưu](/vi/admin/backups/#bật-lên)), sau đó chạy chúng trong một container một lần:
  `docker compose run --rm --no-deps --entrypoint kept kept admin <command>`.

## Lệnh

| Lệnh | Nó làm gì |
|---|---|
| `kept migrate` | Áp dụng các bản di chuyển đang chờ một lần, dưới một khóa cơ sở dữ liệu (dịch vụ `migrate` chạy nó mỗi khi khởi động). |
| `kept admin setup-code` | Phát lại mã thiết lập lần đầu, trong khi thiết lập đang chờ, và gỡ bỏ khóa toàn hệ thống. |
| `kept admin reset-password <login>` | Mã đặt lại mật khẩu dùng một lần, hiệu lực trong một giờ; đăng xuất tài khoản ở mọi nơi. |
| `kept admin disable-user <login>` / `enable-user <login>` | Ngăn tài khoản đăng nhập (và kết thúc các phiên của nó), hoặc cho phép lại. |
| `kept admin transfer-ownership <locationId> <toUserId>` | Chuyển một địa điểm cho chủ sở hữu khác; chủ sở hữu trước đó trở thành người quản trị của địa điểm đó. |
| `kept admin recovery-kit [--format text\|html] [--out <file>]` | Bộ khôi phục để giữ ngoài máy chủ: các khóa, kho lưu trữ sao lưu và thông tin xác thực của nó, các bước khôi phục. Xem [bộ khôi phục](/vi/admin/recovery-kit/). |
| `kept admin token create --user <login> --scope read\|write --name <name>` | Một mã thông báo cá nhân cho các ứng dụng khách MCP và Home Assistant, in một lần; `--expires <days>`, `--location <id or name>` (có thể lặp lại), `--confirm-cross-location`. Từ 1.13.0. Xem [mã thông báo từ máy chủ](#mã-thông-báo-từ-máy-chủ). |
| `kept admin gen-key` | In một khóa mới, để tự đặt `KEPT_SECRET_KEY` hoặc `KEPT_AUTH_SECRET`. |
| `kept admin rotate-key` | Khóa mới làm khóa bí mật hiện tại và đóng gói lại mọi bí mật đã lưu. `--resume` hoàn thành một cái bị gián đoạn; `--drop <version>` xóa một khóa đã nghỉ mà không ai dùng. |
| `kept admin backup` | Sao lưu ngay (một chụp ảnh restic); `--list` liệt kê các chụp ảnh, và mọi bản sao lưu cũ hơn trước restic; `--accept-size` chấp nhận một bản sao lưu nhỏ hơn nhiều làm mức bình thường mới. Xem [sao lưu](/vi/admin/backups/). |
| `kept admin backup verify` | Kiểm kho lưu trữ sao lưu; `--read-data <percent>` cũng đọc tỉ lệ đó của dữ liệu; với lưu trữ tệp S3, kiểm tra các tệp so với thùng (`--all-files` cho mọi tệp, không phải một trong 20). |
| `kept admin backup drill --into <database>` | Khôi phục bản sao lưu mới nhất vào cơ sở dữ liệu thử **trống** và kiểm tra nó: [kiểm tra hàng tháng](/vi/admin/restore/#bài-tập-hàng-tháng). |
| `kept admin backup unlock` | Gỡ bỏ khóa restic cũ sau sự cố; bị từ chối khi một bản sao lưu đang chạy. |
| `kept admin restore <snapshot>` | Khôi phục một chụp ảnh (hoặc `latest`) vào cơ sở dữ liệu **trống** và xác minh nó; `--legacy <id>` khôi phục một bản sao lưu trước restic, cho một phiên bản. Xem [khôi phục](/vi/admin/restore/). |
| `kept admin readable --out <dir>` | Ghi [bản sao dễ đọc](/vi/admin/read-with-restic/) của mọi địa điểm (HTML, CSV, tệp) vào một thư mục; `--location <id>` cho một cái, `--no-pdf` không có tệp PDF kiểm kho. |
| `kept admin storage copy --to s3\|local` | Sao chép mọi tệp sang kho lưu trữ kia, kiểm tra băm của mỗi tệp; `--dry-run` chỉ đếm. Xem [chuyển lưu trữ tệp](/vi/admin/storage/). |
| `kept admin storage verify --store s3\|local` | Kiểm tra mọi tệp cơ sở dữ liệu tham chiếu có trong kho lưu trữ đó với các byte đúng. |
| `kept admin export --out <dir>` | Mỗi hàng, nguyên trạng, với mọi bí mật vẫn được khóa kín, và mọi tệp, vào một thư mục mới: cửa thoát hiểm, nhạy mạnh như một bản sao lưu. |
| `kept admin backfill-pdf-text` | Đọc văn bản của các tệp PDF được tải lên trước khi Kept đọc PDF, để tìm kiếm tìm thấy chúng. |
| `kept admin config` | In [tham chiếu cấu hình](/vi/reference/configuration/) cho phiên bản này. |

`kept admin seed` tồn tại cho phát triển và từ chối chạy trong môi trường sản xuất.

## Mã thông báo từ máy chủ

Ứng dụng chỉ tạo mã thông báo cá nhân qua HTTPS (Cài đặt → Kết nối từ chối qua `http` thuần). Một Kept trên mạng nhà qua `http` vẫn có thể kết nối một ứng dụng AI hoặc [Home Assistant](/vi/users/home-assistant/): người vận hành máy chủ tạo mã thông báo ở đó. Từ 1.13.0:

```sh
docker compose exec kept kept admin token create \
  --user ibrahim@example.com --scope read --name "Home Assistant"
```

- `--user` là người mà mã thông báo hành động thay: địa chỉ email của họ, hoặc tên người dùng của tài khoản được quản lý.
  Nó có thể làm những gì họ có thể, và không gì hơn.
- `--scope read` chỉ đọc; `--scope write` cũng có thể thay đổi điều gì.
- Không có `--location`, nó tiếp cận mọi địa điểm mà người đó thuộc về, ngoại trừ những nơi nó không thể: một địa điểm yêu cầu hai yếu tố (mã thông báo tạo ở đây không có yếu tố thứ hai; hãy tạo cái đó trong Cài đặt → Kết nối, qua HTTPS) và, đối với mã thông báo ghi, những nơi họ là người xem. Mỗi nơi bị bỏ qua được ghi tên. `--location` (một id hoặc tên, có thể lặp lại) chọn chúng thay vào đó.
- Một mã thông báo ghi trên các địa điểm có thành viên khác nhau dừng lại với một cảnh báo, như trong ứng dụng; `--confirm-cross-location` vẫn thực hiện nó.
- `--expires <days>` kết thúc nó sau số ngày đó; nếu không có, nó hoạt động cho đến khi bị thu hồi.

Nó in mã thông báo một lần, trên dòng bắt đầu bằng `KEPT TOKEN:`, và địa chỉ máy chủ MCP. Kept chỉ giữ một vân tay của nó. Người đó thấy nó trong **Cài đặt → Kết nối**, nơi họ có thể thu hồi nó, và được thông qua email.
