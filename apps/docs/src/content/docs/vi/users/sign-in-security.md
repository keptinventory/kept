---
title: Đăng nhập và bảo mật
description: Khóa truy cập và ứng dụng xác thực trong Cài đặt, mã dự phòng, thiết lập lại ứng dụng, tắt nó, những gì Kept từ chối và tại sao, và tại sao khóa ứng dụng không phải là khóa truy cập.
---

**Cài đặt → Đăng nhập và bảo mật** chứa các cách tài khoản của bạn đăng nhập ngoài mật khẩu:
khóa truy cập, và hai yếu tố với ứng dụng xác thực.

## Xác nhận đây là bạn

Mọi thay đổi trên trang này trước hết yêu cầu:

- một tài khoản có mật khẩu: **mật khẩu của bạn**;
- một tài khoản không có (chỉ khóa truy cập, liên kết email hoặc Google): **một lần đăng nhập trong mười phút qua**. Nếu lâu hơn vậy, hộp thoại đưa ra **Đăng nhập lại**.

Thêm khóa truy cập cũng yêu cầu mật khẩu trên tài khoản có mật khẩu, và luôn cần một lần đăng nhập trong mười phút qua, bất kể tài khoản: trình duyệt chạy hộp thoại khóa truy cập riêng của nó lúc đó.
Bật hoặc tắt hai yếu tố không tính là đăng nhập lại.

Hủy liên kết Google hoặc đăng nhập OIDC của bạn trong **Phương thức đăng nhập** yêu cầu cách tương tự.

Mỗi thay đổi đăng xuất mọi thiết bị khác, ngoại trừ việc đổi tên khóa truy cập. Kept gửi email cho bạn khi một khóa truy cập được thêm hoặc xóa, khi một đăng nhập bên ngoài bị hủy liên kết, khi hai yếu tố được bật, thiết lập lại hoặc tắt, và khi các mã dự phòng mới được tạo. Tài khoản được quản lý (một tên người dùng, không có email) không nhận email.

## Khóa truy cập

Một khóa truy cập đăng nhập bạn bằng Face ID, vân tay hoặc khóa màn hình điện thoại, không cần gõ mật khẩu. Kept không bao giờ nhìn thấy nó: nó ở trên thiết bị hoặc trong trình quản lý mật khẩu của bạn. Nó thuộc về một địa chỉ: trên một Kept có [hơn một](/vi/install/home-network/#hơn-một-địa-chỉ), hãy thêm và sử dụng nó ở địa chỉ chính.

| | |
|---|---|
| **Thêm khóa truy cập** | Đặt tên cho nó (Kept gợi ý thiết bị: "Mac", "iPhone"), rồi trả lời hộp thoại của trình duyệt. Đóng hộp thoại đó không thay đổi gì. |
| **Đã đồng bộ** | Trình quản lý mật khẩu hoặc nền tảng của bạn cũng giữ nó trên các thiết bị khác của bạn. |
| **Chỉ thiết bị này** | Nó ở trên thiết bị này hoặc khóa bảo mật. |
| **Đổi tên** | Tên là của bạn, tối đa 64 ký tự. |
| **Xóa** | Nó ngừng đăng nhập cho bạn. Xóa nó trên thiết bị đó cũng nếu bạn không còn muốn nó ở đó. |

Mọi khóa truy cập Kept thêm đều kiểm tra đây là bạn (Face ID, vân tay hoặc mã PIN), nên một lần đăng nhập bằng khóa truy cập tính là hai yếu tố một mình, bao gồm ở các địa điểm yêu cầu nó.

## Ứng dụng xác thực

Hai yếu tố với một ứng dụng như 1Password, Google Authenticator hoặc Aegis: sau mật khẩu, liên kết email hoặc Google, đăng nhập yêu cầu mã 6 chữ số của nó.

- **Bật**: xác nhận đây là bạn, quét mã QR (hoặc nhập khóa), nhập một mã, rồi lưu mười mã dự phòng. Nó chỉ bật khi mã khớp.
- **Còn 8 trong 10 mã dự phòng**: mỗi mã dự phòng đăng nhập bạn một lần, để phòng khi bạn mất điện thoại.
- **Mã dự phòng mới**: mười mã mới, hiển thị một lần. Các mã cũ ngừng hoạt động.
- **Thiết lập lại**: cho điện thoại mới hoặc ứng dụng khác. Quét mã QR mới và nhập một mã từ ứng dụng mới. Cho đến khi bạn làm vậy, ứng dụng hiện tại vẫn hoạt động; đóng hộp thoại giữa chừng và không có gì thay đổi. Khi đã xong, các mã của ứng dụng cũ và các mã dự phòng cũ ngừng hoạt động.
- **Tắt**: đăng nhập ngừng yêu cầu mã.

## Những gì Kept từ chối

Máy chủ từ chối các điều này, bất kể màn hình hiển thị gì:

- **Xóa cách vào cuối cùng của bạn.** Một khóa truy cập không thể xóa, và Google hoặc đăng nhập OIDC của bạn không thể hủy liên kết, khi không có gì khác có thể đăng nhập bạn: một mật khẩu, một khóa truy cập khác, Google hoặc đăng nhập OIDC (trong khi Kept này vẫn cung cấp), hoặc một liên kết email (khi Kept này gửi email và địa chỉ của bạn đã được xác nhận).
- **Tắt hai yếu tố ở nơi một địa điểm cần nó.** Trong khi một địa điểm bạn thuộc về yêu cầu hai yếu tố và bạn không có khóa truy cập, ứng dụng xác thực vẫn bật. Hãy thêm khóa truy cập trước. Cách tương tự, khóa truy cập cuối cùng của bạn vẫn còn khi địa điểm như vậy dựa vào nó và ứng dụng tắt.
- **Thêm khóa truy cập hoặc ứng dụng trước khi địa chỉ của bạn được xác nhận**, khi Kept này gửi email. Đăng nhập một lần với liên kết gửi đến địa chỉ, rồi thử lại.

## Khóa ứng dụng không phải là khóa truy cập

**Cài đặt → Thiết bị này → Mở khóa bằng Face ID hoặc vân tay** mở khóa Kept trên thiết bị đó, sau khi đã đăng nhập ([khóa ứng dụng](/vi/users/phone-app/#khóa-ứng-dụng)). Nó không thể đăng nhập bạn. Nếu trình duyệt đưa ra nó khi đăng nhập và Kept trả lời *Khóa truy cập đó không phải là khóa truy cập mà tài khoản này dùng để đăng nhập*, hãy đăng nhập theo cách khác, rồi thêm một khóa truy cập thực tại đây.
