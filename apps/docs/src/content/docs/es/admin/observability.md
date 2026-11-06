---
title: Monitoreo
description: Comprobaciones de salud, la página de estado, alertas, métricas, registros y trazado y reporte de errores opcionales.
sidebar:
  order: 12
---

Kept no envía nada sobre sí mismo a ninguna parte a menos que lo configures: **ningún tipo de telemetría**, ni siquiera recuentos de instalación opcionales.

## Comprobaciones de salud

| Ruta | Responde |
|---|---|
| `/healthz` | 200 mientras el proceso sirve HTTP. Para una sonda de vida. |
| `/readyz` | 200 cuando responden ambas conexiones de base de datos web, si no, 503. Para disponibilidad, y el propio `HEALTHCHECK` de la imagen. |
| `/version` | la versión, el commit del que se construyó, el repositorio fuente y dónde están los avisos de terceros (`/notices.txt`, en la imagen). |

Un contenedor que ejecuta solo el worker (`KEPT_ROLE=worker`) no sirve HTTP. El `HEALTHCHECK` de la imagen sigue `KEPT_ROLE`: para el worker comprueba que el bucle de trabajos haya consultado la base de datos en los últimos dos minutos (toca `/tmp/kept-worker-alive` mientras avanza), así que un despliegue dividido no necesita anulación del healthcheck.

## La página de estado y las alertas

**Administrador → Estado** muestra lo que necesita atención: el kit de recuperación, el correo, los trabajos en segundo plano fallidos, el escaneo de recordatorios y las copias de seguridad: la antigüedad de la copia de seguridad, el último simulacro de restauración, el versionado del bucket, el espacio en disco, la release y sus migraciones, la comprobación de actualización, HTTPS y los conectores. Las alertas de administrador llegan a los administradores de la instancia en la app, por correo y por push; cada una se resuelve cuando desaparece su causa.

## Métricas

Establece `KEPT_METRICS_TOKEN` y `/metrics` sirve texto de Prometheus a las solicitudes que lo envían como token bearer (`Authorization: Bearer <token>`); sin la variable, la ruta no existe. Compose pasa la variable desde `.env`.

| Métrica | Qué |
|---|---|
| `kept_build_info{version, revision}` | siempre 1; la compilación en ejecución |
| `kept_process_uptime_seconds` | segundos desde que inició el proceso |
| `kept_process_resident_memory_bytes` | la memoria del proceso |
| `kept_db_pool_connections{pool, state}` | conexiones por pool de base de datos: total, inactivas, en espera |
| `kept_backup_last_success_timestamp_seconds` | cuándo terminó la última copia de seguridad correcta (0 antes de la primera) |
| `kept_backup_last_run_status{status}` | 1 para el estado de la última ejecución terminada, 0 para las demás |
| `kept_disk_used_ratio{volume}` | qué tan llenos están el disco de datos y un destino de copia de seguridad de directorio |
| `kept_update_available` | 1 cuando la comprobación de actualización ha visto una release más nueva |

Ninguna etiqueta contiene nunca una ruta ni un destino. Una base de datos que no puede responder omite las líneas de copia de seguridad, disco y actualización; el scrape sigue teniendo éxito.

## Registros

Líneas JSON en la salida estándar (`KEPT_LOG_FORMAT=json`, el valor por defecto), o `pretty` para leer `docker compose logs` a simple vista; `KEPT_LOG_LEVEL` establece el nivel. Cada solicitud tiene un id, que se devuelve en el encabezado de respuesta `x-request-id`, para que un reporte pueda vincularse a su línea de registro. Los tokens en las URLs se redactan del registro, y los secretos y contraseñas nunca se registran.

## Trazado y reporte de errores

Ambos son opcionales y están desactivados por defecto.

- **Trazado:** con `OTEL_EXPORTER_OTLP_ENDPOINT` establecido, Kept envía trazas de OpenTelemetry de sus solicitudes HTTP y consultas de base de datos a tu colector. Si no está establecido, ni siquiera se carga el código de trazado, y un colector caído nunca ralentiza una solicitud.
- **Reporte de errores:** con un DSN compatible con Sentry en `KEPT_ERROR_DSN`, los errores no manejados se reportan con el id de la solicitud y la ruta, y nunca un cuerpo de solicitud, encabezado, cadena de consulta, nombre ni nada almacenado en una ubicación.
