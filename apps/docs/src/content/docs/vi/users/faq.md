---
title: Câu hỏi và câu trả lời
description: "Câu trả lời ngắn cho những câu hỏi mọi người thường hỏi trước và sau khi cài đặt Kept, mỗi câu đều có đường dẫn đến trang chi tiết."
---

## Kept có gửi thông tin gì về tôi hay máy chủ của tôi đi đâu không?

Không. Không có télémesic (telemetry) bất kỳ loại nào, thậm chí không có tính năng chọn tham gia đếm lượt cài đặt. Kiểm tra cập nhật tắt cho đến khi admin bật, và khi đó chỉ gửi yêu cầu bản phát hành mới nhất. Tra cứu mã vạch và AI cũng tắt cho đến khi ai đó kết nối chúng. Xem [khả năng quan sát](/vi/admin/observability/) và [nâng cấp](/vi/admin/upgrades/).

## Dữ liệu của tôi được lưu ở đâu?

Trên máy chủ của bạn: cơ sở dữ liệu trong Postgres, và các tệp (ảnh, hóa đơn, tài liệu) trên ổ dữ liệu của Kept hoặc trong vùng chứa S3 bạn chọn. Điện thoại giữ một bản sao để dùng ngoại tuyến, không có giá trị bí mật. Xem [lưu trữ tệp](/vi/admin/storage/) và [ứng dụng điện thoại](/vi/users/phone-app/).

## Tôi xóa tài khoản như thế nào?

