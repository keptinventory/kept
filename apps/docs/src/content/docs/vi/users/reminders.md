---
title: Lời nhắc và thông báo
description: "Những gì Kept nhắc nhở bạn, cách hoạt động của trung tâm thông báo, thiết lập kênh cho ntfy, Telegram và Apprise, và cài đặt theo từng địa điểm."
---

Kept nhắc bạn về các lịch trình đến hạn, bảo hành sắp hết, hạn chót đăng ký, tài liệu và đồ vật sắp hết hạn, khoản vay quá hạn, đồng hồ không được đọc gần đây, tồn kho thấp, thành viên tham gia và rời đi, và giới hạn chi tiêu AI. Trang chủ **Cần bạn** hiển thị những gì đến hạn hoặc quá hạn; chuông mở trung tâm thông báo, nơi **Hoàn thành**, **Hoãn**, **Gia hạn** và **Đánh dấu đã trả** thực hiện thay thế.

Trang này bao gồm những gì đến với bạn, cách thiết lập kênh và cài đặt theo từng địa điểm. Đối với thông báo đẩy trên điện thoại, xem [Kept trên điện thoại của bạn](/vi/users/phone-app/#thông-báo).

## Những gì đến với bạn

Trang chủ **Cần bạn** hiển thị sáu số đếm, luôn ở cùng một vị trí: **Quá hạn**, **Đến hạn**, **Sắp hết hạn**, **Đã cho mượn**, **Không chắc chắn** và **Tồn kho thấp**. Số không bị làm xám, không bị ẩn. **Mượn về** và **Lâu không thấy** xuất hiện khi chúng có mục. Trên máy tính, mỗi mục đặt tên mục gấp gấp nhất của nó. Nhấn vào một mục để mở danh sách đó, đã được lọc sẵn.

Trung tâm thông báo (chuông) liệt kê mọi thứ đến hạn hoặc quá hạn, nhóm theo loại. Từ đó bạn có thể **Hoàn thành**, **Hoãn**, **Gia hạn** hoặc **Đánh dấu đã trả** mà không rời khỏi trang.

## Cài đặt

**Cài đặt → Tôi → Thông báo** chọn những gì đến với bạn và cách thức:

- **Bản tin hàng ngày**: một bản tóm tắt hàng ngày duy nhất thay vì các thông báo riêng lẻ.
- **Giờ yên lặng**: không có thông báo trong các giờ bạn đặt. Không gì được đẩy hoặc gửi email trong những giờ đó; những gì đến hạn sẽ chờ đến khi chúng kết thúc và được gửi lúc đó.
- **Nguồn cấp lịch**: một liên kết riêng cho ứng dụng lịch của bạn, hiển thị ngày đến hạn.

Thông báo đẩy trên điện thoại được bao gồm trong [Kept trên điện thoại của bạn](/vi/users/phone-app/#thông-báo).

## Bảng thông báo

**Những gì đến với bạn** là một bảng. Các hàng là các loại, được nhóm:

- **Ngày đến hạn**: lịch trình, bảo hành, hạn chót đăng ký, tài liệu, đồ vật hết hạn, đồng hồ không đọc gần đây.
- **Cho mượn**: khoản vay quá hạn.
- **Tồn kho**: tồn kho thấp.
- **Mọi người**: thành viên tham gia và rời đi.
- **AI**: giới hạn chi tiêu và bản tóm tắt hàng tháng.

Các cột là kênh của bạn:

- **Trong Kept**: trung tâm thông báo và Cần bạn của Trang chủ.
- **Email**: đến địa chỉ email của tài khoản của bạn.
- **Thông báo đẩy**: đến điện thoại của bạn (nơi push được thiết lập).
- **Webhook / ntfy / Telegram / Apprise**: khi bạn đã thêm một, một cột xuất hiện cho mỗi loại.

Thông báo thành viên và AI chỉ đi đến Kept và email. Tắt **Trong Kept** cho một loại sẽ tắt nó ở mọi nơi: không có gì khác được gửi cho nó. Trên điện thoại, mỗi loại hiển thị các kênh của nó dưới dạng công tắc bên dưới.

## Cài đặt theo từng địa điểm

- **Tất cả các địa điểm** đặt những gì bạn nhận được ở mọi nơi, bao gồm các địa điểm bạn thêm sau này.
- **Chọn một địa điểm** để thay đổi nó chỉ ở đó. Một chấm đánh dấu những gì được đặt cho địa điểm đó riêng.
- **Đặt lại địa điểm này về tất cả các địa điểm** xóa các ghi đè đó.
- Một loại mà mô-đun của nó tắt ở đó hiển thị là tạm dừng (lời nhắc của nó chờ cho đến khi mô-đun quay lại).
- Nơi bạn là người xem, bạn chỉ nhận thành viên tham gia và rời đi.
- Nơi bạn là thành viên, Kept bắt đầu chỉ với các khoản vay bạn ghi lại: bật những gì bạn muốn ở đó.

## Thiết lập kênh

### ntfy

Thêm máy chủ của bạn (`https://ntfy.sh` hoặc máy chủ của riêng bạn) và một chủ đề khó đoán, thêm mã truy cập nếu chủ đề cần một. Kept giữ tất cả các thứ này được mã hóa và không bao giờ hiển thị chúng lại. **Kiểm tra** gửi một ngay bây giờ.

### Telegram

Tạo một bot với @BotFather, gửi cho nó một tin nhắn, sau đó thêm mã của nó và ID trò chuyện của bạn. Kept giữ tất cả các thứ này được mã hóa và không bao giờ hiển thị chúng lại. **Kiểm tra** gửi một ngay bây giờ.

### Apprise

Khi máy chủ của bạn có Apprise, dán một hoặc nhiều URL Apprise, như `discord://…`, để tiếp cận Discord, Slack, Matrix, Signal và nhiều hơn nữa. Kept giữ tất cả các thứ này được mã hóa và không bao giờ hiển thị chúng lại. **Kiểm tra** gửi một ngay bây giờ.

## Lời nhắc cho mượn

**Cho mượn** một đồ vật (hoặc một phần của số lượng) cho một thành viên hoặc một liên hệ, với ngày đến hạn và ảnh điều kiện. Kept không bao giờ nhắn tin cho người mượn; **Sao chép một lời nhắc** cho bạn văn bản để tự gửi. Một hộp đi kèm với mọi thứ bên trong nó, mỗi đồ vật trên một dòng riêng. Xem
[Bộ dụng cụ và bàn giao](/vi/users/kits/).

## Liên quan

- [Kept trên điện thoại của bạn](/vi/users/phone-app/) cho thông báo đẩy và sử dụng ngoại tuyến.
- [Sử dụng hàng ngày](/vi/users/everyday-use/) cho bức tranh rộng hơn.
- Xe cộ và máy móc cho đọc đồng hồ và lịch trình bảo dưỡng.
