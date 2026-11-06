---
title: "Khôi phục và bài tập định kỳ"
description: "Đưa bản sao lưu trở về cơ sở dữ liệu mới, rỗng, chứng minh nó khớp, đổi chỗ nó - và duyệt bài hàng tháng."
sidebar:
  order: 2
---

Kept chỉ khôi phục **vào cơ sở dữ liệu mới, rỗng**, kiểm tra nó, và để việc đổi chỗ cho bạn. Nó từ chối cơ sở dữ liệu có bất kỳ thứ gì trong đó, nên không thể nhầm lẫn trỏ vào cơ sở dữ liệu đang hoạt động.

## Khôi phục

1. **Liệt kê các ảnh chụp nhanh:**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   Điều này chạy CLI trong một container `kept` chạy một lần, có volume dữ liệu, khóa, đăng nhập chủ sở hữu từ `compose.override.yaml` của bạn, và cài đặt sao lưu (`.env`'s, hoặc những cái lưu trong Admin → Sao lưu; xem [sao lưu](/vi/admin/backups/#bật-lên)).

2. **Tạo cơ sở dữ liệu rỗng** bên cạnh cái đang hoạt động, với tư cách siêu người dùng cơ sở dữ liệu:

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   Trên Postgres được quản lý, hãy chạy [SQL của nhà cung cấp](/vi/install/managed-postgres/#sql) cho các dòng tiện ích mở rộng và quyền sở hữu cho cơ sở dữ liệu mới thay vào đó.

3. **Khôi phục vào nó**, với `.env` đã được nạp vào shell trước đó (`set -a; . ./.env; set +a`):

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <ảnh_chụp_nhanh>
   ```

   Kept lấy cơ sở dữ liệu và tệp ra khỏi ảnh chụp nhanh, kiểm tra bản dump đối với bản kê khai của nó, kiểm tra `pg_restore` khớp với phiên bản chính của máy chủ và các tiện ích mở rộng tồn tại, khôi phục trong một giao dịch, sau đó so sánh **số lượng hàng và bản tóm tắt dữ liệu của mọi bảng** với bản kê khai: bất kỳ bảng nào có dữ liệu khác nhau, ngay cả khi cùng số hàng, cũng khiến khôi phục thất bại. Tệp quay lại kho chứa `KEPT_STORAGE` đặt tên, SHA-256 của từng cái được kiểm tra. Nó kết thúc bằng cách in ra lệnh đổi chỗ.

4. **Đổi chỗ**, với Kept đã dừng, với tư cách siêu người dùng:

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   Giữ `kept_before_restore` cho đến khi bạn chắc chắn, rồi bỏ nó.

   Đổi tên cơ sở dữ liệu cần siêu người dùng, mà không một đăng nhập nào của Kept là: đó là lý do Kept in các lệnh này thay vì chạy chúng.

## Sau khi mất máy chủ

Trên máy mới: cài đặt Kept như trong [Cài đặt với Docker Compose](/vi/install/compose/), và **trước lần khởi động đầu tiên** hãy đặt **khóa của bộ công cụ khôi phục** vào `.env` (`KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET`, và `KEPT_SECRET_KEY_VERSION` và `KEPT_SECRET_KEYS_RETIRED` nếu bộ công cụ liệt kê chúng), với đích sao lưu và mật khẩu của nó trong `compose.override.yaml`. Sau đó:

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

Cơ sở dữ liệu `kept` của bản cài mới vẫn rỗng (dịch vụ `migrate` chưa chạy), nên nó nhận khôi phục trực tiếp; không có gì để đổi chỗ.
Nếu không có khóa, mọi thứ đều quay lại trừ các giá trị bí mật và khóa AI, vẫn ở trạng thái không đọc được.

## Bài tập hàng tháng

Một bản sao lưu không ai khôi phục là hy vọng, không phải bản sao lưu. Một lần một tháng, hãy khôi phục ảnh chụp nhanh mới nhất vào một cơ sở dữ liệu tạm và để Kept so sánh nó (với `.env` đã nạp, như trên):

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

Bài tập khôi phục ảnh chụp nhanh tốt mới nhất, so sánh số lượng và bản tóm tắt, kiểm tra SHA-256 của 50 tệp (`--all-files` kiểm tra tất cả), và ghi lại bài tập trong cơ sở dữ liệu **đang hoạt động**, xóa cảnh báo "bài tập khôi phục đến hạn" trên Admin → Trạng thái. Nó không bao giờ chạm vào dữ liệu đang hoạt động.

## Kiểm tra kho chứa

Công nhân kiểm tra kho chứa hàng tuần (`restic check`). Để kiểm tra ngay, hoặc đọc lại một phần dữ liệu nữa:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

Với lưu trữ tệp S3, verify cũng kiểm tra mọi tệp trong bản kê khai đối với bucket. Nếu sự cố để lại khóa cũ trên kho chứa, `kept admin backup unlock` xóa nó; nó từ chối trong khi sao lưu đang chạy.
