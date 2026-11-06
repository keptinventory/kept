---
title: "Nâng cấp và khôi phục"
description: "Nâng cấp Kept, bản chụp nhanh (snapshot) nó thực hiện trước đó, quay lại một phiên bản, và nâng cấp Postgres major."
sidebar:
  order: 5
---

## Nâng cấp

Với Compose, trỏ `KEPT_IMAGE` trong `.env` tại bản phát hành mới và:

```sh
docker compose pull
docker compose up -d
```

Build riêng từ checkout: `git pull`, `docker build -t kept:local .`, sau đó
`docker compose up -d` với `KEPT_IMAGE=kept:local`.

Một bản phát hành cũng có thể thay đổi `compose.yaml`; ghi chú phát hành sẽ nói rõ. Tải file của bản phát hành đè lên file của bạn
(`curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.yaml`, hoặc
`compose.full.yaml` nếu bạn chạy file đó); `.env` giữ nguyên.

### Cài đặt cần compose.yaml mới

`compose.yaml` truyền cho Kept các cài đặt nó đặt tên, chứ không phải những cái khác. Nâng cấp lên 1.14.5 mà chỉ
thay đổi `KEPT_IMAGE` sẽ giữ file của 1.14.4, file đó không truyền `KEPT_HTTP_SIGN_IN_DAYS` hay
`KEPT_EXTRA_ADDRESSES` và tự đặt `KEPT_TRUSTED_PROXIES`. Những dòng đó trong `.env` không có tác dụng cho đến khi
bạn tải `compose.yaml` của 1.14.5 (hoặc `compose.full.yaml`) và chạy `docker compose up -d`.

### Caddy và Ollama chuyển sang compose.full.yaml

