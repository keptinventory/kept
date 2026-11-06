---
title: Giám sát
description: "Kiểm tra sức khỏe, trang trạng thái, cảnh báo, chỉ số, nhật ký, và theo dõi và báo cáo lỗi tùy chọn."
sidebar:
  order: 12
---

Kept không gửi thông tin gì về chính nó đến đâu cả trừ khi bạn thiết lập: **không có kỹ thuật điều khiển từ xa (telemetry) nào**, ngay cả số lượng cài đặt chọn tham gia (opt-in) cũng không có.

## Kiểm tra sức khỏe

| Đường dẫn | Phản hồi |
|---|---|
| `/healthz` | 200 trong khi tiến trình phục vụ HTTP. Dùng cho kiểm tra liveness. |
| `/readyz` | 200 khi cả hai kết nối cơ sở dữ liệu của web đều phản hồi, ngược lại 503. Dùng cho readiness, và `HEALTHCHECK` riêng của image. |
| `/version` | phiên bản, commit nó được xây dựng từ, kho nguồn, và nơi các thông báo của bên thứ ba ở (`/notices.txt`, trong image). |

Một container chỉ chạy worker (`KEPT_ROLE=worker`) không phục vụ HTTP. `HEALTHCHECK` của image tuân theo `KEPT_ROLE`: với worker nó kiểm tra rằng vòng lặp công việc đã thăm dò cơ sở dữ liệu trong hai phút qua (nó chạm vào `/tmp/kept-worker-alive` khi chạy), vì vậy triển khai tách biệt không cần ghi đè healthcheck.

## Trang trạng thái và cảnh báo

**Quản trị → Trạng thái** hiển thị những gì cần chú ý: bộ khôi phục, thư, các công việc nền thất bại, quét nhắc nhở, và sao lưu: tuổi của bản sao lưu, lần khoan khôi phục gần nhất, phiên bản bucket, dung lượng đĩa, bản phát hành và các migration của nó, kiểm tra cập nhật, HTTPS và các bộ nối. Cảnh báo quản trị đến quản trị viên thể hiện trong ứng dụng, qua thư và đẩy (push); mỗi cái được giải quyết khi nguyên nhân của nó biến mất.

## Chỉ số

Đặt `KEPT_METRICS_TOKEN` và `/metrics` phục vụ văn bản Prometheus cho các yêu cầu gửi nó dưới dạng bearer token (`Authorization: Bearer <token>`); không có biến này, đường dẫn không tồn tại. Compose chuyển biến này từ `.env`.

| Chỉ số | Ý nghĩa |
|---|---|
| `kept_build_info{version, revision}` | luôn là 1; bản dựng đang chạy |
| `kept_process_uptime_seconds` | giây kể từ khi tiến trình bắt đầu |
| `kept_process_resident_memory_bytes` | bộ nhớ của tiến trình |
| `kept_db_pool_connections{pool, state}` | kết nối cho mỗi pool cơ sở dữ liệu: tổng, rảnh, chờ |
| `kept_backup_last_success_timestamp_seconds` | khi bản sao lưu tốt gần nhất kết thúc (0 trước lần đầu) |
| `kept_backup_last_run_status{status}` | 1 cho trạng thái của lần chạy kết thúc gần nhất, 0 cho các cái khác |
| `kept_disk_used_ratio{volume}` | mức đầy của ổ dữ liệu và mục tiêu sao lưu thư mục |
| `kept_update_available` | 1 khi kiểm tra cập nhật thấy bản phát hành mới hơn |

Không nhãn nào bao giờ giữ đường dẫn hoặc mục tiêu. Cơ sở dữ liệu không trả lời được để các dòng sao lưu, đĩa và cập nhật bên ngoài; việc thu thập (scrape) chính nó vẫn thành công.

## Nhật ký

Các dòng JSON trên đầu ra chuẩn (`KEPT_LOG_FORMAT=json`, mặc định), hoặc `pretty` để đọc `docker compose logs` bằng mắt; `KEPT_LOG_LEVEL` đặt mức độ. Mọi yêu cầu có một id, được gửi lại trong tiêu đề phản hồi `x-request-id`, để báo cáo có thể khớp với dòng nhật ký của nó. Token trong URL bị che giấu khỏi nhật ký, và bí mật cùng mật khẩu không bao giờ được ghi nhật ký.

## Theo dõi và báo cáo lỗi

Cả hai đều tùy chọn và tắt mặc định.

- **Theo dõi:** với `OTEL_EXPORTER_OTLP_ENDPOINT` được đặt, Kept gửi các trace OpenTelemetry của yêu cầu HTTP và truy vấn cơ sở dữ liệu của nó đến bộ thu thập của bạn. Không đặt, không một mã theo dõi nào thậm chí được tải, và bộ thu thập bị ngừng không bao giờ làm chậm yêu cầu.
- **Báo cáo lỗi:** với DSN tương thích Sentry trong `KEPT_ERROR_DSN`, các lỗi không được xử lý được báo cáo kèm id yêu cầu và route, và không bao gồm thân yêu cầu, tiêu đề, chuỗi truy vấn, tên hoặc bất cứ thứ gì được lưu trong một địa điểm.
