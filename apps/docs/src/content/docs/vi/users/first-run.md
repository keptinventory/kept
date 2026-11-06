---
title: "Phút đầu tiên của bạn"
description: "Xác nhận một Kept mới bằng mã thiết lập, tạo ngôi nhà đầu tiên, thêm đồ vật, mời mọi người và chọn ngôn ngữ cùng chủ đề."
---

Trang này bắt đầu khi Kept đã chạy và bạn có thể mở địa chỉ của nó. Việc cài đặt được đề cập ở
[Cài đặt bằng Docker Compose](/vi/install/compose/).

## 1. Xác nhận máy chủ bằng mã thiết lập

Lần đầu tiên Kept khởi động mà không có quản trị viên, nó in một mã thiết lập dùng một lần trong nhật ký, dạng
`KEPT SETUP CODE: K7Q-2M9`. Mở địa chỉ Kept đưa bạn đến **Thiết lập Kept này**, ba bước:

1. **Mã thiết lập.** Nhập sáu ký tự. Dấu gạch ngang là tùy chọn và không phân biệt chữ hoa thường. Mã
   ngừng hoạt động sau khi đã dùng. Mất nhật ký? `kept admin setup-code` cấp mã mới
   ([cách làm, dưới Compose](/vi/install/compose/#3-hoàn-tất-thiết-lập)).
2. **Tài khoản đầu tiên.** Tên, email và mật khẩu ít nhất 8 ký tự. Tài khoản này là
   **quản trị máy chủ**: nó điều hành máy chủ (người dùng, đăng ký, sao lưu). Nó không thể xem bên trong ngôi nhà của ai trừ khi được mời.
3. **Tùy chọn máy chủ.** Một công tắc: **Cho phép bất kỳ ai có địa chỉ tạo tài khoản**. Để tắt cho một hộ gia đình: mọi người tham gia qua lời mời, hoặc bạn thêm họ. Bạn có thể thay đổi sau trong
   Cài đặt → Quản trị.

**Hoàn tất thiết lập** đưa bạn đến Trang chủ.

:::caution[Hoàn tất ngay lập tức]
Cho đến khi thiết lập xong, bất kỳ ai có thể mở địa chỉ đều có thể thử chiếm máy chủ.
:::

AI và tra cứu mã vạch không thuộc phần thiết lập. Kept hoạt động mà không cần chúng, và bạn có thể kết nối AI sau
([Nhà cung cấp AI](/vi/users/ai-providers/)).

## 2. Đọc Danh sách kiểm tra bắt đầu của Trang chủ

Trang chủ mở ra **Bắt đầu**, một dòng hiển thị tiến độ và bước tiếp theo, được tính từ những gì bạn đã thực sự làm, nên các bước tự tích. Mũi tên mở ra các bước:

| Bước | Nội dung yêu cầu |
|---|---|
| **Đưa Kept lên HTTPS** | Hiện cho quản trị máy chủ khi Kept phục vụ qua HTTP thuần túy. Điện thoại chặn camera, cài đặt Kept, thông báo đẩy và vị trí qua HTTP. Xem [HTTPS](/vi/install/https/). |
| **Tạo ngôi nhà đầu tiên của bạn** | Một địa điểm, xem bên dưới. |
| **Thêm 3 đồ vật** | Một vài thứ bạn sợ mất theo dõi. |
| **In nhãn đầu tiên của bạn** | Khi Nhãn được bật ở một địa điểm. |
| **Mời ai đó** | Một liên kết hoặc mã QR; không ai cần email. |
| **Kết nối một nhà cung cấp AI** | Không hiện cho thành viên được mời, hoặc ở một địa điểm dùng bản thiết lập Thiết yếu. |
| **Cài đặt trên điện thoại của bạn** | Tự tích khi bạn mở Kept từ biểu tượng màn hình chính lần đầu. |

**×** ẩn nó vĩnh viễn; **Trợ giúp → Danh sách kiểm tra bắt đầu → Hiện lại** hiển thị lại. Nó tự biến mất khi mọi bước xong. Xem thêm về Trang chủ ở [sử dụng hàng ngày](/vi/users/everyday-use/#trang-chủ).

## 3. Tạo ngôi nhà đầu tiên của bạn

Mọi người có một địa điểm **Cá nhân** ngay từ đầu: nó chỉ của bạn (không có thành viên, lời mời hay liên kết chia sẻ) và là nơi đồ vật chụp không có địa điểm sẽ rơi vào. Đổi tên trong **Cài đặt địa điểm →
Chung**, và Kept hiển thị tên mới khắp nơi. Khi đã có địa điểm khác, bạn có thể [ẩn
nó](/vi/users/locations/#ẩn-cá-nhân) trong **Cài đặt → Tôi → Các địa điểm của bạn**. Đồ vật chia sẻ thuộc về
một địa điểm riêng. Chọn **Tạo ngôi nhà đầu tiên của bạn** (hoặc **Địa điểm mới** trên Trang chủ):

1. **Vị trí này tên là gì?** Một tên, như Nhà hoặc Nhà xe, và loại: Nhà, Căn hộ, Nhà xe, Kho chứa, Văn phòng, Nhà nghỉ hoặc Khác.
2. **Các phòng.** Mẫu của loại điền sẵn phòng và vị trí; đổi tên, xóa hoặc **Thêm phòng hoặc vị trí**.
   Mọi địa điểm cũng có **Chưa có vị trí**, cho đồ vật chưa có chỗ. **Bỏ qua** chỉ giữ Chưa có vị trí.
3. **Theo dõi gì.** Ba bản thiết lập:
   - **Thiết yếu**: tìm đồ vật: phòng, hộp, nhãn và tìm kiếm.
   - **Hộ gia đình**: thêm hóa đơn và bảo hành, nhắc nhở, cho mượn, giấy tờ và xe cộ.
   - **Hoàn chỉnh**: thêm nhiên liệu, đồ vật sắp hết, mật mã, chuyển nhà, và
     "Kết nối ChatGPT hoặc Claude".

Múi giờ và tiền tệ lấy từ trình duyệt. Thay đổi chúng, và bật tắt từng mô-đun riêng lẻ,
ở **Cài đặt địa điểm** của địa điểm (**Chung** và **Theo dõi gì**). Tắt một mô-đun ẩn nó đi; không có gì bị xóa.

## 4. Thêm đồ vật đầu tiên của bạn

Cách nhanh nhất là **Chụp**, thẻ giữa trên điện thoại: hướng camera, nhấn chụp, và đồ vật được lưu ở nơi mà chip vị trí trên cùng nói. Tên là tùy chọn khi chụp:
với nhà cung cấp AI đã kết nối, Kept đặt tên từ ảnh; không có AI, đồ vật không tên đợi trong
**Hộp thư đến** để đặt tên. Trên máy tính, **Thêm tại đây** trên một phòng hoặc hộp thêm đồ vật bằng biểu mẫu.
[Sử dụng hàng ngày](/vi/users/everyday-use/) bao gồm chụp, nhãn và phần còn lại.

## 5. Mời mọi người

Chia sẻ diễn ra theo từng địa điểm: người bạn mời đến Nhà thấy Nhà, và không thấy thứ khác của bạn.
Sau khi tạo địa điểm, Trang chủ hiển thị thẻ **Mời mọi người đến …**; trang đó cũng ở
**Cài đặt địa điểm → Thành viên → Mời**.

1. Chọn **Vai trò** và, dưới **Quyền truy cập**, **Không có ngày kết thúc** hoặc **Đến một ngày**. Quyền truy cập của họ,
   và mọi mã thông báo họ tạo, dừng vào ngày đó.
2. **Tạo liên kết mời.** Bạn nhận liên kết với **Sao chép liên kết** và mã QR để **Quét bằng điện thoại
   của họ**. Liên kết dùng một lần, trong 7 ngày, và hiện dưới Thành viên như lời mời chờ cho đến khi được dùng, nơi bạn có thể thu hồi.
3. **Gửi qua email** chỉ hoạt động khi máy chủ đã cấu hình email (`KEPT_SMTP_URL`).

Người đó mở liên kết, sau đó tham gia bằng tài khoản của họ hoặc tạo tài khoản mới; trong khi đăng ký bị đóng, lời mời là cách duy nhất để tạo tài khoản.

### Các vai trò

| Vai trò | Những gì họ làm được ở địa điểm đó |
|---|---|
| **Chủ sở hữu** | Mọi thứ, bao gồm quy tắc hai yếu tố, chuyển nhượng và xóa. Chỉ có một chủ sở hữu. |
| **Quản trị** | Mời và xóa thành viên cùng người xem, cài đặt và mô-đun, nhập và xuất, liên kết chia sẻ và gói claim, xóa vĩnh viễn. Chỉ chủ sở hữu mới cấp hoặc gỡ quản trị. |
| **Thành viên** | Thêm, sửa, di chuyển, cho mượn và đưa vào rác đồ vật; ghi đọc số và dịch vụ; in nhãn; dùng chụp AI. Tiền bạc hiển thị. |
| **Người xem** | Xem và tìm kiếm thôi. Tiền bạc ẩn trừ phi địa điểm cho người xem thấy nó; trợ lý trả lời nhưng không thay đổi được gì. |

Ma trận đầy đủ là `MATRIX` trong
[`packages/shared/src/roles.ts`](https://github.com/keptinventory/kept/blob/main/packages/shared/src/roles.ts).

### Người không có email

Cho trẻ em hoặc người lớn không email, chủ sở hữu hoặc quản trị dùng **Thêm người không cần email** trên trang Thành viên. Kept tạo **tài khoản được quản lý** với tên người dùng và hiển thị mã dùng một lần (hoạt động một lần, 30 phút). Người đó đăng nhập bằng **Tôi có mã dùng một lần**, tên người dùng và mã, và chọn mật khẩu của mình; bạn không bao giờ thấy nó. Người tạo tài khoản (trong khi vẫn là chủ sở hữu hoặc quản trị ở đó), hoặc chủ sở hữu của địa điểm đó, có thể cấp mã mới sau, điều này đăng xuất tài khoản ở khắp nơi. Người đó có thể thêm email để tiếp quản tài khoản. Tài khoản được quản lý không thể sở hữu địa điểm, và một địa điểm
chứa tối đa 20 tài khoản như vậy.

## 6. Ngôn ngữ và chủ đề

**Cài đặt → Tôi → Hiển thị** chứa các lựa chọn hiển thị của thiết bị, được áp dụng trước khi trang vẽ:

- **Ngôn ngữ**: English, العربية, Français, Deutsch, Italiano, Tiếng Việt, Українська hoặc Español.
  Mở danh sách, hoặc gõ để tìm: tên của chính nó, tên tiếng Anh hoặc tên trong ngôn ngữ bạn đang dùng, và lỗi đánh máy nhỏ không sao (`german`, `deutsch` và `francais` đều được). Ả Rập bố cục toàn bộ ứng dụng từ phải sang trái. Trang đăng nhập có bộ chọn giống hệt.
- **Chữ số trong tiếng Ả Rập**: Phương Tây (0123) hoặc Phương Đông (٠١٢٣), chỉ hiện khi ngôn ngữ là Ả Rập.
  ID ngắn và số seri luôn ở chữ số Phương Tây.
- **Vùng**: **Hoa Kỳ** (Oct 29) hoặc **Vương quốc Anh** (29 Oct, 29/10/2026), chỉ hiện khi ngôn ngữ là Anh.
- **Định dạng ngày**: **Mặc định** (29 Oct, có năm chỉ cho năm khác), 29 Oct 2026,
  29/10/2026 hoặc 2026-10-29 (theo cách Vương quốc Anh viết). Mỗi lựa chọn hiển thị hôm nay viết theo cách đó, trong vùng của bạn. Ngày mua và
  bảo hành luôn hiển thị năm.
- **Chủ đề**: **Hệ thống** (theo chế độ sáng hoặc tối của thiết bị), **Sáng** hoặc **Tối**.
- **Chiều rộng nội dung**: **Căn giữa** hoặc **Chiều rộng đầy đủ**, trên màn hình từ 768 px trở lên.

## 7. Xem hướng dẫn

**Trợ giúp → Hướng dẫn** đưa bạn đi qua Kept trên màn hình thật, trong các chương ngắn ba đến sáu bước:

| Chương | Nội dung hiển thị |
|---|---|
| Cơ bản | Trang chủ, các địa điểm của bạn, Quét, Tìm kiếm, và nơi mọi thứ khác ở |
| Đồ vật & vị trí | thêm vào địa điểm, những gì có trong đó, và trang của một đồ vật cùng các thẻ |
| Đồ thị & bản đồ 3D | công tắc Danh sách · Lưới · Đồ thị · Bảng · Bản đồ (Bảng trên máy tính), đồ thị 2D hoặc 3D, 3D hoặc mặt bằng, ghim, tầng và Sắp xếp, nơi phòng di chuyển cùng những gì bên trong |
| Chụp & Hộp thư đến | chọn gì để chụp, nút chụp, và xem lại Kept đọc được gì |
| Quét | một phiên quét: đếm, đóng gói hoặc di chuyển, đâu, và điều Finish thay đổi gì |
| Tìm kiếm & nhãn | ô tìm kiếm, khung nhìn đã lưu, Chọn (di chuyển, in nhãn, Di chuyển đến Rác), in nhãn và Quét, có thể dán nhãn trống lên vị trí bạn có |
| Chuyển nhà | bắt đầu một lần chuyển, các hộp của nó, và chúng ở đâu |
| Cho mượn | gì đang được mượn, Đánh dấu đã trả, và Cho mượn trên một đồ vật |
| Lịch trình & nhắc nhở | một lịch trình mới, gì đến hạn, Hoàn thành, và cách nhắc nhở đến bạn |
| Giấy tờ & bảo hành | thư viện giấy tờ, gì sắp hết hạn, thêm tệp, yêu cầu bồi thường |
| Xe cộ & nhiên liệu | danh sách xe cộ, ghi đọc số hoặc dịch vụ, các dịch vụ bạn có thể mở, và nhiên liệu |
| Nhập & xuất | nhập đến từ đâu, tệp, và xuất |
| Cài đặt & chia sẻ | thông báo, các địa điểm của bạn, mời mọi người, theo dõi gì |

Chỉ liệt kê các chương bạn có: chương của một mô-đun hiện khi nó bật ở một trong các địa điểm của bạn, và người xem không có bước nào thay đổi thứ gì.

- Phía trên: bao nhiêu chương đã xong, với một thanh mỏng, và **Xem hướng dẫn**. Khi một số đã xong nó đọc **Tiếp tục hướng dẫn** và tiếp tục ở chương đầu tiên bạn chưa xong.
- Phía dưới, một hàng ngắn mỗi chương: số thứ tự và các bước. Chạm vào hàng để bắt đầu hướng dẫn tại chương đó. Chương xong gập lại dưới **Xong (N)**; mở để chơi lại.
- Hướng dẫn bắt đầu từ Trợ giúp. Thanh trên cùng của trang giữ công cụ của trang đó; **Bắt đầu phiên** của phiên quét có **Cho tôi xem** nhỏ cho chương của nó.
- Cửa sổ bật lên chỉ vị trí bạn đang ở: "Chương 3 của 12 · bước 2 của 5".
- **Tiếp theo** chuyển tiếp, **Quay lại** lùi trong chương, phím mũi tên làm cả hai, và **Esc**
  hoặc **×** đóng lại.
- Bước cuối của chương gọi tên chương sau: **Tiếp tục** đi thẳng vào nó, **Dừng tại đây**
  kết thúc hướng dẫn tại đó. Chương cuối kết thúc bằng **Xong**.
- Trang vẫn hoạt động khi hướng dẫn chạy: chạm bất cứ thứ gì bên ngoài phần sáng. Đi đến nơi hướng dẫn chưa mở sẽ đóng nó.
- Chương xong nói **Xong** trên Trợ giúp, trên mọi thiết bị. Chương bạn đóng giữa chừng bắt đầu từ bước đầu tiên lần sau.
- Chương cần gì đó để hiển thị mà không tìm thấy sẽ tạo một mẫu có tên rõ ràng, như
  "Mẫu: Máy khoan không dây". Khi hướng dẫn kết thúc bạn chọn giữ hoặc loại bỏ nó; nó không bao giờ
  động đến những gì bạn đã có.
- Hướng dẫn không bao giờ tự bắt đầu.

Một vài gợi ý dùng một lần cũng hiện lần đầu bạn dùng Chụp, Quét, giá trị gợi ý của Hộp thư đến hoặc Nhãn.

Sau khi Kept cập nhật, **Có gì mới trong Kept** hiển thị điểm nhấn của bản phát hành đó, một lần mỗi bản phát hành cho mỗi người, trên mọi thiết bị: một mỗi slide, có ảnh hoặc clip ngắn, tiêu đề và một dòng. **Tiếp theo** và **Quay lại**, các chấm, phím mũi tên hoặc vuốt chuyển giữa chúng; **Đã hiểu** của slide cuối gỡ nó, và **Trợ giúp → Có gì mới** hiển thị lại. Clip phát tắt tiếng và có thể tạm dừng; với chuyển động giảm bật chúng đứng yên cho đến khi bạn nhấn **Phát**. Ngoại tuyến, một slide hiển thị biểu tượng mục thay vì ảnh. Nó không bao giờ hiện trên tài khoản mới, hoặc chồng lên Chụp hay Quét. Điểm nhấn bằng tiếng Anh trong mọi ngôn ngữ, có liên kết đến ghi chú phát hành đầy đủ trên GitHub.

:::tip[Giữ các khóa]
Trước khóa AI đầu tiên, giá trị bí mật hoặc bản sao lưu, Kept chờ cho đến khi quản trị máy chủ đã lưu
[bộ phục hồi](/vi/admin/recovery-kit/) (Quản trị → Trạng thái yêu cầu nó). Không có bộ phục hồi, bản sao lưu không thể
khôi phục khóa AI hay mật khẩu đã lưu trên máy chủ mới.
:::
