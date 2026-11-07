---
title: Mô hình bảo mật
description: Những điều một người vận hành cần biết về cách Kept giữ các hộ gia đình cách biệt, bảo vệ bí mật, đăng nhập mọi người, và những gì rời khỏi máy chủ.
---

Trang này là bản tóm tắt dành cho người vận hành về mô hình đe dọa của Kept và các cơ chế đằng sau nó. Các trang dành cho nhà phát triển đi sâu hơn: [bảo mật cấp dòng](/vi/developers/rls/), [đăng nhập](/vi/developers/auth/) và [kiến trúc](/vi/developers/architecture/).

## Các hộ gia đình được giữ cách biệt bởi cơ sở dữ liệu

Kept kết nối với Postgres bằng bốn tài khoản đăng nhập, mỗi tài khoản chỉ được phép làm những việc cần thiết cho công việc của nó:

| Đăng nhập | Được dùng bởi | Nó được phép làm gì |
|---|---|---|
| `kept_owner` | `kept migrate`, `kept admin`, bản sao lưu hàng đêm | sở hữu schema; không bao giờ được dùng để phục vụ một yêu cầu |
| `kept_app` | mọi yêu cầu web, bao gồm các tuyến của quản trị viên máy chủ | đọc và ghi bảng ứng dụng, luôn dưới bảo mật cấp dòng (`NOBYPASSRLS`, `FORCE` RLS trên mọi bảng) |
| `kept_auth` | đăng nhập (Better Auth) | chỉ schema `auth` của riêng nó |
| `kept_system` | công việc nền xuyên qua các hộ gia đình (quét nhắc nhở, lưu giữ), mã thiết lập | chỉ các chính sách hệ thống rõ ràng |

Mọi yêu cầu chạy trong một giao dịch ghi tên người đã đăng nhập, và mọi chính sách hỏi một hàm về các địa điểm người đó thuộc. Khi không ai được thiết lập, các chính sách không trả về gì, nên một đường dẫn mã quên phạm vi bị chặn lại. Một kiểm tra rò rỉ toàn schema kiểm tra các đường dẫn yêu cầu, xác thực và công việc nền. Chi tiết nằm ở [bảo mật cấp dòng](/vi/developers/rls/).

