---
title: Paperless-ngx
description: "Liên kết một đồ vật hoặc vị trí với các hóa đơn, hướng dẫn sử dụng và thẻ bảo hành của nó trong Paperless-ngx. Kept lưu liên kết và tiêu đề, không lưu tệp, trừ khi bạn sao chép nó vào."
---

Nếu bạn lưu trữ giấy tờ trong [Paperless-ngx](https://docs.paperless-ngx.com/), Kept có thể liên kết một đồ vật với các tài liệu của nó ở đó thay vì bạn tải lên hai lần. Cần khoan hiển thị hóa đơn và hướng dẫn của nó; nhà bếp hiển thị hóa đơn của tủ lạnh.

Tùy chọn: chỉ khi bạn đã chạy Paperless-ngx. Kept hoạt động như nhau khi không có nó.

## Trước khi bắt đầu

| Bạn cần | Tại sao |
|---|---|
| **Paperless-ngx 2.16 trở lên** | Kept yêu cầu phiên bản API 9 của Paperless, mà 2.16 thêm vào và 3.x vẫn cung cấp |
| **Một token API** | Trong Paperless: **Hồ sơ của tôi**, sau đó mũi tên tròn bên cạnh token API. Kept thấy những gì người dùng Paperless đó thấy, nên một người dùng chỉ có thể xem tài liệu của bạn là đủ |
| **Kept có thể truy cập Paperless** | Từ máy Kept chạy trên đó, không phải từ điện thoại của bạn |
| **`https`**, hoặc mạng riêng của bạn | Qua `http` thuần túy, token đi không mã hóa, nên Kept chỉ chấp nhận `http` cho địa chỉ trên mạng riêng của bạn. Địa chỉ như vậy cần **Quản trị → Cài đặt → Cho phép địa chỉ riêng tư** ([yêu cầu ra ngoài](/vi/admin/security-model/#yêu-cầu-đi-ra-ssrf)) |

## Kết nối

Một chủ sở hữu hoặc quản trị viên của địa điểm:

1. **Cài đặt địa điểm → Paperless**.
2. **Địa chỉ Paperless**: địa chỉ bạn mở Paperless, ví dụ `https://paperless.example.com` (một đường dẫn như `/paperless` cũng được).
3. **Token API**, sau đó **Kết nối**. Kept đăng nhập trước và nói lý do nếu không được: token bị từ chối, địa chỉ không phản hồi như Paperless, phiên bản quá cũ.

Khi đã kết nối, trang hiển thị phiên bản của Paperless và số tài liệu đã liên kết. **Kiểm tra kết nối** hỏi Paperless lại. Để thay đổi token, nhập token mới và **Lưu**; để trống để giữ token đã lưu.

## Liên kết tài liệu

Trên trang của một đồ vật, dưới **Giấy tờ**, **Liên kết từ Paperless** nằm bên cạnh **Thêm một tệp** (trên trang của một vị trí, bên cạnh **Thêm tài liệu**). Nó mở một tìm kiếm Paperless của bạn: từ trong tiêu đề hoặc văn bản, một người liên lạc, một loại hoặc một thẻ. Đầu của một từ là đủ: `Camel` tìm "Camelot". Cú pháp tìm kiếm riêng của Paperless được truyền qua khi bạn nhập, như `title:manual` hoặc `*amel*` cho giữa từ. Chọn một hoặc nhiều và **Liên kết**.

Các tài liệu đã liên kết nằm trong cùng danh sách Giấy tờ với các tệp. Mỗi tài liệu hiển thị hình thu nhỏ, tiêu đề, loại và người liên lạc của Paperless, và ngày của nó, cùng với:

- **Loại**: *Hướng dẫn*, *Bảo hành*, *Hóa đơn*, *Hóa đơn bán hàng* hoặc *Tài liệu*. Thay đổi khi loại của Paperless không nói tài liệu là gì.
- **Mở trong Paperless**: trang của tài liệu trong Paperless, trong thẻ mới.
- **Tải xuống**: tài liệu, qua Kept. Thành viên và cao hơn.
- **Sao chép vào Kept**: xem dưới.
- **Hủy liên kết**: nó rời khỏi đồ vật. Paperless giữ nó.

Loại đến từ loại của tài liệu trong Paperless, sau đó các thẻ: *Receipt*, *Invoice*, *Manual* và *Warranty* (cùng các từ này bằng các ngôn ngữ khác của Kept) được nhận diện, bất cứ thứ gì khác là tài liệu. Sau đó loại do bạn quyết định, và **Sao chép vào Kept** sao chép tài liệu với loại đó. Bộ lọc **Loại** trong Giấy tờ thu hẹp cả tệp và tài liệu đã liên kết cùng nhau.

**Từ [nhập Homebox](/vi/users/import-export/#một-bản-xuất-homebox):** một liên kết Homebox đến một trong các tài liệu Paperless của bạn (`…/documents/123`, hoặc `…/api/documents/123/download/` của API) tại địa chỉ địa điểm này đang kết nối sẽ nhập như một tài liệu đã liên kết trên đồ vật hoặc vị trí. Tiêu đề đến từ Paperless, loại từ loại đính kèm Homebox của nó. Kết nối Paperless trước khi nhập; bất kỳ liên kết nào khác vẫn là liên kết thuần túy.

Kept yêu cầu Paperless cung cấp tiêu đề khi nhập chạy, không phải khi kiểm tra bản xuất. Nếu Paperless không thể truy cập, hoặc không có tài liệu hoặc không cho người dùng xem, nhập vẫn hoàn thành và liên kết đó giữ tiêu đề của Homebox, hoặc địa chỉ của nó nếu Homebox không có. Báo cáo nhập nói bao nhiêu. Để lấy tiêu đề Paperless sau, **Hủy liên kết** tài liệu và dùng **Liên kết từ Paperless**, hoặc **Sao chép vào Kept**.

## Đã liên kết hay đã sao chép

| | Đã liên kết | Đã sao chép vào Kept |
|---|---|---|
| Kept lưu gì | Số tài liệu trong Paperless, tiêu đề, loại, loại Paperless, người liên lạc và ngày | Tệp chính nó, như một đính kèm trên đồ vật |
| Nếu Paperless sập | Tiêu đề vẫn hiển thị, có ghi chú Paperless không thể truy cập | Không thay đổi gì |
| Trong sao lưu và xuất Kept | Không: liên kết cần Paperless của máy này | Có, như bất kỳ tệp nào khác |
| Nếu tài liệu thay đổi trong Paperless | Tiêu đề cập nhật khi bạn sao chép nó | Bản sao giữ nguyên như cũ |

**Sao chép vào Kept** là trên mỗi tài liệu và rõ ràng: dùng cho những gì phải tồn tại khi không có Paperless, như hóa đơn bạn sẽ cần cho yêu cầu bảo hành. Bản sao là tệp Paperless phục vụ để tải xuống (PDF đã lưu trữ khi nó tạo), được kiểm tra và định cỡ như một lần tải lên.

## Ai có thể làm gì

| | Người xem | Thành viên | Quản trị, chủ sở hữu |
|---|---|---|---|
| Xem tài liệu đã liên kết và hình thu nhỏ | ✓ | ✓ | ✓ |
| Tìm kiếm Paperless, liên kết, sao chép, tải xuống | | ✓ | ✓ |
| Thay đổi loại, hủy liên kết | | Của họ | Bất kỳ |
| Kết nối, thay đổi, ngắt kết nối | | | ✓ |

Hóa đơn và hóa đơn bán hàng là tiền: nơi tiền bị ẩn cho bạn ở một địa điểm, hóa đơn và hóa đơn bán hàng đã liên kết cũng bị ẩn, và bạn không thể làm một tài liệu đã liên kết thành một.

Một [token cá nhân](/vi/users/mcp-clients/#tạo-token-cá-nhân) đọc các liên kết của một đồ vật hoặc vị trí (`GET /api/v1/paperless-links?thingId=…`), không bao giờ kết nối, tìm kiếm, hình thu nhỏ hoặc tài liệu. Công cụ MCP `get_thing` liệt kê các tài liệu đã liên kết của một đồ vật theo tiêu đề.

## Riêng tư

- Token được niêm phong bằng khóa bí mật của Kept, như mật khẩu hộp thư. Kept không bao giờ hiển thị, ghi nhật ký, hoặc đặt nó vào mục kiểm toán hoặc xuất.
- Trình duyệt của bạn không bao giờ nói chuyện với Paperless bằng token. Tìm kiếm, hình thu nhỏ và tải xuống đi qua Kept, trước tiên kiểm tra bạn có thể thấy đồ vật. Hình thu nhỏ được mã hóa lại bởi Kept và giữ trong năm phút.
- **Mở trong Paperless** là một liên kết bình thường: bạn đăng nhập Paperless như chính bạn.
- Di chuyển đồ vật đến địa điểm khác xóa các liên kết của nó: chúng tên tài liệu trong Paperless của địa điểm cũ, mà thành viên của địa điểm mới có thể không thấy.

## Ngắt kết nối

**Cài đặt địa điểm → Paperless → Ngắt kết nối** xóa kết nối và mọi liên kết đến tài liệu của nó. Tài liệu đã sao chép vào Kept vẫn ở đó.

## Chưa xong

- Đồng bộ hai chiều: Kept không thay đổi gì trong Paperless.
- Khớp hóa đơn với đồ vật tự động.
- Gửi tệp của Kept đến Paperless.
