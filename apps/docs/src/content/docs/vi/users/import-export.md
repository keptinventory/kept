---
title: "Nhập và xuất"
description: "Đưa đồ vật từ bảng tính, Homebox hoặc Kept khác, và lấy một địa điểm ra dưới dạng bản xuất đầy đủ với một bản sao bạn có thể đọc mà không cần Kept."
---

Nhập và xuất nằm trong **Cài đặt → Nhập** và **Cài đặt → Xuất**. Cả hai đều dành cho **chủ sở hữu và quản trị viên** của một địa điểm, chạy trong nền trên máy chủ và cần kết nối. Để di chuyển toàn bộ máy chủ, hoặc một hộ gia đình giữa các máy chủ, xem thêm
[di chuyển sang máy chủ mới](/vi/admin/move-server/).

## Nhập

**Cài đặt → Nhập** hỏi nguồn gốc:

| Nguồn | Là gì |
|---|---|
| **Một bảng tính (CSV)** | Một đồ vật mỗi hàng, có hàng tiêu đề đặt tên các cột; cũng là bản xuất bảng tính của Homebox |
| **Một bản xuất Homebox** | Tệp ZIP từ Homebox v0.26.1 hoặc mới hơn, khuyến nghị v0.27.0 (Bộ sưu tập → Công cụ → Sao lưu & Khôi phục → Tạo bản sao lưu → Tải xuống) |
| **Một bản xuất Kept** | Một địa điểm được xuất từ Kept này hoặc Kept khác |

Mỗi lần nhập đều được kiểm tra trước khi ghi bất cứ thứ gì: **Kiểm tra lần nhập** hiển thị **Lần nhập sẽ làm gì**, từng hàng, với lý do cho bất cứ thứ gì nó bỏ qua. Sau đó nó chạy với thanh tiến trình. Bạn có thể rời trang; việc nhập tiếp tục, và Cài đặt → Nhập cho thấy đã tiến bao xa. Nếu nó dừng, **Tiếp tục** chạy tiếp từ hàng cuối. **Hủy lần nhập** giữ những gì đã nhập.

Chạy lại cùng một lần nhập bỏ qua những gì đã đưa vào, nên chạy lại không bao giờ tạo bản sao. Một tệp nén (ZIP) lên đến 5 GB. Đồ vật nhập vào đến đã được xác nhận, không vào Hộp thư đến.

### Một bảng tính (CSV)

1. **Chọn tệp**, và địa điểm nó đi vào: một bạn sở hữu hoặc quản trị. Một tệp tối đa 10.000 hàng (8 MB); chia tệp lớn hơn. Dưới tệp, **Các cột Kept đọc được** liệt kê mọi cột nó hiểu, và **Tải xuống tệp CSV mẫu** cho một tệp nhỏ để bắt đầu.
2. **Khớp các cột.** Với mỗi cột, chọn trường nó đến, bao gồm **Trường của một loại…** cho các trường loại của bạn. Một cột phải là tên: mọi đồ vật cần một cái.
3. **Một vài lựa chọn:**
   - Cột vị trí như `Garage > Shelf A` tạo các phòng và chỗ: chọn dấu phân cách, và có **Tạo các vị trí mà tệp nhắc đến nhưng chưa có** hay không.
   - Hàng không có vị trí đi đâu (Mặc định là Không có vị trí).
   - Ngày viết như thế nào (được tính từ tệp nơi có thể), và tiền tệ cho hàng không có.
   - **Khớp cột loại với các loại của bạn theo tên**, bằng bất kỳ ngôn ngữ nào của Kept; tắt, loại được giữ trong ghi chú.
4. **Kiểm tra lần nhập**, đọc báo cáo, và nhập.

