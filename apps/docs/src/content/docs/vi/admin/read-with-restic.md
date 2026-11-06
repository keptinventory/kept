---
title: "Đọc hàng tồn kho của bạn chỉ với restic"
description: "Máy chủ đã mất. Với restic, mật khẩu sao lưu và bất kỳ máy tính nào, hãy mở bản sao có thể đọc được của mọi thứ bạn sở hữu - không cần Kept, không cần mạng."
sidebar:
  order: 3
---

Mỗi ảnh chụp nhanh hàng đêm đều chứa một **bản sao có thể đọc** của từng địa điểm: một `index.html` bạn mở trong trình duyệt, một bảng tính (CSV) của các đồ vật, hình thu nhỏ, và các hóa đơn và tài liệu mà các trang liên kết đến. Nó được viết cho ngày Kept không thể chạy: máy chủ bị cháy, ổ cứng hỏng, hoặc Kept đã biến mất lâu rồi. Tất cả những gì bạn cần là:

- **restic**, chương trình sao lưu, trên bất kỳ máy tính nào (Windows, macOS hoặc Linux). Tài liệu của nó liệt kê một gói hoặc một bản tải xuống cho từng hệ điều hành. Hãy dùng phiên bản 0.19.1, phiên bản mà Kept dùng, hoặc mới hơn.
- **Kho lưu trữ và mật khẩu của nó**, từ [bộ công cụ khôi phục](/vi/admin/recovery-kit/), và đối với bucket S3 hoặc máy chủ SFTP, thông tin đăng nhập mà bộ công cụ liệt kê cùng với chúng.
- Bản sao lưu chính nó: ổ đĩa, bucket hoặc máy chủ SFTP mà nó được gửi đến.

## 1. Trỏ restic đến bản sao lưu

Phần sao lưu của bộ công cụ khôi phục cung cấp vị trí kho lưu trữ và mật khẩu, và đối với S3, hai khóa. Trong terminal:

```sh
export RESTIC_REPOSITORY='<the repository line from the kit>'
export RESTIC_PASSWORD='<the backup password from the kit>'
# S3 only:
export AWS_ACCESS_KEY_ID='<from the kit>'
export AWS_SECRET_ACCESS_KEY='<from the kit>'
```

Trên Windows PowerShell, `$env:RESTIC_REPOSITORY = '…'` và cứ thế. Bản sao lưu thư mục được sao chép lên máy tính xách tay chỉ là đường dẫn của nó: thư mục `restic` bên trong thư mục sao lưu.

## 2. Chọn một ảnh chụp nhanh

```sh
restic snapshots
```

liệt kê mọi ảnh chụp nhanh với thời gian và thẻ của nó. Hãy lấy ảnh chụp nhanh mới nhất có thẻ `nightly` (hoặc `manual`); một ảnh chụp nhanh `pre_upgrade` chỉ chứa cơ sở dữ liệu, không phải bản sao có thể đọc. Ghi lại ID của nó.

## 3. Khôi phục bản sao có thể đọc

```sh
restic restore <snapshot ID> --target ./kept-readable --include /backup/readable
```

Điều này chỉ khôi phục bản sao có thể đọc, không phải bản dump cơ sở dữ liệu hay các tệp kích thước đầy đủ, vào một thư mục mới tên là `kept-readable`.

## 4. Mở nó

Mở `kept-readable/backup/readable/index.html` trong trình duyệt. Nó liệt kê mọi địa điểm, với chủ sở hữu và thời gian bản sao được tạo; `index.html` riêng của từng địa điểm liệt kê các vị trí và đồ vật của nó, với ảnh chụp, chi tiết mua hàng và tài liệu. `README.txt` bên cạnh nó nói điều tương tự.

Các trang không cần mạng và không tải gì từ đâu cả. CSV của từng địa điểm mở trong bảng tính.

Bản sao của từng địa điểm là những gì **chủ sở hữu** của nó có thể thấy trong Kept: tiền tệ xuất hiện như chủ sở hữu thấy nó, và các giá trị bí mật (mật khẩu Wi-Fi bạn lưu trên bộ định tuyến) không bao giờ có trong đó. Một địa điểm mà bản sao của nó thất bại đêm đó được liệt kê là "không có trong đêm nay"; hãy lấy ảnh chụp nhanh trước đó.

## Duyệt không cần khôi phục

Trên Linux, và trên macOS với macFUSE, `restic mount ./mnt` hiển thị mọi ảnh chụp nhanh dưới dạng thư mục bạn có thể mở ngay tại chỗ. Nó cần FUSE, mà Windows không có; `restore` hoạt động ở mọi nơi.
