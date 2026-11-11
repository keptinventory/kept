---
title: "Kết nối một ứng dụng AI (MCP)"
description: "Kết nối Claude Desktop hoặc tác nhân AI khác với máy chủ MCP (Giao thức ngữ cảnh mô hình) của Kept, bằng token cá nhân hoặc OAuth."
---

Kept chạy một máy chủ [MCP](https://modelcontextprotocol.io/) tại địa chỉ Kept của bạn theo sau là
`/mcp`, ví dụ `https://kept.example.org/mcp`. Một ứng dụng AI nói được MCP sau đó có thể trả lời
"cái khoan ở đâu?" từ hàng hóa của bạn và, nếu bạn cho phép, thêm, di chuyển và thay đổi đồ vật.

![Claude Code kết nối với Kept: "Thêm TV của tôi vào Phòng khách: Samsung QE55Q80C, số seri 0B7H3CJT500123", và câu trả lời của Claude rằng TV đang ở Kept dưới Trang chủ › Phòng khách](../../../../assets/screens/claude-mcp-light.webp)

Trang này nói về các ứng dụng bên ngoài Kept. Trợ lý riêng của Kept dùng cùng các công cụ và được bao gồm trong
[Nhà cung cấp AI](/vi/users/ai-providers/). Cách máy chủ hoạt động bên trong nằm ở
[Máy chủ MCP](/vi/developers/mcp/).

Có hai cách để kết nối một ứng dụng:

- **Token cá nhân**: bất kỳ ứng dụng khách MCP nào cho phép bạn đặt địa chỉ máy chủ và một tiêu đề
  `Authorization`.
- **Một trình kết nối (OAuth)**: ứng dụng đưa bạn đến Kept để đăng nhập và chọn những gì nó có thể làm. Cái này
  cần Kept ở một địa chỉ `https` mà ứng dụng có thể truy cập.

:::note[Chưa kiểm tra với các ứng dụng]
Kiểm thử của Kept kết nối một ứng dụng khách MCP cả hai cách. Kiểm tra với claude.ai, ChatGPT và Claude Desktop
chính thức vẫn đang chờ, nên chưa xác nhận được những cái nào kết nối như trình kết nối.
:::

## Trước khi bắt đầu

- **Bật "Kết nối ChatGPT hoặc Claude" ở mỗi vị trí mà ứng dụng cần truy cập.** Nó nằm ở
  **Cài đặt vị trí → Theo dõi gì**, và chỉ bật trong cài đặt sẵn **Hoàn thành**. Chủ sở hữu và
  quản trị viên thay đổi nó. Ở một vị trí mà nó tắt, token hoặc trình kết nối không truy cập được gì.
- **Ứng dụng chỉ tạo token qua `https`.** Cài đặt → Kết nối từ chối tạo token khi
  `KEPT_PUBLIC_URL` là `http` thuần túy. Không có cài đặt nào để tắt điều này. Xem
  [HTTPS](/vi/install/https/). Trên mạng nhà qua `http`, người chạy máy chủ có thể
  tạo một ở đó thay thế: [`kept admin token create`](/vi/admin/cli/#mã-thông-báo-từ-máy-chủ).

## Tạo token cá nhân

Mở **Cài đặt → Kết nối** và chọn **Token mới**.

| Trường | Điều để điền |
|---|---|
| **Tên** | Nơi bạn sẽ dùng nó: "Claude Desktop, laptop của tôi". |
| Địa điểm | Một cái được tích sẵn cho bạn. Thêm cái khác chỉ nếu ứng dụng cần cả hai. |
| **Nó có thể làm gì** | **Chỉ đọc**: tìm đồ vật và đọc những gì đã ghi. **Đọc và thay đổi**: cũng thêm, di chuyển hoặc thay đổi chúng. Cả hai đều không xóa hay xem trường bí mật. |
| **Hết hạn** | Một ngày, hoặc để trống để giữ cho đến khi bạn thu hồi nó. Nó kết thúc vào cuối ngày đó. |

Sau đó **Tạo token**. Một token không bao giờ làm nhiều hơn bạn: nơi bạn là người xem, nó chỉ có thể
đọc. Token có thể thay đổi đồ vật ở nhiều vị trí mà thành viên khác nhau nhận được cảnh báo,
**Các địa điểm này có những người dùng khác nhau**, vì ứng dụng có thể di chuyển đồ vật từ cái này sang cái kia. **Tạo cho tất cả chúng** tiếp tục; một token cho mỗi vị trí là lựa chọn an toàn hơn.

Token, `kpt_` theo sau bởi hai phần, xuất hiện **một lần**, với **Sao chép**. Kept chỉ giữ một
dấu vân tay của nó, nên token bị mất không thể hiện lại: hãy thu hồi nó và tạo cái khác.

Ở một vị trí yêu cầu hai yếu tố, token chỉ hoạt động nếu bạn tạo nó khi đã đăng nhập với
yếu tố thứ hai của bạn.

## Kết nối ứng dụng khách bằng token

Dưới token mới, **Kết nối một ứng dụng** hiện ra hai giá trị, mỗi cái có nút sao chép:

```text
Server address   https://kept.example.org/mcp
Authorization    Bearer kpt_…
```

Trong ứng dụng, thêm một máy chủ MCP (có thể gọi là trình kết nối hoặc tích hợp) với địa chỉ đó,
và gửi token trong tiêu đề đó. Kept không cung cấp tệp cài đặt cho ứng dụng cụ thể nào;
địa chỉ và tiêu đề đi đâu nằm trong tài liệu của chính ứng dụng đó.

Điểm cuối chỉ trả lời `POST`, không giữ phiên giữa các yêu cầu, và từ chối yêu cầu mà
`Host` không phải là địa chỉ Kept (hoặc địa chỉ nó đã dùng trước đó) hoặc đến từ trang của trang web khác.

## Kết nối như trình kết nối (OAuth)

Ứng dụng hỗ trợ nó có thể kết nối mà không cần token bạn sao chép. Cái này bật riêng khi
`KEPT_PUBLIC_URL` là `https`. **Quản trị → Trạng thái → Kết nối từ các ứng dụng khác** hiển thị điểm cuối MCP
và **Có sẵn** hoặc **Cần một URL công khai https**.

1. Trong ứng dụng, thêm `https://kept.example.org/mcp` như một trình kết nối.
2. Ứng dụng tìm đăng nhập Kept từ địa chỉ và đưa bạn đến Kept. Đăng nhập.
3. Kept hiển thị **_Ứng dụng_ muốn dùng Kept của bạn**. Tên là cái ứng dụng tự đặt; Kept
   không thể xác nhận ai tạo nó. Chọn **Nó có thể làm gì** và **Ở đâu** (chỉ chọn các vị trí nó
   cần), sau đó **Cho phép** hoặc **Từ chối**. Trang cũng nói ứng dụng vẫn đăng nhập sau khi bạn
   đăng xuất khỏi trình duyệt này, và bất cứ thứ gì đăng xuất tất cả thiết bị khác của bạn làm nó đăng nhập lại.
4. Ứng dụng xuất hiện dưới **Ứng dụng đã kết nối** trong **Cài đặt → Kết nối**.

Ứng dụng vẫn kết nối cho đến khi bạn bấm **Thu hồi** trên nó và xác nhận (Kept hỏi **Ngắt kết nối
_Ứng dụng_?**), hoặc cho đến khi nó 30 ngày không được dùng; lúc đó nó phải đăng nhập lại. Mỗi token truy cập nó nhận
được kéo dài một giờ và ứng dụng tự gia hạn nó mà không hỏi bạn lại; Kept kiểm tra sự cho phép của bạn trên mọi cuộc gọi, nên
**Thu hồi** trong **Cài đặt → Kết nối** có hiệu lực ngay.

Ứng dụng phải đăng nhập lại sau bất cứ điều gì đăng xuất thiết bị khác của bạn: **Đăng xuất tất cả
thiết bị khác**, mật khẩu mới hoặc đặt lại mật khẩu, thay đổi hai yếu tố, mã dự phòng hoặc passkey, bỏ liên kết đăng nhập
bên ngoài, địa chỉ email mới, hoặc quản trị viên đăng xuất bạn ở khắp nơi hoặc vô hiệu hóa tài khoản của bạn. Đăng xuất
một thiết bị được chọn để ứng dụng vẫn đăng nhập.

Một ngoại lệ: yêu cầu xóa tài khoản đăng xuất thiết bị khác của bạn nhưng giữ đăng nhập của ứng dụng.
Ứng dụng ngừng hoạt động khi tài khoản đang chờ, và nếu bạn giữ tài khoản, nó hoạt động lại
mà không cần đăng nhập.

Những việc làm dừng trình kết nối:

- **Ứng dụng không truy cập được Kept.** Ứng dụng web như claude.ai kết nối từ máy chủ của nó, nên
  Kept phải truy cập được từ internet, không chỉ trên mạng nhà hoặc tailnet của bạn.
- **Kept không truy cập được ứng dụng.** Ứng dụng nhận diện mình bằng địa chỉ `https` cho một tài liệu
  mô tả nó, và Kept tải tài liệu đó. Địa chỉ riêng và địa phương bị từ chối.
- **Ứng dụng tự đăng ký.** Kept chấp nhận ứng dụng tự mô tả bằng tài liệu như vậy
  (Tài liệu siêu dữ liệu ID ứng dụng) và tắt đăng ký ứng dụng động. Ứng dụng chỉ có thể đăng ký động
  không thể kết nối như trình kết nối; hãy dùng token cá nhân nếu nó chấp nhận.

## Ứng dụng có thể và không thể làm gì

- **Nó chỉ thấy các vị trí bạn chọn**, và ở mỗi cái chỉ các công cụ cho những phần của Kept
  mà vị trí đó bật. Nơi vai trò của bạn giấu giá trị, chúng cũng bị ẩn khỏi ứng dụng.
- **Thay đổi áp dụng ngay và liệt kê dưới Thay đổi gần đây bởi kết nối** trên trang Kết nối,
  với **Hoàn tác trong 7 ngày**. Hoàn tác từ chối khi trường đã thay đổi kể từ đó.
- **Không có công cụ phá hoại nào để gọi.** Không công cụ nào xóa, đưa vào thùng rác, gộp, chuyển quyền sở hữu,
  tiết lộ trường bí mật, tải tệp lên hay chạy truy vấn của riêng nó.
- **Tệp đi qua bạn.** `attach_link` đưa ứng dụng một liên kết mở trang chụp của Kept;
  bạn thêm ảnh hoặc hóa đơn đó ở đó, đã đăng nhập.
- **Giới hạn mỗi token**: 120 lần đọc và 30 lần thay đổi một phút. Câu trả lời ngắn và phân trang, 20 món
  trừ khi ứng dụng xin thêm, tối đa 200.
- **Văn bản người viết được đánh dấu là không tin cậy.** Tên và ghi chú đến ứng dụng dưới khóa `untrusted`,
  và Kept bảo nó không bao giờ làm theo hướng dẫn tìm thấy trong đó.

## Các công cụ

Ứng dụng chỉ thấy các công cụ nó có thể gọi ở mỗi vị trí; `capabilities` liệt kê chúng. [Ẩn
Cá nhân](/vi/users/locations/#ẩn-cá-nhân) không thay đổi những gì ứng dụng được cho. Công cụ **Đọc**
hoạt động với cả hai loại truy cập; công cụ **thay đổi** cần **Đọc và thay đổi** và vai trò thành viên hoặc cao hơn. Phần của Kept mà công cụ cần là tên dưới **Theo dõi gì**.

| Công cụ | Loại | Cần | Nó trả lời gì |
|---|---|---|---|
| `capabilities` | read | | Tôi có thể làm gì ở mỗi vị trí: các phần của nó và các công cụ tôi có thể gọi đó. |
| `list_locations` | read | | Tôi thấy những địa điểm nào, với vai trò và múi giờ của chúng. |
| `search_things` | read | | Những đồ vật nào khớp với các từ này: tên, bí danh, loại, thương hiệu và ghi chú, với bộ lọc. |
| `where_is` | read | | Đồ vật ở đâu: các kết quả khớp nhất với đường dẫn vị trí đầy đủ của chúng. |
| `get_thing` | read | | Chúng ta biết gì về đồ vật này (theo id hoặc ID ngắn), ai có nó, và các phần của bộ. |
| `list_contents` | read | | Có gì trong vị trí hoặc chứa đựng này, sâu 1 đến 3 cấp. |
| `thing_history` | read | | Điều gì xảy ra với đồ vật này, mới nhất trước: ai làm gì và khi nào. |
| `find_documents` | read | | Hóa đơn, sổ hướng dẫn hoặc bảo hành cho thứ gì ở đâu. |
| `upcoming` | read | Nhắc nhở | Điều gì đến hạn, quá hạn hoặc sắp hết hạn: lịch trình, bảo hành, cho mượn và tồn kho thấp. |
| `add_thing` | change | | Thêm một hoặc nhiều đồ vật, với vị trí mới nếu chưa có, và mọi trường mà trang tạo của ứng dụng đặt (xem bên dưới). |
| `update_thing` | change | | Thay đổi bất kỳ trường nào của đồ vật mà biểu mẫu sửa của ứng dụng thay đổi (xem bên dưới); `null` xóa một cái. |
| `move_thing` | change | | Di chuyển đồ vật, hoặc một phần số lượng, đến vị trí hoặc chứa đựng khác. |
| `mark_seen` | change | | Tôi vừa thấy đồ vật này ở nơi Kept nói nó là. |
| `change_lifecycle` | change | | Đổi vòng đời của đồ vật, như **Đổi vòng đời** và **Lưu trữ** làm: đã bán, đã cho đi, đã mất, đã vứt bỏ, đã lưu trữ hoặc kết thúc khác, với khi nào, nó đến tay ai, bán được bao nhiêu và một ghi chú, hoặc dùng lại với `in_use`. Mỗi lần gọi gửi toàn bộ phần kết thúc, nên chi tiết nào bị bỏ sót sẽ bị xóa. Kept giữ đồ vật và lịch sử của nó, và có thể hoàn tác trong 7 ngày. |
| `create_place` | change | | Thêm vị trí dưới vị trí khác, hoặc ở đỉnh vị trí. Với `template`, thêm nội thất và một vị trí cho mỗi ngăn của nó trong một bước, như [Nội thất với ngăn](/vi/users/locations/#đồ-nội-thất-có-ngăn) làm; một Hoàn tác lấy tất cả lại. Phòng lấy kích thước thực, `width_cm` và `length_cm` (50 cm đến 100 m), và lên [bản đồ](/vi/users/location-map/) với nó. Mẫu tủ rack nhận `units` và `numbering` ([Tủ rack](/vi/users/locations/#tủ-rack)). |
| `update_place` | change | | Thay đổi vị trí như trang của nó làm: đổi tên, đổi loại, di chuyển vào vị trí khác hoặc lên đỉnh, đặt các trường, và thứ tự các vị trí trong nó (A đến Z hoặc Thứ tự tùy chỉnh, sau đó Di chuyển lên hoặc Di chuyển xuống). `turn` (`right` hoặc `left`, nơi đỉnh của nó đi) quay [nội thất với ngăn](/vi/users/locations/#xoay-đồ-nội-thất) sang bên hoặc ngửa, với `renumber` true hoặc false. Hoàn tác trong 7 ngày, trừ di chuyển lên hoặc xuống: di chuyển ngược lại hoàn tác nó. |
| `turn_into_boxes` | change | | Chuyển tối đa 50 vị trí thành hộp, như **Chuyển vị trí thành hộp** làm. Mỗi cái giữ ID, nhãn và thứ trong nó; cái có vị trí bên trong vẫn là vị trí, và cái ở đỉnh vị trí cũng vậy (chuyển cái đó trong Kept). Một Hoàn tác chuyển tất cả lại. |
| `attach_link` | change | | Một liên kết mở trang chụp của Kept để thêm ảnh, hóa đơn hoặc tài liệu. |
| `log_reading` | change | | Ghi đọc đồng hồ: đồng hồ km, giờ, điện. |
| `lend_thing` | change | Cho mượn | Cho mượn đồ vật cho ai đó, với ngày đến hạn tùy chọn. Hộp hoặc bộ đi kèm mọi thứ trong nó, mỗi món trên một dòng. |
| `return_thing` | change | Cho mượn | Đồ vật cho mượn hoặc mượn về, tất cả hoặc một số lượng. Hộp hoặc bộ mang lại những gì vẫn đang ngoài cùng nó. |
| `borrow_thing` | change | Cho mượn | Ghi nhận đồ vật mượn từ ai đó, với ngày đến hạn tùy chọn. |
| `complete_schedule` | change | Nhắc nhở | Nhiệm vụ theo lịch đã làm, vào một ngày hoặc ở giá trị đồng hồ. |
| `snooze_schedule` | change | Nhắc nhở | Hoãn nhiệm vụ theo lịch đến một ngày hoặc giá trị đồng hồ. |
| `add_warranty` | change | Hóa đơn và bảo hành | Ghi bảo hành: loại của nó, và khi nào kết thúc hoặc bao nhiêu tháng. |
| `open_claim` | change | Hóa đơn và bảo hành | Mở yêu cầu bảo hành cho đồ vật. |
| `update_claim` | change | Hóa đơn và bảo hành | Thay đổi trạng thái hoặc tham chiếu của yêu cầu. |
| `log_service` | change | | Ghi dịch vụ: ngày, ai làm, tổng cộng, các dòng (mỗi dòng có thể dùng tồn kho từ tiêu hao), các lịch trình nó hoàn thành, và ghi chú. |
| `log_fuel` | change | Nhiên liệu | Ghi lần đổ xăng: lượng, đơn vị, chi phí, có đầy không, và đồng hồ km. |
| `adjust_stock` | change | Đồ vật bạn dùng hết | Thêm vào hoặc lấy từ tồn kho của tiêu hao. |
| `list_tags` | read | | Những thẻ nào có, với bao nhiêu đồ vật có mỗi thẻ. |
| `tag_things` | change | | Thêm thẻ vào đồ vật, hoặc gỡ chúng; tên mới tạo thẻ. |
| `list_moves` | read | Chuyển nhà | Những chuyển nhà nào có, với bao nhiêu hộp đã đóng, đang vận chuyển và đã mở. |
| `get_move` | read | Chuyển nhà | Mỗi hộp của một lần chuyển ở đâu, và số nào còn thiếu. |
| `start_move` | change | Chuyển nhà | Bắt đầu một lần chuyển, đến vị trí khác hoặc giữa các phòng của cái này. |
| `add_box` | change | Chuyển nhà | Thêm hộp được đánh số tiếp theo: một cái mới, hoặc chứa đựng bạn có. |
| `pack_into_box` | change | Chuyển nhà | Đóng đồ vật vào hộp. |
| `set_box_status` | change | Chuyển nhà | Đánh dấu hộp đã đóng hoặc đang vận chuyển, hoặc chọn phòng của nó. |
| `unpack_box` | change | Chuyển nhà | Mở hộp vào phòng; mọi thứ trong nó đi theo. |

**Các trường của đồ vật.** `add_thing` và `update_thing` lấy mọi trường bạn có thể đặt trên đồ vật trong
ứng dụng, mỗi cái trong trường riêng thay vì trong ghi chú: tên, bao nhiêu, loại (theo tên, bằng tiếng Anh
hoặc tiếng Ả Rập, hoặc theo id), thương hiệu (tạo nếu mới), mẫu, số seri, mã vạch, màu, tình trạng, ghi chú,
tên khác, thẻ (tên mới tạo thẻ, cho thành viên trở lên), của ai nó là (một người, tạo nếu mới), liên kết sổ hướng dẫn,
hết hạn và bao nhiêu ngày trước để nhắc, tối thiểu của tiêu hao, và các trường riêng của loại theo khóa. `add_thing` cũng lấy nó đi đâu và mua (ngày, giá một cái với tiền tệ, và cửa hàng); `update_thing` cũng lấy nó từ đâu, và mua của nó: ngày, cửa hàng, dòng của nó trên hóa đơn, giá một cái với tiền tệ và ghi chú, thay đổi mua nó có hoặc ghi một cái, như trang đồ vật làm. Giá cần Bật tiền và vai trò thấy tiền, như trong ứng dụng; tối thiểu cần **Đồ vật bạn dùng hết**. Loại Kept không biết bị bỏ qua và `not_set` trong câu trả lời nói vậy; thẻ của trợ lý
hiện nó như "chưa đặt" với bộ chọn. Thiết bị trong tủ rack nhận `rack_units` (chiều cao, 0 là cạnh thanh ray) và `rack_at` (số đơn vị nhỏ nhất nó chiếm, theo cách đánh số của chính tủ, như `get_thing` trả về, mặt của nó và có hết chiều sâu không), bị từ chối như trong ứng dụng nếu đơn vị đã có thiết bị.

Các công cụ chuyển nhà và `change_lifecycle` chỉ dành cho ứng dụng đã kết nối; trợ lý trong Kept không dùng chúng.

Mọi công cụ lấy id cũng lấy ID ngắn 6 ký tự như `K7D2QX`. Các hợp đồng đầy đủ ở
[`packages/mcp/src/tools.ts`](https://github.com/keptinventory/kept/blob/main/packages/mcp/src/tools.ts).

## Thu hồi quyền truy cập

Trong **Cài đặt → Kết nối**, tìm token hoặc ứng dụng (lọc theo **Loại**, **Vị trí** hoặc
**Trạng thái**) và chọn **Thu hồi**.

- **Token**: ứng dụng dùng nó ngừng hoạt động ngay. Thay đổi nó làm vẫn ở lại, và vẫn có thể hoàn tác
  trong 7 ngày.
- **Ứng dụng đã kết nối**: nó ngừng truy cập Kept của bạn ngay, và Kept quên sự đồng ý của bạn, nên để
  dùng lại bạn phải kết nối lại từ ứng dụng.

Kept cũng tự kết thúc quyền truy cập, và danh sách nói tại sao: **Đã hết hạn**, **Kết thúc: bạn rời vị trí**,
**Kết thúc: vai trò bạn thay đổi**, **Đã thu hồi bởi quản trị**, hoặc **Đã ngắt kết nối bởi ứng dụng**.
