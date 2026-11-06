---
title: "Cần gì"
description: "Kept được kiểm tra trên gì, bộ nhớ nó dùng, và điều gì làm nó cần nhiều hơn."
sidebar:
  order: 6
---

**Đã kiểm tra: 1 GB RAM, một hoặc hai nhân CPU**, với nhà cung cấp AI bên ngoài hoặc không có. Mọi thứ đều vượt qua ở đó, bao gồm bản sao lưu khi tải ảnh lên. 2 GB để dư thừa.

## Những gì đã được kiểm tra

- **Phiên bản:** các thay đổi của Kept 1.14.3 (bản dựng trước phát hành), `compose.yaml` như đã xuất bản (Kept, Postgres 18 với pgvector). 1.14.2 cần 2 GB cho bản sao lưu của nó.
- **Máy:** mô phỏng trong Docker trên Mac arm64. Docker, Kept và Postgres chia sẻ một ngân sách bộ nhớ và CPU, như trên một VM nhỏ, với 128 MB dành riêng cho hệ điều hành. Không có swap.
- **Dữ liệu:** một hộ gia đình, cộng thêm một địa điểm có 3.000 đồ vật trong 206 vị trí và 200 chứa, và 300 ảnh thực tế.
- **Công việc:** 20 ảnh 12 megapixel, hai PDF, 120 lần tải bản đồ và đồ thị của địa điểm đó, 120 lần đọc danh sách và tìm kiếm, `kept admin backup` trong khi ảnh tải lên, bản sao lưu theo lịch trình, sau đó 10 phút nhàn rỗi.

| Máy | Ảnh, bản đồ, tìm kiếm, PDF | Sao lưu khi tải lên | Bản sao lưu theo lịch trình | Đỉnh |
|---|---|---|---|---|
| 1 GB, 2 nhân (3 lần chạy) | vượt qua | vượt qua | vượt qua | 730–745 MB |
| 1 GB, 1 nhân | vượt qua | vượt qua | vượt qua | 740 MB |
| 768 MB, 1 nhân | vượt qua cho đến khi bản sao lưu hết bộ nhớ; 9 lần tải và cả hai PDF thất bại trong khi Kept khởi động lại | hết bộ nhớ | vượt qua một mình (một lần chạy) | — |

Các đỉnh là bộ nhớ không thể trả lại (bộ nhớ cache trang không tính), cho toàn bộ máy, bao gồm Docker. Hết bộ nhớ, hệ thống giết tiến trình của Kept và Docker khởi động lại nó.

- **Khi nhàn rỗi:** sau khi khởi động, Kept khoảng 160 MB và Postgres khoảng 30–70 MB. Khi ảnh đã được thay đổi kích thước, Kept ở mức khoảng 300 MB.
- **Dữ liệu thực tế:** trên máy chủ nhà amd64, Kept 206 MB và Postgres 119 MB (một lần đọc).
- **Tốc độ** (trung vị): một trang danh sách 30–40 ms, một lần tìm kiếm 50–70 ms, một lần tải ảnh 0,3–0,4 giây, bản đồ của địa điểm 3.000 đồ vật 0,4–0,5 giây.
- **Chưa kiểm tra:** một VM thực, amd64 ở các kích thước này, 512 MB, AI cục bộ. Kiểm tra hiệu suất tiếp tục: [#379](https://github.com/keptinventory/kept/issues/379).

## Điều đó có nghĩa gì

- **1 GB, 1 hoặc 2 nhân:** đã kiểm tra, mọi lần chạy đều vượt qua, với khoảng 150 MB dư thừa ở đỉnh.
- **2 GB:** dư thừa, cho các dịch vụ khác bên cạnh Kept.
- **768 MB:** Kept chạy được, và Sao lưu ngay (đường dẫn của bản sao lưu theo lịch trình) cũng chạy được; `kept admin backup` trong khi ảnh tải lên hết bộ nhớ. Không khuyến nghị.

## Raspberry Pi

Chưa kiểm tra trên một cái. Hình ảnh arm64 là cái mà các bài kiểm tra này chạy, nên một Pi với 1 GB hoặc nhiều hơn có thể phù hợp như các hàng 1 GB; kỳ vọng nó sẽ chậm hơn. Không bản phát hành nào được kiểm tra trên Pi.

## Điều gì nặng

- **Bản sao lưu.** `kept admin backup` thêm khoảng 300–400 MB trong khi nó chạy, bản sao lưu theo lịch trình khoảng 150 MB; restic chính nó khoảng 100 MB trong đó. Không trong [ứng dụng Home Assistant](/vi/install/home-assistant/): bản sao lưu của Home Assistant chạy thay vào đó.
- **Thay đổi kích thước ảnh.** Mỗi lần tải lên được thay đổi kích thước khi đến. Dưới 3 GB RAM, hoặc giới hạn vùng chứa dưới 3 GB, Kept thay đổi kích thước từng cái một, ngược lại hai cái (`KEPT_IMAGE_CONCURRENCY` ghi đè nó). Bộ nhớ tăng khoảng 150 MB qua những ảnh đầu tiên và ở lại đó.
- **Bản đồ và đồ thị của một địa điểm rất lớn.** Máy chủ đọc toàn bộ địa điểm cho mỗi lần tải: khoảng 670 KB cho 3.000 đồ vật.
- **Không trên máy chủ:** bản đồ, đồ thị và Lưới được vẽ bởi trình duyệt của bạn và không thêm bộ nhớ máy chủ khi nhàn rỗi; bản đồ và đồ thị chỉ được tải xuống khi mở.
- **AI cục bộ với Ollama.** Một mô hình trên cùng một máy chia sẻ bộ nhớ của nó với Kept và cần nhiều hơn Kept nhiều; xem [Ollama](/vi/admin/ollama/).
- **Ổ đĩa.** Cơ sở dữ liệu nhỏ; tệp mới là cái tăng. Để chỗ cho bản sao lưu trên một ổ khác, và Quản trị → Trạng thái cảnh báo, và quản trị viên được cảnh báo, khi một ổ vượt quá 85 % đầy.

## Postgres

Kept cần PostgreSQL 18 với pgvector. Compose chạy hình ảnh `pgvector/pgvector`, ghim theo digest; cho cơ sở dữ liệu của nhà cung cấp xem [Postgres được quản lý](/vi/install/managed-postgres/).
