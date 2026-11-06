---
title: Prometheus und Grafana
description: "Kept's /metrics mit Prometheus abrufen, in Grafana visualisieren und bei Backups, Festplatte und Neustarts alarmieren."
---

Eine Anleitung, um Kept mit Prometheus und Grafana zu überwachen. Die Metriken selbst, die Gesundheitsprüfungen, Logs und Tracing findest du unter [Monitoring](/de/admin/observability/).

## 1. `/metrics` aktivieren

Erstelle ein Token in einer Shell:

```sh
openssl rand -hex 32
```

und füge den Wert in `.env` neben `compose.yaml` ein:

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` wird so gelesen, wie es ist, daher wird `$(openssl …)` dort wörtlich genommen. Wende es dann an:

```sh
docker compose up -d
```

Compose übergibt die Variable an Kept. Ohne sie existiert `/metrics` nicht. Prüfe, ob es antwortet:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

Auf Kubernetes füge `KEPT_METRICS_TOKEN` in ein Secret ein und nenne es im Chart unter `metrics.tokenSecret` ([Kubernetes](/de/install/kubernetes/)).

## 2. Abrufen

Speichere das Token in einer Datei, die Prometheus lesen kann, zum Beispiel `/etc/prometheus/kept-token`, und füge einen Job hinzu:

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

`kept:8080` ist Kepts Dienst im Compose-Netzwerk; von anderswo aus verwende die Adresse und den Port, unter denen Prometheus Kept erreicht. Lade Prometheus neu: seine Targets-Seite sollte `kept` als aktiv anzeigen.

## 3. Worauf du achten solltest

| Metrik | Achte auf |
|---|---|
| `kept_process_uptime_seconds` | Springt auf eine kleine Zahl zurück, wenn der Prozess neu startet |
| `kept_process_resident_memory_bytes` | Wachstum in Richtung des Speicherlimits des Containers |
| `kept_db_pool_connections{state="waiting"}` | Über 0 länger als eine Minute: Anfragen warten auf die Datenbank |
| `kept_backup_last_success_timestamp_seconds` | Älter als 36 Stunden (0 bedeutet noch kein erfolgreiches Backup) |
| `kept_backup_last_run_status{status="failed"}` | 1: das letzte Backup ist fehlgeschlagen |
| `kept_disk_used_ratio{volume="data"}` | Über 0.85 |
| `kept_update_available` | 1: eine neuere Version. Bleibt bei 0, es sei denn, die Updateprüfung ist aktiv ([Upgrades](/de/admin/upgrades/)) |

Die Backup- und Festplattenwerte stammen von einer stündlichen Prüfung und können bis zu einer Stunde alt sein.

## 4. Grafana

Ein Dashboard mit einem Panel pro Zeile:

- **Stat**: `kept_build_info`, nach dem Label `version`.
- **Time series**: `kept_process_uptime_seconds` und `kept_process_resident_memory_bytes`.
- **Time series**: `kept_db_pool_connections`, nach `pool` und `state`.
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds`, das Alter des Backups in Sekunden.
- **Stat**: `kept_backup_last_run_status`, nach `status`.
- **Gauge**: `kept_disk_used_ratio{volume="data"}`, von 0 bis 1.

## 5. Warnungen

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

Die 36 Stunden und 85 % stimmen mit Kepts eigenen Admin-Warnungen überein ([Backups beobachten](/de/admin/backups/#überwachung)). Die Regel `> 0` hält die Warnung für veraltete Backups bei einem Kept ohne erstes Backup still: der Wert ist 0 bis dahin.

## Weiterführende Links

- [Monitoring](/de/admin/observability/): Gesundheitsprüfungen, Metriken, Logs, Tracing und Fehlerberichterstattung.
- [Backups](/de/admin/backups/) zum Aktivieren von Backups.
- [Fehlersuche](/de/admin/troubleshooting/) wenn eine Warnung ausgelöst wird.
