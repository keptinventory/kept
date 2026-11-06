---
title: Bộ khôi phục
description: The keys and backup credentials that turn a backup back into a working Kept. Keep them anywhere but the server.
sidebar:
  order: 4
---

Kept niêm phong mọi giá trị bí mật mà nó lưu trữ (khóa AI, và các bí mật bạn lưu trên đồ vật, chẳng hạn như mật khẩu Wi-Fi của bộ định tuyến) bằng `KEPT_SECRET_KEY`, và ký các phiên bằng `KEPT_AUTH_SECRET`. Cả hai đều không nằm trong cơ sở dữ liệu hay bản sao lưu, điều này được làm cố ý: người nào lấy được bản sao lưu của bạn không nên lấy được bí mật cùng lúc. Mặt khác của vấn đề: **nếu không có khóa, việc khôi phục sẽ đưa lại mọi thứ ngoại trừ các giá trị bí mật và khóa AI, những thứ này vẫn không thể đọc được mãi mãi.**

Bộ khôi phục là mọi thứ bạn cần để xây dựng lại Kept từ bản sao lưu của nó. Hãy giữ nó trong trình quản lý mật khẩu hoặc trên giấy, ở nơi nào đó mà sẽ không bị mất cùng với máy chủ.

## Nội dung bên trong

- `KEPT_SECRET_KEY` and `KEPT_AUTH_SECRET`;
- sau khi xoay khóa, phiên bản của khóa (`KEPT_SECRET_KEY_VERSION`) và mọi khóa đã nghỉ hưu (`KEPT_SECRET_KEYS_RETIRED`), mà các bản sao lưu cũ vẫn cần;
- kho restic của bản sao lưu, **mật khẩu của nó, và thông tin xác thực lưu trữ của nó** (khóa S3 và vùng, hoặc khóa SFTP và khóa máy chủ được ghim của máy chủ dưới dạng dòng `known_hosts`), hoặc "Chưa cấu hình bản sao lưu";
- địa chỉ của phiên bản, phiên bản và sửa đổi của Kept, khi bộ khôi phục được tạo;
- các bước khôi phục bằng ngôn ngữ đơn giản, và các lệnh để [đọc kho đồ vật của bạn chỉ với restic](/vi/admin/read-with-restic/), với kho đã được điền sẵn.

Nó là văn bản thuần túy, hoặc một trang có thể in được tạo từ các dòng giống nhau (không có tập lệnh, không có gì được tải từ bất cứ đâu).

## Lấy nó

Từ máy chủ, vào bất cứ lúc nào:

```sh
docker compose exec kept kept admin recovery-kit
```

Nó in ra thiết bị đầu cuối; không có gì được ghi ở bất cứ đâu. `--format html` cho trang có thể in, và `--out <file>` ghi nó vào một tập tin chỉ bạn có thể đọc. Các khóa vẫn in ra ngay cả khi cơ sở dữ liệu bị sập; phần bản sao lưu cần đăng nhập của chủ sở hữu cơ sở dữ liệu (`KEPT_OWNER_DATABASE_URL`, `compose.override.yaml` mà [bản sao lưu](/vi/admin/backups/#bật-lên) sử dụng cung cấp nó), và nếu không có nó, bộ khôi phục sẽ báo là thiếu. Với đăng nhập đó, việc in được tính là một lần tải xuống (dưới đây) và được kiểm toán.

Từ web: **Quản trị → Trạng thái → Bộ khôi phục → Tải bộ khôi phục**, với tư cách là quản trị viên phiên bản, chỉ qua HTTPS, sau khi nhập lại mật khẩu của bạn (hoặc, đối với tài khoản không có mật khẩu, trong vòng mười phút sau khi đăng nhập: đăng nhập bằng khóa truy cập được tính; nếu không thì "Đăng nhập lại"). Chọn một tập tin văn bản hoặc một trang có thể in. Mỗi lần tải xuống đều được kiểm toán, và không có gì của bộ khôi phục được giữ ở bất cứ đâu mà một khách truy cập sau này có thể mở nó.

## Khi Kept yêu cầu nó

Thiết lập không đợi bộ khôi phục, nhưng Kept yêu cầu bạn xác nhận nó trước lần đầu tiên trong: lưu trữ một giá trị bí mật, thêm khóa AI, hoặc thiết lập bản sao lưu. Cho đến lúc đó Quản trị → Trạng thái yêu cầu nó; một lần tải xuống được tính là xác nhận đó. Trang trạng thái yêu cầu lại khi bộ khôi phục bạn tải xuống đã lỗi thời: sau khi cài đặt bản sao lưu thay đổi hoặc khóa được xoay (`kept admin rotate-key`).

## Nếu bạn tự đặt khóa

Với `KEPT_SECRET_KEY` và `KEPT_AUTH_SECRET` trong môi trường của bạn (tạo mỗi cái bằng `kept admin gen-key`), Kept sử dụng chúng như được đưa ra và khối lượng `kept-config` vẫn trống. Bộ khôi phục vẫn in chúng ra; việc giữ một bản sao vẫn là trách nhiệm của bạn.

## Xoay khóa

```sh
docker compose exec kept kept admin rotate-key
```

tạo một khóa mới thành khóa hiện tại và gói lại mọi bí mật đã lưu trữ dưới khóa đó. Nó cần đăng nhập của chủ sở hữu cơ sở dữ liệu, nên dịch vụ `kept` phải có `KEPT_OWNER_DATABASE_URL` (`compose.override.yaml` mà [bản sao lưu](/vi/admin/backups/#bật-lên) sử dụng cung cấp nó). Nó nói những gì cần đặt nếu bạn tự quản lý khóa. Khóa cũ chuyển sang danh sách đã nghỉ hưu, vì vậy các bản sao lưu được tạo trước khi xoay khóa vẫn mở được: hãy tải xuống một bộ khôi phục mới sau đó.
