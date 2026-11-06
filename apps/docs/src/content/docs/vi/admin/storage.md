---
title: Chuyển lưu trữ tệp
description: Di chuyển các tệp của Kept giữa ổ đĩa của máy chủ và một kho S3 với một bản sao đã xác minh.
sidebar:
  order: 6
---

Kept lưu các tệp (ảnh, hóa đơn, tài liệu) trên ổ dữ liệu (`KEPT_STORAGE=local`, là
mặc định) hoặc trong một kho S3 tương thích (`KEPT_STORAGE=s3` với các biến `KEPT_S3_*`). Việc chỉ
thay đổi `KEPT_STORAGE` không di chuyển gì: các tệp đã lưu vẫn ở nơi chúng từng ở và Kept
không thể tìm thấy chúng. Việc di chuyển chúng là một bản sao.

## Di chuyển

Các tệp không bao giờ thay đổi sau khi đã lưu, nên bản sao an toàn khi Kept đang chạy, và có thể lặp lại: một tệp
đã có ở đích với giá trị băm đúng sẽ bị bỏ qua.

1. Thêm cài đặt của đích bên cạnh các cài đặt hiện tại (đối với S3: `KEPT_S3_BUCKET`,
   `KEPT_S3_ACCESS_KEY_ID`, `KEPT_S3_SECRET_ACCESS_KEY` và, nếu cần, `KEPT_S3_ENDPOINT`,
   `KEPT_S3_REGION`, `KEPT_S3_FORCE_PATH_STYLE`), giữ `KEPT_STORAGE` như hiện tại.
2. **Sao chép khi Kept đang chạy:** `kept admin storage copy --to s3` (hoặc `--to local`). Mỗi tệp mà
   cơ sở dữ liệu tham chiếu, cùng các phiên bản thay đổi kích thước của nó, được sao chép và SHA-256 của nó được kiểm tra. `--dry-run`
   chỉ đếm.
3. **Dừng Kept**, và sao chép lại: chỉ những thứ đã đến kể từ đó được sao chép.
4. Thiết lập `KEPT_STORAGE` thành kho mới, và khởi động Kept.
5. **Xác minh:** `kept admin storage verify --store s3` kiểm tra mọi tệp mà cơ sở dữ liệu tham chiếu.

Các tệp cũ vẫn được để lại ở nơi chúng từng ở; hãy xóa chúng khi bạn đã hài lòng.

## Trước khi chọn S3

- Bật **phiên bản hóa kho**: với lưu trữ S3, các bản sao lưu không giữ các tệp, và phiên bản hóa
  là những gì đưa lại một tệp đã bị xóa hoặc ghi đè ([bản sao lưu](/vi/admin/backups/#khi-các-tệp-ở-trong-s3)).
- Điện thoại lấy các tệp từ kho trực tiếp, qua các liên kết ký ngắn hạn. Nếu máy chủ
  truy cập kho tại một địa chỉ điện thoại không thể (trong Compose, ví dụ), hãy đặt
  `KEPT_S3_PUBLIC_ENDPOINT` thành cái chúng có thể.
- Cung cấp kho từ tên máy chủ của riêng nó, không bao giờ là của Kept.
