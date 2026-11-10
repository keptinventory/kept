---
title: "Cài đặt với Docker Compose"
description: "Chạy Kept và Postgres của nó với Docker Compose trên máy chủ hoặc homelab của bạn, đăng nhập lần đầu và giữ khóa an toàn."
sidebar:
  order: 1
---

Docker Compose là cách để chạy Kept trên một máy: chính Kept và Postgres 18 với pgvector.
Caddy cho HTTPS và Ollama cho AI cục bộ đi kèm với một tệp thứ hai
([Caddy và Ollama](#caddy-và-ollama)). Bạn cần Docker với plugin Compose. Đã kiểm tra trên máy có
1 GB RAM và một nhân CPU; Kept và cơ sở dữ liệu của nó sử dụng khoảng 200–400 MB trong đó
([đã kiểm tra gì](/vi/install/hardware/)).

Bốn bước, không cần sao chép kho chứa và không cần tạo mật khẩu:

```sh
mkdir kept && cd kept
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.yaml
docker compose run --rm init
docker compose up -d
```

`compose.yaml` hoạt động độc lập, vì vậy nó cũng dán vào Portainer, Dockge và các công cụ tương tự (xem
[không có terminal](#không-có-terminal)).

:::note[Ảnh]
Các bản phát hành được công bố tại `ghcr.io/keptinventory/kept`, được gắn thẻ `1`, `1.2` và `1.2.3`, không bao giờ
`latest`; `1.0.0` là bản đầu tiên được ký. Cùng các ảnh đó, được ký bằng cùng khóa, có trên Docker
Hub là `keptinventory/kept`. `compose.yaml` chạy bản phát hành mà nó được công bố cùng trừ khi
`KEPT_IMAGE` trong `.env` chỉ định bản khác; `init` ghi phiên bản mà nó chạy vào đó.
[Xác minh nó](/vi/admin/verify-release/) trước nếu bạn muốn. Để chạy bản build của riêng bạn, trong một bản kiểm tra:
`docker build -t kept:local .` và `KEPT_IMAGE=kept:local`.
:::

## Những gì chạy

| Dịch vụ | Chạy |
|---|---|
| `db` | Postgres, và luôn chạy |
| `kept` | Kept trên cổng 8080, và luôn chạy |
| `bootstrap` | một lần mỗi lần khởi động, sau đó thoát: các đăng nhập cơ sở dữ liệu và phần mở rộng |
| `migrate` | một lần mỗi lần khởi động, sau đó thoát: các di chuyển cơ sở dữ liệu |
| `init` | chỉ khi bạn chạy nó (`docker compose run --rm init`): ghi `.env` |

## Caddy và Ollama

`compose.yaml` chạy riêng Kept. `compose.full.yaml` là cùng tệp đó cộng Caddy cho HTTPS (hồ sơ
`https`), Ollama cho AI cục bộ (hồ sơ `ollama`) và triển khai web và worker tách biệt,
được chú thích. Nó cũng hoạt động độc lập. Để dùng nó thay vào đó:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.full.yaml
docker compose -f compose.full.yaml run --rm init
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose up -d
```

Với `COMPOSE_FILE` trong `.env`, `docker compose` thuần đọc `compose.full.yaml`, vì vậy mọi lệnh
trong tài liệu này hoạt động như đã viết. Các dịch vụ, mạng và volume của Kept giống nhau trong cả hai tệp:
một bản cài đặt có thể chuyển đổi bất cứ lúc nào và giữ dữ liệu của nó.

## 1. Viết `.env`

```sh
docker compose run --rm init
```

`init` hỏi **địa chỉ bạn sẽ mở Kept tại đó**, như `http://kept.home.arpa:8080` hoặc
`https://kept.example.org`. Các liên kết, mã QR trên nhãn in và kiểm tra cùng trang web được xây
dựng từ nó, vì vậy nó phải chính xác là những gì trình duyệt hiển thị, và nó không nên thay đổi: **hãy dùng
tên thay vì địa chỉ IP.** Bộ định tuyến gia đình có thể cấp cho máy này một địa chỉ mới vào một ngày nào đó, và
nhãn bạn đã in sẽ khi đó không trỏ đến đâu. Đặt tên trong DNS của bộ định tuyến, hoặc trong tệp hosts
của từng thiết bị. Địa chỉ IP vẫn hoạt động nếu bạn xác nhận nó.

Sau đó nó ghi `.env` bên cạnh `compose.yaml` với địa chỉ đó (`KEPT_PUBLIC_URL`), cổng
(`KEPT_HTTP_PORT`, từ địa chỉ `http://`), ảnh và mã thiết lập (`KEPT_SETUP_CODE`), và
hiển thị mã đó. `.env` không chứa mật khẩu và chỉ bạn mới đọc được. Chạy `init` lại để thay đổi
địa chỉ: nó cập nhật các dòng đó và giữ mọi thứ khác bạn đã thêm. Nếu không có terminal, đưa
địa chỉ trên dòng lệnh: `docker compose run --rm init --url http://kept.home.arpa:8080`.

Mọi thứ khác đều tùy chọn; `compose.env.example` và
[tài liệu tham khảo cấu hình](/vi/reference/configuration/) nói biến nào làm gì.

## 2. Khởi động nó

```sh
docker compose up -d
```

Compose khởi động cơ sở dữ liệu và đợi cho đến khi nó khỏe mạnh. Sau đó:

- **`bootstrap`** (một lần, `kept bootstrap`) tạo bốn đăng nhập cơ sở dữ liệu của Kept và các
  phần mở rộng `pg_trgm`, `unaccent` và `vector`. Lần khởi động đầu tiên nó sinh mật khẩu của mỗi đăng nhập
  vào một volume; mỗi lần khởi động nó đặt mật khẩu của mỗi đăng nhập về giá trị đó, vì vậy Postgres
  và Kept luôn đồng ý.
- **`migrate`** (một lần, `kept migrate`) áp dụng các di chuyển cơ sở dữ liệu một lần, dưới một khóa.
- **Kept** khởi động trên cổng 8080 (`KEPT_HTTP_PORT` thay đổi cổng máy chủ).

## 3. Hoàn tất thiết lập

Mở địa chỉ, nhập mã thiết lập mà `init` đã hiển thị, và tạo tài khoản đầu tiên: nó trở thành
quản trị viên thực thể. Kept cũng in mã đó trong nhật ký của nó khi khởi động lần đầu:

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

Mã bị mất được cấp lại bằng:

```sh
docker compose run --rm migrate admin setup-code
```

Mã sai khóa ngoài một lúc, theo địa chỉ và cho toàn bộ thực thể. Nếu Kept nằm sau một
proxy mà nó không tin cậy, mọi người dùng chung địa chỉ của proxy; xem
[proxy ngược](/vi/install/reverse-proxy/).

## 4. Giữ khóa

Khi khởi động lần đầu, với `KEPT_SECRET_KEY` và `KEPT_AUTH_SECRET` chưa đặt, Kept sinh cả hai
vào volume `kept-config` và ghi một dòng nhật ký nói nơi đặt. Khóa bí mật niêm phong mọi giá trị
bí mật (khóa AI, mật khẩu bạn lưu trong Kept): **bản sao lưu khôi phục mọi thứ trừ những giá trị đó trừ khi
bạn cũng có khóa.**

In khóa và giữ chúng ở đâu đó khác máy chủ này, như trình quản lý mật khẩu:

```sh
docker compose exec kept kept admin recovery-kit
```

Quản trị → Trạng thái yêu cầu bạn xác nhận bộ khôi phục, và Kept yêu cầu nó trước giá trị
bí mật đầu tiên, khóa AI hoặc cài đặt sao lưu. Xem [bộ khôi phục](/vi/admin/recovery-kit/).

## 5. Tiếp theo

- [Đặt Kept lên HTTPS](/vi/install/https/): camera, cài đặt ứng dụng, thông báo đẩy và
  vị trí chỉ hoạt động qua HTTPS.
- [Thiết lập sao lưu](/vi/admin/backups/).
- Thư: đặt `KEPT_SMTP_URL` (`smtp://` hoặc `smtps://`, có thông tin đăng nhập) và `KEPT_SMTP_FROM` cho
  đặt lại mật khẩu, lời mời và nhắc nhở qua email. Nếu không có chúng, nhắc nhở chỉ đến mọi người
  trong ứng dụng, và Quản trị → Trạng thái nói thư chưa được cấu hình.

## Compose tạo gì

| Volume | Chứa | Sao lưu? |
|---|---|---|
| `kept-db` | cơ sở dữ liệu Postgres | thông qua sao lưu của Kept, không bao giờ bằng cách sao chép volume khi nó chạy |
| `kept-data` | tệp đã tải lên (với `KEPT_STORAGE=local`, mặc định) | thông qua sao lưu của Kept |
| `kept-config` | `KEPT_SECRET_KEY` và `KEPT_AUTH_SECRET` đã sinh, và mật khẩu của đăng nhập `kept_app`, `kept_auth` và `kept_system` | giữ bộ khôi phục; mật khẩu được tạo lại nếu mất |
| `kept-owner` | mật khẩu của đăng nhập `kept_owner` | không; nó được tạo lại nếu mất |
| `caddy-data`, `caddy-config` | chứng chỉ của Caddy (hồ sơ `https` của `compose.full.yaml`) | không; Caddy lấy cái mới |

Siêu người dùng của cơ sở dữ liệu không có mật khẩu ai cần: nó chỉ được truy cập từ bên trong
container cơ sở dữ liệu, như `docker compose exec db psql -U postgres`, và bởi bootstrap,
chia sẻ mạng của container đó. Qua mạng mọi đăng nhập đều cần mật khẩu của nó. Không bao giờ công bố
cổng của dịch vụ `db` (không `ports:` trên nó): Kept truy cập nó qua mạng compose.

Các container của Kept chạy với người dùng không phải root (uid 10001) với hệ thống tệp gốc chỉ đọc, mọi
khả năng Linux bị loại bỏ và `no-new-privileges`. Dịch vụ `migrate` nắm đăng nhập của chủ sở hữu
cơ sở dữ liệu; container phục vụ không bao giờ thấy nó (volume `kept-owner` không được gắn đó) cho đến khi bạn
cấp cho nó một cái cho sao lưu đêm ([sao lưu](/vi/admin/backups/#bật-lên)). `init` là một
ngoại lệ duy nhất đối với quy tắc không phải root: nó chạy với quyền root, không có mạng và chỉ những khả năng
tạo `.env` trong thư mục của bạn và đưa nó cho bạn, và thoát.

## Không có terminal

Portainer, Dockge và các công cụ tương tự lấy `compose.yaml` (hoặc `compose.full.yaml`) nguyên vẹn. Chúng không chạy `init`, vì vậy hãy đặt hai
biến trong trình soạn thảo môi trường của chúng thay vào đó: `KEPT_PUBLIC_URL` (địa chỉ, như trên) và
`KEPT_SETUP_CODE` (sáu ký tự 0–9 và A–Z không có I, L, O và U, như `KPT-2X9`; hoặc để
trống và đọc mã từ nhật ký của Kept). Ghim `KEPT_IMAGE` vào một bản phát hành nếu công cụ không làm.

## Bản cài đặt trước 1.13.0

Bản cài đặt được tạo với một bản sao của kho chứa có năm dòng `KEPT_DB_*_PASSWORD` trong `.env`.
Với `compose.yaml` này chúng được dùng chính xác như đã cho, và không có gì được sinh: cập nhật
bản kiểm tra (hoặc tải `compose.yaml` mới bên cạnh `.env` cũ) và chạy
`docker compose up -d`. Xóa những dòng sau, hoặc ghi `.env` lại với `init`, cũng an toàn
đúng: lần khởi động tiếp theo sinh mật khẩu mới và đặt chúng trong Postgres. `KEPT_IMAGE` rỗng
trước đây build bản kiểm tra; giờ nó chạy bản phát hành mà `compose.yaml` đặt tên, vì vậy đặt
`KEPT_IMAGE=kept:local` nếu bạn build của riêng mình.

## Web và worker riêng biệt

Một container phục vụ ứng dụng web và chạy các công việc nền (`KEPT_ROLE=all`, mặc định). Để
tách chúng, chạy dịch vụ Kept thứ hai với `KEPT_ROLE=worker` bên cạnh cái với `KEPT_ROLE=web`. Một
worker không phục vụ HTTP; kiểm tra sức khỏe của ảnh theo dõi `KEPT_ROLE` và kiểm tra vòng lặp công việc
của worker thay vào đó, nên không cái nào cần ghi đè (`compose.full.yaml` có hai dịch vụ được chú thích).
Worker chạy sao lưu đêm, vì vậy nó là cái cần đăng nhập chủ sở hữu và gắn thư mục đích.
