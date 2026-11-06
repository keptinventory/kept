---
title: Prometheus and Grafana
description: "Haz scraping a /metrics de Kept con Prometheus, haz gráficos en Grafana y alerta sobre copias de seguridad, disco y reinicios."

---

A walkthrough for watching Kept with Prometheus and Grafana. The metrics themselves, the health
checks, logs and tracing are on [Monitoring](/es/admin/observability/).

## 1. Activa `/metrics`

Haz un token en un shell:

```sh
openssl rand -hex 32
```

y pega el valor en `.env` junto a `compose.yaml`:

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` se lee tal cual, así que `$(openssl …)` allí se tomaría literalmente. Luego aplícalo:

```sh
docker compose up -d
```

Compose pasa la variable a Kept. Sin ella, `/metrics` no existe. Comprueba que responde:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

En Kubernetes, pon `KEPT_METRICS_TOKEN` en un Secret y nómbralo en el chart's `metrics.tokenSecret` ([Kubernetes](/es/install/kubernetes/)).

## 2. Haz scraping

Guarda el token en un archivo que Prometheus pueda leer, como `/etc/prometheus/kept-token`, y añade un trabajo:

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

`kept:8080` es el servicio de Kept en la red de Compose. Desde fuera, usa la dirección y el puerto donde Prometheus alcanza Kept. Recarga Prometheus: su página de objetivos debe mostrar `kept` como up.

## 3. Qué vigilar

| Métrica | Para vigilar |
|---|---|
| `kept_process_uptime_seconds` | Vuelve a un número pequeño cuando el proceso se reinicia |
| `kept_process_resident_memory_bytes` | Crecimiento hacia el límite de memoria del contenedor |
| `kept_db_pool_connections{state="waiting"}` | Por encima de 0 por más de un minuto: solicitudes esperando la base de datos |
| `kept_backup_last_success_timestamp_seconds` | Mayor a 36 horas (0 significa que aún no hay una buena copia de seguridad) |
| `kept_backup_last_run_status{status="failed"}` | 1: la última copia de seguridad falló |
| `kept_disk_used_ratio{volume="data"}` | Por encima de 0.85 |
| `kept_update_available` | 1: una versión nueva. Se mantiene en 0 a menos que la comprobación de actualizaciones esté activada ([actualizaciones](/es/admin/upgrades/)) |

Las copias de seguridad y las figuras de disco provienen de una revisión cada hora, por lo que pueden tener hasta una hora de antigüedad.

## 4. Grafana

Un panel de control con un panel por fila:

- **Stat**: `kept_build_info`, por su etiqueta `version`.
- **Time series**: `kept_process_uptime_seconds` y `kept_process_resident_memory_bytes`.
- **Time series**: `kept_db_pool_connections`, por `pool` y `state`.
- **Stat**: `time() - kept_backup_last_success_timestamp_seconds`, la edad del backup en segundos.
- **Stat**: `kept_backup_last_run_status`, por `status`.
- **Gauge**: `kept_disk_used_ratio{volume="data"}`, de 0 a 1.

## 5. Alertas

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

Las 36 horas y el 85% coinciden con las alertas administrativas de Kept ([viendo copias de seguridad](/es/admin/backups/#supervisarlo)). El `> 0` mantiene la regla de copia de seguridad estancada en un Kept que no ha hecho su primera copia de seguridad: la métrica es 0 hasta entonces.

## Related

- [Monitoreo](/es/admin/observability/): revisiones de salud, métricas, logs, rastreo y informes.
- [Copias de seguridad](/es/admin/backups/) para activar copias de seguridad.
- [Depuración](/es/admin/troubleshooting/) cuando se dispara una alerta.
