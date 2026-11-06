---
title: Bắt đầu
description: "Con đường ngắn từ không có gì đến đồ vật đầu tiên của bạn trong Kept, có liên kết đến trang chi tiết cho mỗi bước."
---

Con đường ngắn, một bước trên mỗi dòng. Mỗi bước liên kết đến trang có chi tiết.

1. **Cài đặt nó.** Docker với plugin Compose; đã thử nghiệm trên 1 GB RAM và một nhân CPU.
   Tải xuống `compose.yaml`, sau đó `docker compose run --rm init` (nó hỏi địa chỉ bạn sẽ mở Kept tại và ghi `.env`) và `docker compose up -d`. Không cần sao chép kho mã và không cần tạo mật khẩu. [Cài đặt với Docker Compose](/vi/install/compose/)
2. **Đăng ký máy chủ.** Mở địa chỉ, nhập mã thiết lập mà `init` hiển thị, và tạo tài khoản đầu tiên: nó sẽ trở thành quản trị viên phiên bản.
   [Yêu cầu quyền sở hữu máy chủ](/vi/users/first-run/#1-xác-nhận-máy-chủ-bằng-mã-thiết-lập)
3. **Giữ khóa.** In bộ khôi phục và giữ nó khỏi máy chủ.
   [Bộ công cụ khôi phục](/vi/admin/recovery-kit/)
4. **Tạo ngôi nhà đầu tiên của bạn.** Một tên, loại của nó, các phòng của nó, và một bản mẫu cho những gì nó theo dõi.
   [Tạo ngôi nhà đầu tiên](/vi/users/first-run/#3-tạo-ngôi-nhà-đầu-tiên-của-bạn)
5. **Thêm một đồ vật.** **Chụp** trên điện thoại, hoặc **Thêm tại đây** trên một phòng hoặc hộp trên máy tính.
   [Thêm vật phẩm đầu tiên](/vi/users/first-run/#4-thêm-đồ-vật-đầu-tiên-của-bạn)
6. **Mời ai đó.** Một liên kết hoặc mã QR với một vai trò (quản trị viên, thành viên hoặc người xem); không ai cần địa chỉ email. [Mời mọi người](/vi/users/first-run/#5-mời-mọi-người)
7. **Đặt nó trên HTTPS**, để điện thoại cho phép camera, cài đặt Kept, sử dụng ngoại tuyến và đẩy.
   [HTTPS](/vi/install/https/), hoặc [Kept trên mạng gia đình](/vi/install/home-network/) for what works
   without it
8. **Kết nối AI**, nếu bạn muốn: Kept hoạt động không cần nó. [Nhà cung cấp AI](/vi/users/ai-providers/)

Sau đó: [Sử dụng hàng ngày](/vi/users/everyday-use/) cho chuyến tham quan, [Câu hỏi thường gặp](/vi/users/faq/) cho các câu hỏi phổ biến, và [Vấn đề phổ biến](/vi/users/troubleshooting/) khi có điều gì không hoạt động.
