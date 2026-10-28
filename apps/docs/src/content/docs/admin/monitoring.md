---
title: Prometheus and Grafana
description: "Scrape Kept's /metrics with Prometheus, chart it in Grafana, and alert on backups, disk and restarts."
---

A walkthrough for watching Kept with Prometheus and Grafana. The metrics themselves, the health
checks, logs and tracing are on [Monitoring](/admin/observability/).

## 1. Turn on `/metrics`

Make a token in a shell:

```sh
openssl rand -hex 32
```

and paste the value into `.env` beside `compose.yaml`:

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` is read as it is, so `$(openssl …)` there would be taken literally. Then apply it:

```sh
docker compose up -d
```

Compose passes the variable to Kept. Without it, `/metrics` doesn't exist. Check it answers:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

On Kubernetes, put `KEPT_METRICS_TOKEN` in a Secret and name it in the chart's
`metrics.tokenSecret` ([Kubernetes](/install/kubernetes/)).

## 2. Scrape it

Save the token in a file Prometheus can read, such as `/etc/prometheus/kept-token`, and add a job:

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

`kept:8080` is Kept's service on the Compose network; from elsewhere, use the address and port
Prometheus reaches Kept at. Reload Prometheus: its targets page should show `kept` as up.

## 3. What to watch

| Metric | Watch for |
|---|---|
| `kept_process_uptime_seconds` | Falls back to a small number when the process restarts |
| `kept_process_resident_memory_bytes` | Growth towards the container's memory limit |
| `kept_db_pool_connections{state="waiting"}` | Above 0 for more than a minute: requests waiting for the database |
| `kept_backup_last_success_timestamp_seconds` | Older than 36 hours (0 means no good backup yet) |
| `kept_backup_last_run_status{status="failed"}` | 1: the last backup failed |
| `kept_disk_used_ratio{volume="data"}` | Above 0.85 |
| `kept_update_available` | 1: a newer release. Stays 0 unless the update check is on ([upgrades](/admin/upgrades/)) |

The backup and disk figures come from an hourly check, so they can be up to an hour old.

## 4. Grafana

A dashboard with a panel per row:

- **Stat**: `kept_build_info`, by its `version` label.
- **Time series**: `kept_process_uptime_seconds` and `kept_process_resident_memory_bytes`.
- **Time series**: `kept_db_pool_connections`, by `pool` and `state`.
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds`, the backup's age in seconds.
- **Stat**: `kept_backup_last_run_status`, by `status`.
- **Gauge**: `kept_disk_used_ratio{volume="data"}`, from 0 to 1.

## 5. Alerts

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

The 36 hours and 85% match Kept's own admin alerts
([watching backups](/admin/backups/#watching-it)). The `> 0` keeps the stale-backup rule quiet on a
Kept that hasn't made its first backup: the metric is 0 until then.

## Related

- [Monitoring](/admin/observability/): health checks, metrics, logs, tracing and error reporting.
- [Backups](/admin/backups/) for turning backups on.
- [Troubleshooting](/admin/troubleshooting/) when an alert fires.
