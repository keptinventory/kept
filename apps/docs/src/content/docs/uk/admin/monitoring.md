---
title: Prometheus and Grafana
description: "Збирайте /metrics Kept через Prometheus, створюйте графіки в Grafana та отримуйте сповіщення про резервні копії, диск і перезапуски."
---

Посібник зі спостереження за Kept за допомогою Prometheus і Grafана. Самі метрики, перевірки стану,
логи та трасування — на [Моніторинг](/uk/admin/observability/).

## 1. Увімкніть `/metrics`

Створіть токен у терміналі:

```sh
openssl rand -hex 32
```

і вставте значення у `.env` поруч із `compose.yaml`:

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` читається як є, тому `$(openssl …)` там сприйматиметься буквально. Потім застосуйте його:

```sh
docker compose up -d
```

Compose передає змінну до Kept. Без неї `/metrics` не існує. Перевірте, чи відповідає:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

У Kubernetes покладіть `KEPT_METRICS_TOKEN` у Secret і назвіть його в `metrics.tokenSecret` чарта ([Kubernetes](/uk/install/kubernetes/)).

## 2. Збирайте його

Збережіть токен у файлі, який може прочитати Prometheus, наприклад `/etc/prometheus/kept-token`, і додайте завдання:

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

`kept:8080` — сервіс Kept у мережі Compose; з інших місць використовуйте адресу та порт, за якими Prometheus доходить до Kept. Перезавантажте Prometheus: сторінка цілей має показати `kept` як доступний.

## 3. За чим слідкувати

| Метрика | За чим слідкувати |
|---|---|
| `kept_process_uptime_seconds` | Повертається до малого числа при перезапуску процесу |
| `kept_process_resident_memory_bytes` | Зростання до ліміту пам'яті контейнера |
| `kept_db_pool_connections{state="waiting"}` | Понад 0 більше ніж хвилину: запити очікують на базу даних |
| `kept_backup_last_success_timestamp_seconds` | Старіше 36 годин (0 означає, що ще немає успішної резервної копії) |
| `kept_backup_last_run_status{status="failed"}` | 1: останнє резервне копіювання не вдалося |
| `kept_disk_used_ratio{volume="data"}` | Понад 0.85 |
| `kept_update_available` | 1: доступний новий реліз. Залишається 0, якщо перевірка оновлень не увімкнена ([оновлення](/uk/admin/upgrades/)) |

Дані про резервні копії та диск надходять з перевірки раз на годину, тому можуть бути застарілими на годину.

## 4. Grafana

На інформаційній панелі кожен рядок — окрема панель:

- **Статистика**: `kept_build_info`, за міткою `version`.
- **Часовий ряд**: `kept_process_uptime_seconds` і `kept_process_resident_memory_bytes`.
- **Часовий ряд**: `kept_db_pool_connections`, за `pool` і `state`.
- **Статистика**: `time() - kept_backup_last_success_timestamp_seconds`, вік резервної копії в секундах.
- **Статистика**: `kept_backup_last_run_status`, за `status`.
- **Шкала**: `kept_disk_used_ratio{volume="data"}`, від 0 до 1.

## 5. Сповіщення

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

36 годин і 85% збігаються з власними адміністративними сповіщеннями Kept ([спостереження за резервними копіями](/uk/admin/backups/#спостереження)). `> 0` не дає правилу про застарілу резервну копію спрацьовувати на Kept, який ще не робив першої резервної копії: метрика дорівнює 0 до тих пір.

## Related

- [Моніторинг](/uk/admin/observability/): перевірки стану, метрики, логи, трасування та повідомлення про помилки.
- [Резервні копії](/uk/admin/backups/) для увімкнення резервного копіювання.
- [Усунення неполадок](/uk/admin/troubleshooting/) коли спрацьовує сповіщення.
