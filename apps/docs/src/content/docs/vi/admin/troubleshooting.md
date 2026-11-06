---
title: "Khắc phục sự cố"
description: "Các chế độ lỗi thực tế của máy chủ Kept, nguyên nhân của từng lỗi và cách khắc phục."
---

Mỗi mục là một triệu chứng, nguyên nhân và cách khắc phục. Các lệnh giả định Docker Compose; dưới Helm các kiểm tra tương tự áp dụng cho các pod.

## Trước hết, hãy xem

- **Quản trị → Trạng thái** tự đặt tên cho hầu hết các vấn đề: thư, các tác vụ nền thất bại, quét nhắc nhở, sao lưu và bài tập khôi phục, ổ đĩa, bản phát hành và các lần di chuyển của nó, HTTPS.
- **Nhật ký:** `docker compose logs kept` và `docker compose logs migrate`. `KEPT_LOG_FORMAT=pretty` khiến chúng dễ đọc bằng mắt; `KEPT_LOG_LEVEL` (mặc định `info`) đặt mức độ.
- **ID yêu cầu:** mọi phản hồi đều mang `x-request-id`; tìm trong nhật ký để tìm dòng thuộc về báo cáo.
- **Các kiểm tra:** `/healthz` (tiến trình phục vụ HTTP), `/readyzd` (cả hai kết nối cơ sở dữ liệu đều trả lời), `/version` (phiên bản, commit, nguồn). Xem [giám sát](/vi/admin/observability/).
- **Kiểm tra bạn có thể chạy:** `kept admin backup verify`, `kept admin storage verify --store local` (hoặc `s3`) và `kept admin config` ([CLI](/vi/admin/cli/)).

## `docker compose up` dừng ở dịch vụ `bootstrap`

**Nguyên nhân:** dịch vụ `bootstrap` một lần (`kept bootstrap`) không thể thiết lập các đăng nhập cơ sở dữ liệu. Nhật ký của nó cho biết lý do: `docker compose logs bootstrap`. Các trường hợp phổ biến: hình ảnh cũ hơn 1.13.0 và không có lệnh `bootstrap` (đặt `KEPT_IMAGE` thành 1.13.0 hoặc mới hơn); hoặc vòng lặp nội bộ của cơ sở dữ liệu được thiết lập yêu cầu mật khẩu, và `KEPT_DB_SUPERUSER_PASSWORD` trong `.env` không giữ nó.

**Khắc phục:** sửa đúng điều mà dòng báo cáo và chạy lại `docker compose up -d`; bootstrap an toàn để chạy bất kỳ số lần nào.

## Kept thoát khi khởi động với `kept: invalid environment: …` hoặc dòng `kept:` khác

**Nguyên nhân:** môi trường được kiểm tra trước khi bất cứ thứ gì bắt đầu, và vấn đề đầu tiên dừng tiến trình bằng một dòng đặt tên cho nó. Các trường hợp phổ biến:

