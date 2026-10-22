---
title: Monitoring setup
description: "Set up Prometheus and Grafana to monitor Kept: scrape /metrics, build dashboards, and alert on what matters."
---

This page walks through setting up external monitoring for Kept using Prometheus and Grafana.
For the metrics Kept exposes, see [monitoring](/admin/observability/).

## Prerequisites

- Kept running with `KEPT_METRICS_TOKEN` set.
- A Prometheus instance that can reach Kept's `/metrics` endpoint.
- Grafana (optional, for dashboards and alerts).

## 1. Expose the metrics endpoint

Set `KEPT_METRICS_TOKEN` in your `.env` or environment:

```sh
KEPT_METRICS_TOKEN=$(openssl rand -hex 32)
```

Restart Kept. The `/metrics` endpoint is now available at
`http://<your-kept-host>:8080/metrics` and requires the token as a bearer:

```sh
curl -H "Authorization: Bearer $KEPT_METRICS_TOKEN" http://localhost:8080/metrics
```

Without the variable, the path doesn't exist.

## 2. Configure Prometheus

Add a scrape job to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: kept
    metrics_path: /metrics
    scheme: http
    bearer_token: <your-KEPT_METRICS_TOKEN>
    static_configs:
      - targets: ['kept:8080']
```

If Kept is behind a reverse proxy, use the proxy's address instead of `kept:8080`.

Reload Prometheus. The targets page should show `kept` as up.

## 3. Key metrics to watch

| Metric | What to watch | Alert when |
|---|---|---|
| `kept_process_uptime_seconds` | Process restarts | Drops to 0 (restart) |
| `kept_process_resident_memory_bytes` | Memory growth | Exceeds 80% of container limit |
| `kept_db_pool_connections{state="waiting"}` | Database pressure | > 0 for more than 1 minute |
| `kept_backup_last_success_timestamp_seconds` | Backup freshness | Older than 25 hours |
| `kept_backup_last_run_status{status="failed"}` | Backup failures | = 1 |
| `kept_disk_used_ratio{volume="data"}` | Disk space | > 0.85 |
| `kept_update_available` | New releases | = 1 |

## 4. Grafana dashboards

Import the following panels:

### Build info
- **Stat**: `kept_build_info` — shows version and revision.

### Uptime and memory
- **Time series**: `kept_process_uptime_seconds` — process uptime.
- **Time series**: `kept_process_resident_memory_bytes` — memory usage.

### Database
- **Time series**: `kept_db_pool_connections` grouped by `pool` and `state` — connection pool health.

### Backups
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds` — seconds since last good backup.
- **Stat**: `kept_backup_last_run_status` — last run's status.

### Disk
- **Gauge**: `kept_disk_used_ratio{volume="data"}` — data disk usage (0–1).

### Updates
- **Stat**: `kept_update_available` — 1 when a newer release exists.

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
        expr: time() - kept_backup_last_success_timestamp_seconds > 86400
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kept backup is older than 24 hours"

      - alert: KeptBackupFailed
        expr: kept_backup_last_run_status{status="failed"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Kept backup failed"

      - alert: KeptDiskFull
        expr: kept_disk_used_ratio{volume="data"} > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kept data disk is over 90% full"

      - alert: KeptUpdateAvailable
        expr: kept_update_available == 1
        for: 1h
        labels:
          severity: info
        annotations:
          summary: "A new Kept release is available"
```

## 6. Logs

Kept writes JSON lines to standard output. Collect them with your log aggregator
(Promtail, Fluent Bit, Vector) and parse the JSON.

Every request has an `x-request-id` response header that matches a log line, so a user's report
can be traced to its log entry. Tokens in URLs are redacted, and secrets and passwords are never
logged.

Set `KEPT_LOG_FORMAT=pretty` for human-readable output during debugging. Set `KEPT_LOG_LEVEL`
to control verbosity (default: `info`).

## 7. Tracing and error reporting

Both are optional and off by default.

- **Tracing**: set `OTEL_EXPORTER_OTLP_ENDPOINT` to your OpenTelemetry collector. Kept sends
  traces of HTTP requests and database queries. Unset, none of the tracing code loads.
- **Error reporting**: set `KEPT_ERROR_DSN` to a Sentry-compatible DSN. Unhandled errors are
  reported with the request id and route, never a request body, header, query string, name or
  anything stored in a location.

## Related

- [Monitoring](/admin/observability/) for the metrics reference and health checks.
- [Backups](/admin/backups/) for backup configuration.
- [Troubleshooting](/admin/troubleshooting/) for common problems.
