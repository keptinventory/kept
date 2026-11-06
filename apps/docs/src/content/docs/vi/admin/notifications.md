---
title: Thư, đẩy và feeds lịch
description: Cài đặt thư đi và đẩy web cho một máy chủ Kept, và những điều người điều hành cần biết về các liên kết lịch riêng tư mọi người tạo.
---

Kept liên lạc với người ngoài ứng dụng qua **email**, **thông báo đẩy** đến trình duyệt hoặc ứng dụng đã cài đặt, **ntfy**, **Telegram** và **Apprise**, và một **feeds lịch** ứng dụng lịch của người đó đăng ký. Tất cả cũng đến trung tâm thông báo trong ứng dụng, không cần thiết lập. Người chọn những gì đến với họ trong **Cài đặt → Thông báo** (Lời nhắc và cảnh báo → **Mở**). Trang này là phía người điều hành. Mọi biến được liệt kê trong [tài liệu tham khảo về cấu hình](/vi/reference/configuration/).

## Thư

| Biến | Nó làm gì |
|---|---|
| `KEPT_SMTP_URL` | Máy chủ SMTP, dưới dạng `smtp://` hoặc `smtps://`, với thông tin đăng nhập nếu nó cần: `smtps://user:password@mail.example.org:465`. |
| `KEPT_SMTP_FROM` | From của mọi thư. Mặc định: `Kept <no-reply@<your KEPT_PUBLIC_URL host>>`. Hầu hết nhà cung cấp chỉ gửi dưới dạng địa chỉ họ đã xác minh, nên hãy thiết lập nó. |

Với Compose, hãy đặt cả hai trong `.env`; `compose.yaml` chuyển chúng đến `kept` và `migrate`. Với biểu đồ Helm, `smtp.existingSecret` chỉ định một Secret chứa `KEPT_SMTP_URL`, và `smtp.from` đặt người gửi. Kept mở một kết nối cho mỗi thư; các tuỳ chọn URL riêng của nodemailer (ví dụ `?pool=true`) được chuyển qua URL.

### Khi `KEPT_SMTP_URL` không được đặt

Thư chỉ được ghi nhận là đến hạn: một cảnh báo cho mỗi thư, `mail not sent: no mail transport is configured`, ghi rõ loại thư và không bao giờ địa chỉ, liên kết hoặc mã thông báo. **Quản trị → Trạng thái** hiển thị **Thư: Chưa được cấu hình** và thông báo **Thư chưa được cấu hình**. Không có thư thì không có liên kết đăng nhập, đặt lại mật khẩu, lời mời email, cảnh báo qua email hoặc báo cáo qua email. Lời mời liên kết và mật khẩu vẫn hoạt động không cần nó, và lời nhắc vẫn đến với người bằng thông báo đẩy và trong ứng dụng. **Gửi email cho tôi** và **Gửi lại** trong In kho hàng bị khóa, và chủ sở hữu và quản trị viên nhận một liên kết **Thiết lập email** đến trang này; API từ chối `email: true` và lịch trình báo cáo với 409 `mail_not_configured`.

Khi thư đã được cấu hình, một tài khoản có địa chỉ chưa được xác minh không thể thêm khóa truy cập hoặc ứng dụng xác thực cho đến khi địa chỉ được xác minh.

### Những gì Kept gửi

Mỗi thư được gửi dưới dạng văn bản và HTML bằng ngôn ngữ của người nhận (Tiếng Anh khi Kept không biết nó). Các liên kết mang mã thông báo của chúng sau `#`, nên một bộ quét thư hoặc nhật ký máy chủ không bao giờ giữ một cái có thể dùng được.

