---
title: "Phương tiện và máy móc"
description: "Ghi nhận chỉ số, bảo dưỡng và nhiên liệu cho bất kỳ thứ gì có đồng hồ đo: ô tô, máy phát điện, lò hơi. Lịch trình theo ngày hoặc theo chỉ số, lịch trình khởi đầu, vật tư từ tồn kho và báo cáo lịch sử."
---

Kept theo dõi bất cứ thứ gì có đồng hồ đo: một chiếc ô tô, một máy phát điện, một lò hơi, một máy cắt cỏ. Một đồ vật có loại là metered sẽ có **Đồng hồ đo**: chỉ số, bảo dưỡng và lịch trình. **Phương tiện** (cài đặt sẵn Household và Complete) thu gom mọi phương tiện vào một nơi, mỗi chiếc có các thẻ cho tổng quan, chỉ số, bảo dưỡng, tài liệu, chi phí và, trên Complete, nhiên liệu.

Trang này bao gồm ghi nhận chỉ số và bảo dưỡng, lịch trình, nhiên liệu và báo cáo lịch sử. Về các hình dạng bản đồ mà một phương tiện có thể mang theo, xem [hình dạng bản đồ](/vi/users/map-shapes/).

## Ghi nhận chỉ số

Một chỉ số hoạt động từ Trang chủ, từ phương tiện và ngoại tuyến. Một chỉ số không vừa khít giữa các chỉ số lân cận sẽ bị từ chối, và Kept nói rõ lý do. Một ảnh chụp màn hình điều khiển sẽ tham gia vào các ảnh chứng minh của phương tiện.

## Ghi nhận bảo dưỡng

Một bản ghi bảo dưỡng lưu lại chuyến đến cửa hàng:

- **Ngày** và **chỉ số** tại thời điểm đó.
- **Cửa hàng** và **hóa đơn**. AI có thể điền các dòng mục từ hóa đơn.
- **Các dòng mục** với chi phí của chúng.
- **Lịch trình đã hoàn thành**: lưu lại sẽ khởi động lại đếm của chúng.
- **Các dòng Từ tồn kho** (xem bên dưới).
- **Ghi chú**.

Trên thẻ **Bảo dưỡng** của phương tiện, chạm vào một lần bảo dưỡng để mở nó: mọi thứ nó chứa, kèm theo ghi chú.

- **Sửa** mở cùng biểu mẫu, đã được điền sẵn. Lưu chỉ thay đổi những gì bạn đã sửa.
- **Xóa** hỏi trước, sau đó cung cấp **Hoàn tác**. Các dòng và hóa đơn của nó đi kèm; các lịch trình nó đã hoàn thành sẽ đếm từ lần bảo dưỡng trước đó.
- Ai được làm: người đã ghi nhận nó, và chủ vị trí cùng quản trị viên. Người xem chỉ có thể mở, không thể thay đổi.
- Một hóa đơn đang được đọc là một **bản nháp**: **Hoàn tất ghi nhận** hoặc **Hủy bản nháp**.

## Từ tồn kho

Khi Consumables bật cho vị trí, một dòng bảo dưỡng có thể chọn một vật tư tiêu hao từ cùng vị trí: cái lọc dầu trên kệ.

- Lưu sẽ trừ số lượng của dòng (1 khi số lượng để trống) khỏi số lượng của vật tư tiêu hao.
- Kept từ chối nếu nhiều hơn số còn lại.
- Sửa dòng, xóa dòng, xóa bản ghi bảo dưỡng hoặc hoàn tác bất kỳ thứ nào trong này sẽ đưa số lượng về đúng lại.
- Một hóa đơn đang được đọc không trừ gì cho đến khi bạn lưu nó.

**Lịch sử** của vật tư tiêu hao hiển thị việc sử dụng, có liên kết đến bản ghi bảo dưỡng.

Trợ lý và các máy khách MCP có thể ghi nhận bảo dưỡng theo cách tương tự ("dùng 4,5 lít dầu máy"). Thẻ xác nhận của trợ lý hiển thị từng dòng **Từ tồn kho** trước khi bất cứ thứ gì di chuyển.

## Lịch trình

Một lịch trình là nhắc nhở để làm lại một việc, theo ngày hoặc theo chỉ số.

- **Thêm lịch trình khởi đầu** thêm các lịch trình thông thường: thay dầu, đảo lốp, thay dầu phanh, thay lọc gió.
- **Một lần duy nhất** (một ngày, không lặp lại) được coi là xong khi bạn hoàn thành nó. Nó rời khỏi Đến hạn và Quá hạn, và **Lịch trình** liệt kê nó là **Xong** kèm ngày. Hoàn tác việc hoàn thành, hoặc xóa bản ghi bảo dưỡng đó, và nó sẽ đến hạn lại.
- Các lịch trình đến hạn và quá hạn xuất hiện trong **Cần bạn** của Trang chủ, trong nguồn lịch và trung tâm thông báo. Xem nhắc nhở và thông báo.

## Nhiên liệu (cài đặt sẵn Complete)