Các cột Kept đọc được: tên, số lượng, vị trí, loại, thương hiệu, mẫu, số seri, mã vạch, màu, tình trạng, ghi chú, thẻ, tên khác, ngày mua, giá, tiền tệ, cửa hàng, liên kết hướng dẫn sử dụng, mã nhãn cũ của bạn, mã của bạn, ID hàng (để nhập lại bỏ qua hàng), và các trường riêng của các loại. Tiêu đề bằng bất kỳ ngôn ngữ nào của Kept đều được khớp cho bạn. Thẻ và tên khác được phân tách bằng dấu phẩy, giá là số không có ký hiệu tiền tệ, và ngày viết một cách xuyên suốt cả tệp.

#### Bảng tính của Homebox

Mọi Homebox đều có thể xuất bảng tính (lên đến v0.25: **Công cụ → Nhập/Xuất → Xuất Kho**). Homebox v0.10.3 và v0.11.0 viết nó phân tách bằng tab
(`homebox-items.tsv`); Kept đọc cả hai. Khi cột là của Homebox (`HB.name`,
`HB.location`, …), Kept nói vậy, tự khớp các cột và đọc những gì nhập bảng tính thường sẽ bỏ:

| Cột Homebox | Kept |
|---|---|
| `HB.asset_id`, và liên kết mục trong `HB.url` (v0.13 trở đi) | Nhãn cũ: nhãn Homebox in ra mở đồ vật |
| `HB.sold_*` | Có người mua hoặc giá: đồ vật kết thúc là đã bán, với ngày, người mua, ghi chú và giá. Chỉ ngày bán ở lại trong ghi chú |
| `HB.archived` | Lựa chọn của bạn: **Đã lưu trữ** (mặc định), **Đang sử dụng**, hoặc **Bỏ qua**. Một cái có bán kết thúc là đã bán |
| `HB.warranty_expires`, `HB.lifetime_warranty` | Bảo hành từ ngày mua, nơi Bảo hành bật |
| `HB.warranty_details`, `HB.insured` | Dòng trong ghi chú |

Giá 0 được đọc như không có giá (Homebox viết 0 khi chưa đặt). Các hàng vị trí mà bảng tính v0.26 hoặc mới hơn liệt kê bị bỏ qua; vị trí đến từ đường dẫn vị trí của mỗi mục. Bảng tính không mang được ảnh, tệp, bảo trì hoặc mục trong mục, và trường tùy chỉnh chỉ nhập nếu bạn khớp chúng với trường của loại. Để tất cả những đó, dùng tệp ZIP xuất.

### Một bản xuất Homebox