Từ 1.14.5, `compose.yaml` chỉ chạy Kept và cơ sở dữ liệu của nó. Caddy (profile `https`),
Ollama (profile `ollama`) và phần triển khai chia tách đã được comment nằm trong
`compose.full.yaml`: file đó cộng thêm các thành phần đó. **Nếu bạn dùng Caddy hoặc Ollama**, hãy tải
`compose.full.yaml` thay vào đó và đặt `COMPOSE_FILE=compose.full.yaml` trong `.env`:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.full.yaml
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose --profile https up -d   # the profiles you use: https, ollama or both
```

Nếu không thì lần tải `compose.yaml` tiếp theo sẽ bỏ Caddy: Compose coi container của nó là orphan,
và khi nó mất đi, Kept sẽ chỉ chạy trên http thuần túy. Các dịch vụ, mạng và volume của Kept
(chứng chỉ của Caddy trong `caddy-data`, mô hình trong `ollama`) giống nhau trong cả hai file, nên
không có gì bị mất. Nếu không dùng Caddy hay Ollama, thì không có gì thay đổi.

**Đằng sau proxy riêng của bạn**, `KEPT_TRUSTED_PROXIES` trong `.env` truyền tới Kept từ 1.14.5. Trước đó,
`compose.yaml` tự đặt giá trị của nó, nên một dòng trong `.env` bị bỏ qua và mọi người truy cập đều chia sẻ
giới hạn đăng nhập của proxy. Giá trị đã có trong `.env` có hiệu lực khi bạn đã tải `compose.yaml` của 1.14.5
([trên](#cài-đặt-cần-composeyaml-mới)); cái trong
`compose.override.yaml` có thể chuyển sang `.env`. Với Caddy của `compose.full.yaml`, hãy để trống hoặc
giữ `172.29.72.200` trong danh sách ([reverse proxies](/vi/install/reverse-proxy/#tin-tưởng-proxy-và-chỉ-proxy)).

### Đường dẫn đăng nhập (1.14.0)

1.14.0 chuyển Kept sang better-auth 1.7.13, sửa một lỗ hổng bảo mật nơi state của đăng nhập OAuth
có thể được dùng như đường dẫn phép thuật để đăng nhập thành người khác (GHSA-965c-763c-88jm). Một đường dẫn phép thuật
đã gửi qua thư, hoặc một đăng nhập Google hoặc OIDC đã bắt đầu, trước khi nâng cấp sẽ không còn hoạt động: hãy yêu cầu
đường dẫn mới, hoặc đăng nhập lại.

### Cài đặt không cần clone (1.13.0)

Từ 1.13.0 `compose.yaml` không cần bản sao của repository và không cần mật khẩu cơ sở dữ liệu: dịch vụ `bootstrap`
chạy một lần tạo các đăng nhập ở mỗi lần khởi động. Cài đặt làm trước vẫn hoạt động như cũ: năm dòng
`KEPT_DB_*_PASSWORD` trong `.env` được dùng như đã cho
([cài đặt từ trước 1.13.0](/vi/install/compose/#bản-cài-đặt-trước-1130)). Hai điều cần biết: `KEPT_IMAGE` rỗng không còn build checkout nữa
(nó chạy `compose.yaml` của bản phát hành chỉ định), và `compose.override.yaml` của bản sao lưu đêm đọc mật khẩu
của chủ sở hữu từ volume `kept-owner` sau khi `.env` không còn giữ nó ([sao lưu](/vi/admin/backups/#bật-lên)).

Dịch vụ `migrate` chạy một lần thực thi `kept migrate` trước: các migration áp dụng **một lần, dưới khóa cơ sở dữ liệu**,
trước khi phiên bản mới phục vụ yêu cầu. Migration của Kept chỉ thêm (cột hoặc bảng chỉ bị xóa hoặc đổi tên qua hai bản phát hành),
nên phiên bản trước vẫn chạy được trên schema mới, đó là điều làm việc quay lại trở nên khả thi.

Hãy đọc ghi chú phát hành trước khi nâng cấp phiên bản major (`1.x` lên `2.0`).

### Image đã chuyển (1.8.0)

Từ 1.8.0 image là `ghcr.io/keptinventory/kept` và chart
`oci://ghcr.io/keptinventory/charts/kept`. Các bản phát hành đến 1.7.1 vẫn ở
`ghcr.io/ibrahimroshdy/kept`, nơi không nhận phiên bản mới. Để nâng cấp, hãy đổi tên image một lần:

- Compose: `KEPT_IMAGE=ghcr.io/keptinventory/kept:1.8.0`.
- Helm: `image.repository: ghcr.io/keptinventory/kept`, hoặc cài chart từ địa chỉ mới.

Khóa ký vẫn giống nhau, nên `cosign verify --key cosign.pub ghcr.io/keptinventory/kept:<version>`
hoạt động như trước ([Xác minh bản phát hành](/vi/admin/verify-release/)).

### Biết có phiên bản mới

Kept có thể kiểm tra phiên bản mới, và nó **tắt theo mặc định**. Khi bật, nó hỏi GitHub một lần mỗi ngày
về bản phát hành mới nhất của repository mà image của nó được build từ đó, không gửi gì ngoài yêu cầu (không
có phiên bản, không có định danh instance). Không có gì được tải hoặc cài đặt. `KEPT_UPDATE_CHECK=true`
bật và khóa nó; `false` khóa tắt nó.

Công tắc nằm trong Admin → Đăng ký, dưới mục "Phiên bản mới". Admin → Trạng thái nói "Kept X có sẵn"
khi có bản phát hành mới hơn, và **Kiểm tra ngay** của nó hỏi ngay lập tức.

## Bản chụp nhanh trước mỗi lần nâng cấp

Khi `kept migrate` tìm thấy migration chưa áp dụng trên cơ sở dữ liệu đã có dữ liệu, và mục tiêu sao lưu
đã được cấu hình, nó trước tiên chụp bản chụp nhanh chỉ cơ sở dữ liệu bằng restic gắn thẻ `pre_upgrade`. **Nếu
bản chụp nhanh thất bại, không có migration nào được thực hiện** và lệnh dừng lại kèm lý do. 3 bản chụp nhanh
pre-upgrade gần nhất được giữ lại.

