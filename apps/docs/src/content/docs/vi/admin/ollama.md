---
title: "AI cục bộ với Ollama"
description: "Chạy mô hình AI trên máy của bạn với hồ sơ Ollama trong compose.full.yaml, và chi phí bộ nhớ của nó."
sidebar:
  order: 10
---

Các tính năng AI của Kept (điền thông tin đồ vật từ ảnh và hóa đơn, trợ lý, tìm kiếm ngữ nghĩa)
hoạt động với bất kỳ nhà cung cấp nào mà chủ sở hữu vị trí kết nối trong **Cài đặt → AI**. Ollama chạy mô hình
trên phần cứng của bạn, nên không có gì rời khỏi nó; Kept giao tiếp với nó như một nhà cung cấp **Tương thích OpenAI**.

:::caution[Chưa được kiểm tra]
Ollama chưa được đo lường với Kept. Một mô hình chia sẻ bộ nhớ của máy với Kept, vì vậy hãy dự trữ
nhiều hơn [1 GB Kept đã được kiểm tra](/vi/install/hardware/), và hãy kỳ vọng một mô hình nhỏ sẽ chậm hơn
và kém chính xác hơn một mô hình lưu trữ khi đọc hóa đơn.
:::

## Thiết lập

1. Ollama đi kèm với `compose.full.yaml`, không phải `compose.yaml`: tải xuống và đặt
   `COMPOSE_FILE=compose.full.yaml` trong `.env` ([Caddy và Ollama](/vi/install/compose/#caddy-và-ollama)).
   Khởi động Kept với hồ sơ `ollama`, sau đó kéo một mô hình vào nó bằng lệnh của Ollama:

   ```sh
   docker compose --profile ollama up -d
   docker compose exec ollama ollama pull <model>
   ```

   Các mô hình nằm trong volume `ollama`. Không có gì được xuất bản trên máy chủ: chỉ Kept, trên
   mạng của Compose, mới truy cập được Ollama. Hình ảnh khoảng 3,8 GB (amd64) hoặc 2,8 GB (arm64) trước
   khi có bất kỳ mô hình nào.

2. **Cho phép địa chỉ riêng tư.** `http://ollama:11434` nằm trên mạng riêng của Compose, một địa chỉ
   riêng tư, và Kept từ chối những địa chỉ đó theo mặc định ([yêu cầu đi ra](/vi/admin/security-model/#yêu-cầu-đi-ra-ssrf)).
   Quản trị viên thể hiện bật **Quản trị → Cài đặt → Cho phép địa chỉ riêng tư** trước; nếu không,
   thêm nhà cung cấp sẽ nói "Địa chỉ đó nằm trên mạng riêng". Tương tự với Ollama
   (hoặc LM Studio) ở nơi khác trên mạng nhà của bạn.

3. Trong **Cài đặt → AI**, thêm một nhà cung cấp **Tương thích OpenAI** với URL cơ sở
   `http://ollama:11434/v1` và mô hình bạn đã kéo. Ollama bỏ qua khóa API, vì vậy bất kỳ giá trị nào
   cũng được.
