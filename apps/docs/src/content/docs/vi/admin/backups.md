---
title: Sao lưu
description: Các ảnh chụp nhanh restic mã hóa mỗi đêm của cơ sở dữ liệu, các tệp và một bản sao dễ đọc, đến một đĩa khác, một bucket S3 hoặc một máy chủ SFTP.
sidebar:
  order: 1
---

Mỗi đêm Kept lấy một **ảnh chụp nhanh restic**: mã hóa bằng mật khẩu bạn chọn,
loại bỏ trùng lặp (một đêm không có gì mới gần như không thêm gì), và gửi đến một nơi không phải là
ổ đĩa của chính máy chủ.

## Những gì một ảnh chụp nhanh giữ

- **Cơ sở dữ liệu**, được xuất ra từ một thời điểm nhất quán, với một bản kê khai của số hàng của mọi bảng
  và một bản tóm tắt của dữ liệu của nó, để một lần khôi phục có thể chứng minh nó đã đưa về chính xác những gì đã có.
- **Các tệp** (ảnh, hóa đơn, tài liệu), khi chúng được lưu trên ổ đĩa của máy chủ. Với
  lưu trữ tệp S3 thì không: xem [dưới đây](#khi-các-tệp-ở-trong-s3).
- **Một bản sao dễ đọc của mọi địa điểm**: các trang web, bảng tính, ảnh thu nhỏ và hóa đơn mở
  trong trình duyệt với chỉ restic. Xem
  [đọc danh mục đồ vật của bạn chỉ với restic](/vi/admin/read-with-restic/).

**Các khóa không** nằm trong bản sao lưu. Giữ [bộ khôi phục](/vi/admin/recovery-kit/) ở nơi khác.

## Nó có thể đi đến đâu

| Đích | Thiết lập bằng | Kho lưu trữ restic |
|---|---|---|
| Một thư mục: một đĩa khác, hoặc một chia sẻ NAS gắn trên máy chủ | `KEPT_BACKUP_DIR` (tuyệt đối, bên ngoài `KEPT_DATA_DIR`) | `<directory>/restic` |
| Một bucket tương thích S3: AWS, hoặc điểm cuối S3 của một nhà cung cấp khác | `KEPT_BACKUP_S3_BUCKET` và các biến khác `KEPT_BACKUP_S3_*` | `restic/` trong `KEPT_BACKUP_S3_PREFIX` |
| Một máy chủ SFTP | `KEPT_BACKUP_SFTP` (cú pháp `sftp:` của restic), `KEPT_BACKUP_SFTP_KEY_FILE`, `KEPT_BACKUP_SFTP_KNOWN_HOSTS` | đường dẫn bạn cung cấp |

Thiết lập một đích. Nên chọn một máy khác hoặc một nơi khác: một thư mục trên cùng một ổ đĩa với dữ
liệu của Kept bị từ chối, và trang trạng thái cảnh báo khi đích chia sẻ một ổ đĩa với nó. Các điểm cuối S3 của Backblaze B2 và
Cloudflare R2 dự kiến sẽ hoạt động nhưng chưa được kiểm tra. SFTP ghim khóa máy chủ từ tệp known-hosts và chỉ kết nối nếu nó khớp.

## Bật lên

Quản trị viên máy chủ thiết lập đích và mật khẩu trong **Quản trị → Sao lưu**, qua HTTPS, sau
khi xác nhận bộ khôi phục. "Kiểm tra" kiểm tra xem Kept có thể mở (hoặc tạo) kho lưu trữ; "Sao lưu
ngay" chạy một lần lập tức. Một biến môi trường ưu tiên hơn màn hình và hiển thị ở đó là bị khóa, nên một
người vận hành có thể cố định đích trong phần triển khai.

**Mật khẩu** có ít nhất 12 ký tự (`KEPT_BACKUP_PASSWORD`, hoặc thiết lập trên màn hình).
**Không mật khẩu, không sao lưu:** Kept không bao giờ ghi một bản sao lưu chưa được mã hóa. Nếu mất mật khẩu,
bản sao lưu sẽ không thể đọc được, đó là lý do mật khẩu nằm trong bộ khôi phục.

Bản sao lưu chạy trong worker với tư cách là chủ sở hữu cơ sở dữ liệu, do đó worker cũng cần `KEPT_OWNER_DATABASE_URL`.
Với Compose, `compose.yaml` đã chuyển mọi biến `KEPT_BACKUP_*` từ `.env` đến Kept và đến `migrate` (dịch vụ này lấy một ảnh chụp nhanh trước khi nâng cấp); một `compose.override.yaml`
bên cạnh nó thêm đăng nhập của chủ sở hữu và, đối với đích thư mục, việc gắn kết trên cả hai:

```yaml
services:
  kept:
    environment:
      KEPT_OWNER_DATABASE_URL: postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD:-}@db:5432/kept
      KEPT_DB_OWNER_PASSWORD_FILE: /owner/kept_owner
    volumes:
      - kept-owner:/owner:ro
      - /mnt/backup/kept:/backups
  migrate:
    volumes:
      - /mnt/backup/kept:/backups
```

Mật khẩu của chủ sở hữu đến từ volume `kept-owner`, nơi quá trình khởi tạo giữ nó (một bản cài từ trước phiên bản 1.13.0 có `KEPT_DB_OWNER_PASSWORD` trong `.env` thì dùng giá trị đó, và dòng tệp không có tác dụng gì).

Sau đó, hãy thiết lập đích và mật khẩu trên màn hình, hoặc khóa chúng trong `.env`
(`KEPT_BACKUP_DIR=/backups`, `KEPT_BACKUP_PASSWORD=…`).

Thư mục phải thuộc về người dùng của Kept:

```sh
sudo mkdir -p /mnt/backup/kept
sudo chown 10001:10001 /mnt/backup/kept
sudo chmod 700 /mnt/backup/kept
```

## Khi nào và trong bao lâu

- **Khi nào:** mỗi đêm vào giờ được đặt trong Quản trị → Sao lưu, `HH:MM` theo UTC (mặc định `02:30`).
  Một giờ mới có hiệu lực từ đêm tới, không cần khởi động lại; thay vào đó, `KEPT_BACKUP_TIME` cố định giờ này.
- **Chạy ngay** chạy một lần lập tức; nhấn vào nó lại khi bản đó đang chờ hoặc chạy bị từ chối
  ("Đã có một bản sao lưu đang chạy") thay vì xếp hàng hai lần. Một bản sao lưu bị cắt bởi một lần khởi động lại hoặc bởi
  hết bộ nhớ không chặn thao tác này; lần chạy tiếp theo đánh dấu bản bị cắt đó là đã bị gián đoạn.
- **Trên một máy nhỏ** (dưới 4 GB, hoặc giới hạn container dưới 4 GB) restic chạy trên tối đa hai
  nhân với giới hạn bộ nhớ mềm; `GOMAXPROCS` và `GOMEMLIMIT` trong môi trường của Kept (với Compose,
  một `compose.override.yaml`) ghi đè cả hai.
- **Thời gian giữ:** ảnh chụp nhanh mới nhất của mỗi trong số **7 ngày, 4 tuần và 6
  tháng qua** (`KEPT_BACKUP_KEEP_DAILY`, `_WEEKLY`, `_MONTHLY`). `KEPT_BACKUP_KEEP` của bản alpha
  được đọc là số lượng hàng ngày cho một bản phát hành. Các ảnh chụp nhanh được lấy trước khi nâng cấp giữ 3 bản cuối của chúng.
- **Một bản sao lưu nhỏ đáng ngờ** (một bản xuất dưới nửa kích thước của bản tốt cuối cùng, hoặc ít hơn nhiều
  đồ vật, các vị trí hoặc tệp) vẫn được lấy, nhưng không có gì cũ bị loại vào đêm đó và quản trị viên được
  cảnh báo, do đó một đêm xấu không bao giờ có thể đẩy các ảnh chụp nhanh tốt ra ngoài.

## Giám sát

Quản trị → Trạng thái hiển thị bản sao lưu cuối cùng và độ tuổi của nó, số lượng ảnh chụp nhanh, kích thước
của kho lưu trữ, lần diễn tập khôi phục cuối cùng, và các ổ đĩa. Quản trị viên được cảnh báo bằng thư và thông báo đẩy khi:

| Cảnh báo | Khi nào |
|---|---|
| Sao lưu thất bại | một lần chạy thất bại |
| Sao lưu quá cũ | không có bản sao lưu tốt trong 36 giờ khi đã thiết lập đích |
| Kích thước đáng ngờ | một lần chạy nhỏ hơn nhiều so với bản tốt cuối cùng |
| Dung lượng ổ đĩa thấp | ổ đĩa dữ liệu hoặc một đích thư mục đầy 85 % |
| Phiên bản hóa bucket tắt | các tệp ở trong S3 và bucket không giữ bất kỳ phiên bản cũ nào |
| Đến hạn diễn tập khôi phục | không có [diễn tập khôi phục](/vi/admin/restore/#diễn-tập-hàng-tháng) trong 30 ngày |

`/metrics` (với `KEPT_METRICS_TOKEN`) thêm thời gian của bản sao lưu tốt cuối cùng và mức sử dụng
của các ổ đĩa. Xem [giám sát](/vi/admin/observability/).

## Khi các tệp ở trong S3

restic sao lưu các tệp trên ổ đĩa, không phải các đối tượng trong một bucket. Với `KEPT_STORAGE=s3`, ảnh chụp nhanh giữ
cơ sở dữ liệu, bản kê khai và bản sao dễ đọc, và **bucket tự giữ an toàn cho các tệp**:
bật **phiên bản hóa bucket** (và, nếu nhà cung cấp của bạn có điều đó, sao chép sang một vùng khác). Kept
kiểm tra phiên bản hóa trên mọi lần chạy và cảnh báo khi nó tắt. Kiểm tra hàng tuần và diễn tập khôi phục
so sánh mã băm của mọi tệp trong bản kê khai với bucket.

## Các bản sao lưu của bản alpha

Các bản sao lưu được thực hiện trước restic, bởi bản alpha (`runs/` và `blobs/` bên cạnh thư mục `restic/` mới), không bao giờ
được ghi thêm nữa, và vẫn có thể khôi phục với `kept admin restore --legacy <id>` trong một bản phát hành. Xóa
chúng sau khi một ảnh chụp nhanh restic đã vượt qua một lần diễn tập khôi phục.