- Không có mục tiêu sao lưu: Kept vẫn migrate, ghi log rõ ràng, và Admin → Trạng thái nói nó đã "nâng cấp
  không có sao lưu" cho đến lần sao lưu tốt tiếp theo.
- `KEPT_UPGRADE_SNAPSHOT=off` (hoặc `kept migrate --skip-snapshot`) bỏ qua nó cố ý.
- [Ứng dụng Home Assistant](/vi/install/home-assistant/) không bao giờ chụp: sao lưu của Home Assistant
  trước khi cập nhật là đường quay lại.
- Cơ sở dữ liệu hoàn toàn mới không bao giờ chụp.

Để điều này hoạt động, dịch vụ `migrate` cần khóa, cài đặt sao lưu cũng như đăng nhập chủ sở hữu.
File Compose cấp cho nó cả ba thứ; mục tiêu thư mục cũng cần mount của nó trên `migrate`
([sao lưu](/vi/admin/backups/#bật-lên)).

## Quay lại một phiên bản

Để khôi phục, hãy chạy lại image của bản phát hành trước: `KEPT_IMAGE` về tag cũ, sau đó
`docker compose up -d`. Không có migration xuống; phiên bản trước chạy trên schema mới hơn.

Kept ghi lại migration của từng bản phát hành trong cơ sở dữ liệu, và kiểm tra khi khởi động:

- cơ sở dữ liệu **mới hơn một bản phát hành** so với image: Kept khởi động, và Admin → Trạng thái nói nó đã
  được khôi phục từ X;
- **nhiều hơn một** bản phát hành, hoặc mới hơn bởi migration không do bản phát hành nào ghi nhận: Kept từ chối
  khởi động (`downgrade_refused`) và nêu cả hai phiên bản. Đó là lúc để
  [khôi phục](/vi/admin/restore/) bản chụp nhanh pre-upgrade thay vào đó. `KEPT_ALLOW_DOWNGRADE=1` ép buộc
  khởi động, và việc ép buộc được ghi nhật ký kiểm tra.

Từ 1.14.4 về 1.14.3: bản đồ của 1.14.3 có tối thiểu 1 m. Phòng dưới 1 m một cạnh giữ kích thước của nó
cho đến khi ai đó bấm **Xong** trong **Sắp xếp**, lúc đó nó lưu ở 1 m (hoặc từ chối, nếu điều đó làm nó
chồng lên phòng kế tiếp). Để giữ những kích thước đó, đừng sắp xếp bản đồ cho đến khi bạn quay lại 1.14.4.

## Nâng cấp Postgres major

File Compose của Kept ghim Postgres 18 theo digest, và cập nhật phụ thuộc của nó không bao giờ đề xuất
tăng major. Phiên bản major mới là **xuất (dump) và khôi phục (restore)**, không bao giờ đổi tag trên volume
cũ (file dữ liệu của một major version không mở được trong major khác):

1. Thực hiện sao lưu và để nó xong: `docker compose run --rm --no-deps --entrypoint kept kept admin backup`.
2. Dừng Kept: `docker compose stop kept`.
3. Đổi image `db` sang major version mới, trên volume **mới** (đổi tên `kept-db` trong
   `compose.yaml`, hoặc dời cái cũ ra); giữ volume cũ cho đến khi xong.
4. `docker compose up -d db`: script init tạo role và extension trong cơ sở dữ liệu rỗng.
5. [Khôi phục](/vi/admin/restore/#sau-khi-mất-máy-chủ) sao lưu vào đó, sau đó `docker compose up -d`.

Image của Kept mang công cụ client của major Postgres mà nó hỗ trợ, và việc khôi phục kiểm tra
chúng khớp với major của server.
