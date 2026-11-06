---
title: "Di chuyển sang máy chủ mới"
description: "Hai cách để di chuyển Kept - toàn bộ thực thể thông qua bản sao lưu, hoặc từng vị trí một thông qua xuất dữ liệu."
sidebar:
  order: 8
---

## Toàn bộ thực thể: thông qua bản sao lưu

Thao tác này di chuyển mọi thứ (mọi tài khoản, địa điểm, tệp và cài đặt) và tuân theo cùng quy trình như
khôi phục từ máy chủ bị mất:

1. Trên máy chủ cũ, thực hiện bản sao lưu và đợi hoàn tất, sau đó in
   [bộ công cụ khôi phục](/vi/admin/recovery-kit/).
2. Trên máy chủ mới, [cài đặt Kept](/vi/install/compose/) với khóa từ bộ công cụ trong `.env` và cùng
   đích sao lưu, nhưng **chưa khởi động Kept**.
3. [Khôi phục](/vi/admin/restore/#sau-khi-mất-máy-chủ) bản sao lưu mới nhất vào cơ sở dữ liệu trống mới.
4. Trỏ địa chỉ cũ tới máy chủ mới (DNS, hoặc proxy của bạn), giữ `KEPT_PUBLIC_URL` không đổi,
   và khởi động Kept. Nhãn và mã QR vẫn hoạt động vì địa chỉ không thay đổi.
5. Dừng máy chủ cũ sau khi máy chủ mới được kiểm tra, và giữ đĩa cũ cho đến khi máy chủ mới đã có
   bản sao lưu tốt và [bài tập khôi phục](/vi/admin/restore/#bài-tập-hàng-tháng).

Nếu địa chỉ thay đổi, các nhãn đã in vẫn mang theo địa chỉ cũ: hãy trỏ tên máy chủ cũ
cũng tới máy chủ mới, và liệt kê nó trong số các tên máy chủ cũ của thực thể: Kept sau đó sẽ
chuyển hướng truy cập dưới tên cũ tới cùng trang tại địa chỉ mới.

## Từng vị trí một: thông qua xuất dữ liệu

Chủ sở hữu xuất một vị trí, cùng tệp đính kèm và, nếu họ chọn, các giá trị bí mật dưới
mật khẩu; trên máy chủ mới họ nhập vào một vị trí mới. Thao tác này di chuyển một hộ gia đình mà không
cần phần còn lại của thực thể, và hoạt động giữa hai thực thể chạy các phiên bản khác nhau, miễn là
phiên bản mới không cũ hơn phiên bản cũ (Kept cũ hơn có thể từ chối bản xuất từ Kept mới hơn).

1. Trên máy chủ cũ, vào **Cài đặt → Xuất**, xuất vị trí. Chọn có bao gồm
   giá trị bí mật hay không; nếu có, đặt mật khẩu. Xuất dữ liệu chỉ thực hiện qua HTTPS, và sẵn sàng
   tải xuống trong 7 ngày.
2. Trên máy chủ mới, đăng nhập, mở **Cài đặt → Nhập**, và chọn bản xuất Kept (tệp ZIP).
   Kept kiểm tra trước và hiển thị những gì sẽ được thêm trước khi ghi bất cứ điều gì; cung cấp mật khẩu
   để khôi phục các giá trị bí mật.
3. Việc nhập tạo một **vị trí mới** với các đồ vật, các vị trí, tệp, báo cáo tình trạng,
   các lần di chuyển và lịch sử của chúng. Nhãn đã in vẫn hoạt động: mã ngắn của nhãn được giữ
   khi nó còn trống trên máy chủ mới, và cấp lại khi không, trong trường hợp này quét nhãn cũ
   vẫn mở đồ vật.
4. Mời những người chia sẻ vị trí; việc nhập liệt kê họ, nhưng không tự động mời ai cả.
