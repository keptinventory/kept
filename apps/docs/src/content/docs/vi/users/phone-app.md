---
title: "Kept trên điện thoại của bạn"
description: "Cài đặt Kept lên màn hình chính, những gì hoạt động khi không có kết nối, đồng bộ hóa và xung đột trông như thế nào, máy ảnh, khóa ứng dụng và thông báo."
---

Kept không có ứng dụng trên cửa hàng ứng dụng. Nó là một ứng dụng web bạn cài đặt từ trình duyệt (một PWA): nó mở từ biểu tượng riêng, toàn màn hình, giữ một bản sao hàng tồn kho của bạn trên điện thoại và hoạt động ngoại tuyến. Mọi thứ trên trang này cần Kept chạy trên **HTTPS**: qua HTTP thuần túy, điện thoại chặn máy ảnh, cài đặt, thông báo đẩy và vị trí ([HTTPS](/vi/install/https/)).

## Cài đặt nó

**Cài đặt trên điện thoại của bạn** trên danh sách kiểm tra của Trang chủ, và **Trợ giúp → Cài đặt trên điện thoại của bạn**, hiển thị các bước cho thiết bị của bạn:

| Thiết bị | Các bước |
|---|---|
| iPhone, iPad | Trên Safari, chạm **Chia sẻ**, sau đó **Thêm vào màn hình chính**, rồi **Thêm**. Mở Kept từ biểu tượng mới của nó. |
| Android | Mở menu của trình duyệt (ba chấm), chạm **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**, và mở Kept từ biểu tượng mới của nó. |
| Máy tính | Trên Chrome hoặc Edge, biểu tượng cài đặt ở cuối thanh địa chỉ, hoặc **Cài đặt Kept** trong menu. Trên Safari trên Mac, **Tệp › Thêm vào Dock**. |

Bước danh sách kiểm tra tự đánh dấu lần đầu tiên bạn mở Kept từ biểu tượng của nó. Khi một phiên bản mới đã sẵn sàng, Kept hiển thị **Một phiên bản mới đã sẵn sàng** cùng với **Tải lại**; nó không bao giờ tự tải lại trong khi đang tải lên hay có phiên chụp đang mở.

## Những gì hoạt động ngoại tuyến

Điện thoại giữ một bản sao của mọi địa điểm bạn thuộc về, được làm mới mỗi khi đồng bộ hóa. Câu trả lời ngoại tuyến ghi **tính theo lần đồng bộ cuối** và thời gian.

| Hoạt động ngoại tuyến | Cần kết nối |
|---|---|
| Duyệt các địa điểm, phòng, hộp và đồ vật | Sửa chi tiết đồ vật, cài đặt, quản trị |
| Tìm kiếm, gắn nhãn **Trên điện thoại này** | Trợ lý và đặt tên bằng AI |
| Chụp, di chuyển, đánh dấu đã thấy, không ở đây | Nhập, xuất và báo cáo |
| Ghi đọc số, thêm phòng hoặc vị trí | Ghi dịch vụ (vì nó mang tiền) |
| Kiểm tra hộp, cho hộp mở một lần khi đang trực tuyến | Bất cứ thứ gì có tiền hoặc giá trị bí mật |
| Quét nhãn, nhận nhãn trống | |

Bản sao không bao giờ giữ giá trị bí mật hay chi tiết liên lạc của mọi người. Tiền và tài liệu không lên điện thoại trừ khi bạn giữ một địa điểm ngoại tuyến phía sau khóa ứng dụng (dưới đây). Đăng xuất sẽ xóa bản sao của người này khỏi điện thoại.

## Đồng bộ hóa, như bạn thấy nó

Những gì bạn làm ngoại tuyến đi vào hàng đợi và được gửi khi điện thoại quay lại trực tuyến. Một dòng dưới tiêu đề chỉ xuất hiện khi có điều gì để nói:

- **Ngoại tuyến · 12 đang chờ đồng bộ**, hoặc **Ngoại tuyến · tính theo lần đồng bộ cuối, 14:02**.
- Đồ vật mới hiển thị **ID đang chờ** cho đến khi máy chủ cấp cho chúng ID ngắn; nhãn cho chúng có thể in khi nó đến (Nhãn cung cấp **In nhãn đang chờ**).
- **Trên iPhone, hàng đợi chỉ di chuyển khi Kept đang mở**: dòng nói **Mở để hoàn tất đồng bộ hóa (12)**. Giữ Kept mở trên màn hình một chút khi bạn quay lại trực tuyến.
- **Cập nhật Kept để hoàn tất đồng bộ hóa** có nghĩa là máy chủ mới hơn ứng dụng: tải lại. Hàng đợi được giữ nguyên.
- **Trình duyệt này có thể xóa bản sao ngoại tuyến của Kept sau nhiều tuần không dùng**: điện thoại từ chối lưu trữ vĩnh viễn cho Kept. Mở Kept rồi lại để nó đồng bộ hóa.

**Khi một thay đổi không thể áp dụng.** Nếu người khác đã xóa, di chuyển hoặc loại bỏ một đồ vật trong khi bạn ngoại tuyến, thay đổi của bạn đối với nó bị bỏ qua và dòng báo cho biết, ví dụ "Một thay đổi không thể áp dụng: cái khoan đã bị Alfred xóa", kèm **Khôi phục** để thử lại. Các thay đổi khác cần quyết định đi vào **Hộp thư đến** ("2 thay đổi cần xem").

**Khi cả hai cùng sửa một đồ vật trực tuyến**, Kept hợp nhất các trường chỉ một người thay đổi và hỏi về phần còn lại: **Giữ của tôi**, **Giữ của họ** hoặc **Sửa**.

