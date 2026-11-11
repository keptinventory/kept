---
title: Cài đặt trên Unraid
description: Cài đặt Kept từ Community Applications của Unraid dưới dạng một container, gồm Kept và cơ sở dữ liệu riêng, mọi thứ nằm trong thư mục appdata.
sidebar:
  order: 2
  label: Unraid
---

Kept chạy trên Unraid dưới dạng một container từ **Community Applications** (thẻ **Apps**): Kept và
cơ sở dữ liệu PostgreSQL riêng, mọi thứ nằm trong `/mnt/user/appdata/kept`. Không cần Compose,
không cần tự đặt mật khẩu.

## Bạn cần

| | |
|---|---|
| Unraid | Có thẻ **Apps** (plugin Community Applications) |
| Bộ nhớ | Khoảng 300 MB trống cho Kept và cơ sở dữ liệu của nó |
| Một địa chỉ | Địa chỉ bạn sẽ mở Kept, chẳng hạn `http://tower.local:8080`. Dùng một cái tên thay vì địa chỉ IP: nhãn in ra mang địa chỉ này |

## Cài đặt

1. **Apps**, tìm **Kept**, rồi **Install**.
2. **Kept's address**: địa chỉ bạn sẽ mở Kept, không có đường dẫn. Phần còn lại có thể giữ
   nguyên. **Show more settings** chứa các mục tùy chọn: thư, đăng nhập bằng OIDC và Google, một
   reverse proxy, việc đăng ký.
3. **Apply.** Unraid tải image về và khởi động container.
4. Thẻ **Docker**, biểu tượng của Kept, **Logs**: mã thiết lập.

   ```text
   app: Kept is at http://tower.local:8080
   KEPT SETUP CODE: XXX-XXX
   ```

5. Biểu tượng của Kept, **WebUI**. Kept hiện **Nhập mã thiết lập**: gõ mã, rồi
   **Tạo tài khoản đầu tiên**. Tài khoản này trở thành quản trị viên của phiên bản.
6. **Giữ các khóa.** Biểu tượng của Kept, **Console**, rồi:

   ```sh
   kept admin recovery-kit
   ```

   Chép văn bản bắt đầu bằng `KEPT RECOVERY KIT` sang nơi khác ngoài máy chủ này, chẳng hạn trình
   quản lý mật khẩu. Không có các khóa, bản sao lưu không lấy lại được các giá trị bí mật.

Lần khởi động đầu tiên tạo cơ sở dữ liệu và mất khoảng một phút. Docker báo container khỏe ngay khi
Kept trả lời.

## Trong thư mục appdata có gì

| Thư mục | Nội dung |
|---|---|
| `postgres/` | Cơ sở dữ liệu đang chạy. Thuộc người dùng `postgres` của container |
| `kept/` | Ảnh và tệp. Thuộc uid 10001, người dùng mà Kept chạy dưới tên |
| `config/` | Các khóa của Kept (`secrets.json`) và mật khẩu cơ sở dữ liệu. Thuộc uid 10001 |
| `owner/` | Mật khẩu của chủ sở hữu cơ sở dữ liệu. Chỉ root: tiến trình của Kept không bao giờ đọc nó |
| `backup/kept.pgdump` | Bản dump của cơ sở dữ liệu, ghi mỗi khi container dừng |

Container khởi động bằng root, giao các thư mục này cho chủ của chúng, rồi chạy Postgres và Kept
bằng người dùng riêng. Bản thân thư mục vẫn thuộc root: không ai khác liệt kê được nội dung.

## Sao lưu

- **Sao lưu thư mục appdata** khi container đã dừng, chẳng hạn bằng plugin Appdata Backup của
  Unraid. Khi dừng, container ghi `backup/kept.pgdump` trước, nên bản sao lưu có một bản nhất quán
  của cơ sở dữ liệu kể cả khi các tệp đang chạy thì không.
- **Khôi phục:** đặt thư mục về chỗ cũ rồi khởi động Kept. Khi không có thư mục `postgres/` và có
  bản dump trong `backup/`, Kept khôi phục cơ sở dữ liệu từ bản dump lúc khởi động; nhật ký ghi
  `database restored from the backup`.
- **Sao lưu hằng đêm riêng của Kept** (Quản trị → Sao lưu) không được thiết lập trong container
  này: chúng cần đăng nhập của chủ sở hữu cơ sở dữ liệu, mà Kept đang chạy không có. Hãy sao lưu
  thư mục appdata.

## Cập nhật

Mẫu theo phiên bản chính của Kept (`kept-unraid:1`). Khi có bản phát hành, thẻ **Docker** hiện bản
cập nhật cho Kept: **apply update**. Container dừng (ghi bản dump của nó), image mới khởi động, và
Kept nâng cấp cơ sở dữ liệu khi khởi động.

## Địa chỉ của Kept

Đổi nó trong mẫu (biểu tượng của Kept, **Edit**) rồi **Apply**. Để phục vụ Kept qua https, đặt một
reverse proxy trước cổng 8080, đặt **Kept's address** là địa chỉ https của nó và
**Trusted reverse proxies** là địa chỉ của proxy như Kept thấy
([sau một reverse proxy](/vi/install/reverse-proxy/)). Máy ảnh, cài ứng dụng điện thoại, thông báo
đẩy và passkey cần https ([Kept trong mạng gia đình](/vi/install/home-network/)).

## Gỡ bỏ

1. Thẻ **Docker**, biểu tượng của Kept, **Remove**. Thư mục appdata vẫn còn.
2. Để xóa cả dữ liệu, xóa `/mnt/user/appdata/kept`, từ terminal hoặc trình quản lý tệp. Không thể
   hoàn tác: hãy sao lưu trước nếu bạn có thể cần lại.
