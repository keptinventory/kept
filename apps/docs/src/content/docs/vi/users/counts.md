---
title: "Kiểm kê và kiểm tra tồn kho"
description: "Mỗi lần kiểm kê và kiểm tra hộp đều được lưu giữ, với những gì được tìm thấy, những gì bị thiếu và vị trí hiện tại của mỗi đồ vật. Kiểm kê một vị trí cùng nhau, lên kế hoạch kiểm kê mỗi vài tháng, so sánh với lần trước và xuất CSV."
---

Một lần kiểm kê lưu giữ mọi kết quả. **Kiểm kê** liệt kê từng lần kiểm kê và kiểm tra hộp của một địa điểm, mới nhất trước, và trang của một lần kiểm kê hiển thị những gì nó tìm thấy, những gì nó để lại là thiếu, và vị trí hiện tại của mỗi đồ vật.

Mở nó từ **Thêm → Kiểm kê**, từ trang của một địa điểm (**Kiểm kê**), hoặc từ trang của một vị trí (**Các lần kiểm kê trước**). Sau khi lưu một lần kiểm kê, **Xem lần kiểm kê này** sẽ mở nó.

## Danh sách Kiểm kê

Tìm kiếm theo những gì đã được kiểm kê, và lọc theo loại (kiểm kê, kiểm tra hộp), vị trí, người kiểm kê, **Có thiếu** và ngày. Nhóm theo vị trí, người hoặc tháng. Danh sách được phân trang, và mọi bộ lọc đều nằm trong địa chỉ, nên một danh sách đã lọc có thể được thêm vào dấu trang hoặc lưu làm một chế độ xem.

## Trang của một lần kiểm kê

- **Tìm thấy X của Y**, khi nào, mất bao lâu, ai đã kiểm kê (mọi người, trong một lần kiểm kê chung) và ai đã hoàn thành nó.
- **Kể từ lần kiểm kê trước** của cùng một vị trí hoặc hộp: "1 mới bị thiếu · 0 tìm thấy lại · 2 đồ vật mới", với liên kết đến lần trước.
- Các danh sách của nó, mỗi hàng liên kết đến đồ vật với vị trí hiện tại của nó:

| Danh sách | Ý nghĩa |
|---|---|
| Tìm thấy | Được đọc trong lúc kiểm kê: đã đánh dấu đã thấy |
| Thiếu | Trong danh sách, không được đọc, và không được đánh dấu không có ở đây |
| Tìm thấy ở nơi khác | Được đọc ở đây, nhưng Kept để nó ở nơi khác, và bạn để nó lại đó |
| Di chuyển đến đây | Tìm thấy ở nơi khác, và di chuyển đến đây |
| Đánh dấu không có ở đây | Được chọn trên trang tóm tắt |
| Đang cho mượn, Đang sửa, Trong Thùng rác | Không bao giờ bị thiếu: vắng mặt vì lý do Kept biết |
| Không kiểm kê: Kệ sau | Trong khu vực không ai kiểm kê (xem bên dưới) |

Một đồ vật bị vứt vào thùng rác kể từ lần kiểm kê vẫn hiển thị, được đánh dấu **Đã vứt vào thùng rác**.

**Xuất CSV** lưu lần kiểm kê dưới dạng bảng tính: đồ vật, ID ngắn, vị trí mong đợi, kết quả, số lượng tìm thấy trên số lượng, và vị trí hiện tại.

Các lần kiểm kê lưu trước Kept 1.14 hiển thị tổng số của chúng; chúng không ghi lại những gì bị thiếu hay ở nơi khác.

## Không bao giờ "thiếu" vì một lý do

Một đồ vật đang được cho mượn, đang sửa hoặc trong Thùng rác không bao giờ được liệt kê là thiếu. Trang tóm tắt đưa mỗi lý do vào một nhóm riêng, "Đang cho Murdock mượn (3)", "Đang sửa (1)", và lần kiểm kê giữ chúng như vậy.

## Không được kiểm kê, và "Tôi đã kiểm tra nó"

Một lần kiểm kê của một vị trí có các vị trí bên trong nó (hoặc của toàn bộ một địa điểm) có **khu vực**: vị trí đó và từng vị trí bên trong nó. Một khu vực không có gì được đọc là **Không được kiểm kê**: các đồ vật của nó được liệt kê dưới "Không được kiểm kê: Kệ sau", không phải dưới Thiếu. Nếu bạn đã nhìn và khu vực đó thực sự trống rỗng của những đồ vật đó, nhấn **Tôi đã kiểm tra nó**: chúng trở thành Thiếu.

## Kiểm kê theo số lượng

Một đồ vật có số lượng (6 hộp) được tính là tất cả chúng khi nhãn của nó được đọc. Sử dụng **−** và **+** trên hàng của nó để nói bạn tìm thấy bao nhiêu. Tìm thấy thiếu, chọn **Đánh dấu phần còn lại là không có ở đây** cho nó: phần còn lại được tách ra thành hàng riêng, được đánh dấu không có ở đây, giống như kiểm tra hộp. Hoàn tác gom nó lại.

## Kiểm kê cùng nhau

Một lần kiểm kê bắt đầu trực tuyến được chia sẻ. Bất kỳ ai khác mở một lần kiểm kê của cùng một vị trí sẽ thấy **Đang kiểm kê bởi Sam: Tham gia**. Tham gia thêm những gì bạn đọc vào cùng một lần kiểm kê, mỗi lần đọc kèm theo người đọc; trang tóm tắt hiển thị những gì người khác tìm thấy, và khu vực của họ được tính là đã kiểm kê. Bất kỳ ai đang kiểm kê ở đó đều có thể hoàn thành nó, và hoàn thành cần kết nối. Một lần kiểm kê tham gia qua nhiều ngày vẫn mở cho đến khi ai đó hoàn thành nó.

## Độ bao phủ nhãn

Cài đặt của lần kiểm kê nói bao nhiêu đồ vật ở đó có nhãn ("62% đồ vật ở đây có nhãn"), với **In nhãn cho phần còn lại**. Một đồ vật không có nhãn không bao giờ bị thiếu: tích nó trên trang tóm tắt nếu bạn đã thấy nó.

## Kiểm kê dự định

Trên trang của một vị trí, **Kiểm kê định kỳ** lên kế hoạch một lần kiểm kê mỗi 1 đến 24 tháng. Đây là lịch trình của vị trí, với nhắc nhở thông thường (một tuần trước), đến hạn và quá hạn, và ô Cần bạn. Kiểm kê vị trí đó (có hoặc không có các vị trí bên trong) đánh dấu nó hoàn thành; hoàn tác lần kiểm kê cũng hoàn tác việc đó. Để kiểm kê toàn bộ một địa điểm định kỳ, lên kế hoạch nó trên vị trí cao nhất của nó.

## Ai có thể làm gì

| | Chủ sở hữu, quản trị viên, thành viên | Người xem |
|---|---|---|
| Xem Kiểm kê, trang kiểm kê, so sánh, xuất CSV | ✓ | ✓ |
| Kiểm kê, tham gia kiểm kê | ✓ | Một lần kiểm tra: không lưu gì, không liệt kê |
| Lên kế hoạch kiểm kê | ✓, với Lịch trình bật | — |
