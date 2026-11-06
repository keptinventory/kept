---
title: Kept trên mạng gia đình
description: Chạy Kept trên mạng gia đình qua HTTP đơn giản - những gì hoạt động, những gì cần HTTPS và tại sao, và hai cách thêm HTTPS không cần tên miền công cộng - Tailscale, hoặc Caddy với cơ quan chứng chỉ riêng của nó.
sidebar:
  order: 3
---

Kept hoạt động trên mạng gia đình của bạn ở một địa chỉ `http://` đơn giản, như `http://192.0.2.20:8080`
hoặc `http://kept.home.arpa:8080`. Dữ liệu của bạn hoạt động ở đó: thêm, tìm và di chuyển Đồ vật,
ảnh và tệp, nhãn, báo cáo, nhập và xuất mà không có giá trị bí mật.

Một vài Đồ vật cần HTTPS. Một số vì Kept từ chối đưa ra một khóa hoặc hiển thị một bí mật qua một kết nối mà bất kỳ ai trong mạng cũng có thể đọc; những cái khác vì trình duyệt chỉ cho phép chúng trên một địa chỉ bảo mật, mà Kept không thể thay đổi.

## Những gì hoạt động qua HTTP đơn giản

| | Qua HTTP đơn giản | Tại sao |
|---|---|---|
| Đồ vật, các vị trí, tìm kiếm, di chuyển, nhãn, báo cáo | Hoạt động | |
| Ảnh và tệp, chọn từ thiết bị | Hoạt động | |
| Nhập (Homebox, CSV, một xuất của Kept) | Hoạt động | |
| Mở các bí mật của một xuất khi nhập nó | Cần HTTPS. Qua HTTP đơn giản phần còn lại của xuất nhập mà không có chúng | Kept: cụm từ mật khẩu và các giá trị bí mật |
| Xuất mà không có giá trị bí mật | Hoạt động. Mỗi giá trị bí mật bị bỏ qua và được đánh dấu là bị bỏ qua; xuất nhập như bình thường | Dữ liệu của bạn |
| Thiết lập một giá trị bí mật | Hoạt động | |
| Hiển thị một giá trị bí mật | Cần HTTPS | Kept: một bí mật không bao giờ được gửi qua HTTP đơn giản |
| Xuất có giá trị bí mật | Cần HTTPS | Kept: các bí mật và cụm từ mật khẩu của chúng |
| Mã thông báo cho ứng dụng AI (MCP) và Home Assistant | Không từ trình duyệt. Tạo một trên máy chủ: `kept admin token create` ([CLI](/vi/admin/cli/#mã-thông-báo-từ-máy-chủ)) | Kept: một mã thông báo là một khóa |
| Kết nối một ứng dụng với OAuth (máy kết nối) | Cần HTTPS | Kept: OAuth cần một địa chỉ bảo mật |
| Tải xuống gói khôi phục | Không từ trình duyệt. Trên máy chủ: `kept admin recovery-kit` ([CLI](/vi/admin/cli/)) | Kept: nó giữ các khóa của máy chủ |
| Cài đặt sao lưu và kiểm tra của chúng | Cần HTTPS, hoặc thiết lập chúng trong môi trường của máy chủ ([cấu hình](/vi/reference/configuration/)) | Kept: mật khẩu sao lưu |
| Khóa truy cập | Cần HTTPS | Trình duyệt: không Khóa truy cập trên một địa chỉ HTTP đơn giản |
| Camera, cài đặt Kept, làm việc ngoại tuyến, thông báo đẩy, địa điểm | Cần HTTPS | Trình duyệt |

Qua HTTP đơn giản một lần đăng nhập cũng kéo dài 12 giờ và không được gia hạn; qua HTTPS nó kéo dài 30 ngày. Để thay đổi 12 giờ, xem [Giữ trong mạng của bạn](#giữ-trong-mạng-của-bạn).

Bắt đầu trên Trang chủ yêu cầu một quản trị viên phiên đặt Kept lên HTTPS. Nếu bạn chỉ dùng trong mạng gia đình, hãy chọn **Tôi chỉ dùng trong mạng gia đình** và bước được coi là xong. Dòng HTTPS ở đầu mỗi trang cũng có thể bị loại bỏ.

`localhost` được tính là một địa chỉ bảo mật trong trình duyệt, nhưng Kept dựa theo `KEPT_PUBLIC_URL`: trong khi nó là `http:`, những sự từ chối của chính Kept ở trên cũng áp dụng trên `localhost`.

## Giữ trong mạng của bạn

Ai chạy Kept có thể thay đổi hai Đồ vật trên máy chủ: thời gian một lần đăng nhập kéo dài qua HTTP đơn giản, và những địa chỉ Kept trả lời. Hai điều này đều không thể được thay đổi từ ứng dụng, và Admin → Trạng thái hiển thị cái đang có hiệu lực.

### Các lần đăng nhập dài hơn qua HTTP đơn giản

Qua HTTP đơn giản bạn đăng nhập lại mỗi 12 giờ. `KEPT_HTTP_SIGN_IN_DAYS` trong `.env` khiến nó là nhiều ngày như vậy, từ 1 đến 30, được gia hạn khi bạn sử dụng. 7 phù hợp với một mạng gia đình hoặc Tailscale:

```sh
KEPT_HTTP_SIGN_IN_DAYS=7
```

Sau đó `docker compose up -d`. Trong ứng dụng Home Assistant, đó là tùy chọn **thời gian đăng nhập qua http**.

Một cài đặt được nâng cấp từ 1.14.4 bằng cách thay đổi chỉ `KEPT_IMAGE` vẫn giữ `compose.yaml` cũ, không truyền cài đặt này: [tải về cái mới](/vi/admin/upgrades/#cài-đặt-cần-composeyaml-mới)
trước.

**Chi phí:** qua HTTP đơn giản một cookie đăng nhập có thể bị sao chép bởi bất kỳ ai có thể xem lưu lượng. Khi cài đặt được bật, một bản sao chép vẫn hoạt động trong khi nó được dùng, cho đến khi thiết bị đó đăng xuất hoặc các thiết bị khác của bạn bị đăng xuất. Vì vậy hãy giữ nó trong một mạng bạn tin tưởng, và đăng xuất trên một thiết bị bạn mất.

| | Chưa đặt | Đã đặt |
|---|---|---|
| Một lần đăng nhập qua HTTP đơn giản kéo dài | 12 giờ | Nhiều ngày như vậy |
| Được gia hạn | Không | Một lần mỗi ngày dùng (vào ngày 1, sau nửa ngày) |
| Qua HTTPS | 30 ngày, được gia hạn | 30 ngày, được gia hạn: cài đặt này không làm gì |
| Bí mật và khóa qua HTTP đơn giản | Từ chối | Từ chối |
| Hành động nhạy cảm | Mật khẩu, hoặc một lần đăng nhập trong mười phút qua | Giống nhau; một lần gia hạn không tính là một lần đăng nhập |
| Đăng xuất khỏi mọi nơi | Kết thúc mọi lần đăng nhập | Kết thúc mọi lần đăng nhập |

Bất kỳ giá trị nào khác (0, 31, `7d`) đều dừng Kept khi khởi động với một thông điệp nói nó cần gì. Việc để nó trống giống như việc để nó bỏ qua.

Khi bật, một lần đăng nhập đã thực hiện sẽ có độ dài lâu hơn vào lần sau nó được dùng. Khi tắt, một lần hết hạn theo thời gian của nó, tối đa đến độ dài nó từng có; để kết thúc sớm hơn, hãy sử dụng **Đăng xuất khỏi mọi nơi** trong Admin → Người dùng.

### Hơn một địa chỉ

Kept chỉ chấp nhận đăng nhập và lưu từ `KEPT_PUBLIC_URL`, nên một cách thứ hai để tiếp cận cùng một Kept, một tên Tailscale bên cạnh tên LAN, hoặc một IP bên cạnh một tên, nói "Kept này được thiết lập cho …". `KEPT_EXTRA_ADDRESSES` liệt kê những cái khác, phân tách bằng dấu phẩy, chính xác như trình duyệt hiển thị chúng:

```sh
KEPT_PUBLIC_URL=http://kept.lan:8080
KEPT_EXTRA_ADDRESSES=http://192.0.2.20:8080,http://<machine>.<tailnet>.ts.net:8080
```

Sau đó `docker compose up -d`. Trong ứng dụng Home Assistant, đó là tùy chọn **Các địa chỉ bổ sung**. Nó hoạt động giống nhau qua HTTPS.

Một cài đặt được nâng cấp từ 1.14.4 bằng cách thay đổi chỉ `KEPT_IMAGE` vẫn giữ `compose.yaml` cũ, không truyền cài đặt này: [tải về cái mới](/vi/admin/upgrades/#cài-đặt-cần-composeyaml-mới)
trước.

| | `KEPT_PUBLIC_URL` | Một địa chỉ bổ sung |
|---|---|---|
| Dùng Kept, đăng nhập bằng mật khẩu hoặc mã dùng một lần | Có | Có |
| Một liên kết email hoặc đặt lại mật khẩu | Mở ở đây | Mở tại `KEPT_PUBLIC_URL` |
| Khóa truy cập | Có, qua HTTPS | Không; một Khóa truy cập thuộc về một địa chỉ |
| Đăng nhập Google và OIDC | Có | Nút mở `KEPT_PUBLIC_URL` |
| Ứng dụng AI (MCP, OAuth) | Có | Kết nối chúng tại `KEPT_PUBLIC_URL`: `/mcp` từ chối địa chỉ này, và sự đồng ý của OAuth bị từ chối ở đây |
| Liên kết, nhãn, mã QR, thư, nguồn lịch | Trỏ ở đây | Vẫn trỏ tới `KEPT_PUBLIC_URL` |

- **Mỗi địa chỉ đăng nhập riêng và cài đặt như một ứng dụng riêng,** vì trình duyệt giữ cookie và dữ liệu ngoại tuyến theo mỗi địa chỉ. Đăng xuất trên một cái để kia vẫn đăng nhập; **Đăng xuất khỏi mọi nơi** kết thúc cả hai. Thông báo đẩy, ở nơi HTTPS cho phép, mở trên địa chỉ thiết bị đã bật chúng. Hai cổng trên một tên máy chủ chia sẻ cookie của chúng: trình duyệt không giữ chúng theo mỗi cổng.
- **Một liên kết email** được yêu cầu trên một địa chỉ bổ sung mở tại `KEPT_PUBLIC_URL` và đăng nhập bạn ở đó, không ở nơi bạn yêu cầu. Việc đặt lại mật khẩu đặt mật khẩu ở đó; sau đó đăng nhập trên địa chỉ bạn đang ở. Nếu `KEPT_PUBLIC_URL` không thể tiếp cận từ nơi bạn, hãy dùng mật khẩu của bạn.
- **Khóa truy cập:** thêm và dùng chúng tại `KEPT_PUBLIC_URL`. Một địa chỉ bổ sung đưa ra mật khẩu của bạn hoặc một liên kết email và nói tại sao.
- **Địa chỉ chính xác:** scheme, host và port, so sánh toàn bộ. `http://kept.lan` không phải `http://kept.lan:8080`, và `kept.lan.example.com` không phải `kept.lan`. Một ký tự đại diện, một đường dẫn, một đăng nhập hoặc sự trộn lẫn `http` và `https` dừng Kept khi khởi động với một thông điệp nói cái nào. Việc để nó trống giống như việc để nó bỏ qua.
- **Header được chuyển tiếp:** `Host` và `X-Forwarded-*` không đóng vai trò nào, nên proxy của bạn không thể thêm một địa chỉ vô tình, hoặc lấy một cái đi. Trỏ nó đến Kept cho mỗi địa chỉ bạn liệt kê.

**Chi phí:** một trang được phục vụ tại một địa chỉ được liệt kê được coi như chính Kept, và có thể dùng lần đăng nhập của ai mở nó ở đó. Vì vậy hãy chỉ liệt kê những địa chỉ tiếp cận đến Kept này, trên tên và IP bạn kiểm soát.

## Thêm HTTPS: Tailscale trước

Công việc ít nhất cho một gia đình: cài đặt Tailscale trên máy chạy Kept và trên mỗi điện thoại và máy tính dùng nó, bật chứng chỉ HTTPS cho tailnet của bạn, và phân phát Kept với

```sh
tailscale serve --bg 8080
```

Kept sau đó ở `https://<machine>.<tailnet>.ts.net`, với một chứng chỉ mọi thiết bị đã tin tưởng, từ nhà hoặc xa nhà. Thiết lập `KEPT_PUBLIC_URL` thành địa chỉ đó và khởi động lại Kept. Xem thêm tại [Đặt Kept lên HTTPS](/vi/install/https/#tailscale).

## Thêm HTTPS: Caddy với cơ quan chứng chỉ riêng của nó

Không có Tailscale và không có tên miền công cộng, Caddy có thể ký một chứng chỉ cho một tên mạng gia đình chính nó (`tls internal`). Nó hoạt động, nhưng không nhanh: **mọi thiết bị mở Kept phải được yêu cầu tin tưởng chứng chỉ gốc của Caddy**, một cái mỗi lần, cho mọi người trong nhà. Cho đến khi một thiết bị tin tưởng nó, trình duyệt của nó hiển thị một cảnh báo bảo mật.

1. Chọn một tên mọi thiết bị có thể phân giải đến máy, ví dụ `kept.home.arpa` (một mục DNS trên bộ định tuyến của bạn, hoặc một mục trong tệp hosts của mỗi thiết bị).
2. Thiết lập nó trong `.env`:

   ```sh
   KEPT_DOMAIN=kept.home.arpa
   KEPT_PUBLIC_URL=https://kept.home.arpa
   ```

3. Caddy đi kèm với `compose.full.yaml`: tải về nó và `docker/caddy/Caddyfile`, và thiết lập `COMPOSE_FILE=compose.full.yaml` trong `.env`, như trong [Đặt Kept lên HTTPS](/vi/install/https/#hồ-sơ-caddy-của-compose). Sau đó thêm `tls internal` vào Caddyfile:

   ```caddy
   {$KEPT_DOMAIN} {
   	tls internal
   	encode zstd gzip
   	reverse_proxy kept:8080
   }
   ```

4. Khởi động Caddy và sao chép chứng chỉ gốc của nó ra khỏi khối lượng dữ liệu của nó:

   ```sh
   docker compose --profile https up -d
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./kept-root.crt
   ```

5. Cài đặt `kept-root.crt` trên mọi thiết bị và tin tưởng nó:
   - **iPhone và iPad:** gửi nó đến thiết bị (AirDrop hoặc thư), cài đặt hồ sơ trong Cài đặt → Chung → Quản lý VPN & Thiết bị, sau đó bật tin tưởng đầy đủ cho nó trong Cài đặt → Chung → Giới thiệu → Cài đặt Tin tưởng Chứng chỉ.
   - **Android:** trong cài đặt bảo mật, cài đặt nó như một chứng chỉ CA (tên menu khác nhau theo nhà sản xuất). Một số ứng dụng bỏ qua chứng chỉ do người dùng cài đặt.
   - **Máy tính:** thêm nó vào chứng chỉ đáng tin tưởng của hệ thống (Truy cập Chuỗi khóa trên Mac, trình quản lý chứng chỉ trên Windows, kho CA của phân phối trên Linux). Firefox có thể giữ danh sách riêng của nó.

Gốc của Caddy kéo dài mười năm; những chứng chỉ nó ký với nó tự gia hạn. Khóa riêng của gốc giữ trong khối lượng `caddy-data`: bất kỳ ai sao chép nó có thể ký cho bất kỳ tên nào thiết bị của bạn bây giờ tin tưởng, vậy hãy bảo vệ khối lượng đó như một mật khẩu. [mkcert](/vi/install/https/#một-chứng-chỉ-chỉ-các-thiết-bị-của-bạn-tin-tưởng) là ý tưởng tương tự với một công cụ khác.

## Mở Kept tại địa chỉ đúng

Mở Kept tại địa chỉ trong `KEPT_PUBLIC_URL`. Mở tại một cái khác (địa chỉ IP của máy khi URL đặt tên là `kept.home.arpa`, ví dụ), đăng nhập nói địa chỉ nào Kept này được thiết lập cho, với một liên kết đến nó.
