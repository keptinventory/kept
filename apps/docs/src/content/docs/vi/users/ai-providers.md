---
title: Nhà cung cấp AI
description: Nhà cung cấp AI nào Kept làm việc với, chìa khóa đặt ở đâu, mỗi tính năng gửi và chi phí bao nhiêu, giới hạn chi tiêu, mô hình cục bộ, và cách tắt AI.
---

Kept hoạt động mà không cần AI. Kết nối một nhà cung cấp AI thêm ba thứ: đặt tên cho đồ vật từ ảnh và đọc hóa đơn, nhãn và chỉ số đồng hồ; trợ lý, trả lời các câu hỏi về kho hàng của bạn; và, với một mô hình nhúng, tìm kiếm theo ý nghĩa. Bạn tự mang khóa của mình; Kept không có dịch vụ AI của riêng nó.

## Nhà cung cấp AI

| Nhà cung cấp | Ảnh và hóa đơn | Trợ lý | Tìm kiếm theo ý nghĩa |
|---|---|---|---|
| **Groq** (khuyên dùng) | có | có | không có mô hình nhúng |
| **OpenAI** | có | có | có |
| **Anthropic** | có | có | không có mô hình nhúng |
| **Google** (Gemini) | có | có | có |
| **OpenRouter** | có | có | có (các mô hình nhúng của nó) |
| **Tương thích OpenAI** (Ollama, LM Studio, …) | các mô hình bạn đặt tên | các mô hình bạn đặt tên | nếu máy chủ có |

**Groq với `qwen/qwen3.8-27b`** là sự khuyên dùng: kết quả đáng tin cậy rẻ nhất Kept đã đo, khoảng USD 0.004 cho một hóa đơn (trên ảnh kiểm tra tổng hợp, 2026-09-26). Dán khóa Groq sẽ chọn nó, và **Tại sao?** trên trang đưa ra các con số. Kept gợi ý một mô hình cho mỗi nhà cung cấp AI và mỗi nhiệm vụ; bạn có thể chọn bất kỳ mô hình nào khác từ danh sách của nhà cung cấp AI dưới **Nâng cao**, hoặc nhập bất kỳ mã mô hình nào.

## Khóa đặt ở đâu

