---
title: "PostgreSQL được quản lý"
description: "Chạy Kept trên PostgreSQL 18 của nhà cung cấp - nhà cung cấp nào hoạt động và SQL tạo các vai trò và tiện ích mở rộng của Kept."
sidebar:
  order: 5
---

Kept có thể sử dụng PostgreSQL được quản lý thay vì PostgreSQL tích hợp. Nó cần **PostgreSQL 18** và ba tiện ích mở rộng trong lược đồ `public`: `pg_trgm`, `unaccent` và `vector` (pgvector).

## Nhà cung cấp nào hoạt động

Đọc từ tài liệu của từng nhà cung cấp vào 2026-10-06; chưa có nhà cung cấp nào được chạy với Kept.

| Nhà cung cấp | PostgreSQL 18 | Ghi chú |
|---|---|---|
| AWS RDS cho PostgreSQL | có | Người dùng chính tạo các tiện ích mở rộng. Nếu quản trị viên thu hẹp `rds.allowed_extensions`, hãy liệt kê cả ba. |
| Google Cloud SQL | có | Người dùng `postgres` mặc định (thành viên của `cloudsqlsuperuser`) tạo chúng. |
| Azure Database cho PostgreSQL, máy chủ linh hoạt | có | **Cho phép danh sách trước:** thêm `pg_trgm,unaccent,vector` vào tham số máy chủ `azure.extensions`, sau đó chạy SQL với tư cách quản trị viên máy chủ. |
| DigitalOcean Managed PostgreSQL | có | **Chỉ bản Standard Edition**, với tư cách `doadmin`. Bản Advanced Edition không thể tạo tiện ích mở rộng, nên không thể chạy Kept. |
| Neon | có | Vai trò riêng của dự án (thành viên của `neon_superuser`) tạo chúng. |
| Supabase | **không** | Nó không cung cấp PostgreSQL 18, và đặt tiện ích mở rộng trong lược đồ `extensions`, không phải `public`. |

## SQL

`pg_trgm` và `unaccent` là tiện ích mở rộng tin cậy, nhưng `vector` của pgvector thì không, vì vậy người dùng thông thường không phải superuser không thể tạo nó. Chạy điều này **dưới tư cách người dùng quản trị của nhà cung cấp**, kết nối với cơ sở dữ liệu Kept sẽ sử dụng, với mật khẩu của bạn thay cho `…` và tên cơ sở dữ liệu thay cho `<database>`:

```sql
-- Azure: allow-list pg_trgm,unaccent,vector in azure.extensions first.
CREATE ROLE kept_owner  LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_app    LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_auth   LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_system LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
-- A request can't run away or sit idle inside a transaction.
ALTER ROLE kept_app SET statement_timeout = '15s';
ALTER ROLE kept_app SET idle_in_transaction_session_timeout = '30s';
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA public;
-- A non-superuser admin may hand ownership to a role only while it is a member of that role.
GRANT kept_owner TO CURRENT_USER;
ALTER DATABASE <database> OWNER TO kept_owner;
ALTER SCHEMA public OWNER TO kept_owner;
REVOKE kept_owner FROM CURRENT_USER;
```

Mọi câu lệnh đều được chạy cục bộ trên PostgreSQL 18.6 với tư cách non-superuser có các thuộc tính Azure ghi nhận cho quản trị viên của nó; chỉ `CREATE EXTENSION vector` cần nhiều hơn, đó là những gì vai trò quản trị viên của nhà cung cấp cung cấp.

Hai thời gian chờ trên `kept_app` rất quan trọng: thiết lập Compose của Kept đặt giống nhau, và các migrations của nó không thể (vai trò sở hữu có thể không thay đổi các vai trò khác).

## Bốn đăng nhập

| Biến | Đăng nhập | Dùng cho |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | mọi yêu cầu, dưới bảo mật cấp hàng |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | đăng nhập |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | tác vụ nền và thiết lập lần đầu |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`, `kept admin`, và dump của bản sao lưu |

**Không bao giờ trỏ bất kỳ cái nào tới người dùng quản trị của nhà cung cấp.** Một số nhà cung cấp cấp cho nó `BYPASSRLS` (`doadmin` của DigitalOcean, `neon_superuser` của Neon), điều này sẽ tắt bảo mật cấp hàng ngăn chặn dữ liệu của một hộ gia đình bị lộ cho hộ khác. Bốn vai trò của Kept đều là `NOBYPASSRLS`.

Hầu hết các nhà cung cấp yêu cầu TLS: thêm `sslmode` mà tài liệu của họ cung cấp vào mỗi URL.