Trên cài đặt sẵn Complete, thẻ **Nhiên liệu** ghi nhận mỗi lần đổ. Biểu mẫu hỏi **số lượng** (theo đơn vị của bạn: lít, gallon, hoặc sạc tính bằng kWh cho xe điện) và **chi phí**; giá trên đơn vị được tính từ hai giá trị đó, không nhập tay. Nó cũng có ngày và giờ, **Đầy bình** hoặc **Đổ một phần**, đồng hồ công-tơ-mét (tùy chọn, đối chiếu với các chỉ số trước và sau nó), ảnh chụp đồng hồ công-tơ-mét, biên lai trạm, một ghi chú, và trạm — một trạm mới sẽ được thêm vào nhà cung cấp của bạn khi bạn lưu. **Tôi đã bỏ sót một lần đổ trước lần này** đánh dấu một khoảng trống, để tiêu thụ vẫn đúng: tiêu thụ được đo từ một lần đầy bình đến lần đầy bình tiếp theo, và hiển thị lại sau hai lần đầy bình có chỉ số đồng hồ công-tơ-mét.

## Đơn vị

- **Đồng hồ công-tơ-mét**: đồng hồ công-tơ-mét của một phương tiện mới đếm bằng **km**, hoặc bằng **mi** khi cài đặt **Đơn vị đo** của bạn (Cài đặt → Tôi → Hiển thị) là **Hệ Anh**. Đồng hồ của máy phát điện đếm giờ.
- **Đổi đơn vị**: chủ sở hữu và quản trị viên tìm thấy nó trên thẻ đồng hồ công-tơ-mét của tổng quan, và trên một đồng hồ ở trang của một đồ vật. Đồng hồ công-tơ-mét chuyển giữa km và mi theo một trong hai cách:
  - **Chỉ đổi tên**: các chỉ số vốn luôn ở đơn vị mới. Mọi giá trị giữ nguyên.
  - **Quy đổi các chỉ số**: mọi chỉ số (cả những chỉ số đang chờ xem lại), độ lệch khi thay, giới hạn mỗi ngày và các lịch trình chạy theo đồng hồ công-tơ-mét (mỗi bao nhiêu km, thông báo trước đó, chỉ số mà nó đếm từ đó và hoãn đến một chỉ số) được quy đổi theo 1 mi = 1,609344 km, đến phần nghìn.

  Trước khi bạn lưu, Kept cho biết bao nhiêu chỉ số thay đổi và chỉ số mới nhất trước và sau. Thay đổi được ghi vào lịch sử của phương tiện là **Đã đổi đơn vị đồng hồ đo**, và thông báo sau đó có **Hoàn tác**, đưa mọi giá trị trở lại chính xác. Hoàn tác bị từ chối, và nói rõ lý do, khi có bất cứ gì trên đồng hồ đã thay đổi kể từ đó: một chỉ số được ghi, giữ lại hoặc sửa, hoặc một lịch trình được thay đổi. Đồng hồ giờ hoặc đồng hồ tùy chỉnh chỉ có thể đổi tên.
- **Chỉ số và số lượng nhiên liệu** được giữ như đã nhập. Chỉ **Quy đổi các chỉ số** thay đổi một chỉ số, và có thể hoàn tác. Số lượng nhiên liệu (lít, gallon, kWh) không bao giờ được quy đổi.
- **Tiêu thụ nhiên liệu** theo cài đặt **Đơn vị đo** của bạn, bất kể đồng hồ công-tơ-mét đếm bằng đơn vị nào: **L/100 km**, hoặc **kWh/100 km** cho lần sạc, ở hệ mét; **mpg** (gallon Mỹ) hoặc **mi/kWh** ở hệ Anh. Trên đồng hồ giờ, nó tính theo giờ, bằng đơn vị bạn đã nhập. PDF của báo cáo lịch sử theo cài đặt của người tạo ra nó.
- **Ảnh màn hình điều khiển ở đơn vị khác**: khi ảnh hiển thị dặm và đồng hồ công-tơ-mét đếm km, hoặc ngược lại, chỉ số chờ trong **Hộp thư đến** như mọi chỉ số từ ảnh. Thẻ của nó nói ảnh đã hiển thị gì và đưa ra giá trị theo đơn vị của đồng hồ công-tơ-mét, kèm một nút để dùng nó. Không có gì được quy đổi cho đến khi bạn chọn.

## Chi phí

Thẻ **Chi phí** của một phương tiện hiển thị chi phí nhiên liệu, bảo dưỡng và phí. Insights hiển thị các con số tương tự trên các phương tiện của bạn dưới **Chi phí xe**.

## Đọc thẻ đăng ký

Ở chế độ Label, **Đọc thẻ** đọc thẻ đăng ký: VIN, biển số và hạn sử dụng giấy phép.

## Báo cáo lịch sử

**Báo cáo lịch sử** tạo một PDF cho một khoảng thời gian: lịch sử đồng hồ công-tơ-mét kèm ảnh chứng minh, các lần bảo dưỡng kèm hóa đơn, nhiên liệu và tài liệu, và chi phí chỉ ở nơi bạn thấy được tiền.

## Liên quan

- [Sử dụng hàng ngày](/vi/users/everyday-use/) cho bức tranh toàn cảnh.
- [Số lượng và kiểm kê](/vi/users/counts/) cho vật tư tiêu hao được theo dõi trong kho.
- [Nhà cung cấp AI](/vi/users/ai-providers/) để đọc hóa đơn và thẻ.
