---
title: Prometheus and Grafana
description: "Set up Prometheus and Grafana to monitor Kept: scrape /metrics, build dashboards, and alert on what matters."
---

This page walks through setting up external monitoring for Kept using Prometheus and Grafana.
For the metrics Kept exposes, logs, and optional tracing, see [Monitoring](/admin/observability/).

## Prerequisites

- Kept running with `KEPT_METRICS_TOKEN` set.
- A Prometheus instance that can reach Kept's `/metrics` endpoint.
- Grafana (optional, for dashboards and alerts).

## 1. Expose the metrics endpoint

Generate the token in a shell (`.env` doesn't run `$( )` itself):

```sh
openssl rand -hex 32
```

Paste the value into your `.env`:

```
KEPT_METRICS_TOKEN=<pasted value>
```

Then `docker compose up -d` so Kept picks it up. The `/metrics` endpoint is now available at
`http://<your-kept-host>:8080/metrics` and requires the token as a bearer:

```sh
curl -H "Authorization: Bearer $KEPT_METRICS_TOKEN" http://localhost:8080/metrics
```

Without the variable, the path doesn't exist.

## 2. Configure Prometheus

Save the same token value to a file Prometheus can read, then use the `authorization:` block:

```yaml
scrape_configs:
  - job_name: kept
    metrics_path: /metrics
    scheme: http
    authorization:
      type: Bearer
      credentials_file: /path/to/kept_metrics_token
    static_configs:
      - targets: ['kept:8080']
```

If Kept is behind a reverse proxy, use the proxy's address instead of `kept:8080`.

Reload Prometheus. The targets page should show `kept` as up.

## 3. Key metrics to watch

| Metric | What to watch | Alert when |
|---|---|---|
| `kept_process_uptime_seconds` | Process restarts | Resets to a small number (restart) |
| `kept_process_resident_memory_bytes` | Memory growth | Exceeds 80% of container limit |
| `kept_db_pool_connections{state="waiting"}` | Database pressure | > 0 for more than 1 minute |
| `kept_backup_last_success_timestamp_seconds` | Backup freshness | Older than 36 hours, the app's own stale line |
| `kept_backup_last_run_status{status="failed"}` | Backup failures | = 1 |
| `kept_disk_used_ratio{volume="data"}` | Disk space | > 0.85 |
| `kept_update_available` | New releases | = 1; only changes when the update check is on |

## 4. Grafana dashboards

Import the following panels:

### Build info
- **Stat**: `kept_build_info`: shows version and revision.

### Uptime and memory
- **Time series**: `kept_process_uptime_seconds`: process uptime; it resets to a small number
  after a restart, not to 0.
- **Time series**: `kept_process_resident_memory_bytes`: memory usage.

### Database
- **Time series**: `kept_db_pool_connections` grouped by `pool` and `state`: connection pool health.

### Backups
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds`: seconds since last good backup.
- **Stat**: `kept_backup_last_run_status`: last run's status.

### Disk
- **Gauge**: `kept_disk_used_ratio{volume="data"}`: data disk usage (0–1).

### Updates
- **Stat**: `kept_update_available`: 1 when a newer release exists and the update check is
  turned on.

## 5. Alerting rules

Example Prometheus alerting rules:

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
          summary: "Kept is down"

      - alert: KeptBackupStale
        expr: kept_backup_last_success_timestamp_seconds > 0 and time() - kept_backup_last_success_timestamp_seconds > 129600
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kept backup is older than 36 hours"

      - alert: KeptBackupFailed
        expr: kept_backup_last_run_status{status="failed"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Kept backup failed"

      - alert: KeptDiskFull
        expr: kept_disk_used_ratio{volume="data"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kept data disk is over 85% full"

      - alert: KeptUpdateAvailable
        expr: kept_update_available == 1
        for: 1h
        labels:
          severity: info
        annotations:
          summary: "A new Kept release is available"
```

## Related

- [Monitoring](/admin/observability/) for the metrics reference, health checks, logs and tracing.
- [Backups](/admin/backups/) for backup configuration.
- [Troubleshooting](/admin/troubleshooting/) for common problems.
