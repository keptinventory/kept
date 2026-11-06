---
title: Đặt Kept chạy qua HTTPS
description: Tại sao Kept cần HTTPS, và cách làm - Caddy từ compose.full.yaml, Tailscale, NetBird, Twingate, Cloudflare Tunnel hoặc proxy riêng của bạn.
sidebar:
  order: 2
---

Kept chạy qua HTTP thuần, nhưng điện thoại coi địa chỉ HTTP thuần là không an toàn, và một số chức năng ngừng hoạt động:

- **máy ảnh** (Kept quay lại trình chọn tệp),
- **cài đặt Kept** lên màn hình chính, và làm việc ngoại tuyến từ nó,
- **thông báo đẩy**,
- **vị trí**.

`localhost` được coi là an toàn; một địa chỉ LAN qua HTTP không an toàn. Với `KEPT_PUBLIC_URL` là `https:`, Kept cũng đánh dấu các cookie của nó `Secure` và gửi HSTS; `KEPT_HSTS=off` xóa nó khi các dịch vụ HTTP thuần chia sẻ tên máy chủ ([HSTS](/vi/install/reverse-proxy/#hsts)).

Kept từ chối hoàn toàn một số chức năng khi `KEPT_PUBLIC_URL` là `http:`, kể cả trên `localhost`, vì chúng cung cấp hoặc thay đổi một bí mật: hiển thị một giá trị bí mật, một bản xuất có giá trị bí mật, mở các bí mật của một bản xuất khi nhập nó, tạo mã thông báo truy cập trong trình duyệt, kết nối một ứng dụng với OAuth, tải bộ khôi phục xuống, và thay đổi hoặc kiểm tra cài đặt sao lưu. Một bản xuất không có giá trị bí mật vẫn hoạt động, và một lần nhập không có chúng cũng vậy. Phiên cũng ngắn hơn qua HTTP. Trong khi Kept được phục vụ qua HTTP, danh sách kiểm tra Bắt đầu trên Trang chủ đặt "Đặt Kept chạy qua HTTPS" ở đầu, cho đến khi một quản trị viên chọn "Giữ ở mạng nhà tôi". Mọi thứ vẫn hoạt động qua HTTP thuần, trong một bảng: [Kept trên một mạng nhà](/vi/install/home-network/).

## Hồ sơ Caddy của Compose

Với một tên miền trỏ đến máy này, các cổng 80 và 443 có thể tiếp cận từ internet (Caddy chứng minh tên miền với Let's Encrypt hoặc ZeroSSL qua chúng). Caddy đi kèm với `compose.full.yaml`, không phải `compose.yaml` ([Caddy và Ollama](/vi/install/compose/#caddy-và-ollama)):

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

Caddy đọc `docker/caddy/Caddyfile` bên cạnh tệp Compose. Một bản sao của kho có cả hai tệp; một cài đặt không có chúng sẽ tải về một lần:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/docker/caddy/Caddyfile
docker compose --profile https up -d
```

Không có tệp, `docker compose --profile https up -d` dừng với "bind source path does not exist". Bất kỳ proxy nào khác cũng hoạt động; nó chuyển tiếp đến cổng của Kept, như trong các phần dưới đây.

Caddy lấy và gia hạn chứng chỉ và chuyển tiếp tất cả đến Kept. Compose đưa cho Caddy một địa chỉ cố định trên mạng riêng của nó và truyền địa chỉ đó đến Kept dưới dạng `KEPT_TRUSTED_PROXIES`, nên Kept tin vào `X-Forwarded-For` của Caddy và không tin vào cái khác. Bạn sau đó có thể ràng buộc HTTP thuần chỉ với loopback, bằng `KEPT_HTTP_PORT=127.0.0.1:8080`.

Nếu `172.29.72.0/24` trùng với LAN của bạn, hãy thay đổi subnet của mạng, `ip_range` của nó, `ipv4_address` của Caddy và `KEPT_TRUSTED_PROXIES` cùng nhau trong `compose.full.yaml`.

## Tailscale

Dành cho Kept chỉ các thiết bị của bạn truy cập, không mở cổng nào đến internet: trên máy chạy Kept, với chứng chỉ HTTPS được bật cho tailnet của bạn,

```sh
tailscale serve --bg 8080
```

phục vụ Kept tại `https://<machine>.<tailnet>.ts.net` với chứng chỉ thực, đến mọi thiết bị trên tailnet. Thiết lập `KEPT_PUBLIC_URL` thành địa chỉ đó.

Proxy của Tailscale chạy trên cùng một máy và kết nối đến Kept từ `127.0.0.1`; Kept xem mọi yêu cầu như đến từ đó trừ khi bạn tin tưởng nó. Trên một instance chỉ cho một gia đình, điều đó chỉ quan trọng cho [khoá thiết lập](/vi/install/reverse-proxy/#khóa-thiết-lập).

## NetBird

Proxy ngược của NetBird đưa một cổng của peer về một địa chỉ `https://` công khai với chứng chỉ:

```sh
netbird expose 8080
```

Nó in địa chỉ đó. Thiết lập `KEPT_PUBLIC_URL` thành nó (hoặc thành miền của riêng bạn, với `--with-custom-domain kept.example.org`, đã thiết lập trong NetBird trước). Địa chỉ đó là công khai trừ khi bạn chọn **Truy cập Chỉ NetBird** cho dịch vụ trong bảng điều khiển, điều đó giới hạn nó đến các peer của bạn. Một quản trị viên tài khoản bật **Hiển thị peer** trong Cài đặt → Khách trước.

## Twingate

Twingate cho phép Kept được truy cập từ các thiết bị của bạn mà không mở cổng nào, nhưng chứng chỉ là của bạn: hãy cho Kept một tên máy chủ trên một miền bạn sở hữu (`kept.example.org`), lấy chứng chỉ cho nó bằng một thách thức DNS (Caddy, Traefik hoặc cert-manager có thể), và thêm tên máy chủ đó làm một tài nguyên Twingate. Thiết lập `KEPT_PUBLIC_URL` thành `https://kept.example.org`.

## Cloudflare Tunnel

Dành cho một địa chỉ công khai không mở cổng. Cloudflare phân phối tên máy chủ qua HTTPS và chuyển tiếp đến Kept thông qua `cloudflared`:

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

với `~/.cloudflared/config.yml`:

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

Thiết lập `KEPT_PUBLIC_URL` thành `https://kept.example.org`. Cloudflare Access có thể đặt một trang đăng nhập trước nó. Một địa chỉ công khai cũng là điều mà một ứng dụng web như claude.ai cần để [kết nối đến máy chủ MCP của Kept](/vi/users/mcp-clients/#kết-nối-như-trình-kết-nối-oauth).

`cloudflared`, như các đường hầm khác ở đây, tiếp cận Kept từ cùng một máy; tin tưởng nó như trong [proxy ngược](/vi/install/reverse-proxy/#tin-tưởng-proxy-và-chỉ-proxy).

## Proxy ngược riêng của bạn

Bất kỳ proxy nào chấm dứt TLS và chuyển tiếp đến cổng 8080 đều hoạt động. Đọc [proxy ngược](/vi/install/reverse-proxy/) cho ba cài đặt quan trọng.

## Một chứng chỉ chỉ các thiết bị của bạn tin tưởng

Trên một LAN không có miền, mkcert có thể tạo một chứng chỉ cho địa chỉ của máy, phục vụ qua bất kỳ proxy TLS nào. Mọi điện thoại sau đó phải tin chứng chỉ gốc của mkcert; trên một iPhone điều đó có nghĩa là cài đặt nó như một hồ sơ và bật tin tưởng đầy đủ trong Cài đặt → Chung → Giới thiệu → Cài đặt Tin tưởng Chứng chỉ. Tailscale thường ít việc hơn.
