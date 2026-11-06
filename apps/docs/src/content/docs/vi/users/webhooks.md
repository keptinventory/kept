---
title: Webhook
description: "POST có chữ ký đến máy chủ của bạn khi có thay đổi: các sự kiện, nội dung tải, kiểm tra chữ ký, các lần gửi và thử lại, và mã bí mật."
---

Một **webhook** là Kept gửi POST đến một địa chỉ bạn chọn khi có chuyện gì xảy ra tại một địa điểm: một đồ vật được thêm, di chuyển hoặc xóa, một đọc ghi được ghi lại, một nhắc nhở đến hạn. Mỗi POST đều được ký, để máy chủ của bạn biết rằng nó đến từ Kept. Nó mang theo các id và tên của các trường đã thay đổi, không bao giờ mang giá trị của chúng: để xem chính đồ vật đó, máy chủ của bạn lấy nó từ [API](/api/) bằng mã thông báo của riêng nó.

Chủ sở hữu và quản trị viên quản lý webhook của một địa điểm tại **Cài đặt địa điểm → Webhook**: **Thêm webhook**, địa chỉ, và các sự kiện nó nhận. **Cài đặt → Kết nối** liệt kê các webhook bạn quản lý trên các địa điểm của bạn.

## Các sự kiện

| Sự kiện | Gửi khi |
|---|---|
| `thing.created` | Một đồ vật được thêm |
| `thing.updated` | Một đồ vật bị thay đổi |
| `thing.moved` | Một đồ vật bị di chuyển |
| `thing.trashed` | Một đồ vật vào Thùng rác |
| `thing.restored` | Một đồ vật khôi phục từ Thùng rác |
| `thing.lifecycle_changed` | Trạng thái của một đồ vật thay đổi, như mất hoặc đã bán |
| `reading.logged` | Một đọc ghi đồng hồ được ghi lại |
| `reminder.due` | Một nhắc nhở đến hạn |

Mọi nội dung tải đều có cùng các trường:

```json
{
  "id": "evt_…",
  "event": "thing.updated",
  "occurred_at": "2026-10-03T09:12:44.000Z",
  "location_id": "…",
  "entity": { "type": "thing", "id": "…" },
  "changed_fields": ["…"],
  "actor": { "type": "user", "id": "…" }
}
```

`entity.type` là `thing`, `reading` hoặc `reminder` (`webhook` cho bản thử); `changed_fields` đặt tên các trường mà một lần ghi đã thay đổi, và rỗng cho nhắc nhở; `actor.type` là `user`, `token` hoặc `system`.

**Gửi bản thử** gửi một sự kiện `ping`, gửi một lần và không thử lại, và hiển thị trạng thái mà máy chủ của bạn trả lời: cách nhanh nhất để kiểm tra một địa chỉ mới.

## Kiểm tra chữ ký

Mọi lần gửi đều mang một tiêu đề `Kept-Signature`:

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`t` là lúc nó được ký (giây Unix). `v1` là một HMAC-SHA256, với mã bí mật của webhook, của `<t>.<body>`: dấu thời gian, một chấm, sau đó là chính thân yêu cầu. Máy chủ của bạn tính cùng HMAC, so sánh với `v1` trong thời gian không đổi, và từ chối một `t` cũ (hơn năm phút, ví dụ). Hộp thoại mã bí mật có một đoạn **Kiểm tra một lần gửi (Node.js)** có sẵn.

## Mã bí mật

Mã bí mật ký chỉ hiện một lần, khi webhook được tạo: hãy sao chép nó lúc đó. Kept giữ nó kín để ký, và không bao giờ hiện lại. Mất rồi? **Mã bí mật mới** tạo một cái khác; cái hiện tại ngừng hoạt động ngay, vì vậy các lần gửi không thể xác minh cho đến khi máy chủ của bạn có cái mới.

## Các lần gửi

**Các lần gửi** của mỗi webhook liệt kê 30 ngày gần nhất, mới nhất trước: một hàng cho mỗi lần gửi, với trạng thái của nó, trạng thái máy chủ của bạn trả lời (hoặc không có) và số lần thử.

- **Đang chờ gửi**: đã xếp hàng.
- **Đã gửi**: máy chủ của bạn trả lời với trạng thái 2xx.
- **Thất bại, đang thử lại**: bất kỳ câu trả lời nào khác, không có câu trả lời trong 10 giây, hoặc một chuyển hướng (Kept không theo chuyển hướng). Kept thử lại.
- **Đã ngừng thử lại**: 10 lần thử trong khoảng 24 giờ đều thất bại.

Tối đa 10 lần gửi một giây đi ra cho mỗi địa điểm, nên một đợt thay đổi không làm ngập máy chủ của bạn.

Khi một lần gửi ngừng thử lại, webhook được đánh dấu **Đang thất bại từ** ngày đó và quản trị viên thể hiện nhận được cảnh báo. Nó tiếp tục gửi; lần gửi tiếp theo thành công sẽ xóa dấu hiệu đó.

Một webhook được chuyển **Tắt** khi một chủ sở hữu hoặc quản trị viên tắt nó, hoặc khi người tạo nó không còn là quản trị viên của địa điểm. Xóa một cái là cuối cùng: Kept ngừng gửi đến nó và các lần gửi của nó bị quên.

## Webhook của bạn, cho nhắc nhở

Riêng biệt với webhook của địa điểm, **Cài đặt → Tôi → Thông báo** có thể thêm một webhook làm một trong các kênh của bạn, bên cạnh email, push, ntfy, Telegram và Apprise ([nhắc nhở](/vi/users/reminders/)). Nó nhận một POST cho mỗi nhắc nhở (`reminder.due`) với các id, loại nhắc nhở, loại nguồn và ngày đến hạn, đồ vật, vị trí hoặc địa điểm nó liên quan, và một liên kết quay lại Kept: không có tên hay giá trị. Nó được ký theo cùng cách, với một mã bí mật chỉ hiện một lần.

Một lần gửi thất bại được thử lại tối đa 10 lần trong khoảng 24 giờ; nếu không cái nào thành công, kênh được đánh dấu **Đang thất bại từ** và Kept gửi email cho bạn một lần. **Kiểm tra** gửi một cái ngay. Bạn có thể có tối đa năm cái.

## Địa chỉ trên mạng của riêng bạn

Kept từ chối gửi POST đến các địa chỉ riêng tư (như `192.168.x.x`), nên một webhook không thể nhắm vào một bộ định tuyến hoặc dịch vụ khác trên mạng của máy chủ. Quản trị viên thể hiện có thể cho phép chúng trong **Quản trị → Đăng ký** (**Cho phép địa chỉ riêng tư**), cho một bộ nhận bạn tự lưu trữ, như Home Assistant. Cùng công tắc đó cho phép một nhà cung cấp AI, một nhập Homebox và một đăng nhập OIDC tiếp cận mạng đó, vì vậy hãy bật nó biết ai có thể thêm những thứ đó. Xem [mô hình bảo mật](/vi/admin/security-model/#yêu-cầu-đi-ra-ssrf).