Kept đọc bản xuất ZIP riêng của Homebox, chứa mọi thứ, bao gồm tệp. Trong Homebox, mở **Bộ sưu tập → Công cụ → Sao lưu & Khôi phục**, chọn **Tạo bản sao lưu**, và **Tải xuống** bản sao lưu khi nó được liệt kê. Nó tồn tại từ Homebox v0.26: dùng
v0.26.1 hoặc mới hơn (ảnh Docker v0.26.0 mất tệp đính kèm), và v0.27.0 nếu bạn có thể. Homebox cũ hơn v0.26 không có xuất: xem
[đến từ Homebox cũ hơn](#đến-từ-homebox-cũ-hơn). ZIP không có
`manifest.json` của Homebox bị từ chối với lời khuyên đó.

:::tip[Nếu Homebox nói "Topic has been Shutdown"]
Homebox v0.26 tạo một xuất mỗi lần nó khởi động. Khởi động lại Homebox và xuất lại, hoặc cập nhật
lên v0.27.0, không có giới hạn này.
:::

Sau khi tải lên, Kept hiển thị bộ sưu tập và ngày xuất. Nó vào **Một địa điểm mới** hoặc **Một địa điểm bạn quản lý**, nơi đồ vật đã có ở đó vẫn được giữ nguyên và
chạy lại chỉ thêm cái mới. Một địa điểm mới được tạo khi bạn nhấn **Nhập**, không phải trước: một lần nhập bạn dừng ở bước kiểm tra không để lại gì. **Kết nối với Homebox (không bắt buộc)** đọc đơn vị tiền tệ của bộ sưu tập, thứ mà tệp ZIP không có: cung cấp địa chỉ của Homebox và một khóa API, hoặc email và mật khẩu. Chúng chỉ được dùng một lần và không bao giờ được lưu lại.

Với một địa điểm mới, tiếp theo là **Theo dõi gì**: **Thiết yếu** (phòng, hộp, nhãn và tìm kiếm),
và thêm vào đó, được tích, những gì bản sao lưu dùng: **Giá trên 10 đồ vật** bật Tiền, **5 bảo hành** bật Bảo hành, **2 mục bảo trì** bật Lịch trình. Bỏ tích một và dữ liệu đó ở lại trong ghi chú của đồ vật như văn bản, không thể thành bản ghi sau. Bản sao lưu không có cái nào bắt đầu chỉ với Thiết yếu. **Cũng áp dụng cho Cá nhân** cho địa điểm Cá nhân của bạn cái giống vậy, nên thực đơn chỉ hiện những gì bạn theo dõi. Thay đổi bất cứ lúc nào trong **Cài đặt địa điểm → Theo dõi gì**; tắt cái gì không bao giờ xóa gì.

Sau đó chọn:

- **Giá tính bằng**: tiền tệ, chỉ hỏi khi bản sao lưu có giá. Chọn cái nào gán nhãn lại số tiền; nó không quy đổi.
- **Các mục đã lưu trữ**: **Đã lưu trữ** (mặc định: lưu trữ trong Kept cũng vậy, vẫn của bạn, để đi), **Đang sử dụng**, hoặc **Bỏ qua**. Mục lưu trữ có người mua hoặc giá kết thúc là đã bán.
- **Các mục có số lượng bằng 0**: **Giữ 0 hoặc lưu trữ** (mặc định: loại bạn hết hàng giữ 0, cái khác về lưu trữ), **Đặt thành 1**, hoặc **Bỏ qua**. Mỗi cái đến có "Số lượng trong Homebox: 0" trong ghi chú. Mục chứa mục khác không bao giờ bị lưu trữ hay bỏ qua vì 0, và vị trí thành hộp không có số lượng để kiểm tra.
- **Thêm trường "Được bảo hiểm" có/không**, và **Bỏ qua các vị trí và thẻ mẫu của Homebox** (tám phòng và sáu thẻ mỗi bộ sưu tập Homebox mới bắt đầu có, khi chúng chưa dùng).
- **Những vị trí này trông giống hộp**: vị trí đặt tên như hộp hay thùng (Box 01, Bin 2, Kiste 3…) không chứa vị trí khác. Tích chúng, hoặc **Chọn tất cả**, và chúng đến như hộp: đồ vật chứa đồ vật, với thẻ và cái bên trong. Cái còn lại đến như vị trí.
- **Trường tùy chỉnh**: với mỗi cái, **Thêm vào loại** hoặc **Giữ trong ghi chú**.
- **Các loại**: với mỗi loại Homebox, một loại Kept, **Loại mới…** với tên bạn gõ, hoặc **Không có loại**. Các loại riêng của Homebox 0.27, `global.item` và `global.location`, đọc là **Mục** và Địa điểm, như trong Homebox; loại chung **Mục** bắt đầu là **Không có loại**.

Bước kiểm tra liệt kê mọi mục cần xem, mỗi cái với chuyện gì xảy ra với nó bằng lời, và trang nhập giữ danh sách đó sau nhập: mở từ **Hoạt động** (Đã chạy một lần nhập).

Điều gì đến:

| Homebox | Kept |
|---|---|
| Bộ sưu tập | Một địa điểm |
| Vị trí (lồng nhau) | Phòng và chỗ, giữ cây |
| Mục | Đồ vật; mục chứa mục khác thành hộp, không phải toàn bộ loại |
| Nhà sản xuất, mẫu, số seri | Thương hiệu, mẫu, số seri |
| Ngày mua, cửa hàng và giá | Một lần mua với cửa hàng của nó |
| Bảo hành, bảo hành trọn đời | Một bảo hành |
| Chi tiết bán | Có người mua hoặc giá (lớn hơn 0): đồ vật kết thúc là đã bán, với ngày, giá, người mua và ghi chú. Chỉ ngày bán không phải là bán: đồ vật ở lại đang dùng, ngày trong ghi chú |
| Thẻ | Thẻ với màu (thẻ lồng gọn làm phẳng) |
| Ảnh, hướng dẫn, hóa đơn, tệp bảo hành | Ảnh, hướng dẫn, hóa đơn của lần mua, tài liệu của bảo hành |
| Liên kết | Liên kết. Liên kết đến tài liệu của [Paperless-ngx](/vi/users/paperless/) mà địa điểm kết nối (cùng địa chỉ) đến như liên kết Paperless, như **Liên kết từ Paperless** làm, với tiêu đề từ Paperless (của Homebox nếu Paperless không cho; báo cáo nói bao nhiêu); kết nối Paperless trước khi nhập |
| Bảo trì đã làm | Bản ghi dịch vụ |
| Bảo trì lên lịch | Lịch trình một lần |
| Mẫu | Mẫu tài khoản, tối đa nơi khớp |

Người thông báo, thành viên và vai trò không nhập. Nơi mô-đun tắt trong địa điểm, văn bản của bản ghi đó giữ trong ghi chú của đồ vật. Mô tả vị trí không giữ (vị trí không có ghi chú); bước kiểm tra gọi tên mỗi cái.

Homebox viết ngày không ai gõ: vài nâng cấp lấp đầy trường ngày trống, và bản sao lưu có thể mang ngày trống như ngày cuối năm 0. Kept đọc ngày trước năm 1000 như không ngày, và bán cần người mua hoặc giá.

#### Sửa một lần nhập trước

Nhập trước Kept 1.13.0 biến số lượng 0 thành 1, làm toàn bộ loại thành loại hộp khi một mục của nó chứa cái khác (mọi đồ vật của nó mở tab Nội dung trống), và có thể tạo loại tên `global.item`. Nhập trước 1.14.1 kết thúc đồ vật đã bán khi Homebox chỉ có ngày bán. Mở lần nhập từ **Hoạt động** (Đã chạy một lần nhập): **Sửa lần nhập này** liệt kê gì nó sửa được, bằng tên:

- **Lưu trữ đồ vật có số lượng 0 trong Homebox** (vẫn đang dùng, số lượng 1);
- **Làm loại thành loại thường lại** (đồ vật chứa đồ vật vẫn là hộp);
- **Đổi tên `global.item` thành Mục**;
- **Đưa đồ vật đánh dấu đã bán chỉ có ngày về dùng lại**: bán không người mua và không giá, và không thay đổi từ đó. Mục lưu trữ trong Homebox cũng về dùng lại: lưu trữ lại bằng tay.

Tích cái bạn muốn và nhấn **Sửa**. Một **Hoàn tác** đưa tất cả về.

**Nhãn cũ vẫn hoạt động.** Mỗi ID tài sản Homebox (`000-001`) được nhớ và liệt kê dưới
**Mã của bạn** trên đồ vật. Bộ quét Kept nhận diện nhãn Homebox và mở đồ vật nhập; nếu bạn trỏ hostname Homebox cũ tại Kept, quét bằng camera điện thoại cũng hoạt động. ID mục và vị trí dài của Homebox (cái trong liên kết nhãn của nó) được nhớ để quét nhưng không liệt kê. Đồ vật nhập nhận mã Kept riêng, ở ngoài danh sách cho đến khi bạn in nhãn của chúng.

### Đến từ Homebox cũ hơn

Homebox cũ hơn v0.26 không tạo được ZIP xuất. Hai cách vào:

- **Mọi thứ, ảnh và bảo trì kèm theo:** cập nhật bản sao Homebox lên v0.27.0 và
  xuất ZIP từ bản sao. Thử từ Homebox v0.10.3 (phát hành cuối của `hay-kot/homebox` gốc) thẳng lên v0.27.0.
- **Nhanh hơn, với ít hơn:** nhập [bảng tính](#bảng-tính-của-homebox) của nó.

Nâng cấp không hoàn tác được (từ v0.23, ghi chú của Homebox nói vậy), nên chạy trên bản sao
và Homebox của bạn nguyên vẹn:

1. **Dừng Homebox và sao chép thư mục dữ liệu**, cái gắn tại `/data` (`homebox.db` với
   `-wal` và `-shm` của nó, và tệp đính kèm). Giữ bản gốc làm bản sao lưu.
2. **Khởi động Homebox v0.27.0 trên bản sao.** Homebox giờ ở
   `ghcr.io/sysadminsmedia/homebox`; v0.26 trở lên cần `HBOX_AUTH_API_KEY_PEPPER`, 32
   hoặc nhiều ký tự ngẫu nhiên:

   ```sh
   docker run --rm -p 7745:7745      -e HBOX_AUTH_API_KEY_PEPPER="$(openssl rand -hex 24)"      -v /path/to/homebox-copy:/data      ghcr.io/sysadminsmedia/homebox:0.27.0
   ```

   Lần khởi động đầu cập nhật cơ sở dữ liệu một lần. Nó cũng thêm tám phòng mẫu của Homebox,
   mà Kept bỏ qua mặc định khi chúng trống.
3. **Đăng nhập** với tài khoản thường và mở **Bộ sưu tập → Công cụ → Sao lưu & Khôi phục**.
   Chọn **Tạo bản sao lưu**, rồi **Tải xuống** bản sao lưu khi được liệt kê.
4. **Nhập vào Kept** như [một bản xuất Homebox](#một-bản-xuất-homebox).
5. Dừng bản sao và xóa nó khi nhập xong.

Ảnh thêm trước Homebox ghi loại tệp cũng đến: Kept tự kiểm tra mỗi tệp.

### Một bản xuất Kept

Một bản xuất Kept luôn vào như **một địa điểm mới**, với đồ vật, vị trí, tệp, báo cáo tình trạng,
chuyển nhà và lịch sử, và vị trí của địa điểm nếu có (cho
[Gợi ý tôi ở đâu](/vi/users/phone-app/#máy-ảnh-thư-viện-và-quét)). Nếu nó giữ giá trị bí mật, **Mở các bí mật** với cụm từ khi xuất;
không có nó, mọi thứ khác nhập. Mở cần HTTPS: qua HTTP thường màn hình nhập nói vậy và nhập phần còn lại. **Người cần mời** liệt kê ai chia sẻ địa điểm;
người nào không được mời bởi việc nhập, nên mời từng người bạn.

**Báo cáo tình trạng** về với ngày, ghi chú, phòng và ảnh, và mỗi ảnh giữ lúc Kept nhận nó lần đầu. Báo cáo xong về xong cùng lúc, và vẫn khóa. Trên máy chủ mới, ảnh và lúc xong dưới tên người nhập; lịch sử vẫn cho ai làm gì trước nhập.

**Chuyển nhà** về với hộp: số hộp, trạng thái và phòng nó đến, và chuyển nhà xong xong lại. Chuyển nhà đến địa điểm khác vào như chuyển nhà trong cái mới, với phòng chọn lại.

Bản xuất bởi Kept mới hơn máy chủ bạn nhập vào có thể bị từ chối: cập nhật máy chủ đó trước.

### Lịch sử LubeLogger của một xe

Trên trang Tổng quan của xe, **Nhập từ LubeLogger** lấy CSV mà LubeLogger xuất cho một xe: nhiên liệu, bản ghi dịch vụ (sửa và nâng cấp cũng vậy) hoặc đọc odometer, một tệp một lần. Kept đọc tệp, nói loại nào và đoán ngày và thập phân viết như thế nào (LubeLogger viết theo ngôn ngữ máy chủ của nó); đổi cái nào nếu đoán sai, và nói nhiên liệu tính bằng lít hay gallon. **Kiểm tra** cho thấy gì sẽ thêm và hàng nào không, và tại sao; **Nhập** thêm chúng, cũ trước, với đọc odometer. Nhập cùng tệp lại không thêm gì. Chủ sở hữu và quản trị viên của địa điểm có thể nhập.

### Từ tìm kiếm sau nhập

Khi nhà cung cấp AI được kết nối, cuối nhập có thể đề nghị **Thêm từ tìm kiếm bằng AI?**, với ước lượng token. Nó chạy trong nền và thêm bí danh trong ngôn ngữ của địa điểm, như đồ vật chụp được ([Nhà cung cấp AI](/vi/users/ai-providers/)).

## Xuất

**Cài đặt → Xuất** có hai loại:

- **Xuất một địa điểm**, một bạn sở hữu hoặc quản trị: mọi đồ vật, vị trí, ảnh, tài liệu,
  báo cáo tình trạng và chuyển nhà luôn trong đó.
- **Xuất dữ liệu của tôi**: địa điểm Cá nhân với tệp, hồ sơ và tùy chọn, và cuộc gọi AI của bạn. Với [Cá nhân ẩn](/vi/users/locations/#ẩn-cá-nhân) nó mang địa điểm khác đầu tiên bạn sở hữu, và Cá nhân ở **Xuất một địa điểm**.

**Gồm những gì** thêm: đồ vật lưu trữ và kết thúc (đã bán, đã cho, đã vứt), Thùng rác, lịch sử,
cuộc gọi AI, và **Một bản sao bạn có thể đọc mà không cần Kept**: trang web, bảng tính, ảnh nhỏ và hóa đơn mở trong mọi trình duyệt, tùy chọn có PDF kho, bằng ngôn ngữ riêng.

**Bao gồm bí mật** cho chủ sở hữu địa điểm. Giá trị bí mật được mã hóa với cụm từ ít nhất 12 ký tự, gõ hai lần. Ai có tệp và cụm từ đọc mọi bí mật trong đó, và Kept không khôi phục cụm từ quên. Bản sao đọc không bao giờ giữ bí mật.

Xuất không bí mật để mọi giá trị bí mật ra và nói vậy: mỗi đồ vật hoặc vị trí có cái gọi tên trường trong `secretsWithheld`, tệp manifest đếm chúng, và bản sao đọc có dòng về nó. Nó nhập như xuất khác; trường đến trống. Qua HTTP thường đây là loại duy nhất (**Bao gồm bí mật** cần HTTPS, [Kept trên mạng nhà](/vi/install/home-network/)).

Xuất được xây trong nền; bạn được thông báo khi sẵn. Mỗi xuất ở trong danh sách, sẵn để **Tải xuống**, bảy ngày. Mọi tệp trong ZIP được đặt ngày khi xuất tạo.

### Xuất và bản sao lưu

Xuất là cái bạn mang đi: một địa điểm, đọc đâu cũng được, nhập vào Kept bất kỳ.
Bản sao lưu đêm của máy chủ riêng biệt và bao phủ toàn thể thể hiện; nó cũng giữ bản sao đọc của mọi địa điểm ([bản sao lưu](/vi/admin/backups/)). Xóa địa điểm đề nghị **Xuất trước**.

## Di chuyển giữa các thể hiện

Để di chuyển một hộ gia đình sang máy chủ Kept khác: xuất địa điểm (với bí mật nếu cần), rồi nhập ZIP đó như một bản xuất Kept. Nhãn in vẫn hoạt động: nhãn giữ mã khi mã đó tự do trên máy chủ mới, và khi không, nhãn cũ vẫn mở đồ vật. Để di chuyển toàn bộ máy chủ với mọi tài khoản, dùng bản sao lưu thay thế. Cả hai cách trong
[di chuyển sang máy chủ mới](/vi/admin/move-server/).
