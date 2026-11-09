---
title: Vấn đề thường gặp
description: "Đăng nhập, đồng bộ, máy ảnh, nhãn, AI và sử dụng ngoại tuyến: những gì bạn thấy, và phải làm gì."
---

Các vấn đề bạn có thể gặp khi sử dụng Kept. Đối với vấn đề khi chạy máy chủ, xem [Khắc phục sự cố](/vi/admin/troubleshooting/).

## Đăng nhập

### Tôi quên mật khẩu

Trang đăng nhập, nhập địa chỉ email của bạn và chọn **Quên mật khẩu của bạn?**. Kept gửi một liên kết để đặt mật khẩu mới; nó chỉ dùng được một lần, trong một giờ. Không có gì đến: kiểm tra thư rác, hoặc hỏi người quản lý Kept của bạn xem email có được cài đặt không. Nếu không có email, một quản trị viên máy chủ có thể phát một liên kết đặt lại một lần trên máy chủ với `kept admin reset-password` ([dòng lệnh](/vi/admin/cli/)).

Tài khoản được quản lý (một tên người dùng, không email) nhận một mã dùng một lần mới thay vì, từ người tạo tài khoản hoặc chủ sở hữu của vị trí ([người không có email](/vi/users/first-run/#người-không-có-email)).

### Liên kết đăng nhập không hoạt động

Một liên kết từ **Gửi cho tôi liên kết đăng nhập qua email** chỉ dùng được một lần, trong 15 phút: yêu cầu một liên kết mới. Một liên kết được gửi trước khi Kept của bạn được nâng cấp lên 1.14.0 hoàn toàn không còn hoạt động, cũng như đăng nhập Google hoặc OIDC bắt đầu trước đó ([nâng cấp](/vi/admin/upgrades/#đường-dẫn-đăng-nhập-1140)).

### Mã khóa truy cập của tôi không hoạt động

- **Các mã khóa truy cập cần HTTPS.** Trên một địa chỉ `http://` thuần khiết, trình duyệt không đề xuất gì ([Kept trên mạng gia đình](/vi/install/home-network/)).
- **Một mã khóa truy cập nằm trên thiết bị tạo ra nó**, hoặc trong trình quản lý mật khẩu của bạn khi được đồng bộ. Trên thiết bị khác, đăng nhập theo cách khác (mật khẩu của bạn hoặc **Gửi cho tôi liên kết đăng nhập qua email**), sau đó thêm một mã khóa truy cập ở đó trong **Cài đặt → Đăng nhập và bảo mật**.
- **"Mã khóa truy cập này không phải là cái mà tài khoản này dùng để đăng nhập"**: trình duyệt đề xuất thứ khác, chẳng hạn như khóa ứng dụng của thiết bị, không thể dùng để đăng nhập. Đăng nhập theo cách khác.

Xem thêm trong [Đăng nhập và bảo mật](/vi/users/sign-in-security/).

### Tôi mất điện thoại, hoặc mã dự phòng của tôi

Một mã dự phòng là bước thứ hai sau mật khẩu của bạn, thay vì mã 6 chữ số từ ứng dụng xác thực. Mỗi mã chỉ dùng được một lần.

- **Vẫn đang đăng nhập ở nơi nào đó:** **Cài đặt → Đăng nhập và bảo mật**. **Mã dự phòng mới** tạo mười mã mới (các mã cũ ngừng hoạt động); **Thiết lập lại** di chuyển xác thực hai yếu tố sang điện thoại mới.
- **Bị khóa vào tài khoản, không có mã dự phòng:** hỏi một quản trị viên máy chủ. **Đặt lại xác thực hai yếu tố** trong **Quản trị viên máy chủ → Người dùng** dừng ứng dụng xác thực và mã dự phòng của bạn, và bạn thiết lập lại xác thực hai yếu tố tại lần đăng nhập tiếp theo.

### "Tài khoản của bạn sẽ bị xóa vào …"

Bạn yêu cầu xóa tài khoản, và nó chờ 30 ngày; cho đến đó không có gì khác trong Kept được mở. **Giữ tài khoản của tôi** dừng việc xóa và đưa tài khoản về như cũ. Xem [câu hỏi thường gặp](/vi/users/faq/#tôi-xóa-tài-khoản-như-thế-nào).

## Đồng bộ

### Các ảnh chụp từ điện thoại của tôi không hiển thị

Một ảnh chụp được lưu trên điện thoại trước và được gửi khi điện thoại đồng bộ.

- **Trên iPhone, hàng đợi chỉ di chuyển khi Kept mở.** Dòng dưới tiêu đề nói **Mở để hoàn tất đồng bộ** kèm số lượng: để Kept hiển thị trên màn hình trong một lát khi đang kết nối.
- **Không có tên**, một ảnh chụp chờ trong **Hộp thư đến**. **Ảnh cần xem lại** trên Trang chủ hiển thị chúng.

### Tìm kiếm nói "Trên điện thoại này, đến lần đồng bộ cuối cùng"

Câu trả lời đến từ bản sao của chính điện thoại, vì bạn đang ngoại tuyến. Kết nối lại, sau đó kéo xuống để làm mới.

### Một thay đổi tôi làm ngoại tuyến không được áp dụng

Nếu người khác đã xóa, di chuyển hoặc xóa bỏ một đồ vật khi bạn ngoại tuyến, thay đổi của bạn đối với nó bị loại bỏ và dòng nói như vậy, với **Khôi phục** để thử lại. Các thay đổi khác cần quyết định vào **Hộp thư đến**. Xem [đồng bộ, như bạn thấy](/vi/users/phone-app/#đồng-bộ-hóa-như-bạn-thấy-nó).

### Đồng bộ dường như bị kẹt

- Kéo xuống để làm mới, hoặc đóng Kept và mở lại.
- **Cập nhật Kept để hoàn tất đồng bộ**: máy chủ mới hơn ứng dụng. Tải lại; hàng đợi được giữ lại.
- Vẫn bị kẹt: **Cài đặt → Chẩn đoán** kiểm tra hỗ trợ ngoại tuyến và bộ nhớ và sao chép một báo cáo. Gửi nó cho người quản lý Kept của bạn.

## Máy ảnh và chụp

### Máy ảnh không mở

Điện thoại chỉ cho phép máy ảnh trên địa chỉ HTTPS. Trên `http://` thuần khiết, Chụp quay lại chọn tệp. Cài đặt Kept, làm việc ngoại tuyến và thông báo đẩy cũng cần HTTPS. Những gì hoạt động qua HTTP thuần khiết, và hai cách thêm HTTPS tại nhà: [Kept trên mạng gia đình](/vi/install/home-network/).

Trên HTTPS và vẫn bị chặn, Kept nói cách cho phép máy ảnh trong trình duyệt.

### AI không đặt tên cho đồ vật của tôi

Không có AI, các ảnh chụp chờ trong Hộp thư đến để có tên: đặt tên cho chúng ở đó, hoặc xem [AI](#ai) bên dưới.

### AI đặt tên sai

Những gì AI điền là một gợi ý. Mở đồ vật và sửa tên, thương hiệu, mẫu hoặc loại.

## Nhãn

### Một nhãn không quét được

Đảm bảo nhãn được đặt phẳng và ánh sáng đủ, và làm sạch kính máy ảnh. **Nhập mã** lấy sáu ký tự in dưới mã QR, có hoặc không có dấu gạch ngang. Một nhãn bị mòn được in lại với cùng một mã ([Mã ngắn và nhãn](/vi/users/short-ids/)). Một nhãn trên te dãn in nhãn hẹp không có mã QR: giữ nút **Quét** trên mã ngắn được in, hoặc nhập mã đó ([quét một mã không có mã QR](/vi/users/short-ids/#quét-mã-không-có-mã-qr)).

Nếu **Quét** báo **Kept không thể quét tại đây** vì máy quét không khởi động được, hãy chạm **Thử lại**: camera và máy quét khởi động lại từ đầu, không cần đóng ứng dụng.

## AI

### "Đang chờ một nhà cung cấp AI"

Không có nhà cung cấp nào được kết nối cho vị trí này. Công việc trong một vị trí được trả bằng khóa của chủ sở hữu, nên chủ sở hữu kết nối một nhà cung cấp trong **Cài đặt → AI**, hoặc một quản trị viên máy chủ thiết lập một nhà cung cấp cho máy chủ trong **Quản trị → AI**. Thành viên và người xem không thể kết nối một nhà cung cấp cho vị trí của người khác: dòng nói để hỏi một quản trị viên. Xem [Nhà cung cấp AI](/vi/users/ai-providers/#khóa-đặt-ở-đâu).

### AI bị tắt trong một vị trí

Một chủ sở hữu hoặc quản trị viên đã tắt nó: **Cài đặt địa điểm → Theo dõi gì**, trong **AI trong vị trí này**, công tắc **AI chụp và trợ lý**. Bật lại nó sẽ đưa AI trở lại ở đó.

### "AI đã tạm dừng"

Một hạn mức hàng tháng đã đạt, hoặc ai đó đã chọn **Tạm dừng AI**. Các ảnh chụp vẫn được lưu; việc đặt tên chờ và tiếp tục với AI. Ai đã đặt hạn mức sẽ nhận **Tiếp tục ngay**. Hạn mức nằm trong **Cài đặt → AI → Nâng cao → Giới hạn** ([hạn mức và tạm dừng](/vi/users/ai-providers/#giới-hạn-và-tạm-dừng)).

### AI tốn quá nhiều

Đặt một hạn mức hàng tháng trong **Cài đặt → AI → Nâng cao → Giới hạn**, chọn một mô hình rẻ hơn trong **Nâng cao → Mô hình**, hoặc chạy một mô hình cục bộ với [Ollama](/vi/admin/ollama/).

## Ngoại tuyến

### Một điều gì đó không hoạt động ngoại tuyến

Làm việc ngoại tuyến cần Kept được cài đặt từ địa chỉ HTTPS. Duyệt web, tìm kiếm và chụp ảnh hoạt động mà không cần kết nối; chỉnh sửa chi tiết, trợ lý, báo cáo, bản đồ, biểu đồ và bất cứ gì liên quan đến tiền cần một kết nối. Danh sách đầy đủ: [những thứ hoạt động ngoại tuyến](/vi/users/phone-app/#những-gì-hoạt-động-ngoại-tuyến).

## Nhận trợ giúp

- **Câu hỏi và ý tưởng:** [Thảo luận](https://github.com/keptinventory/kept/discussions)
- **Lỗi:** [một vấn đề](https://github.com/keptinventory/kept/issues/new/choose), với những gì bạn làm và những gì bạn thấy
- **Trợ giúp trên Discord:** [máy chủ Kept](https://discord.gg/g4WCXPfuNv), trong #help: một vấn đề mỗi bài đăng, phiên bản Kept của bạn và cách bạn chạy nó (Docker Compose, Kubernetes), những gì đã xảy ra, và nhật ký với các bí mật và chi tiết cá nhân đã làm mờ
- **Vấn đề bảo mật:** riêng tư, không bao giờ trong một vấn đề công khai ([SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md))
