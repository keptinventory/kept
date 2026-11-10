---
title: ID ngắn và nhãn
description: "ID sáu ký tự, in nhãn trên trang giấy, cuộn và dây nhãn máy dán, những gì bộ quét làm với mọi mã nó đọc, quét mã không có mã QR, và Kept giữ mã nào ở đâu."
---

Khi một đồ vật mới đến máy chủ nó nhận một ID ngắn: sáu chữ cái và số, như `7KQ-4MZ`,
không bao giờ tái sử dụng. Cho đến lúc đó nó hiển thị **ID đang chờ**. Một nhãn mang ID dưới dạng văn bản và, trên mọi loại giấy trừ dây nhãn máy dán hẹp, trong một mã QR mở đồ vật đó. Một nhãn giữ mã của nó mãi mãi, nên một nhãn mất in lại cùng mã.

Danh sách, kết quả tìm kiếm và bảng điều khiển ⌘K hiển thị một đồ vật bằng tên của nó. Mã của nó hiện đó dưới dạng dây nhãn màu hổ phách chỉ khi nó đã có nhãn in: một nhãn được xác nhận bằng **Đã in xong?**, hoặc một nhãn trắng được yêu cầu cho nó. Trang tính nội dung hộp di chuyển cũng được tính, sau khi được xác nhận theo cùng cách ([Chuyển nhà](/vi/users/moving/)). Màu hổ phách nghĩa là "đồ vật này đã được dán nhãn". Trên trang riêng của nó, một đồ vật hoặc vị trí không có nhãn in hiển thị mã của nó nhỏ và xám, sau phần còn lại; cái có nhãn hiển thị dây nhãn. Một đồ vật có hơn một nhãn (một nhãn trắng được yêu cầu cho nó, ví dụ) hiển thị mã của cái in cuối cùng. Tìm kiếm và bộ quét tìm một đồ vật bằng bất kỳ mã nào của nó.

## In

**In** (Nhãn trong menu, hoặc **Nhãn** trên một đồ vật): chọn gì để in (một lựa chọn,
**Dán nhãn cho mọi thứ chưa có nhãn in** tại một địa điểm hoặc vị trí, hoặc một **Trang trắng**), chọn **Loại giấy nhãn**, chọn nơi bắt đầu trên một trang đã dùng một phần, và in từ trình duyệt. **Xem trước trang** chính là bản in đó, nhỏ hơn: cùng
mã QR, tên và vị trí, ngắt dòng cùng chỗ. Một tên không bao giờ bị cắt ngắn: tên dài
xuống dòng và chữ nhỏ lại, và cái vẫn không vừa được liệt kê trước khi bạn in, với
liên kết để đổi tên. Trang được đặt theo kích thước giấy của trang với lề bằng không, nên mặc định của hộp thoại in (tỷ lệ 100 %) đặt mọi nhãn vào ô của nó.

Các loại giấy nhãn (khi **Đơn vị đo** là **Hệ Anh** trong Cài đặt → Tôi → Hiển thị, bộ chọn hiển thị các kích thước này bằng inch, đến hai chữ số thập phân: nhãn của trang Letter là 2,63 × 1 inch; bản in vẫn như nhau):

| Loại | Kích thước | Mỗi nhãn |
|---|---|---|
| Trang A4, 24 nhãn | 70 × 37 mm, 3 × 8 | Mã QR, ID ngắn, tên và vị trí |
| Trang A4, 65 nhãn | 38 × 21 mm, 5 × 13 | Mã QR và ID ngắn |
| Trang Letter, 30 nhãn (bố cục Avery 5160) | 67 × 25 mm, 3 × 10 | Mã QR, ID ngắn, tên và vị trí |
| Cuộn máy in nhãn | 50 × 30, 40 × 30 và 62 × 29 mm | Mã QR, ID ngắn, tên và vị trí |
| Dây nhãn máy dán, 9 và 12 mm (Brother TZe và tương tự) | 40 và 50 mm dài | ID ngắn chữ to, và tên. Không có mã QR |
| Dây nhãn máy dán, 18 và 24 mm | 50 và 60 mm dài | Mã QR, ID ngắn chữ to, và tên |

