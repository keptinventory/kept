---
title: Địa điểm, phòng và hộp
description: "Cây mà mọi thứ nằm trong: địa điểm, phòng và vị trí, hộp và thùng chứa, Chưa có vị trí, các bố cục của một địa điểm (Danh sách, Lưới, Sơ đồ, Bảng, Bản đồ), và Chọn cho nhiều đồ vật cùng lúc."
---

Mọi thứ nằm trong một cây: một địa điểm (Trang chủ, Nhà để xe, một đơn vị lưu trữ) chứa **phòng và vị trí** ("phòng hoặc vị trí" là từ của Kept cho bất kỳ nơi nào), chứa đồ vật. Một đồ vật có thể là một **hộp hoặc thùng chứa** chứa các đồ vật khác, sâu bao nhiêu cũng được. Mỗi địa điểm cũng có **Chưa có vị trí**, cho các đồ vật chưa có nơi.

- Trên một địa điểm, phòng hoặc hộp, **Thêm tại đây** thêm một Đồ vật, một **Hộp / thùng chứa** hoặc một **Phòng hoặc vị trí**, hoặc [đồ nội thất có ngăn](#đồ-nội-thất-có-ngăn).
- Các danh sách có ô tìm kiếm, **+ Bộ lọc**, **Chế độ xem** đã lưu, và nút **Hiển thị** cho thứ tự sắp xếp và nhóm. Bộ lọc nằm trong địa chỉ, nên danh sách đã lọc có thể được thêm vào bookmark hoặc chia sẻ.
- **Chọn** (bên cạnh ô tìm kiếm, cho bất kỳ ai có thể sửa đồ vật) tích các đồ vật trong danh sách của một địa điểm, vị trí hoặc hộp, trong Danh sách hoặc Lưới. **Shift-click** vào ô checkbox của một hàng (hoặc **Shift+Space** trên nó) để tích mọi hàng từ hàng bạn tích lần trước. Sau đó: **Di chuyển**, **Thêm thẻ…** hoặc **Xóa thẻ…**, **Đặt một trường…**, **Nhặt lên** (vào khay), **In nhãn**, **Thêm vào sự cố** và **Gói yêu cầu bồi thường** (chủ sở hữu và quản trị viên, nơi Hóa đơn và bảo hành đang bật), hoặc **Di chuyển vào Thùng rác**. Thanh đó là của [Bảng](/vi/users/spreadsheet/).
- **Đặt một trường…** cho mọi đồ vật đã tích một giá trị: loại, thương hiệu, mẫu, tình trạng và các trường còn lại. Thay đổi chờ, đánh dấu **Chưa lưu**, cho đến **Lưu N thay đổi**; một **Hoàn tác** lấy lại toàn bộ lần lưu. Nó cần một kết nối. Nếu ai đó đã thay đổi một trong số chúng giữa chừng, cái đó chờ: **Giữ của tôi** hoặc **Giữ của họ**.
- **Di chuyển vào Thùng rác** lấy tối đa 200 mỗi lần và cần một kết nối. Nó hỏi trước chuyện gì xảy ra với thứ bên trong hộp (di chuyển ra, hoặc rác nó theo) và về thứ đang cho mượn, rồi một **Hoàn tác** đưa tất cả trở lại.
- **Thứ tự:** các vị trí và đồ vật đọc Từ A đến Z với số theo thứ tự (Hộp 2 trước Hộp 10), giống nhau trong ứng dụng, ngoại tuyến, trong xuất dữ liệu và cho ứng dụng AI. Các tầng giữ thứ tự chúng được tạo: cái đầu tiên là tầng trệt trên bản đồ. Trên một vị trí, **Hiển thị → Đồ vật: sắp xếp theo** sắp xếp đồ vật của nó; các vị trí của nó vẫn Từ A đến Z.
- **Thứ tự của bạn:** trên một vị trí, **Quản lý → Thứ tự các vị trí ở đây → Thứ tự tùy chỉnh** đặt các vị trí bên trong theo thứ tự bạn chọn, với **Di chuyển lên** và **Di chuyển xuống** trên mỗi cái (bàn phím cũng được). **Từ A đến Z** quay lại bất cứ lúc nào, và chuyển sang **Thứ tự tùy chỉnh** lại đưa thứ tự của bạn về. Cây, bản đồ, xuất dữ liệu và ứng dụng AI theo nó. Cấp cao nhất của một địa điểm vẫn Từ A đến Z.
- **Chuyển vị trí thành hộp…** trên **Quản lý** của một vị trí liệt kê các vị trí bên trong: tích một số, hoặc **Chọn tất cả**, và chúng thành hộp trong một bước, mỗi cái giữ ID, nhãn và nội dung của nó. Một vị trí có vị trí bên trong không thể tích: hộp chỉ chứa đồ vật. **Hoàn tác** của toast chuyển tất cả trở lại thành vị trí, như chúng từng là; nó ở trong lịch sử 7 ngày.
- **Trợ lý và ứng dụng AI** có thể làm tương tự: đổi tên một vị trí, đổi loại nó, di chuyển nó, đặt các trường của nó và thứ tự các vị trí trong nó, và chuyển vị trí thành hộp (`update_place` và `turn_into_boxes`, [MCP clients](/vi/users/mcp-clients/)). Trợ lý hiện một thẻ để xác nhận trước; Hoàn tác hoạt động như trong ứng dụng.
- **Cây vị trí** (bên cạnh trang trên máy tính, **Tất cả vị trí** trên điện thoại) hiện hộp dưới vị trí của chúng với số lượng đồ vật trong mỗi cái, tối đa 50 một vị trí, sau đó **+N hộp**. Mũi tên bên cạnh một vị trí gấp cái dưới nó; **Thu gọn tất cả** và **Mở tất cả** làm mọi vị trí cùng lúc. Kept nhớ các lần gấp của bạn cho tài khoản, trên mọi thiết bị. Các vị trí trên trang bạn đang xem vẫn mở, ngay cả sau **Thu gọn tất cả**.
- **Độ rộng của nó** (trên máy tính, từ 1280 px rộng): kéo đường dọc theo cạnh cây, hoặc focus vào nó và dùng phím mũi tên, Home và End. **Thu gọn vị trí**, nút ở đỉnh cây, gấp nó để để trang toàn chỗ; **Mở rộng vị trí** đưa nó lại. Thiết bị này nhớ cả hai.
- Trên một địa điểm, **Sắp xếp chúng** đi qua Chưa có vị trí từng đồ vật một với bộ chọn vị trí.
- Một hộp mở từ nhãn của nó hiện lưới ảnh của thứ bên trong.
- **Bố cục:** trang của một địa điểm chuyển giữa **Danh sách**, **Lưới**, **Sơ đồ**, **Bảng** và **Bản đồ**, mỗi cái với biểu tượng của nó. **Sơ đồ** vẽ địa điểm thành đồ thị các tầng, phòng, hộp và đồ vật, trong 2D hoặc 3D ([Sơ đồ](/vi/users/graph/)). **Bảng** hiện đồ vật của nó như bảng tính, trên màn hình 1024 px rộng trở lên ([Chế độ xem bảng tính](/vi/users/spreadsheet/)), nên điện thoại hiện Danh sách · Lưới · Sơ đồ · Bản đồ. **Bản đồ** hiện địa điểm trong 3D, theo tầng, với phòng, kệ và hộp của nó ([Bản đồ địa điểm](/vi/users/location-map/)). Menu **Hiển thị** của danh sách đưa ra lựa chọn tương tự. Trang riêng của một vị trí (không phải Chưa có vị trí) có công tắc đó nữa, không có Bảng. Kept nhớ bố cục cho mỗi địa điểm và mỗi vị trí trên thiết bị đó.
- **Lưới** hiện vị trí và đồ vật của một địa điểm hoặc phòng như ô vuông, dưới cùng các tiêu đề **Các vị trí** và Đồ vật như Danh sách; mỗi tiêu đề gấp đi. **Hiển thị → Kích thước** chọn ô **Nhỏ**, **Trung bình** hoặc **Lớn** (3, 2 hoặc 1 một hàng trên điện thoại), và Kept nhớ kích thước của bạn trên thiết bị đó.
- Trên máy tính hoặc máy tính bảng, thanh bên đánh dấu địa điểm bạn đang ở: trên trang của nó, và trên phòng, đồ vật, hộp và cài đặt của nó.

![Một địa điểm trong Lưới với ô Nhỏ: tiêu đề Các vị trí · 9 trên các phòng, sau đó tiêu đề Đồ vật · 20+ trên các đồ vật, sáu ô một hàng, mỗi ô chỉ có tên](../../../../assets/screens/grid-desktop-light.webp)

![Cùng lưới đó trong giao diện tối](../../../../assets/screens/grid-desktop-dark.webp)

Liên kết dùng ID, không bao giờ dùng đường dẫn, nên di chuyển đồ vật không bao giờ làm gãy liên kết đến nó.

## Đồ nội thất có ngăn

Một kệ ô vuông, một tủ sách hoặc một bộ ngăn kéo là một vị trí, và mỗi ô vuông, kệ hoặc ngăn kéo là một vị trí bên trong nó, với tên, nhãn và, nếu bạn muốn, mã riêng của nó.

- **Thêm tại đây → Phòng hoặc vị trí → Đồ nội thất có ngăn…** tạo đồ nội thất và tất cả ngăn của nó trong một bước. Chọn một mẫu: kệ ô vuông 1 × 4, 2 × 2, 2 × 4, 4 × 4 hoặc 2 × 8, tủ sách (6 kệ), bộ ngăn kéo (9) hoặc kệ đựng (4). Thay đổi số kệ hoặc ngăn kéo trước khi thêm. Loại của đồ nội thất là **Nội thất**; các ngăn của nó là **Ô vuông**, **Kệ** hoặc **Ngăn kéo**.
- **Cách đặt:** một kệ ô vuông không vuông có thể đứng **Thẳng đứng** hoặc nằm **Nghiêng**. Một 2 × 4 thẳng đứng là 4 hàng 2; nghiêng, 2 hàng 4. Các ngăn được xây dựng như cách nó đứng.
- **Đếm:** từ góc trên bên trái, hàng theo hàng, như bạn thấy trước mặt. Một 4 × 4 là Ô vuông 1 đến Ô vuông 16; một 2 × 4 nghiêng có 1 đến 4 trên hàng trên và 5 đến 8 bên dưới. Trang tính hiện số trước khi bạn thêm. **Tên ngăn** lấy `{n}` cho số, `{row}` và `{col}` cho nơi nó nằm.
- **Mã:** **Mã riêng của nó** cho đồ nội thất một mã (`KX01`), và **Mã ngăn** một mẫu cho các ngăn, như `{parent}-F{col:02}{row:02}`: `{parent}` là mã của đồ nội thất, `{col:02}` cột với hai chữ số. Một 4 × 4 thì nhận `KX01-F0101` đến `KX01-F0404`. Mỗi mã được kiểm tra với quy tắc định dạng của địa điểm (**Cài đặt → địa điểm → Chung → Các mã của riêng bạn**) và với các mã đã có; nếu cái nào không vừa, không cái nào được tạo và Kept báo mã đó. Quét hoặc tìm mã tìm thấy ngăn của nó.
- **Hoàn tác:** **Hoàn tác** của toast bỏ đồ nội thất và các ngăn của nó vào Thùng rác và giải phóng mã của chúng, miễn là không có thứ gì được đặt vào hoặc thay đổi kể từ đó.
- **Nhãn:** trên đồ nội thất mới, **Dán nhãn cho mọi thứ ở đây** in nhãn cho nó và cho mọi ngăn, theo thứ tự đếm.
- **Trang của nó** hiện các ngăn như cách nó đứng, đánh số như nhãn của chúng. Chạm một cái để mở. **In nhãn của chúng** in tất cả lại, theo thứ tự đếm, với tên chúng có bây giờ.

### Xoay đồ nội thất

**Xoay…** trên trang của đồ nội thất, cho kệ ô vuông không vuông.

- **Phần trên giờ ở:** **Bên phải** hoặc **Bên trái**, như bạn đối diện nó. Mỗi ngăn di chuyển cùng đơn vị, với đồ vật và nhãn in của nó.
- **Các ngăn của nó** được hỏi mỗi lần, vì nhãn đã dán trên:
  - **Đánh số lại:** mỗi ngăn nhận số, tên và mã của nơi nó giờ đứng, đếm từ trên trái lại. Mã cũ vẫn hoạt động: nó mở ngăn giờ ở vị trí nó đặt tên. In nhãn lại cho tên mới.
  - **Giữ nguyên mã:** chỉ cách đặt thay đổi. Mọi ngăn giữ số, tên và mã của nó.
- Trang tính hiện lưới mới trước khi bạn xoay. Tên hoặc mã bạn tự gõ ở lại với ngăn của nó dù cách nào.
- **Hoàn tác** xoay ngược lại, số, tên và mã bao gồm, miễn là không có thứ gì trong nó thay đổi kể từ đó.

### Gộp và tách ngăn

Một khay ô vuông hoặc một kệ gỡ ra làm hai hoặc nhiều ngăn thành một.

- **Gộp hoặc tách…**, sau đó chạm các ngăn cạnh nhau tạo thành hình chữ nhật, và **Gộp**. Cái trên trái ở lại, với số, tên và mã của nó. Các cái khác vào Thùng rác; mã và nhãn in của chúng mở ngăn đã gộp, và thứ trong chúng di chuyển vào nó.
- Để tách một ngăn đã gộp, chạm vào nó và **Tách**. Mỗi ô trở lại với mã và nhãn của nó; đồ vật ở lại cái trên trái.
- **Hoàn tác** đảo ngược cả hai.
- **Mẫu của riêng bạn:** **Cài đặt → Tài khoản → Mẫu → Nội thất** có mẫu vị trí của tài khoản: ô vuông ngang và dọc (thẳng đứng), kệ hoặc ngăn kéo, các loại, tên và mẫu mã, chia sẻ với địa điểm bạn chọn. Chủ sở hữu và quản trị viên tạo chúng; bất kỳ ai có thể thêm vị trí dùng chúng.
- **Ứng dụng AI** có thể làm tương tự: `create_place` lấy một `template`, và `update_place` một `turn` ([MCP clients](/vi/users/mcp-clients/#các-công-cụ)). Gộp và tách ở trong ứng dụng.

## Ẩn Cá nhân

Mọi người nhận một địa điểm **Cá nhân**. Nếu bạn không dùng nó, bật **Ẩn Cá nhân** trong **Cài đặt → Tôi → Các địa điểm của bạn**, và tắt để hiện lại bất cứ lúc nào. Đó là sở thích của bạn: không ai thấy thay đổi.

- **Mất từ:** các địa điểm trong menu, Trang chủ, danh sách, tìm kiếm và bộ lọc của chúng. Một mô-đun chỉ theo dõi Cá nhân (Xe cộ, ví dụ) mất khỏi menu cùng nó.
- **Không đổi:** mọi thứ trong nó. Liên kết đến Cá nhân hoặc đến đồ vật trong nó vẫn mở nó. Ẩn là dọn dẹp, không phải bảo vệ: nó không khóa gì.
- **Nhắc nhở vẫn đến bạn**, như thông báo, trong bản tóm tắt và trong nạp lịch. Tắt chúng trong **Cài đặt → Tôi → Thông báo**, nơi Cá nhân vẫn liệt kê.
- **Chụp** bắt đầu ở địa điểm khác của bạn, hoặc ở Cá nhân nếu bạn không thể thêm đồ vật ở đâu khác.
- **Nhập** đưa ra các địa điểm khác bạn sở hữu hoặc quản trị, hoặc Cá nhân nếu không có cái nào. Một lần nhập cũ vẫn mở từ Hoạt động, bất kể nó đi đâu.
- **Giữ sẵn dùng ngoại tuyến** trong **Cài đặt → Thiết bị này** giữ hàng của Cá nhân selama bản sao của nó trên thiết bị, nên bạn có thể tắt nó.
- **Xuất dữ liệu của tôi** mang theo địa điểm khác đầu tiên bạn sở hữu, và Cá nhân vẫn ở **Xuất một địa điểm**. Nếu bạn không sở hữu địa điểm khác, nó mang theo Cá nhân.
- **Khóa AI cá nhân của bạn** cũng trả cho một địa điểm bạn sở hữu và dùng một mình, khi tài khoản của địa điểm đó không có khóa riêng. Nó không bao giờ trả cho địa điểm chia sẻ.
- **Trợ lý** để Cá nhân ra ngoài, trừ khi bạn mở nó từ Cá nhân. **Kết nối** (mã cá nhân và ứng dụng kết nối) giữ các địa điểm bạn cho chúng, ẩn hay không.

Bạn không thể ẩn nó khi nó là địa điểm duy nhất của bạn. Nếu nó trở thành địa điểm duy nhất sau (bạn rời, bạn bị xóa, địa điểm khác bị xóa), nó hiện lại một mình, và ẩn lại khi bạn có cái khác.

## Liên quan

- [Sử dụng hàng ngày](/vi/users/everyday-use/) cho bức tranh rộng hơn.
- [Thẻ](/vi/users/tags/) cho thứ đồ vật là ngoài vị trí nó ở.
- [Chia sẻ một địa điểm](/vi/users/everyday-use/#chia-sẻ-một-địa-điểm) cho việc cho người vào một cái.