| Dòng báo cáo | Khắc phục |
|---|---|
| `kept: invalid environment: KEPT_PUBLIC_URL` | Đặt địa chỉ: `docker compose run --rm init` ([cài đặt](/vi/install/compose/#1-viết-env)) |
| `KEPT_DATABASE_URL has no password, and KEPT_DB_APP_PASSWORD_FILE: … does not exist` | Bootstrap chưa chạy: bắt đầu bằng `docker compose up -d`, nó chạy bootstrap trước, không phải `docker compose up kept` đơn lẻ |
| `KEPT_SECRET_KEY and KEPT_AUTH_SECRET are set together or not at all` | Đặt cả hai, hoặc bỏ đặt cả hai để dùng cặp được tạo trong ổ cấu hình |
| `<path>/secrets.json exists but …; fix or restore it` | Tệp khóa được tạo bị hỏng: đặt lại khóa từ [bộ khôi phục](/vi/admin/recovery-kit/) |
| `KEPT_BACKUP_DIR is inside KEPT_DATA_DIR …` | Trỏ sao lưu sang ổ đĩa khác |
| `a backup target is set, and the nightly backup dumps the database as kept_owner …` | Cung cấp cho worker `KEPT_OWNER_DATABASE_URL` ([sao lưu](/vi/admin/backups/#bật-lên)) |
| `set one backup target, not …` | Giữ một trong `KEPT_BACKUP_DIR`, `KEPT_BACKUP_S3_BUCKET`, `KEPT_BACKUP_SFTP` |
| `KEPT_STORAGE=s3 needs …` | Thêm các cài đặt S3 mà nó nêu ([lưu trữ](/vi/admin/storage/)) |
| `KEPT_OIDC_ISSUER is set without KEPT_OIDC_CLIENT_ID` | Thêm ID ứng dụng, hoặc bỏ đặt issuer |

Mọi biến đều trong [tài liệu tham khảo cấu hình](/vi/reference/configuration/).

## Đã đổi mật khẩu cơ sở dữ liệu trong `.env`, và bây giờ không gì kết nối được

**Nguyên nhân:** với `compose.yaml` của Kept 1.13.0 điều này tự khắc phục: bootstrap đặt mật khẩu của mọi đăng nhập thành mật khẩu trong `.env` (hoặc tệp của nó) trên mỗi `docker compose up -d`. Nó xảy ra với `compose.yaml` cũ hơn, đặt mật khẩu một lần khi ổ `kept-db` được tạo lần đầu.

**Khắc phục:** dùng `compose.yaml` hiện tại và chạy `docker compose up -d`. Với cái cũ, đổi mật khẩu của vai trò trong Postgres cho khớp, sau đó khởi động lại:

```sh
docker compose exec db psql -U postgres -c "ALTER ROLE kept_app PASSWORD '<the new password>'"
```

(Vai trò là `kept_owner`, `kept_app`, `kept_auth` hoặc `kept_system`, khớp với biến.)

## `/readyz` trả lời 503

**Nguyên nhân:** một trong hai kết nối cơ sở dữ liệu của web (`app` và `system`, hiển thị là `false` trong thân phản hồi) không thể chạy truy vấn. Nhật ký có `readiness check failed`. Khi khởi động, Kept chờ khoảng hai phút cho cơ sở dữ liệu vẫn đang khởi động trước khi từ bỏ.

**Khắc phục:** kiểm tra `docker compose ps db` khỏe và đăng nhập tên `false` có mật khẩu đúng (trên). Với Postgres được quản lý, kiểm tra bốn đăng nhập tồn tại ([Postgres được quản lý](/vi/install/managed-postgres/#bốn-đăng-nhập)).

## "Kept này được thiết lập cho …" hoặc "Yêu cầu không đến từ trang web này."

- **Ứng dụng:** "Kept này được thiết lập cho *địa chỉ*. Hãy mở nó tại đó.", trên trang đăng nhập hoặc dưới dạng dải trên ứng dụng khi lưu bị từ chối.
- **API:** 403, "Yêu cầu không đến từ trang web này."

**Nguyên nhân:** một ghi mang cookie của Kept phải đến từ đúng nguồn gốc của `KEPT_PUBLIC_URL`, hoặc một trong `KEPT_EXTRA_ADDRESSES`: lược đồ, máy chủ và cổng. Kept so sánh nó với tiêu đề `Origin` của trình duyệt, là địa chỉ trong thanh địa chỉ; một proxy ngược ở giữa không thay đổi gì. Mở Kept tại một địa chỉ khác (IP thay vì tên, `http` thay vì `https`, cổng khác, địa chỉ nội bộ của proxy) khiến mọi ghi thành 403. Liên kết, mã QR và thư mời được xây từ cùng giá trị, và passkey được đăng ký cho tên máy chủ của nó.

**Khắc phục:** đặt `KEPT_PUBLIC_URL` chính xác như thanh địa chỉ trình duyệt hiển thị, khởi động lại, và luôn mở Kept tại đó. Nếu bạn truy cập Kept tại hai địa chỉ thực, như tên LAN và tên Tailscale, liệt kê những cái khác trong `KEPT_EXTRA_ADDRESSES` ([Nhiều hơn một địa chỉ](/vi/install/home-network/#hơn-một-địa-chỉ)).

## Kept không khởi động sau nâng cấp, và `migrate` thoát với lỗi

**Nguyên nhân:** dịch vụ `kept` chỉ bắt đầu sau khi `migrate` thành công. Trước khi di chuyển cơ sở dữ liệu có dữ liệu, `kept migrate` chụp ảnh trước nâng cấp khi mục tiêu sao lưu được đặt; **nếu ảnh chụp thất bại, không có gì được di chuyển** và nó thoát với lý do ([nâng cấp](/vi/admin/upgrades/#bản-chụp-nhanh-trước-mỗi-lần-nâng-cấp)).

**Khắc phục:** đọc `docker compose logs migrate`, sửa sao lưu (mục tiêu, mật khẩu, gắn trên `migrate`), và `docker compose up -d` lại. Để nâng cấp mà không có ảnh chụp có chủ đích, đặt `KEPT_UPGRADE_SNAPSHOT=off` cho lần chạy đó.

## Kept từ chối khởi động với `downgrade_refused`

**Nguyên nhân:** hình ảnh cũ hơn hơn một bản phát hành so với cơ sở dữ liệu (hoặc cơ sở dữ liệu có các lần di chuyển không có bản phát hành ghi nhận). Quay lại một phiên bản được phép; nhiều hơn không được.

**Khắc phục:** chạy lại bản phát hành mới hơn, hoặc [khôi phục](/vi/admin/restore/) ảnh chụp trước nâng cấp được lấy bởi bản cũ hơn. `KEPT_ALLOW_DOWNGRADE=1` ép bắt đầu và được ghi nhận; chỉ dùng khi ghi chú phát hành nói vậy ([quay lại một phiên bản](/vi/admin/upgrades/#quay-lại-một-phiên-bản)).

## Mã thiết lập bị mất, hoặc thiết lập bị khóa

**Nguyên nhân:** mã chỉ được in một lần, bởi tiến trình tạo ra nó. Mã sai khóa ngoại địa chỉ gửi chúng, và nhiều mã sai khóa ngoại thể hiện.

**Khắc phục:** `docker compose run --rm migrate admin setup-code` cấp mã mới và gỡ khóa toàn thể; khóa ngoại từng địa chỉ tự kết thúc. Nếu mọi người cùng bị khóa cùng lúc, đọc mục tiếp theo.

## Mọi người đều gặp cùng giới hạn đăng nhập

**Nguyên nhân:** phía sau proxy ngược Kept thấy địa chỉ của proxy cho mọi khách trừ khi proxy nằm trong `KEPT_TRUSTED_PROXIES`, nên mọi người chia sẻ một bộ giới hạn.

**Khắc phục:** liệt kê địa chỉ của proxy như Kept thấy trong `KEPT_TRUSTED_PROXIES` ([proxy ngược](/vi/install/reverse-proxy/#tin-tưởng-proxy-và-chỉ-proxy)).

## Tải lên thất bại, hoặc ảnh lớn chưa bao giờ đến

**Nguyên nhân:** Kept từ chối tệp quá `KEPT_MAX_FILE_MB` (25 MB mặc định) với 413. Một proxy phía trước thường có giới hạn thân nhỏ hơn và thất bại trước.

**Khắc phục:** tăng giới hạn của proxy lên ít nhất `KEPT_MAX_FILE_MB` ([cho phép tải lên](/vi/install/reverse-proxy/#để-tải-lên-đi-qua)).

## Camera, cài đặt, đẩy hoặc vị trí không hoạt động trên điện thoại

**Nguyên nhân:** điện thoại chỉ cho phép chúng trên nguồn gốc an toàn; địa chỉ LAN qua HTTP thuần không phải là một. Qua HTTP Kept cũng từ chối hiển thị giá trị bí mật, xuất, mã truy cập, kết nối OAuth, tải bộ khôi phục và cài đặt sao lưu.

**Khắc phục:** [đặt Kept trên HTTPS](/vi/install/https/) và đặt `KEPT_PUBLIC_URL` thành địa chỉ `https://`.

## Lưu nhà cung cấp AI hoặc webhook thất bại: "Địa chỉ đó nằm trên mạng riêng."

**Nguyên nhân:** các yêu cầu ra bị từ chối đến địa chỉ riêng, vòng lặp và dành riêng (`private_address`). Một nhà cung cấp trên mạng của bạn, bao gồm `http://ollama:11434/v1` của Compose, giải quyết thành một.

**Khắc phục:** một quản trị viên thể hiện bật **Quản trị → Cài đặt → Cho phép địa chỉ riêng tư**. Xem [mô hình bảo mật](/vi/admin/security-model/#yêu-cầu-đi-ra-ssrf).

## Không thư nào đến

**Nguyên nhân:** không có `KEPT_SMTP_URL` và `KEPT_SMTP_FROM`, thư chỉ được ghi nhật ký là đến hạn, và Quản trị → Trạng thái nói thư chưa được cấu hình.

**Khắc phục:** đặt cả hai và khởi động lại ([cài đặt](/vi/install/compose/#5-tiếp-theo)).

## Sao lưu không chạy, hoặc cảnh báo "Sao lưu cũ" kích hoạt

**Nguyên nhân:** thường là một trong: không có mục tiêu hoặc không có mật khẩu (không có sao lưu không mã hóa), worker không có `KEPT_OWNER_DATABASE_URL`, mục tiêu thư mục không được gắn trên bộ chứa, hoặc không thuộc về người dùng của Kept (uid 10001).

**Khắc phục:** làm theo [sao lưu](/vi/admin/backups/#bật-lên), sau đó chạy một cái bằng tay và đọc nó nói gì:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup
```

Nó thoát 1 trên cảnh báo, theo tên:

| Cảnh báo | Ý nghĩa, và việc làm |
|---|---|
| `backup_suspicious_size` | nhỏ hơn nhiều so với cái tốt cuối cùng; nếu sự co lại là thực, `kept admin backup --accept-size` |
| `files_unreadable` | restic không đọc được một số tệp; kiểm tra quyền ổ dữ liệu |
| `blob_checksum_mismatch` | một tệp đã lưu không còn khớp SHA-256 của nó; kiểm tra ổ đĩa |
| `readable_incomplete` | bản sao đọc được của một vị trí thất bại; nhật ký đặt tên cho nó |

Sau sập, một khóa restic cũ có thể chặn mọi lần chạy: `kept admin backup unlock` gỡ nó (nó từ chối trong khi sao lưu chạy).

## Khôi phục từ chối bắt đầu

**Nguyên nhân:** Kept chỉ khôi phục vào cơ sở dữ liệu **trống**, và kiểm tra `pg_restore` khớp phiên bản chính của Postgres máy chủ và các phần mở rộng tồn tại.

**Khắc phục:** tạo cơ sở dữ liệu trống mới với các phần mở rộng, như trong [khôi phục](/vi/admin/restore/#khôi-phục); đừng bao giờ trỏ khôi phục tại cái đang sống.

## Sau khôi phục, giá trị bí mật và khóa AI không đọc được

**Nguyên nhân:** chúng được niêm phong bằng `KEPT_SECRET_KEY`, mà không có trong sao lưu.

**Khắc phục:** đặt khóa của bộ khôi phục vào `.env` (với `KEPT_SECRET_KEY_VERSION` và `KEPT_SECRET_KEYS_RETIRED` nếu nó liệt kê chúng) và khởi động lại. Nếu bộ liệt kê các khóa đã nghỉ, chạy `kept admin rotate-key --resume` một khi Kept đang chạy. Không có khóa thì những giá trị đó mất vĩnh viễn.

## `kept admin` nói `KEPT_OWNER_DATABASE_URL … is required`

**Nguyên nhân:** hầu hết lệnh quản trị cần đăng nhập của chủ cơ sở dữ liệu, mà chỉ dịch vụ `migrate` giữ.

**Khắc phục:** chạy chúng như `docker compose run --rm migrate admin <command>`, hoặc cho `rotate-key`, `backup`, `restore` và `export`, cung cấp cho dịch vụ `kept` đăng nhập chủ trong `compose.override.yaml` ([CLI](/vi/admin/cli/#chạy-nó-trong-compose)).

## Bộ chứa chỉ-worker không khỏe

**Nguyên nhân:** với `KEPT_ROLE=worker` kiểm tra sức khỏe đọc tệp vòng lặp việc chạm (`/tmp/kept-worker-alive`); nó thất bại khi vòng lặp không thăm dò cơ sở dữ liệu trong hai phút.

**Khắc phục:** kiểm tra nhật ký của worker và kết nối cơ sở dữ liệu của nó; các kiểm tra cơ sở dữ liệu giống như cho `/readyz` áp dụng.

## Vẫn bị kẹt

Mở một vấn đề với phiên bản từ `/version`, Kept chạy như thế nào, và các dòng nhật ký liên quan với mọi thứ riêng tư bị gỡ bỏ. Vấn đề bảo mật đi qua báo cáo lỗ hổng riêng tư ([mô hình bảo mật](/vi/admin/security-model/#báo-cáo-một-lỗ-hổng-bảo-mật)).