**Đăng xuất với các lần chụp chưa gửi** cảnh báo bạn trước: đăng xuất sẽ xóa các lần chụp chưa đồng bộ. Nếu phiên hết hạn, điện thoại xóa bản sao hàng tồn kho của bạn nhưng giữ lại các lần chụp chưa gửi, bị khóa, cho đến khi bạn đăng nhập lại. Nếu người khác đăng nhập trên điện thoại đó, Kept báo có bao nhiêu lần chụp đang chờ từ tài khoản khác và chỉ xóa chúng khi người đó đồng ý.

## Máy ảnh, thư viện và quét

- **Chụp** giữ máy ảnh mở cho một cú chụp sau một cú chụp. **Thư viện** chọn nhiều ảnh cùng lúc; mỗi ảnh trở thành một bản nháp. Nếu máy ảnh bị chặn, Kept nói cách cho phép, và qua HTTP thuần túy, Chụp chuyển sang chọn tệp.
- Ảnh iPhone định dạng HEIC được giữ nguyên bản gốc; nếu một ảnh không thể xem trước, nó nói **Xem trước không khả dụng** và không bao giờ bị từ chối.
- **Chia sẻ vào Kept**: trên Android và Chrome máy tính, ứng dụng đã cài xuất hiện trong bảng chia sẻ, nên hóa đơn hoặc PDF từ ứng dụng khác rơi vào Chụp. iPhone không cho ứng dụng web xuất hiện trong bảng Chia sẻ: lưu tệp, sau đó dùng **Thư viện** trong Chụp.
- **Quét** đọc nhãn Kept và mã vạch sản phẩm, ngoại tuyến cũng được, từ bản sao trên điện thoại, và mã Data Matrix, Code 39, Code 93, ITF, Codabar, PDF417 và Aztec; một số seri hoặc thẻ tài sản mở đồ vật của nó khi bạn trực tuyến. Danh sách đầy đủ: [ID ngắn và nhãn](/vi/users/everyday-use/#id-ngắn-và-nhãn).
- **Gợi ý vị trí của tôi**, một công tắc trong bộ chọn vị trí của Chụp, so sánh vị trí của bạn với vị trí của các địa điểm của bạn trên chính điện thoại và gợi ý địa điểm bạn đang ở: cách vị trí của nó không quá 150 m, chọn địa điểm gần hơn nếu có hai. Vị trí của bạn không bao giờ được gửi hay giữ. Chủ sở hữu hoặc quản trị viên đặt vị trí của địa điểm trong **Cài đặt địa điểm → Chung → Vị trí** ([Vị trí của nó](/vi/users/locations/#vị-trí-của-nó)); địa điểm không có vị trí không bao giờ được gợi ý.
- **Đọc chính tả** điền tên bằng giọng nói ở nơi trình duyệt hỗ trợ.

**Cài đặt → Chẩn đoán** kiểm tra máy ảnh, hỗ trợ ngoại tuyến và bộ nhớ, và sao chép báo cáo những gì nó tìm thấy.

## Khóa ứng dụng

**Cài đặt → Thiết bị này → Khóa ứng dụng** khóa Kept trên điện thoại này bằng mã PIN 6 đến 12 chữ số, và với **Mở khóa bằng Face ID hoặc vân tay** nơi điện thoại có thể xác minh bạn. Khi khóa bật, Kept hỏi khi khởi động lạnh và sau 5 phút ẩn hoặc nhàn rỗi, trực tuyến hay ngoại tuyến.

Face ID hoặc vân tay ở đây chỉ mở khóa Kept trên thiết bị này; nó không bao giờ đăng nhập bạn. Để đăng nhập bằng Face ID hoặc vân tay, thêm một khóa truy cập trong [Đăng nhập và bảo mật](/vi/users/sign-in-security/).

- Mười mã PIN sai liên tiếp xóa bản sao của Kept khỏi điện thoại này và đăng xuất bạn, giữ lại các lần chụp chưa gửi của bạn. **Quên rồi? Đăng xuất và đăng nhập lại** làm điều tương tự.
- Khóa ngăn người đang cầm điện thoại. Nó không ngăn người đã sao chép bộ nhớ trình duyệt thử mã PIN; trang cài đặt nói rõ điều này.

**Giữ sẵn dùng ngoại tuyến**, trên cùng trang, thêm giá và tài liệu của một địa điểm vào bản sao của điện thoại, được mã hóa phía sau khóa. Nó cần khóa ứng dụng bật, hiển thị kích thước tải trước, và cảnh báo rằng bất cứ ai mở khóa Kept trên điện thoại đều thấy chúng. Một thiết bị giữ tối đa 250 MB cách này, với tệp lên tới 25 MB mỗi tệp.

## Thông báo

Trong **Cài đặt → Tôi → Thông báo**, dưới **Thiết bị này**, **Bật** bật đẩy: nhắc nhở hiện lên ngay cả khi Kept đã đóng. **Kiểm tra** gửi một cái để thử.

- **iPhone và iPad** chỉ đẩy thông báo đến ứng dụng đã cài: thêm Kept vào Màn hình chính, mở nó từ đó, và bật nó. Trước đó, nhắc nhở có thể đến qua email.
- Đẩy cần HTTPS. Nếu máy chủ không có cách gửi đẩy, hoặc trình duyệt không thể nhận, trang sẽ nói vậy; email và trung tâm thông báo vẫn hoạt động.
- Giờ yên tĩnh giữ đẩy và email cho đến khi chúng kết thúc. Những gì mỗi địa điểm gửi, và cách gửi, được trình bày trong [sử dụng hàng ngày](/vi/users/everyday-use/#nhắc-nhở-và-thông-báo).