| Khóa | Đặt ở | Trả cho |
|---|---|---|
| **Khóa của tài khoản** | **Cài đặt → AI**, bởi chủ sở hữu tài khoản | Mỗi địa điểm mà tài khoản đó sở hữu |
| **Khóa cá nhân của bạn** | **Cài đặt → AI → Khóa AI cá nhân** | Địa điểm Cá nhân của bạn, các luồng trợ lý riêng tư của bạn, và các câu hỏi xuyên qua các chủ sở hữu. Với [Ẩn cá nhân](/vi/users/locations/#ẩn-cá-nhân), cũng một địa điểm bạn sở hữu và sử dụng một mình, khi tài khoản của nó không có khóa |
| **Khóa của máy chủ này** | **Quản trị → AI**, bởi quản trị viên instance | Bất kỳ ai mà tài khoản của họ không có khóa riêng của chính họ |

Làm việc trong một địa điểm (đặt tên cho ảnh, câu trả lời của trợ lý về nó) được trả bởi **chủ sở hữu địa điểm**, nên các thành viên của Alfred's "Family house" dùng khóa của Alfred, không phải của họ. Các thành viên và người xem thấy một dòng chỉ đọc nói ai trả.

**Kết nối:** dán khóa trong **Dán khóa của bạn**. Kept nhận dạng nhà cung cấp AI từ khóa khi có thể (nếu không, chọn nó dưới **Nâng cao**), rồi **Lưu và kiểm tra** sẽ kiểm tra xem mô hình có đọc ảnh và đưa ra câu trả lời có cấu trúc hay không, và nói chi phí của bài kiểm tra là bao nhiêu. Khóa chỉ ghi: Kept chưa bao giờ hiển thị lại một khóa đã lưu, và **Thay khóa** hoán đổi nó. Trước khi có khóa đầu tiên trên một máy chủ, quản trị viên instance phải lưu [gói khôi phục](/vi/admin/recovery-kit/): khóa là một bí mật Kept phải có thể khôi phục từ bản sao lưu.

**Nâng cao** chứa nhà cung cấp AI và URL cơ sở, mô hình cho mỗi nhiệm vụ (**Mô hình**), **Nỗ lực suy luận** (thấp theo mặc định), các giới hạn và các giá cả.

**Mô hình:** danh sách là của chính nhà cung cấp AI, được yêu cầu mỗi lần trình chọn mở (Kept sử dụng lại nó trong mười phút; **Làm mới danh sách** hỏi lại). Các mô hình `:free` của OpenRouter có trong đó, được đánh dấu "free: shared, may be busy": một nhóm dùng chung thường trả lời "busy". Dưới mỗi trình chọn, **Mã mô hình tùy chỉnh** nhận bất kỳ mã nào, cho mọi nhà cung cấp AI, kể cả một mã mà danh sách không hiển thị; **Lưu và kiểm tra** sau đó kiểm tra nó. Khi nhà cung cấp AI không trả lời danh sách, chỉ còn lại việc nhập mã.

## Những gì dùng AI trong Kept, và chi phí

Cài đặt AI mở với **Những gì dùng AI trong Kept**: một hàng cho mỗi hành động (một ảnh đã chụp, một hóa đơn, một nhãn, một chỉ số đồng hồ, một câu hỏi của trợ lý, một tìm kiếm, bài kiểm tra), với số lần gọi nó thực hiện, số token nó lấy, và chi phí từ bảng giá, từ việc dùng trong 30 ngày qua của bạn khi đã có dữ liệu. Dưới **Tháng này**, một thanh cho mỗi giới hạn cho thấy chi tiêu đến nay.

- **Chụp** (chế độ Đồ vật, Hóa đơn, Nhãn, Chỉ số đồng hồ): một lần gọi cho mỗi ảnh. Tên, nhãn hiệu, mô hình và loại được điền vào; giá, ngày, số serial và chỉ số đồng hồ đợi trong Hộp thư đến dưới dạng giá trị gợi ý để bạn chấp nhận. Mỗi bản nháp đã điền bằng AI kèm một dòng như "Đọc bởi qwen/qwen3.8-27b (Groq) · 2,502 token", với chi phí và ai đã trả.
- **Nhiều đồ vật trong một ảnh** (chế độ Đồ vật; Quản trị → Cài đặt, tắt theo mặc định): cùng một lần gọi đặt tên cho tối đa 12 đồ vật trong ảnh. Cái thứ nhất điền vào bản nháp của bản chụp và giữ ảnh; mỗi cái còn lại trở thành một bản nháp bên cạnh nó, ở cùng vị trí và lô, với ảnh riêng được cắt từ ảnh, để xác nhận, hợp nhất hoặc loại bỏ trong Hộp thư đến. Việc cắt ảnh tốt hay kém phụ thuộc vào các hộp của nhà cung cấp AI, vì vậy hãy kiểm tra một số bản nháp sau khi bật nó.
- **Ảnh phòng** (chế độ Phòng): một lần gọi cho mỗi ảnh liệt kê tối đa 60 đối tượng, và cho một vài ảnh một cuộc gọi chỉ văn bản ngắn gọn để hợp nhất chúng. Các đối tượng trở thành các bản nháp trong phòng, mỗi cái với ảnh riêng của nó ([Ảnh phòng](/vi/users/room-photos/)).
- **Sơ đồ mặt bằng** (bản đồ địa điểm có **Bắt đầu từ một sơ đồ mặt bằng**): một lần gọi cho mỗi sơ đồ, đọc các phòng của nó, các nhãn và kích thước in của chúng; Kept tự tính toán kích thước và vị trí, và bạn kiểm tra chúng trước khi thêm bất cứ cái nào ([bản đồ địa điểm](/vi/users/location-map/#bắt-đầu-từ-một-sơ-đồ-mặt-bằng)).
  Màn hình hiển thị số lượng lớn nhất một lần đọc có thể lấy trước khi gửi: khoảng 11,000 token trên Groq, một ước tính.
- **Trợ lý** trả lời từ kho hàng của bạn trong vai trò của bạn, và mỗi công cụ nó sử dụng thêm một cuộc gọi. Những thay đổi nó đề xuất hiện thẻ xác nhận mà bạn phê duyệt; đối với người xem, nó chỉ đọc.
- **Từ tìm kiếm sau khi nhập**: một lần nhập có thể đưa ra **Thêm từ tìm kiếm bằng AI?**, với ước tính token trước ([nhập](/vi/users/import-export/)).

Các trang **Mức sử dụng AI** liệt kê mọi cuộc gọi: **Mức dùng AI của tôi** cho mọi người, việc sử dụng của một địa điểm cho quản trị viên và chủ sở hữu của nó, của tài khoản cho chủ sở hữu của nó, và của instance dưới Quản trị → AI. Mỗi trang hiển thị tổng cộng, token theo ngày chồng lên theo nhiệm vụ, phân tích theo nhiệm vụ, người và địa điểm khi chúng liên quan, và danh sách cuộc gọi với **Xuất CSV**. Một cuộc gọi ghi lại mô hình, token, kết quả và chi phí của nó, không bao giờ lời nhắc, ảnh, câu trả lời hoặc khóa.

Giá cả đến từ **bảng giá**, được quản trị viên instance chỉnh sửa trong Quản trị → AI (với **Điền từ … danh sách** cho những nhà cung cấp AI công bố giá cả). Giá của mô hình Groq được khuyên dùng đã được điền sẵn cho bạn. Một cuộc gọi không có giá được tính theo token và hiển thị là chi phí không xác định.

## Giới hạn và tạm dừng

Không có gì bị giới hạn bởi tiền trừ khi ai đó chọn: sau khóa đầu tiên Kept đề xuất **Thiết lập giới hạn hàng tháng?** với một số tiền được gợi ý, và **Không giới hạn**. Dưới Nâng cao, Giới hạn chứa:

- **Tiền mỗi tháng** (trong một loại tiền tệ mà máy chủ đã bật) và **Token mỗi tháng**, cho tài khoản; giới hạn riêng của một địa điểm bên trong tài khoản, do chủ sở hữu đặt; và một giới hạn cho mỗi người.
- Việc đọc ảnh và hóa đơn có ngân sách token 60,000 token mỗi phút, 2,000,000 mỗi ngày và 20,000,000 mỗi tháng cho mỗi tài khoản trả phí trừ khi được thay đổi.
- **Tạm dừng AI** dừng mọi cuộc gọi theo cách thủ công cho đến khi bạn tiếp tục.

Khi một giới hạn được đạt đến, AI tạm dừng cho phạm vi đó mà thôi, với một banner như "AI đã tạm dừng đến 1 Tháng mười · Giới hạn hàng tháng của Trang chủ đã đạt". Các bản chụp vẫn lưu; đặt tên chờ đợi, và tiếp tục khi AI tiếp tục. Ai đặt giới hạn sẽ nhận **Tiếp tục ngay**, để nâng nó, xoá nó hoặc giữ tạm dừng. Giới hạn tốc độ riêng của một nhà cung cấp AI không phải là tạm dừng: các dòng tiến độ nói "Đang chờ Groq · khoảng 20 giây" và tiếp tục.

**Một yêu cầu trợ lý được giữ dưới giới hạn mỗi phút của nhà cung cấp AI** sau khi nhà cung cấp AI đã xác định nó (mức miễn phí của Groq: 8,000 token mỗi phút). Mỗi yêu cầu mang theo các công cụ mà câu hỏi liên quan đến: tìm kiếm đồ vật và các thay đổi hàng ngày luôn, và cho mượn, lịch trình, bảo hành, tài liệu, xe cộ, hàng tồn kho, lịch sử hoặc các vị trí khi câu hỏi (hoặc những tin nhắn cuối cùng trong luồng) đặt tên chúng, ở bất kỳ ngôn ngữ nào của Kept; một công cụ mà mô hình yêu cầu nhưng chưa được gửi được gửi ở bước tiếp theo. Một câu hỏi đầu tiên với mọi module bật lên khoảng 3,100 token trước mức cho phép của câu trả lời. Nếu một yêu cầu vẫn quá lớn, Kept gửi ít công cụ hơn, sau đó hỏi một câu trả lời ngắn hơn, sau đó loại bỏ các kết quả công cụ lâu nhất khỏi những gì nó gửi; luồng giữ chúng. Một câu hỏi vẫn không vừa vào thất bại với "quá lớn": một mô hình hoặc gói có giới hạn cao hơn trả lời nó.

## Gì được gửi đến nhà cung cấp AI

Tóm tắt riêng của Kept, hiển thị bên cạnh mỗi nhà cung cấp AI:

> Chỉ một bản sao của ảnh với dữ liệu vị trí và máy ảnh bị xóa, không bao giờ là bản gốc. Các hướng dẫn cố định và ngôn ngữ của địa điểm của bạn. Với trợ lý, câu hỏi của bạn và kho hàng nó tra cứu, trong vai trò của bạn. Không bao giờ các trường bí mật.

Một sơ đồ mặt bằng gửi cùng loại bản sao (trang đầu tiên của một PDF được vẽ thành một hình, với văn bản của trang đó) và không có tên địa điểm, phòng hoặc tầng của bạn; văn bản riêng của sơ đồ được gửi dưới dạng dữ liệu, và không gì Kept giữ lại từ câu trả lời là một tên, một địa chỉ hoặc một số từ sơ đồ ngoài các nhãn và kích thước của các phòng của nó.

Dưới nó, Kept tóm tắt những gì nhà cung cấp AI nói nó làm với dữ liệu API (huấn luyện, lưu giữ) và liên kết đến chính sách của nó. Một máy chủ bạn tự chạy giữ những gì bạn cho phép nó giữ.

## Tìm kiếm và nhúng

Tìm kiếm bằng từ khóa luôn hoạt động, bao gồm các từ tìm kiếm AI thêm vào đồ vật trong mỗi ngôn ngữ của địa điểm. Tìm kiếm theo ý nghĩa cần một mô hình nhúng, đến từ một trong ba nơi, do quản trị viên của máy chủ đặt với `KEPT_EMBEDDINGS` ([cấu hình](/vi/reference/configuration/)):

- `provider` (mặc định): nhà cung cấp AI của địa điểm, khi nó có một mô hình nhúng (OpenAI, Google, OpenRouter, hoặc một máy chủ Tương thích OpenAI). Chọn một cái dưới **Nâng cao → Mô hình → Tìm kiếm**; OpenRouter không có mặc định, và liệt kê các miễn phí. Groq và Anthropic không có, nên với những cái này, tìm kiếm chỉ theo từ khóa và sẽ nói vậy. Một khóa xa hơn trong chuỗi với một mô hình Tìm kiếm (của máy chủ này) bao quát một địa điểm mà khóa riêng của nó không có.

- Khi một khóa có mô hình trợ lý nhưng không có mô hình Tìm kiếm, và không có gì xa hơn trong chuỗi cung cấp một cái, Cài đặt → AI nói **Tìm kiếm chỉ khớp theo tên**, với bước: **Chọn mô hình tìm kiếm**, hoặc đối với Groq và Anthropic **Chọn nhà cung cấp khác**. Quản trị → Trạng thái → Nhúng tìm kiếm đếm các địa điểm tìm kiếm chỉ theo tên, không chỉ ra tên chúng.

- Kept yêu cầu OpenAI và Google các vectơ 768 số. Các mô hình khác trả lời độ dài của chính chúng, phải 2,000 hoặc ít hơn: một mô hình với vectơ dài hơn không thể được dùng cho tìm kiếm. Một yêu cầu trở về với vectơ của độ dài khác so với yêu cầu, hoặc hai độ dài, bị từ chối và không có gì được lưu trữ.

- `local`: một mô hình nhỏ bên trong Kept, không có khóa và không có chi phí mỗi lần gọi. Kept từ chối cài đặt này trừ khi thời gian chạy của mô hình cục bộ được cài đặt.

- `off`: chỉ tìm kiếm bằng từ khóa.

## Mô hình cục bộ với Ollama

Để giữ tất cả trên phần cứng của riêng bạn, hãy chạy một mô hình với Ollama và thêm nó như một nhà cung cấp AI **Tương thích OpenAI** với URL cơ sở của nó; Kept không điền gì đối với loại này, vì vậy bạn đặt tên các mô hình. Một địa chỉ trên mạng riêng của bạn phải được phép bởi một quản trị viên instance trong Quản trị → Cài đặt trước. Cài đặt, bộ nhớ và hồ sơ Compose: [Ollama](/vi/admin/ollama/).

## Tắt AI

- **Dành cho một địa điểm:** **Cài đặt địa điểm → Theo dõi gì**, dưới **AI trong địa điểm này**, tắt **Chụp bằng AI và trợ lý**. Chụp vẫn hoạt động; đồ vật đợi trong Hộp thư đến để có một tên.
- **Trong một thời gian:** **Tạm dừng AI**, dưới Nâng cao.
- **Không kết nối nào:** khi không có khóa ở bất kỳ cấp độ nào, không có gì được gửi, và bước **Kết nối một nhà cung cấp AI** của danh sách kiểm tra có thể được bỏ qua.

Trang AI không có nút để xóa một khóa đã lưu; hãy thay nó, tạm dừng, hoặc tắt AI cho mỗi địa điểm.

:::note[ChatGPT hoặc Claude làm ứng dụng khách]
"Kết nối ChatGPT hoặc Claude" (cài đặt Đầy đủ) hoạt động theo hướng ngược lại: ứng dụng AI của bạn đọc và cập nhật Kept qua MCP, sử dụng mô hình và đăng ký của riêng nó, với một mã bạn tạo trong **Cài đặt → Kết nối**. Xem [kết nối ứng dụng AI](/vi/users/mcp-clients/) và, để biết chi tiết, [MCP](/vi/developers/mcp/).
:::