Cài đặt → Tôi → Xóa tài khoản của tôi, với mật khẩu. Trước hãy chuyển mỗi địa điểm bạn sở hữu (trừ Cá nhân) cho người khác, hoặc xóa nó; admin duy nhất của thể hiện phải tạo admin khác trước. Tài khoản sau đó chờ 30 ngày: đăng nhập sẽ hiển thị ngày và cách giữ lại, và không gì khác mở được. Sau đó tài khoản bị xóa cùng với địa điểm Cá nhân. Những gì bạn thêm vào địa điểm của người khác vẫn ở đó. [Xuất dữ liệu](/vi/users/import-export/#xuất) trước nếu muốn bản sao.

## Tôi có thể dùng không cần AI không?

Được. Mọi thứ hoạt động ngoại trừ đặt tên đồ vật từ ảnh, đọc hóa đơn, trợ lý và tìm kiếm theo ngữ nghĩa. Không có nhà cung cấp, đồ vật chụp chờ trong Hộp thư đến để đặt tên, và tìm kiếm dùng từ khóa. Xem [nhà cung cấp AI](/vi/users/ai-providers/).

## Nhà cung cấp AI nào hoạt động, và ai trả tiền?

Groq (khuyên dùng), OpenAI, Anthropic, Google, OpenRouter, hoặc bất kỳ máy chủ tương thích OpenAI nào như Ollama. Bạn dùng khóa của mình; công việc trong một địa điểm do khóa của chủ địa điểm đó trả, và bạn có thể giới hạn chi tiêu. Xem [nhà cung cấp AI](/vi/users/ai-providers/).

## Có hoạt động ngoại tuyến không?

Trên điện thoại đã cài Kept, có cho tìm và chụp: duyệt, tìm kiếm, chụp, di chuyển đồ vật, đọc số, kiểm tra hộp và quét nhãn. Sửa chi tiết, báo cáo, nhập và xuất cần kết nối. Những gì bạn làm ngoại tuyến đồng bộ khi kết nối lại. Xem [Kept trên điện thoại](/vi/users/phone-app/#những-gì-hoạt-động-ngoại-tuyến).

## Có ứng dụng trên App Store hay Google Play không?

Không. Kept là ứng dụng web bạn thêm vào màn hình chính từ trình duyệt. Nó cần Kept chạy trên HTTPS. Xem [Kept trên điện thoại](/vi/users/phone-app/#cài-đặt-nó) và [HTTPS](/vi/install/https/).

## Có chạy trên arm64 hay Raspberry Pi không?

Ảnh được xây dựng cho amd64 và arm64, nên máy chủ ARM và Docker trên Apple Silicon chạy được. Raspberry Pi từ 1 GB trở lên có thể chạy, chậm hơn; không bản phát hành nào được test trên đó. Kept được test trên 1 GB RAM và một hai nhân CPU (arm64). Xem [đã test gì](/vi/install/hardware/).

## Một Kept có thể dùng cho bao nhiêu người?

Kept quy mô theo đồ vật chứ không phải người: mục tiêu 10.000 đồ vật trong một địa điểm và 50.000 trong một thể hiện; test 1 GB dùng 3.000 trong một địa điểm. Người tham gia địa điểm bằng lời mời, và mỗi địa điểm cũng chứa tới 20 tài khoản được quản lý cho người không có email. Xem [cần gì](/vi/install/hardware/) và [mời người](/vi/users/first-run/#5-mời-mọi-người).

## Tôi có thể giữ nhiều hơn một hộ gia đình, hoặc chỉ chia sẻ một phần đồ vật không?

Được. Mỗi địa điểm (một nhà, một gara, một kho, một nhà bố mẹ) được chia sẻ riêng, với thành viên và vai trò riêng; chia sẻ gara không chia sẻ cái khác. Một người có thể thuộc nhiều địa điểm, và mỗi người có địa điểm Cá nhân riêng. Xem [phút đầu tiên](/vi/users/first-run/#5-mời-mọi-người).

## Kept khác Homebox như thế nào?

Cả hai theo dõi bạn sở hữu gì và ở đâu. Kept còn có:

- **Bản đồ 3D** các tầng, phòng, kệ và hộp.
- **Phương tiện**: đọc số, dịch vụ, nhiên liệu và chi phí của chúng.
- **Lời nhắc** cho bảo hành, dịch vụ, cho vay và tồn kho thấp.
- **Dùng ngoại tuyến** trên điện thoại, với nhãn in và quét.
- **AI, nếu muốn**: chụp từ ảnh, và máy chủ MCP cho trợ lý.

Nó nhập bản sao Homebox, nên bạn có thể thử với đồ vật của mình.

## Tôi có thể chuyển từ Homebox không?

Được. Từ Homebox v0.26.1 trở lên (khuyên dùng v0.27.0), tạo bản sao trong Homebox (**Bộ sưu tập → Công cụ → Sao lưu & Khôi phục → Tạo bản sao**, sau đó **Tải xuống**), nhập ZIP đó vào Kept, xem trước gì sẽ xảy ra, rồi nhập. Ảnh, hóa đơn, bảo hành, bảo trì và thẻ đến, và nhãn Homebox cũ vẫn quét được. Đồ vật vào trạng thái đã bán chỉ khi Homebox có người mua hoặc giá (ngày bán riêng vẫn ở ghi chú), và đồ vật đã lưu trữ vào **Đã lưu trữ** trừ khi chọn **Đang dùng** hoặc **Bỏ ra**. Kết nối [Paperless-ngx](/vi/users/paperless/) trước và liên kết tài liệu của Homebox đến Paperless đến như liên kết Paperless. Xem [nhập và xuất](/vi/users/import-export/#một-bản-xuất-homebox); nhập trước 1.14.1 có thể [sửa](/vi/users/import-export/#sửa-một-lần-nhập-trước). Homebox cũ không có bản sao Kept đọc được: cập nhật bản sao trước, hoặc nhập bảng tính. Xem [từ Homebox cũ](/vi/users/import-export/#đến-từ-homebox-cũ-hơn).

## Tôi sao lưu như thế nào?

Máy chủ nightly lấy ảnh chụp restic mã hóa của cơ sở dữ liệu, tệp và bản sao đọc được của mọi địa điểm, sang ổ khác, vùng chứa S3 hoặc máy SFTP. Giữ bộ khôi phục ở chỗ khác. Để lấy một địa điểm ra, xuất nó. Xem [sao lưu](/vi/admin/backups/), [bộ khôi phục](/vi/admin/recovery-kit/) và [nhập và xuất](/vi/users/import-export/#xuất).

## Nếu máy chủ mất cùng ngôi nhà thì sao?

Bản sao đọc được của bản sao mở trong bất kỳ trình duyệt nào có restic, mật khẩu bản sao và một laptop, không cần Kept. Để đưa Kept lên máy mới bạn cũng cần bộ khôi phục. Xem [đọc hàng hóa chỉ với restic](/vi/admin/read-with-restic/) và [khôi phục](/vi/admin/restore/).

## Nó nói được những ngôn ngữ nào?

Tiếng Anh, Ả Rập (bố cục phải sang trái), Pháp, Đức, Ý, Việt, Ukraina và Tây Ban Nha, chọn theo thiết bị. Xem [ngôn ngữ và giao diện](/vi/users/first-run/#6-ngôn-ngữ-và-chủ-đề).

## Phép phép nào?

GNU Affero General Public License, phiên bản 3 (AGPL-3.0). Bạn có thể chạy, sửa và chia sẻ; nếu chạy phiên bản sửa cho người khác qua mạng, phải cung cấp mã nguồn cho họ. Văn bản trong [LICENSE](https://github.com/keptinventory/kept/blob/main/LICENSE) của kho.

## Kept miễn phí? Sẽ có phí không?

Kept tự lưu trữ miễn phí và mã nguồn mở. Ứng dụng di động, máy tính và phiên bản đám mây đang phát triển.

## Có bản phát hành không?

Có: `1.0.0` là bản phát hành ký đầu tiên, trên GHCR là `ghcr.io/keptinventory/kept`, và mọi bản phát hành sau đều liệt kê trên [trang phát hành](https://github.com/keptinventory/kept/releases). Nâng cấp chạy migration một lần, chụp ảnh cơ sở dữ liệu trước, và có thể quay lại một phiên bản. Xem [cài bằng Docker Compose](/vi/install/compose/) và [nâng cấp](/vi/admin/upgrades/).
