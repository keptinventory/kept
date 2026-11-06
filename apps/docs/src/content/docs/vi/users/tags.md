---
title: Thẻ
description: "Thẻ nói lên những gì khác về một đồ vật, bên cạnh vị trí của nó. Thêm chúng ở bất cứ đâu, lọc theo nhiều thẻ, mở trang của một thẻ, và gắn thẻ trên điện thoại mà không cần tín hiệu."
---

**Các vị trí** nói một đồ vật ở đâu. **Thẻ** nói nó còn là gì nữa: *cắm trại*, *mùa đông*, *trẻ em*,
*mỏng manh*. Một đồ vật có thể có tới 50 thẻ; một tài khoản lên tới 1.000.

Thẻ thuộc về tài khoản, nên mọi địa điểm của nó đều chia sẻ chung. Chỉ đồ vật mới có thẻ (hộp
là đồ vật); các vị trí, tài liệu và con người thì không.

## Thêm thẻ

- **Trang của một đồ vật:** **Thẻ → Thêm thẻ**. Chọn một, hoặc gõ tên mới và **Tạo**. Tên
  gần với thẻ hiện có được liệt kê đầu tiên dưới **Ý bạn là**, nên *Campng* không trở thành
  *Camping* thứ hai.
- **Thêm một đồ vật:** trường **Thẻ** trong **Thêm một đồ vật**.
- **Chụp:** **Thêm thẻ** dưới tên. Các thẻ vẫn giữ nguyên cho các bức ảnh tiếp theo, giống như vị trí.
- **Nhiều cùng lúc:** **Chọn** trong nội dung của một vị trí, trang của một thẻ hoặc Hộp thư đến, sau đó
  **Thêm thẻ…** hoặc **Xóa thẻ…**. Các thẻ khác giữ nguyên.
- **Chế độ bảng tính:** cột **Thẻ** và **Thẻ…** cho một lựa chọn.

Mọi thay đổi đều có **Hoàn tác**.

## Ai làm được gì

| | Chủ sở hữu | Quản trị viên | Thành viên | Người xem |
|---|---|---|---|---|
| Xem thẻ, lọc theo chúng | ✓ | ✓ | ✓ | ✓ |
| Gắn thẻ cho đồ vật, tạo thẻ mới | ✓ | ✓ | ✓ | |
| Đổi tên, đổi màu, gộp, xóa thẻ | ✓ | ✓ | | |

## Màu sắc

Mỗi thẻ có một màu từ một bộ cố định mười hai màu, được chọn để đọc được cả trong giao diện sáng và tối. Thẻ mới lấy màu được dùng ít nhất. Thay đổi ở **Cài đặt → Tài khoản → Thẻ → Sửa**. Màu từ việc nhập Homebox trở thành màu gần nhất trong mười hai màu.

## Trang của một thẻ

Nhấn vào một thẻ trên trang của đồ vật, hoặc một hàng trong **Cài đặt → Tài khoản → Thẻ**. Nó liệt kê mọi thứ có thẻ đó trên các địa điểm của bạn, kèm số lượng ở mỗi nơi, cùng tìm kiếm, bộ lọc và nhóm như thường lệ. Chủ sở hữu và quản trị viên đổi tên, đổi màu, gộp và xóa ở đây.

- **Gộp** gom một thẻ vào thẻ khác: các đồ vật của nó nhận thẻ kia.
- **Xóa** chỉ hoạt động cho thẻ mà không đồ vật nào có, kể cả đồ vật trong Thùng rác. Hãy gộp thay vào đó.
- Đổi tên, đổi màu, gộp và xóa có thể hoàn tác trong 7 ngày.

## Tìm theo thẻ

- **Bộ lọc → Thẻ:** **là bất kỳ giá trị nào trong**, **có tất cả** (đồ vật có mọi thẻ được chọn) hoặc **không phải bất kỳ giá trị nào trong**.
- **Hiển thị → Nhóm: Thẻ** liệt kê mỗi đồ vật dưới thẻ đầu tiên của nó, theo thứ tự A đến Z; đồ vật không có thẻ ở cuối.
- Tìm kiếm tìm tên thẻ, và tìm kiếm theo ngữ nghĩa cũng nhận biết chúng.

## Ngoại tuyến

Điện thoại giữ lại các thẻ của bạn: các chip hiển thị, và bộ lọc thẻ hoạt động trong tìm kiếm ngoại tuyến. Thẻ bạn thêm hoặc gỡ, và thẻ bạn tạo, được lưu trên điện thoại và đồng bộ khi bạn quay lại trực tuyến.

## AI và MCP

- **Chụp:** với AI bật, một bức ảnh gợi ý thẻ từ danh sách của bạn, không bao giờ là thẻ mới. Xác nhận hoặc từ chối chúng trong Hộp thư đến.
- **MCP và trợ lý:** `get_thing` trả về thẻ; `list_tags` liệt kê chúng; `tag_things` thêm hoặc gỡ chúng; `search_things` nhận nhiều thẻ, bất kỳ hoặc tất cả; `add_thing` và
  `update_thing` nhận tên thẻ.

## Nhập

- **Homebox:** thẻ chuyển sang kèm màu của chúng; thẻ lồng nhau được làm phẳng. Thẻ trên các vị trí Homebox không được giữ, và báo cáo nhập sẽ nói rõ điều đó.
- **CSV:** cột `tags` tạo ra các thẻ nó đặt tên.
