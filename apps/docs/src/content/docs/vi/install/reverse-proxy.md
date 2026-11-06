---
title: "Đứng sau một reverse proxy"
description: "Các cài đặt quan trọng khi Kept nằm sau nginx, Traefik, Caddy hoặc proxy khác - địa chỉ đáng tin cậy, kích thước tải lên, hostname nào để dùng, lỗi địa chỉ và HSTS."
sidebar:
  order: 3
---

Kept lắng nghe trên cổng 8080 và nói HTTP thuần túy; proxy ở trước nó chấm dứt TLS. Trỏ proxy tới cổng 8080, đặt `KEPT_PUBLIC_URL` thành địa chỉ mà mọi người mở, và kiểm tra các điều bên dưới. Hồ sơ [Caddy](/vi/install/https/#hồ-sơ-caddy-của-compose) của Compose đã làm ba việc đầu tiên.

## Tin tưởng proxy, và chỉ proxy

Kept giới hạn tốc độ đăng nhập, mã thiết lập và các yêu cầu nhạy cảm khác **theo địa chỉ khách hàng**. Đứng sau proxy, địa chỉ của khách đến trong `X-Forwarded-For`, thứ mà ai cũng có thể viết. Kept chỉ tin nó từ các địa chỉ trong `KEPT_TRUSTED_PROXIES`:

```sh
KEPT_TRUSTED_PROXIES=10.0.0.5            # one proxy
KEPT_TRUSTED_PROXIES=10.0.0.5,10.0.1.0/24  # several, or a range
```

Kept duyệt `X-Forwarded-For` từ phải sang trái và dừng tại địa chỉ đầu tiên mà nó không tin: đó là khách hàng. Rỗng (mặc định), địa chỉ socket là khách hàng. Liệt kê địa chỉ của proxy như Kept thấy nó (trên mạng Docker, địa chỉ container proxy, không phải của host), và không có thứ gì mà người lạ có thể gửi yêu cầu từ đó.

Với Compose, đặt nó trong `.env` cạnh `compose.yaml`. Trước 1.14.5, `compose.yaml` tự đặt giá trị của nó và một dòng trong `.env` không bao giờ đến Kept; trên những phiên bản đó hãy đặt nó cho dịch vụ `kept` trong một `compose.override.yaml`. Với `compose.full.yaml` có Caddy, để trống (địa chỉ Caddy là mặc định) hoặc giữ `172.29.72.200` trong danh sách.

### Khóa thiết lập

Mã thiết lập sai khóa địa chỉ gửi chúng một lúc, và nhiều mã sai khóa toàn bộ thể hiện. Nếu proxy không có trong `KEPT_TRUSTED_PROXIES`, mọi khách chung địa chỉ của proxy, nên đoán của một người khóa tất cả mọi người. `kept admin setup-code` cấp mã mới và gỡ khóa thể hiện, nhưng không gỡ khóa theo địa chỉ: khóa đó tự hết.

## Để tải lên đi qua

Proxy phải chấp nhận thân yêu cầu ít nhất bằng Kept, và không nên đệm tải lên mà nó không cần:

| Tải lên | Giới hạn của Kept |
|---|---|
| Một ảnh, hóa đơn hoặc tài liệu | `KEPT_MAX_FILE_MB`, 25 MB mặc định; luồng, từ chối bằng 413 trước khi đọc khi quá lớn |
| Một nhập CSV | 8 MB |

Mặc định của hầu hết proxy nhỏ hơn (`client_max_body_size` của nginx, chẳng hạn); tăng nó lên ít nhất `KEPT_MAX_FILE_MB`. Thời gian chờ phải cho phép tải lớn qua kết nối điện thoại chậm.

## Cho Kept hostname riêng

Phục vụ Kept trên hostname mà miền cha không có trang nào bạn không kiểm soát, hoặc trên một miền riêng. Qua HTTPS cookie phiên của Keht có tiền tố `__Secure-`, vẫn cho phép trang trên **subdomain anh chị em** (`other.example.org` bên cạnh `kept.example.org`) đặt cookie cho `example.org` mà trình duyệt cũng gửi tới Kept. Anh chị em do người khác chạy có thể dùng đó để gán cố phiên. Các dịch vụ khác của bạn trên subdomain anh chị em không sao.

## "Kept này được thiết lập cho …"

Ứng dụng nói "Kept này được thiết lập cho *địa chỉ*. Hãy mở nó ở đó." khi nó được mở ở địa chỉ khác `KEPT_PUBLIC_URL`.

- **Tại sao:** Kept chỉ chấp nhận ghi từ địa chỉ trong `KEPT_PUBLIC_URL`, bởi `Origin` của trình duyệt: scheme, host và cổng, chính xác. Proxy không đóng vai trò; địa chỉ của nó và header `X-Forwarded-*` không thay đổi nó.
- **Sửa:** đặt `KEPT_PUBLIC_URL` chính xác thành địa chỉ mọi người mở (`https://kept.example.org`, không phải upstream của proxy `http://kept:8080`), và khởi động lại Kept.
- **Nhiều hơn một địa chỉ:** `KEPT_EXTRA_ADDRESSES` liệt kê những cái khác, và mỗi cái cũng phải đến Kept qua proxy của bạn ([Nhiều hơn một địa chỉ](/vi/install/home-network/#hơn-một-địa-chỉ)).

Thêm trong [Khắc phục sự cố](/vi/admin/troubleshooting/#kept-này-được-thiết-lập-cho--hoặc-yêu-cầu-không-đến-từ-trang-web-này).

## HSTS

Với `KEPT_PUBLIC_URL` có `https:`, Kept gửi `Strict-Transport-Security: max-age=31536000`: trình duyệt sau đó chỉ mở hostname này qua https, trong một năm. Qua `http:` nó không gửi gì.

- **Toàn bộ hostname, mọi cổng:** trình duyệt áp dụng chính sách cho hostname, không phải cổng của Kept. Dịch vụ plain-http trên cùng tên, như `http://server.lan:8081` bên cạnh Kept trên `https://server.lan`, bị ép sang https và ngừng tải. Trình duyệt bỏ qua HSTS từ địa chỉ IP.
- **Tắt nó:** đặt `KEPT_HSTS=off` khi các dịch vụ plain-http khác chia sẻ hostname của Kept, và khởi động lại. Kept gửi `max-age=0`, nên trình duyệt đã lưu chính sách quên nó ở lần truy cập https tiếp theo tới Kept. Bỏ qua header không xóa nó.
- **Proxy của bạn:** nếu nó thêm header `Strict-Transport-Security` riêng, tắt nó ở đó nữa.
- **Miền preloaded:** dưới top-level domain trong danh sách preload HSTS của trình duyệt, như `.dev` hoặc `.app`, mọi tên chỉ https, bất kể Kept gửi gì.

### Xóa chính sách đã lưu thủ công

Khi Kept không còn truy cập qua https, `max-age=0` không đến trình duyệt. Xóa hostname trong từng trình duyệt đã truy cập nó:

- **Chrome, Edge và các trình duyệt Chromium khác:** mở `chrome://net-internals/#hsts` (trong Edge, `edge://net-internals/#hsts`), nhập hostname dưới **Delete domain security policies**, và chọn **Xóa**.
- **Firefox:** Lịch sử → Quản lý Lịch sử, tìm trang, chuột phải và chọn **Quên Trang Này**. Cách này cũng xóa lịch sử, cookie và đăng nhập đã lưu của nó.
- **Safari trên Mac:** không có trang cho HSTS. Xóa dữ liệu trang (Cài đặt → Riêng tư → Quản lý Dữ liệu Trang web, chọn nó, **Xóa**); nếu plain http vẫn biến thành https, xóa lịch sử nữa (Lịch sử → Xóa Lịch sử).
- **Safari trên iPhone hoặc iPad:** Cài đặt → Ứng dụng → Safari (Cài đặt → Safari trước iOS 18) → Nâng cao → Dữ liệu Trang web, tìm trang và xóa nó; nếu không đủ, **Xóa Lịch sử và Dữ liệu Trang web** trên trang Safari.
