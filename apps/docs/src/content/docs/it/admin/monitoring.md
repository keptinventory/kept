---
title: Prometheus e Grafana
description: Raccogli /metrics di Kept con Prometheus, visualizzalo in Grafana e ricevi avvisi su backup, disco e riavvi.
---

Una guida per monitorare Kept con Prometheus e Grafana. Le metriche stesse, i controlli di stato, i log e il tracing sono in [Monitoring](/it/admin/observability/).

## 1. Attiva `/metrics`

Crea un token in una shell:

```sh
openssl rand -hex 32
```

e incolla il valore in `.env` accanto a `compose.yaml`:

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` viene letto così com'è, quindi `$(openssl …)` lì verrebbe preso letteralmente. Poi applicalo:

```sh
docker compose up -d
```

Compose passa la variabile a Kept. Senza di essa, `/metrics` non esiste. Verifica che risponda:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

Su Kubernetes, metti `KEPT_METRICS_TOKEN` in un Secret e nominalo nel chart con `metrics.tokenSecret` ([Kubernetes](/it/install/kubernetes/)).

## 2. Esegui lo scraping

Salva il token in un file leggibile da Prometheus, ad esempio `/etc/prometheus/kept-token`, e aggiungi un job:

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

`kept:8080` è il servizio di Kept sulla rete Compose; da altrove, usa l'indirizzo e la porta con cui Prometheus raggiunge Kept. Ricarica Prometheus: la sua pagina dei target dovrebbe mostrare `kept` come attivo.

## 3. Cosa monitorare

| Metrica | Osserva |
|---|---|
| `kept_process_uptime_seconds` | Torna a un numero piccolo quando il processo si riavvia |
| `kept_process_resident_memory_bytes` | Crescita verso il limite di memoria del contenitore |
| `kept_db_pool_connections{state="waiting"}` | Sopra 0 per più di un minuto: richieste in attesa del database |
| `kept_backup_last_success_timestamp_seconds` | Più vecchio di 36 ore (0 significa che non c'è ancora un backup valido) |
| `kept_backup_last_run_status{status="failed"}` | 1: l'ultimo backup è fallito |
| `kept_disk_used_ratio{volume="data"}` | Sopra 0.85 |
| `kept_update_available` | 1: è disponibile una versione più recente. Resta 0 a meno che il controllo aggiornamenti non sia attivo ([aggiornamenti](/it/admin/upgrades/)) |

I dati di backup e disco provengono da un controllo orario, quindi possono essere vecchi fino a un'ora.

## 4. Grafana

Una dashboard con un pannello per riga:

- **Stat**: `kept_build_info`, per la sua etichetta `version`.
- **Time series**: `kept_process_uptime_seconds` e `kept_process_resident_memory_bytes`.
- **Time series**: `kept_db_pool_connections`, per `pool` e `state`.
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds`, l'età del backup in secondi.
- **Stat**: `kept_backup_last_run_status`, per `status`.
- **Gauge**: `kept_disk_used_ratio{volume="data"}`, da 0 a 1.

## 5. Avvisi

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

Le 36 ore e l'85% coincidono con gli avvisi amministrativi di Kept ([controllo backup](/it/admin/backups/#monitorarlo)). Il `> 0` tiene silenziosa la regola di backup obsoleto su un Kept che non ha ancora fatto il primo backup: la metrica è 0 fino ad allora.

## Correlati

- [Monitoring](/it/admin/observability/): controlli di stato, metriche, log, tracing e segnalazione errori.
- [Backup](/it/admin/backups/) per attivare i backup.
- [Risoluzione dei problemi](/it/admin/troubleshooting/) quando scatta un avviso.