Điều này có nghĩa gì với bạn: vùng chứa phục vụ không bao giờ giữ tài khoản đăng nhập của chủ sở hữu trừ khi bạn cho nó một tài khoản cho sao lưu ([sao lưu](/vi/admin/backups/#bật-lên)). Một quản trị viên máy chủ **không có quyền truy cập trong ứng dụng** đến các địa điểm của người khác; một người vận hành có quyền truy cập cơ sở dữ liệu có thể bỏ qua điều đó, nên chính cơ sở dữ liệu phải được giữ riêng cho máy chủ.

## Khóa và mã hóa

- **`KEPT_SECRET_KEY`** đóng kín mọi giá trị bí mật: trường bí mật trên đồ vật, khóa AI, cài đặt kênh thông báo, bí mật webhook, mật khẩu hộp thư đến, mã thông báo API Paperless-ngx, khóa riêng đẩy web, mật khẩu sao lưu. AES-256-GCM với một khóa dữ liệu cho mỗi dòng, mỗi bản mã được ràng buộc với bảng, dòng và trường của nó, nên không thể hoán đổi lẫn nhau.
- **`KEPT_AUTH_SECRET`** ký các phiên và mã thông báo. Nó được tách riêng để mỗi cái có thể được xoay vòng một mình.
- **Tự tạo khi khởi động đầu tiên** khi cả hai đều chưa được thiết lập, vào volume cấu hình (chứ không phải volume dữ liệu), với một dòng nhật ký cho biết nơi lưu. Thiết lập chúng bằng tay với `kept admin gen-key`; khởi động từ chối khóa ngắn hơn 32 byte, và từ chối một cái được thiết lập mà không có cái kia.
- **Không cái nào ở trong cơ sở dữ liệu hoặc bản sao lưu.** Giữ [bộ khôi phục](/vi/admin/recovery-kit/). Không có khóa bí mật, việc khôi phục mang lại tất cả trừ các giá trị bí mật và khóa AI.
- **Xoay vòng:** `kept admin rotate-key` tạo một khóa mới thành hiện tại và đóng gói lại mọi giá trị đã đóng kín; khóa cũ được giữ như một phiên bản đã nghỉ nên các bản sao lưu cũ vẫn mở được. `--resume` hoàn thành một lần chạy bị gián đoạn, `--drop <version>` loại bỏ một khóa đã nghỉ mà không ai dùng ([dòng lệnh](/vi/admin/cli/#lệnh)).
- **Mật khẩu hộp thư chỉ được ghi:** máy chủ, tên người dùng và mật khẩu của một hộp thư đến được đóng kín cùng nhau; trang chỉ hiển thị máy chủ và tên người dùng, không bao giờ hiển thị mật khẩu.
- **Khóa AI chỉ được ghi:** sau khi lưu, Kept chỉ hiển thị bốn ký tự cuối của chúng.
- **Mã thông báo Paperless-ngx chỉ được ghi:** địa chỉ và mã thông báo Paperless của một địa điểm được đóng kín cùng nhau; trang hiển thị địa chỉ, không bao giờ hiển thị mã thông báo, và trình duyệt không bao giờ nói chuyện với Paperless bằng nó. Hình thu nhỏ và các bản tải xuống đi qua Kept, sau khi Kept tự kiểm tra quyền truy cập của mình.

## Đăng nhập

Kept dùng Better Auth trên đăng nhập và schema của riêng nó. Một tài khoản có thể đăng nhập bằng:

- **Email và mật khẩu.** Việc đặt lại mật khẩu đăng xuất tài khoản ở mọi nơi, và chủ sở hữu được báo qua email khi một thông tin xác thực thay đổi.
- **Khóa truy cập**, đã đăng ký cho tên máy chủ của `KEPT_PUBLIC_URL`. Mỗi khóa phải xác thực người dùng của nó (Face ID, vân tay, mã PIN) và có thể được khám phá.
- **Xác thực hai lớp** với ứng dụng xác thực (TOTP) hoặc một khóa truy cập đã xác thực người dùng. Một mã một lần qua email không bao giờ là yếu tố thứ hai. Chủ sở hữu của một địa điểm có thể yêu cầu xác thực hai lớp cho mọi người trong nó. Các tài khoản không có mật khẩu cũng có thể dùng ứng dụng xác thực.
- **Cài đặt → Đăng nhập và bảo mật** thêm, đổi tên và xóa khóa truy cập, và bật ứng dụng xác thực, tạo mã dự phòng mới, thiết lập lại và tắt nó ([Đăng nhập và bảo mật](/vi/users/sign-in-security/)). Mọi thay đổi yêu cầu mật khẩu, hoặc một lần đăng nhập trong mười phút qua trên tài khoản không có mật khẩu, và đăng xuất mọi thiết bị khác (trừ việc đổi tên). Máy chủ từ chối xóa cách vào cuối cùng, và tắt xác thực hai lớp trong khi một địa điểm yêu cầu nó và tài khoản không có khóa truy cập. Thiết lập lại ứng dụng giữ khóa bí mật cũ hoạt động cho đến khi một mã từ cái mới được chứng thực.
- **Liên kết ma thuật** chỉ cho các tài khoản hiện có (không đăng ký mở), có hiệu lực 15 phút. Các mã thông báo gửi qua thư nằm trong phần `#fragment` của liên kết và được dùng hết bằng một POST từ trang, nên một trình quét thư mở liên kết không thể dùng hết chúng; chỉ một băm được lưu trữ.
- **Tên người dùng** cho các tài khoản được quản lý (người không có địa chỉ email).
- **OIDC**, khi `KEPT_OIDC_ISSUER` và `KEPT_OIDC_CLIENT_ID` được thiết lập ([cấu hình](/vi/reference/configuration/)). Một danh tính bên ngoài không bao giờ được liên kết với một tài khoản vì email trùng khớp; một người mới vào bằng lời mời, hoặc qua một miền hoặc nhóm được cho phép. Mã thông báo của nhà cung cấp danh tính không bao giờ được lưu trữ.
- **Google**, khi `KEPT_GOOGLE_CLIENT_ID` và `KEPT_GOOGLE_CLIENT_SECRET` được thiết lập, với URI chuyển hướng mà Quản trị → Trạng thái hiển thị. Các quy tắc giống OIDC, trừ không ai vào qua miền: chỉ một tài khoản hiện có đã liên kết Google, hoặc một người được mời.
- **Liên kết và hủy liên kết** một lần đăng nhập bên ngoài xảy ra trong Cài đặt → Tôi → Phương thức đăng nhập. Việc liên kết cần một lần đăng nhập trong mười phút qua; việc hủy liên kết yêu cầu mật khẩu (hoặc lần đăng nhập gần đây trên tài khoản không có mật khẩu). Một tài khoản giữ ít nhất một cách vào.

**Các phiên** kéo dài 30 ngày qua HTTPS, được gia hạn một lần mỗi ngày dùng, với cookie có tiền tố `Secure`, `__Secure-`. Qua HTTP thuần chúng kéo dài 12 giờ và không bao giờ được gia hạn, và Kept từ chối các hành động tiết lộ hoặc thay đổi một bí mật ([HTTPS](/vi/install/https/)). Các hành động nhạy cảm hỏi lại mật khẩu, hoặc một lần đăng nhập trong mười phút qua; gia hạn đăng nhập không đặt lại mười phút đó.

`KEPT_HTTP_SIGN_IN_DAYS` (1 đến 30, chưa thiết lập theo mặc định) cho phép người điều hành máy chủ làm cho một lần đăng nhập qua HTTP thuần kéo dài số ngày đó, được gia hạn khi được dùng. Đây là thiết lập duy nhất nới lỏng điều này, nó không thể được thay đổi từ ứng dụng, và nó không làm gì qua HTTPS. Các bí mật vẫn bị từ chối qua HTTP, mười phút vẫn giữ, và đăng xuất ở mọi nơi vẫn kết thúc mọi lần đăng nhập. Giá phải trả: qua HTTP thuần một cookie đăng nhập có thể được sao chép bởi bất kỳ ai có thể thấy lưu lượng, và khi thiết lập bật, một bản sao chép vẫn hoạt động trong suốt thời gian được dùng, cho đến khi thiết bị đó đăng xuất hoặc các thiết bị khác của bạn được đăng xuất ([Giữ ở trong mạng của bạn](/vi/install/home-network/#giữ-trong-mạng-của-bạn)).

**Yêu cầu từ các trang khác** bị từ chối: một lần ghi mang cookie của Kept phải đến từ nguồn của `KEPT_PUBLIC_URL`, nếu không nó nhận 403 trước khi phiên được đọc. Điều này cũng bắt buộc cho thiết lập lần đầu, chưa có cookie nào, trước khi mã thiết lập được thử.

`KEPT_EXTRA_ADDRESSES` (chưa thiết lập theo mặc định) cho phép người điều hành máy chủ liệt kê các nguồn chính xác khác được coi là Kept. Chúng được đọc một lần khi khởi động và so sánh toàn bộ với `Origin` của trình duyệt; `Host` và `X-Forwarded-*` không có vai trò. Một ký tự đại diện, hoặc sự kết hợp `http` và `https`, dừng khởi động. Thông báo từ chối nêu tên `KEPT_PUBLIC_URL` và không bao giờ nêu danh sách. Khóa truy cập, lần đăng nhập bên ngoài, OAuth và mọi liên kết vẫn ở trên `KEPT_PUBLIC_URL`: một khóa truy cập được kiểm tra đối với địa chỉ đó bất kể yêu cầu nói gì. Giá phải trả: một trang được phục vụ tại một địa chỉ được liệt kê có thể hành động thay cho ai đã đăng nhập ở đó ([Hơn một địa chỉ](/vi/install/home-network/#hơn-một-địa-chỉ)).

Các trang được phục vụ với chính sách bảo mật nội dung `default-src 'self'`, không được nhúng vào khung, và nhận HSTS khi URL công khai là HTTPS, trừ khi `KEPT_HSTS=off` ([HSTS](/vi/install/reverse-proxy/#hsts)).

## Giới hạn tốc độ

Như đã xây dựng:

| Điều gì | Giới hạn |
|---|---|
| Thử đăng nhập | 5 lần mỗi phút trên mỗi địa chỉ; trên mỗi tài khoản và địa chỉ, 20 lần mỗi giờ, với thời gian trễ tăng sau lần thất bại thứ tư (tối đa 5 phút) thay vì bị khóa |
| Các tuyến xác thực khác | 100 lần mỗi phút trên mỗi địa chỉ và tuyến |
| API và MCP, trên mỗi mã thông báo | 120 lần đọc và 30 lần ghi mỗi phút |
| Đặt lại mật khẩu và liên kết ma thuật | 3 lần mỗi giờ trên mỗi tài khoản |
| Trang của liên kết chia sẻ | 60 lượt xem mỗi phút trên mỗi liên kết |

Giới hạn được giữ trong cơ sở dữ liệu, nên các bản sao chép chia sẻ chúng. Địa chỉ của máy khách đến từ socket, hoặc từ `X-Forwarded-For` chỉ khi kết nối từ một địa chỉ trong `KEPT_TRUSTED_PROXIES` ([proxy ngược](/vi/install/reverse-proxy/#tin-tưởng-proxy-và-chỉ-proxy)).

## Yêu cầu đi ra (SSRF)

Kept chỉ tải các địa chỉ ai đó đã cấu hình: URL cơ sở của nhà cung cấp AI, webhooks, đẩy, một nhà cấp OIDC, siêu dữ liệu của máy khách OAuth, một máy chủ Homebox để nhập từ, tra cứu mã vạch, kiểm tra cập nhật, hộp thư đến qua email của một địa điểm (IMAP) và Paperless-ngx của một địa điểm. Mỗi cái đều đi qua cùng một cổng kiểm duyệt ([`apps/server/src/net/ssrf.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/net/ssrf.ts)):

- địa chỉ được kiểm tra **khi kết nối được thiết lập**, sau khi tên được phân giải, nên một tên thay đổi giữa lần kiểm tra và yêu cầu không thể lách qua;
- các dải riêng, vòng lặp, cục bộ liên kết (bao gồm địa chỉ siêu dữ liệu đám mây), NAT cấp nhà cung cấp, đa phát và dành riêng đều bị từ chối, IPv4 và IPv6;
- chuyển hướng bị từ chối, nên một máy chủ công khai không thể chuyển hướng ngược yêu cầu vào trong.

Một địa chỉ bị từ chối là `400 private_address`. Trên một máy chủ tự lưu trữ, một quản trị viên máy chủ có thể cho phép các địa chỉ riêng (**Quản trị → Cài đặt → Cho phép địa chỉ riêng tư**), điều mà một nhà cung cấp trên mạng của bạn, chẳng hạn như [Ollama](/vi/admin/ollama/), cần. Nó bị tắt theo mặc định.

## Đầu vào thù địch

Nhập và tải lên được coi là thù địch. Các giá trị mặc định:

| Giới hạn | Mặc định |
|---|---|
| Nhập ZIP | 5 GB chưa nén, nén 100:1 cho mỗi mục, 200.000 mục, không có liên kết tượng trưng |
| Hình ảnh | giải mã tối đa 100 megapixel, từng ảnh một khi dưới 3 GB RAM hoặc giới hạn vùng chứa dưới 3 GB |
| PDF | phân tích cú pháp trong tiến trình con, 20 giây và 256 MB |
| Tải lên | `KEPT_MAX_FILE_MB` (25 MB theo mặc định), bị từ chối trước khi nội dung được đọc |

Các tệp đã lưu được tải thông qua một liên kết đã ký có hiệu lực năm phút trên một đường dẫn không đọc phiên, với `nosniff` và chính sách `default-src 'none'; sandbox`, và dưới dạng một bản tải xuống trừ khi tệp là một trong các JPEG đã mã hóa lại của chính Kept. Các ô CSV đã xuất bắt đầu giống như công thức bị làm vô hại.

## Những gì rời khỏi máy chủ

- **Không có gì về chính Kept.** Không có telemetry nào cả; telemetry riêng của thư viện đăng nhập đã bị tắt. Việc theo dõi và báo cáo lỗi chỉ đi đến một trình thu thập bạn thiết lập ([giám sát](/vi/admin/observability/#theo-dõi-và-báo-cáo-lỗi)).
- **Việc kiểm tra cập nhật bị tắt theo mặc định.** Khi bật, nó hỏi GitHub về bản phát hành mới nhất một lần mỗi ngày, không gửi gì ngoài yêu cầu ([nâng cấp](/vi/admin/upgrades/#biết-có-phiên-bản-mới)).
- **Nhà cung cấp AI thấy gì**, khi một địa điểm dùng một cái: ảnh dưới dạng bản sao đã mã hóa lại với EXIF và XMP bị loại bỏ (Kept từ chối gửi một ảnh vẫn chứa chúng), lời nhắc cố định và các ngôn ngữ của địa điểm cho trích xuất, câu hỏi và kết quả công cụ mà vai trò của người hỏi cho phép đối với trợ lý, và trường mô tả cho tìm kiếm ngữ nghĩa. **Không bao giờ có giá trị bí mật**, và không bao giờ có dữ liệu tiền bạc cho tìm kiếm. Bản ghi riêng của Kept về mỗi cuộc gọi lưu số token và chi phí, không bao giờ lưu lời nhắc, ảnh, phản hồi hoặc khóa. Xem [nhà cung cấp AI](/vi/users/ai-providers/).
- **Liên kết chia sẻ** (`/s/<token>`) là trang duy nhất bất kỳ ai cũng có thể mở mà không cần đăng nhập. Mã thông báo là 32 byte ngẫu nhiên, hiển thị một lần và lưu dưới dạng băm SHA-256 của nó; nó không bao giờ xuất hiện trong một dòng nhật ký. Trang được đọc thông qua một hàm cơ sở dữ liệu lấy băm của mã thông báo và chỉ trả về tên, loại, nơi các đồ vật nằm, số lượng, tình trạng, ghi chú và ảnh, cho hộp, vị trí hoặc tìm kiếm được chia sẻ trong địa điểm đó. Ảnh là bản xem trước đã loại bỏ GPS, dưới dạng URL đã ký có hiệu lực năm phút, và chỉ cho những đồ vật đó. Một liên kết dừng khi bị thu hồi hoặc hết hạn, hoặc khi người tạo không còn quản trị địa điểm; nó được kiểm tra trên mọi lượt xem.
- **Sao lưu** là các ảnh chụp nhanh restic được mã hóa bằng một mật khẩu ít nhất 12 ký tự trước khi chúng rời đi; không có mật khẩu thì không có sao lưu ([sao lưu](/vi/admin/backups/)).

## Báo cáo một lỗ hổng bảo mật

Hãy dùng **báo cáo lỗ hổng bảo mật riêng** của GitHub trên kho lưu trữ (tab **Security** → **Report a vulnerability**); đây là kênh duy nhất, và không có địa chỉ email bảo mật. Đừng mở một vấn đề công khai. [SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md) có chi tiết và các phiên bản được hỗ trợ, có hiệu lực từ 1.0. Để kiểm tra một image có đúng là image mà người duy trì đã build không, hãy xem [xác thực một bản phát hành](/vi/admin/verify-release/).
