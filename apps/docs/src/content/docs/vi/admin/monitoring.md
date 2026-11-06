---
title: Prometheus và Grafana
description: "Thu thập /metrics của Kept bằng Prometheus, vẽ biểu đồ trong Grafana và cảnh báo về các sao lưu, đĩa và khởi động lại."
---

Một hướng dẫn để theo dõi Kept với Prometheus và Grafana. Chính các chỉ số này, các kiểm tra sức
khỏe, nhật ký và theo dõi là trên [Giám sát](/vi/admin/observability/).

## 1. Bật `/metrics`

Tạo một token trong shell:

```sh
openssl rand -hex 32
```

và dán giá trị vào `.env` cạnh `compose.yaml`:

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` được đọc như đang có, nên `$(openssl …)` ở đó sẽ được giữ nguyên. Sau đó áp dụng nó:

```sh
docker compose up -d
```

Compose truyền biến đó tới Kept. Thiếu nó, `/metrics` không tồn tại. Kiểm tra nó có trả lời:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

Trên Kubernetes, đặt `KEPT_METRICS_TOKEN` trong một Secret và đặt tên của nó trong
`metrics.tokenSecret` của chart ([Kubernetes](/vi/install/kubernetes/)).

## 2. Thu thập

Lưu token vào một file mà Prometheus có thể đọc, như `/etc/prometheus/kept-token`, và thêm một job:

```yaml
scrape_configs:
  - job_name: kept
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kept-token
    static_configs:
      - targets: ['kept:8080']
```

`kept:8080` là dịch vụ của Kept trong mạng lưới Compose; từ nơi khác, hãy dùng địa chỉ và cổng mà
Prometheus có thể kết nối tới Kept. Khởi động lại Prometheus: trang targets của nó nên báo `kept`
là đang hoạt động.

## 3. Cần theo dõi

| Chỉ số | Cần theo dõi |
|---|---|
| `kept_process_uptime_seconds` | Khi tiến trình khởi động lại, dùng một số nhỏ |
| `kept_process_resident_memory_bytes` | Tăng tới giới hạn bộ nhớ của container |
| `kept_db_pool_connections{state="waiting"}` | Trên 0 trong hơn một phút: các yêu cầu đang chờ cơ sở dữ liệu |
| `kept_backup_last_success_timestamp_seconds` | Cũ hơn 36 giờ (0 nghĩa là chưa có sao lưu tốt nào) |
| `kept_backup_last_run_status{status="failed"}` | 1: sao lưu lần cuối thất bại |
| `kept_disk_used_ratio{volume="data"}` | Trên 0.85 |
| `kept_update_available` | 1: có bản phát hành mới hơn. Giữ nguyên 0 trừ khi kiểm tra cập nhật đang bật ([nâng cấp](/vi/admin/upgrades/)) |

Các số liệu về sao lưu và đĩa được lấy từ một kiểm tra hàng giờ, nên chúng có thể trễ tới một giờ.

## 4. Grafana

Một bảng điều khiển có một bảng con cho mỗi hàng:

- **Stat**: `kept_build_info`, theo nhãn `version`.
- **Time series**: `kept_process_uptime_seconds` và `kept_process_resident_memory_bytes`.
- **Time series**: `kept_db_pool_connections`, theo `pool` và `state`.
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds`, độ tuổi của sao lưu tính theo giây.
- **Stat**: `kept_backup_last_run_status`, theo `status`.
- **Gauge**: `kept_disk_used_ratio{volume="data"}`, từ 0 đến 1.

## 5. Cảnh báo

```yaml
groups:
  - name: kept
    rules:
      - alert: KeptDown
        expr: up{job="kept"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: Kept is down

      - alert: KeptBackupStale
        expr: >-
          kept_backup_last_success_timestamp_seconds > 0
          and time() - kept_backup_last_success_timestamp_seconds > 36 * 3600
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Kept's last good backup is more than 36 hours old

      - alert: KeptBackupFailed
        expr: kept_backup_last_run_status{status="failed"} == 1
        labels:
          severity: critical
        annotations:
          summary: Kept's last backup failed

      - alert: KeptDiskFilling
        expr: kept_disk_used_ratio{volume="data"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Kept's data disk is over 85% full

      - alert: KeptUpdateAvailable
        expr: kept_update_available == 1
        for: 1h
        labels:
          severity: info
        annotations:
          summary: A new Kept release is available
```

36 giờ và 85% khớp với các cảnh báo quản trị của Kept
([theo dõi sao lưu](/vi/admin/backups/#giám-sát)). Quy tắc sao lưu cũ (`> 0`) được giữ yên trên
một Kept chưa tạo sao lưu đầu tiên: cho đến khi đó, chỉ số là 0.

## Liên quan

- [Giám sát](/vi/admin/observability/): các kiểm tra sức khỏe, chỉ số, nhật ký, theo dõi và báo lỗi.
- [Sao lưu](/vi/admin/backups/) để bật các sao lưu.
- [Khắc phục sự cố](/vi/admin/troubleshooting/) khi có cảnh báo.
