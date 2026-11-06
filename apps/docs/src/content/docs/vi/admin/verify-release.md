---
title: Xác minh bản phát hành
description: "Kiểm tra xem hình ảnh Kept có phải là hình ảnh mà người bảo trì đã xây dựng và ký."
sidebar:
  order: 11
---

Mọi hình ảnh phát hành đều được ký bằng **cosign**, với khóa mà người bảo trì nắm giữ, và đi kèm với SBOM (danh sách mọi thứ bên trong) và tệp thông báo bên thứ ba. Hình ảnh phát hành được gắn thẻ `X.Y.Z`, `X.Y` và `X`, tất cả đều trỏ đến một bản tóm tắt đã được xác minh; không bao giờ có `latest`.

Để kiểm tra hình ảnh trước khi chạy nó, hãy cài đặt cosign và xác minh nó dựa trên `cosign.pub` từ kho lưu trữ:

```sh
cosign verify --key cosign.pub <image>:<version>
```

Chữ ký được ghi trong nhật ký minh bạch công khai, và ghi chú của mỗi phát hành cung cấp chính xác lệnh. Chữ ký tốt in ra các xác nhận đã xác thực và thoát với mã 0; bất cứ thứ gì khác đều có nghĩa là không chạy nó. Ghim bản tóm tắt mà nó in ra trong `KEPT_IMAGE` (`<image>@sha256:…`) để chạy chính xác hình ảnh đó.

Bản đồ Helm được xuất bản như một hiện vật OCI bên cạnh hình ảnh và được ký theo cùng cách. Một Kept đang chạy báo cáo phiên bản của nó, commit mà nó được xây dựng từ và kho lưu trữ nguồn của nó tại `/version`, và phục vụ các thông báo bên thứ ba của hình ảnh tại `/notices.txt` (được liên kết từ dòng phiên bản trong ứng dụng).