Cuộn và dây in một nhãn mỗi trang, ở kích thước của nhãn: trong hộp thoại in, chọn máy in nhãn của bạn và kích thước đó. Với ứng dụng máy dán nhãn nhận hình ảnh, **Chia sẻ dưới dạng hình ảnh** tạo một PNG cho mỗi nhãn. Dây hẹp không có chỗ cho mã QR quét được, nên nó mang ID ngắn to thay vào đó: bộ quét đọc nó từ văn bản ([Quét mã không có mã QR](#quét-mã-không-có-mã-qr)).

Sau đó, **Đã in xong?** hỏi về lô bạn vừa in và ghi nhận nó; từ đó các đồ vật và vị trí đó hiển thị dây nhãn màu hổ phách. **Các lô gần đây** cho thấy mỗi lô chứa gì, khi và nơi nó được tạo và đã in hay chưa; lô chưa được xác nhận có thể đánh dấu **Đã in tốt** hoặc **Chưa in** đó, và in lại với cùng mã. In lại cùng đồ vật trong khi trang của chúng chưa được xác nhận đưa ra trang đó thay vì một trang mới. Đồ vật có ID vẫn đang chờ không thể in ngay.

## Quét

**Quét** trên Trang chủ và Tìm kiếm mở camera.

| Bạn quét | Kept |
|---|---|
| Nhãn Kept cho thứ bạn nhìn thấy | Mở nó và đánh dấu nó vừa được nhìn thấy |
| Mã Kept in không có mã QR (dây hẹp) | Mở nó, đọc từ văn bản, hoặc hỏi **Đây có phải là mã không?** trước khi đọc không rõ ([dưới](#quét-mã-không-có-mã-qr)) |
| Nhãn trắng | Đề xuất **Hộp mới tại đây**, **Đính kèm vào một đồ vật đã có** hoặc **Gắn vào một vị trí có sẵn** (một phòng, kệ hoặc chỗ) |
| Mã vạch sản phẩm | Đề xuất thêm nó như một đồ vật mới; với tra cứu mã vạch do quản trị viên bật, nó được đặt tên từ Open Food Facts, Open Products Facts hoặc Open Beauty Facts |
| Số serial hoặc thẻ tài sản mà một đồ vật có | Mở đồ vật đó |
| Mã vạch mà một đồ vật có | Mở đồ vật đó; vài đồ vật hỏi chọn cái nào |
| Mã chưa thuộc về thứ gì | Nêu loại của nó và đề xuất thêm nó như một đồ vật mới, giữ mã làm mã vạch hoặc số serial của nó |
| Nhãn Homebox, sau [nhập Homebox](/vi/users/import-export/) | Mở đồ vật đã nhập |
| Bất cứ thứ gì khác | Nói nó không phải nhãn Kept |

Một nhãn được yêu cầu cho một vị trí hiển thị trên nó như dây nhãn màu hổ phách, như một cái được in cho nó. Yêu cầu hoạt động ngoại tuyến: nó chờ trên điện thoại cho đến khi đồng bộ, và nếu điện thoại khác đã yêu cầu cùng nhãn trước bạn được biết cái nào có nó. Thành viên, quản trị viên và chủ sở hữu có thể yêu cầu; người xem không thể.

Để dán nhãn cho một vị trí bạn đã dán nhãn trắng lên, mở vị trí và chọn **Thêm mã nhãn** (dưới Quản lý): bộ quét mở ra, và nhãn trắng bạn quét đưa ra vị trí đó trước.

Một nhãn ở lại với thứ nó được dán lên. Khi [các ngăn được gộp](/vi/users/locations/#gộp-và-tách-ngăn),
nhãn của cái bị gộp đi mở ngăn đã gộp; tách lại cho mỗi cái nhãn của nó trở lại. Khi đồ nội thất bị [xoay](/vi/users/locations/#xoay-đồ-nội-thất), mỗi ngăn giữ nhãn của nó, dù nó được đánh số lại hay không.

Các mã Kept đọc, và một đồ vật mới giữ chúng ở đâu:

| Mã | Thường ở | Kept giữ nó làm |
|---|---|---|
| Mã QR | Nhãn Kept, nhãn Homebox | Nhãn |
| EAN-13, EAN-8, UPC-A, UPC-E | Sản phẩm | Mã vạch |
| Code 128, Codabar | Nhãn cửa hàng, tài sản và thư viện | Mã vạch |
| ITF-14 | Hộp lớn | Mã vạch, khi chữ số kiểm tra của nó đúng; nếu không bạn chọn |
| Code 39, Code 93 | Thẻ tài sản, dán IT | Số serial, hoặc Mã vạch nếu bạn chọn |
| Data Matrix | Điện tử, sạc, linh kiện | Một mã GS1: GTIN của nó làm mã vạch và serial của nó làm số serial. Văn bản thuần túy: bạn chọn |
| PDF417, Aztec | Nhãn vận chuyển, thẻ bảo hành, vé | Bạn chọn; văn bản quá dài cho cả hai trường (64 ký tự cho mã vạch, 100 cho số serial) không được giữ |

Nhãn Kept thắng trong tất cả các trường hợp này. Số serial khớp chính xác như đã lưu, và chỉ trực tuyến: bản sao ngoại tuyến của điện thoại không giữ số serial. Mã GS1 gõ với ngoặc, như `(01)04006381333931(21)K7Q2X9`, được đọc theo cùng cách.

Nhãn mòn, hoặc không có camera: **Nhập mã**. Camera Capture cũng nhận diện nhãn Kept, và đề xuất mở hộp đó hoặc chụp vào đó.

### Quét mã không có mã QR

Nhãn không có mã QR (dây hẹp) quét bằng ID ngắn in của nó. Chỉ **Quét** vào mã, để nó lấp khoảng một phần ba chiều rộng camera, và giữ yên một lúc: Kept đọc sáu ký tự từ văn bản và mở đồ vật, như từ mã QR, và một thông báo nói mã nào nó đã đọc.

- **Trên điện thoại, ngoại tuyến cũng được.** Việc đọc xảy ra trên điện thoại; hình ảnh không bao giờ được gửi đâu. Nó hoạt động không cần kết nối cho bất cứ thứ gì trong bản sao của điện thoại.
- **Không bao giờ mở sai đồ vật.** Kept mở mã chỉ khi nó đọc rõ mọi ký tự, hai lần liên tiếp, và mã là của bạn. Khi nó không chắc, nó hiển thị mã nó đọc và cái nó mở, và hỏi **Đây có phải là mã không?** trước khi mở. Mã không khớp với nhãn nào của bạn không mở gì: **Quét lại**, hoặc **Nhập mã**.
- **Chỉ in của Kept.** Nó đọc ID ngắn như Kept in, trong font riêng của Kept. Mã gõ vào máy dán nhãn bằng tay, trong font của máy dán, có thể không đọc được: hãy gõ nó thay vào đó.

Chỉ **Quét** đọc mã in. Các phiên quét, kiểm tra hộp và camera Capture đọc mã QR và mã vạch thôi.

## Liên quan

- [Phiên quét](/vi/users/scanning-sessions/) để quét cả một hộp cùng lúc.
- [Thẻ](/vi/users/tags/) để nói đồ vật còn là gì nữa.
- [Sử dụng hàng ngày](/vi/users/everyday-use/) để thấy bức tranh rộng hơn.
