---
title: Mô-đun và mẫu cài đặt
description: "Mỗi địa điểm theo dõi điều gì: các mẫu cài đặt Thiết yếu, Hộ gia đình và Hoàn thành, các mô-đun đằng sau chúng, và việc tắt một mẫu cài đặt này sẽ làm gì."
---

Mỗi địa điểm chạy trên một **mẫu cài đặt**: một tập hợp các **mô-đun** được bật cùng lúc. Một mẫu cài đặt là điểm khởi đầu: một chủ sở hữu hoặc quản trị viên có thể bật hoặc tắt từng mô-đun sau đó, và tắt một mô-đun chỉ ẩn nó đi. Không có gì bị xóa.

Bạn chọn mẫu cài đặt khi tạo địa điểm ([Các phút đầu tiên của bạn](/vi/users/first-run/)). Địa điểm **Cá nhân** của một tài khoản mới bắt đầu bằng Thiết yếu. Việc nhập Homebox vào một địa điểm mới cũng bắt đầu bằng Thiết yếu, với từng mô-đun sao lưu có dữ liệu được đánh dấu thêm ([nhập từ Homebox](/vi/users/import-export/#một-bản-xuất-homebox)).

## Ba mẫu cài đặt

- **Thiết yếu**: tìm đồ vật: phòng, hộp, nhãn và tìm kiếm.
- **Hộ gia đình**: thêm biên lai và bảo hành, lời nhắc, cho mượn, giấy tờ và phương tiện.
- **Hoàn thành**: thêm nhiên liệu, đồ vật bạn dùng hết, mật khẩu và mã, chuyển nhà, và "Kết nối ChatGPT hoặc Claude".

Múi giờ và tiền tệ không phải là một phần của mẫu cài đặt: chúng ở **Cài đặt địa điểm → Chung**.

## Mỗi mô-đun thêm gì

Các tên dưới đây là các công tắc trong **Theo dõi gì**.

| Module | Từ | Nó mang lại |
|---|---|---|
| **Nhãn và mã QR** | Thiết yếu | Nhãn in được cho đồ vật và vị trí; quét một nhãn mở ra đồ vật hoặc vị trí mà nhãn đó đang gắn trên. |
| **Tiền và chi tiêu** | Hộ gia đình | Giá, tổng và **Thống kê**. Mỗi loại tiền tệ trên một dòng riêng, không bao giờ được chuyển đổi. |
| **Biên lai và bảo hành** | Hộ gia đình | Ngày bảo hành; một bảo hành sắp hết hạn hiện ra như một lời nhắc. |
| **Lời nhắc** | Hộ gia đình | Lịch trình: những gì đến hạn, theo ngày hoặc theo số đo. |
| **Cho mượn** | Hộ gia đình | Cho đồ vật đi mượn và mượn đồ vật lại. |
| **Giấy tờ** | Hộ gia đình | Thư viện giấy tờ; ngày của tài liệu cung cấp cho lời nhắc. |
| **Phương tiện** | Hộ gia đình | Phương tiện và máy móc. |
| **Nhiên liệu** | Hoàn thành | Nhiên liệu và sạc. Cần **Phương tiện**. |
| **Đồ vật bạn dùng hết** | Hoàn thành | **Giữ ít nhất** trên một đồ vật; tồn kho thấp hiện ra như một lời nhắc. |
| **Chuyển nhà** | Hoàn thành | Chế độ chuyển nhà. Cần **Nhãn và mã QR**. |
| **Mật khẩu và mã** | Hoàn thành | Các trường bí mật: ẩn cho đến khi ai đó được phép hiển thị một trường, được ghi lại. |
| **Kết nối ChatGPT hoặc Claude** | Hoàn thành | Kết nối MCP, để một ứng dụng AI có thể làm việc với địa điểm. |

## AI trong địa điểm này

**Chụp bằng AI và trợ lý** được bật trong mọi mẫu cài đặt khi một nhà cung cấp AI đã được kết nối cho địa điểm. Chúng chia sẻ một công tắc, **Chụp bằng AI và trợ lý**, dưới **AI trong địa điểm này** trên cùng một trang, cho phép một địa điểm không sử dụng AI trong khi một nhà cung cấp AI được kết nối. Việc chọn một mẫu cài đặt không thay đổi điều đó. Xem [Nhà cung cấp AI](/vi/users/ai-providers/).

## Tắt một mô-đun

Một mô-đun đang tắt bị ẩn mọi nơi nó sẽ xuất hiện (màn hình của nó, mục menu của nó, bộ lọc của nó) và lời nhắc của nó tạm dừng. Việc bật lại nó mang mọi thứ lại, vì không có gì bị xóa.

- **Lời nhắc tạm dừng cùng với mô-đun của chúng.** Lịch trình và những gì hết hạn chờ cùng với **Lời nhắc**, ngày bảo hành và đăng ký cùng với **Biên lai và bảo hành**, ngày tài liệu cùng với **Giấy tờ** (tài liệu của một phương tiện cũng tiếp tục chạy trong khi **Phương tiện** đang bật), khoản cho mượn cùng với **Cho mượn**, tồn kho thấp cùng với **Đồ vật bạn dùng hết**. Những lời nhắc về máy đo chưa được đọc trong thời gian gần đây luôn chạy.

- **Những gì phụ thuộc cũng tắt theo.** Nhiên liệu cần Phương tiện, và Chuyển nhà cần Nhãn và mã QR: khi bạn tắt thứ một mô-đun cần, mô-đun đó cũng bị tắt theo. Công tắc của nó sau đó hiển thị *Cần Phương tiện, tắt trong địa điểm này*.

- **Menu tuân theo tất cả các địa điểm của bạn.** Dưới **Theo dõi**, một mục (Lịch trình, Cho mượn, Giấy tờ, Đồ vật bạn dùng hết, Phương tiện, Chuyển nhà, Thống kê) hiện ra khi mô-đun của nó đang bật trong bất kỳ địa điểm nào của bạn. Dưới **Công cụ**, **Nhãn** hiển thị trong khi **Nhãn** đang bật ở bất kỳ đâu, và **Kiểm kê** luôn có sẵn. Hoạt động, Thùng rác và Thông báo cũng luôn có sẵn.

## Thay đổi sau này

Một chủ sở hữu hoặc quản trị viên mở **Cài đặt địa điểm → Theo dõi gì**. Chọn mẫu cài đặt đặt tất cả các mô-đun cùng một lúc; **Tinh chỉnh** bên dưới nó có một công tắc cho mỗi mô-đun. Trước khi lưu, **Khi bạn lưu** liệt kê những gì sẽ bật và những gì sẽ tắt.

## Liên quan

- [Địa điểm, phòng và hộp](/vi/users/locations/) cho các vị trí bên trong một địa điểm.
- [Chia sẻ một địa điểm](/vi/users/sharing/) cho vai trò.