- **Đăng nhập và tài khoản**: liên kết đăng nhập, đặt lại mật khẩu, xác nhận và xác minh địa chỉ email mới và một ghi chú đến địa chỉ cũ, một ghi chú khi người nào đó cố đăng ký bằng địa chỉ đã có tài khoản, và một thông báo khi thông tin xác thực thay đổi: mật khẩu, khóa truy cập được thêm hoặc xoá, đăng nhập bên ngoài bị hủy liên kết, hai yếu tố được bật, thiết lập lại hoặc tắt, và mã sao lưu mới.
- **Con người và địa điểm**: lời mời email; đến chủ sở hữu của một địa điểm, mỗi thành viên mới hoặc tài khoản được quản lý và mỗi đăng ký thành viên đến ngày kết thúc.
- **Trong sáng**: khi quản trị viên phiên (hoặc `kept admin`) tác động vào tài khoản của ai đó; và đến mọi người dùng hoạt động khi đăng nhập OIDC của phiên, thư đi của nó hoặc nhà cung cấp AI mặc định thay đổi.
- **Lời nhắc**: một đồ vật quá hạn ngay lập tức, bản tóm tắt hàng ngày, một kiểm tra kênh, và một ghi chú khi webhook của chính người đó vẫn thất bại.
- **AI**: giới hạn hàng tháng đạt 80% hoặc 100%, và bản tóm tắt AI hàng tháng tùy chọn.
- **Đến quản trị viên phiên**: cảnh báo quản trị, tối đa một lần mỗi ngày cho mỗi cảnh báo ([trang trạng thái và cảnh báo](/vi/admin/observability/#trang-trạng-thái-và-cảnh-báo)).

### Thay đổi máy chủ thư

Kept so sánh máy chủ SMTP và người gửi với những gì nó lần cuối thấy mỗi khi khởi động, không bao giờ là mật khẩu. Nếu bất kỳ cái nào thay đổi, thay đổi được kiểm toán và mọi người dùng hoạt động được thông báo qua đường dẫn mới. Lần đầu khởi động khi thư đã được cấu hình chỉ ghi lại nó.

## Thông báo đẩy

Đẩy không cần **khóa nào từ bạn**. Lần đầu khởi động Kept sinh một cặp khóa VAPID và giữ trong cơ sở dữ liệu, khóa riêng được đóng kín với `KEPT_SECRET_KEY`. Để dùng cặp khóa của riêng bạn, hãy thiết lập cả hai:

| Biến | Nó làm gì |
|---|---|
| `KEPT_VAPID_PUBLIC_KEY` | Khóa công khai: base64url không padding của 65 byte, như `generateVAPIDKeys()` của web-push ghi nó. |
| `KEPT_VAPID_PRIVATE_KEY` | Nửa riêng của nó (32 byte, mã hóa giống nhau). Không bao giờ được ghi nhật ký. Thiết lập một cái không có cái khác khiến Kept dừng khi khởi động. |
| `KEPT_VAPID_SUBJECT` | Ai dịch vụ đẩy có thể liên hệ: một URL `https:` hoặc địa chỉ `mailto:`. Mặc định: `KEPT_PUBLIC_URL` khi nó là `https`, nếu không `mailto:` địa chỉ `KEPT_SMTP_FROM`. |

Đẩy **không khả dụng** khi:

- `KEPT_PUBLIC_URL` là `http` thuần trên bất cứ cái nào ngoài localhost: trình duyệt chỉ đăng ký trên một trang bảo mật. Người thấy "Đẩy cần HTTPS." ([HTTPS](/vi/install/https/))
- không có chủ đề: không có `KEPT_VAPID_SUBJECT`, không có URL công khai `https` và không có `KEPT_SMTP_FROM`. Người thấy "Đẩy chưa được thiết lập trên máy chủ này."

Thư và trung tâm thông báo vẫn hoạt động cả hai cách.

Người bật đẩy trên mỗi thiết bị với **Bật** trong **Cách Kept liên hệ với bạn**, sau khi trình duyệt hỏi. **Trên iPhone và iPad, thông báo chỉ hoạt động từ ứng dụng đã cài đặt**: Kept nói vậy và cung cấp **Cách cài đặt** ([ứng dụng điện thoại](/vi/users/phone-app/)).

Những gì rời khỏi máy chủ: Kept gửi mỗi đẩy qua HTTPS đến dịch vụ đẩy trình duyệt đã đăng ký, nên nó cần kết nối internet ra ngoài; địa chỉ riêng tư và cục bộ bị từ chối. Một đẩy mang một tiêu đề, một dòng văn bản và một liên kết, dưới 3 KB, không bao giờ chứa tiền hoặc chi tiết liên hệ. Dịch vụ đẩy giữ nó trong tối đa một ngày khi thiết bị ngoại tuyến. Một đăng ký mà dịch vụ báo cáo là đã mất bị xóa.

:::caution[Khi mất khóa]
Nếu khóa riêng được lưu không thể mở, vì khóa bí mật dùng để đóng kín nó đã mất, Kept tạo một cặp mới và xoá mọi đăng ký đẩy. Không gì khác bị mất: người bật đẩy lại trên mỗi thiết bị. Giữ [bộ khôi phục](/vi/admin/recovery-kit/) và điều này không bao giờ xảy ra khi khôi phục hoặc một [di chuyển](/vi/admin/move-server/).
:::

## ntfy và Telegram

Người tự thêm các dịch vụ này trong **Cài đặt → Tôi → Thông báo**; không có gì cần thiết lập trên máy chủ. Kept đăng đến điểm cuối JSON của máy chủ ntfy và đến Bot API của Telegram (`api.telegram.org`), cùng lúc và thông qua cùng bảo vệ như webhook: một máy chủ ntfy trên địa chỉ riêng tư chỉ hoạt động khi **Cho phép địa chỉ riêng tư** được bật (**Quản trị → Cài đặt**), và chuyển hướng bị từ chối. Cài đặt của chúng (một chủ đề và mã thông báo ntfy, một mã thông báo bot Telegram) được mã hóa như bí mật của webhook và được bao phủ bởi [xoay khóa](/vi/admin/recovery-kit/). Một lần gửi thất bại được thử lại với lời nhắc và đánh dấu kênh "Thất bại kể từ"; lần gửi sau nào thành công sẽ xóa dấu đó. Cảnh báo quản trị không được gửi đến chúng.

## Apprise

[Apprise](https://github.com/caronc/apprise) đến Discord, Slack, Matrix, Signal, Pushover và hơn 100 dịch vụ khác. Kept nói chuyện với một máy chủ **Apprise API** bạn chạy bên cạnh nó, và cung cấp **Thêm Apprise** cho người chỉ khi `KEPT_APPRISE_URL` trỏ đến một máy chủ như vậy:

```yaml
# compose.yaml, beside the kept service
  apprise:
    image: caronc/apprise:2.0.0
    restart: unless-stopped

# and in the kept service's environment
KEPT_APPRISE_URL: http://apprise:8000
```

- Mỗi người thêm các **URL Apprise** của riêng mình (một hoặc nhiều, như `discord://…` hoặc `mailto://…`). Chúng được mã hóa như bí mật của webhook, không bao giờ hiển thị lại, và được bao phủ bởi [xoay khóa](/vi/admin/recovery-kit/).
- Kept sử dụng `POST /notify/` không trạng thái của Apprise API và gửi các URL với mỗi thông điệp, nên máy chủ Apprise không giữ gì. Nó được truy cập trên mạng riêng của bạn theo ý định, với chuyển hướng bị từ chối.
- Các URL chung của Apprise như `json://`, `xml://` và `form://` (và các dạng `s` của chúng) có thể trỏ đến bất kỳ máy chủ nào, bao gồm máy trong mạng của bạn, nên Kept từ chối chúng trừ khi **Cho phép địa chỉ riêng tư** được bật (**Quản trị → Cài đặt**).
- Một lần gửi thất bại (Apprise trả lời 424 khi một dịch vụ từ chối) được thử lại với lời nhắc và đánh dấu kênh "Thất bại kể từ". Cảnh báo quản trị không được gửi đến Apprise.

## feeds lịch

Mỗi người có thể tạo một liên kết iCal riêng của những gì đến hạn và những gì hết hạn trong **Cài đặt → Thông báo → feeds lịch → Tạo một liên kết**. Không có gì cần thiết lập trên máy chủ.

- **Nó chứa**: sự kiện cả ngày từ một tháng trước đến 13 tháng tới, xuyên các địa điểm của người đó: tiêu đề, đường dẫn vị trí, tên địa điểm và một liên kết vào Kept. Không bao giờ tiền, bí mật, ghi chú hoặc chi tiết liên hệ của bất kỳ ai. Chỉ những loại người đó nhận trên một số kênh, và không gì từ một phần của Kept mà một địa điểm đã tắt. Các địa điểm yêu cầu hai yếu tố bị loại ra.
- **Liên kết**: `https://kept.example.org/cal/<token>.ics`, được hiển thị một lần. Kept chỉ lưu SHA-256 của mã thông báo và xóa nó khỏi nhật ký yêu cầu. Nó được xây dựng từ `KEPT_PUBLIC_URL` khi được tạo, nên một liên kết được tạo trước khi thay đổi địa chỉ vẫn trỏ đến địa chỉ cũ.
- **Ai có thể đọc**: bất kỳ ai có liên kết, không cần đăng nhập. Một liên kết không xác định hoặc đã bị thu hồi, hoặc một liên kết thuộc tài khoản bị vô hiệu hóa, trả lời 404 mà không nói là cái nào. Mỗi liên kết có thể được lấy 60 lần mỗi phút.
- **Thu hồi**: **Thu hồi** trên liên kết kết thúc nó vĩnh viễn; các lịch đăng ký nó ngừng cập nhật. Danh sách giữ hàng đã thu hồi và hiển thị khi mỗi liên kết trực tiếp lần cuối được lấy. Một người có thể giữ tối đa 3 liên kết trực tiếp.

Lịch Google lấy liên kết từ máy chủ của Google, nên ở đó nó chỉ hoạt động khi Kept có thể được truy cập từ internet.
