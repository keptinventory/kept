---
title: Resolución de problemas
description: Modos reales de fallo de un servidor Kept, qué causa cada uno y la solución.
---

Cada entrada es un síntoma, su causa y la solución. Los comandos asumen Docker Compose; bajo Helm se aplican las mismas comprobaciones a los pods.

## Primero, revisa

- **Administrador → Estado** nombra la mayoría de los problemas por sí mismo: correo, trabajos en segundo plano fallidos, el escaneo de recordatorios, las copias de seguridad y el simulacro de restauración, los discos, la versión y sus migraciones, HTTPS.
- **Los registros:** `docker compose logs kept` y `docker compose logs migrate`. `KEPT_LOG_FORMAT=pretty` los hace legibles a simple vista; `KEPT_LOG_LEVEL` (predeterminado `info`) establece el nivel.
- **Un id de solicitud:** cada respuesta incluye `x-request-id`; busca en el registro ese id para encontrar la línea que corresponde a un reporte.
- **Las sondas:** `/healthz` (el proceso responde HTTP), `/readyz` (ambas conexiones a la base de datos responden), `/version` (versión, commit, fuente). Consulta [monitoreo](/es/admin/observability/).
- **Comprobaciones que puedes ejecutar:** `kept admin backup verify`, `kept admin storage verify --store local` (o `s3`) y `kept admin config` ([la CLI](/es/admin/cli/)).

## `docker compose up` se detiene en el servicio `bootstrap`

**Causa:** el `bootstrap` de una sola ejecución (`kept bootstrap`) no pudo configurar los inicios de sesión de la base de datos. Su registro explica por qué: `docker compose logs bootstrap`. Casos comunes: la imagen es anterior a 1.13.0 y no tiene el comando `bootstrap` (configura `KEPT_IMAGE` a 1.13.0 o posterior); o el bucle invertido de la base de datos se configuró para requerir contraseña, y `KEPT_DB_SUPERUSER_PASSWORD` en `.env` no la contiene.

**Solución:** corrige lo que la línea señala y ejecuta `docker compose up -d` de nuevo; el bootstrap es seguro de ejecutar cualquier número de veces.

## Kept termina al iniciar con `kept: invalid environment: …` u otra línea `kept:`

**Causa:** el entorno se verifica antes de que algo inicie, y el primer problema detiene el proceso con una línea que lo nombra. Casos comunes:

| La línea dice | Solución |
|---|---|
| `kept: invalid environment: KEPT_PUBLIC_URL` | Configura la dirección: `docker compose run --rm init` ([instalación](/es/install/compose/#1-escribe-env)) |
| `KEPT_DATABASE_URL has no password, and KEPT_DB_APP_PASSWORD_FILE: … does not exist` | El bootstrap no se ha ejecutado: inicia con `docker compose up -d`, que lo ejecuta primero, no solo con `docker compose up kept` |
| `KEPT_SECRET_KEY and KEPT_AUTH_SECRET are set together or not at all` | Configura ambas o desconfigura ambas para usar el par generado en el volumen de configuración |
| `<path>/secrets.json exists but …; fix or restore it` | El archivo de claves generado está dañado: vuelve a poner las claves de [el kit de recuperación](/es/admin/recovery-kit/) |
| `KEPT_BACKUP_DIR is inside KEPT_DATA_DIR …` | Apunta la copia de seguridad a otro disco |
| `a backup target is set, and the nightly backup dumps the database as kept_owner …` | Dale al worker `KEPT_OWNER_DATABASE_URL` ([copias de seguridad](/es/admin/backups/#activarlo)) |
| `set one backup target, not …` | Conserva una de `KEPT_BACKUP_DIR`, `KEPT_BACKUP_S3_BUCKET`, `KEPT_BACKUP_SFTP` |
| `KEPT_STORAGE=s3 needs …` | Añade las configuraciones S3 que nombra ([almacenamiento](/es/admin/storage/)) |
| `KEPT_OIDC_ISSUER is set without KEPT_OIDC_CLIENT_ID` | Añade el id de cliente o desconfigura el emisor |

Todas las variables están en la [referencia de configuración](/es/reference/configuration/).

## Cambiaste la contraseña de la base de datos en `.env`, y ahora nada se conecta

**Causa:** con el `compose.yaml` de Kept 1.13.0 esto se arregla solo: el bootstrap establece la contraseña de cada login a la de `.env` (o a su archivo) en cada `docker compose up -d`. Ocurre con un `compose.yaml` anterior, que establecía las contraseñas una vez, cuando se creó por primera vez el volumen `kept-db`.

**Solución:** usa el `compose.yaml` actual y ejecuta `docker compose up -d`. Con el antiguo, cambia la contraseña del rol en Postgres para que coincida y luego reinicia:

```sh
docker compose exec db psql -U postgres -c "ALTER ROLE kept_app PASSWORD '<the new password>'"
```

(El rol es `kept_owner`, `kept_app`, `kept_auth` o `kept_system`, según la variable.)

## `/readyz` responde 503

**Causa:** una de las dos conexiones a la base de datos del servidor web (`app` y `system`, mostradas como `false` en el cuerpo de la respuesta) no puede ejecutar una consulta. El registro tiene `readiness check failed`. Al inicio, Kept espera alrededor de dos minutos a que una base de datos que todavía está iniciando antes de rendirse.

**Solución:** verifica que `docker compose ps db` esté saludable y que el login nombrado `false` tenga la contraseña correcta (arriba). Con Postgres administrado, verifica que existan los cuatro logins ([Postgres administrado](/es/install/managed-postgres/#los-cuatro-accesos)).

## "Este Kept está configurado para …" o "La solicitud no provino de este sitio."

- **La app:** "Este Kept está configurado para *address*. Ábrelo allí.", en la página de inicio de sesión o como una franja sobre la app cuando se rechaza un guardado.
- **La API:** 403, "La solicitud no provino de este sitio."

**Causa:** una escritura que lleva la cookie de Kept debe venir del origen exacto de `KEPT_PUBLIC_URL`, o de uno de `KEPT_EXTRA_ADDRESSES`: esquema, host y puerto. Kept lo compara con el encabezado `Origin` del navegador, que es la dirección en la barra de direcciones; un proxy inverso en medio no cambia nada. Abrir Kept en otra dirección (una IP en lugar del nombre, `http` en lugar de `https`, un puerto distinto, la dirección interna del proxy) hace que toda escritura sea un 403. Los enlaces, códigos QR y correos de invitación se construyen a partir del mismo valor, y las passkeys se registran para su nombre de host.

**Solución:** configura `KEPT_PUBLIC_URL` exactamente a lo que muestra la barra de direcciones del navegador, reinicia y abre Kept siempre allí. Si accedes a Kept por dos direcciones reales, como un nombre de LAN y un nombre de Tailscale, enumera las demás en `KEPT_EXTRA_ADDRESSES` ([Más de una dirección](/es/install/home-network/#más-de-una-dirección)).

## Kept no inicia después de una actualización, y `migrate` salió con un error

**Causa:** el servicio `kept` inicia solo después de que `migrate` se complete correctamente. Antes de migrar una base de datos con datos, `kept migrate` toma una instantánea previa a la actualización cuando hay un destino de copia de seguridad configurado; **si la instantánea falla, no se migra nada** y termina con el motivo ([actualizaciones](/es/admin/upgrades/#la-instantánea-antes-de-cada-actualización)).

**Solución:** lee `docker compose logs migrate`, corrige la copia de seguridad (destino, contraseña, montaje en `migrate`) y ejecuta `docker compose up -d` de nuevo. Para actualizar sin la instantánea a propósito, configura `KEPT_UPGRADE_SNAPSHOT=off` para esa ejecución.

## Kept se niega a iniciar con `downgrade_refused`

**Causa:** la imagen tiene más de una versión anterior a la base de datos (o la base de datos tiene migraciones que ninguna versión registrada hizo). Una versión atrás está permitida; más no.

**Solución:** ejecuta de nuevo la versión más reciente, o [restaura](/es/admin/restore/) la instantánea previa a la actualización tomada por la más antigua. `KEPT_ALLOW_DOWNGRADE=1` fuerza el inicio y queda auditado; úsalo solo cuando las notas de una versión lo indiquen ([volver una versión atrás](/es/admin/upgrades/#volver-atrás-una-versión)).

## El código de configuración se perdió, o la configuración está bloqueada

**Causa:** el código se imprime una sola vez, por el proceso que lo creó. Los códigos incorrectos bloquean la dirección que los envió, y muchos códigos incorrectos bloquean la instancia.

**Solución:** `docker compose run --rm migrate admin setup-code` genera un código nuevo y levanta el bloqueo de toda la instancia; un bloqueo por dirección termina por sí solo. Si todos están bloqueados a la vez, lee la siguiente entrada.

## A todos les aplican los mismos límites de inicio de sesión

**Causa:** detrás de un proxy inverso Kept ve la dirección del proxy para cada visitante a menos que el proxy esté en `KEPT_TRUSTED_PROXIES`, por lo que todos comparten un mismo conjunto de límites.

**Solución:** enumera la dirección del proxy tal como la ve Kept en `KEPT_TRUSTED_PROXIES` ([proxies inversos](/es/install/reverse-proxy/#confía-en-el-proxy-y-solo-en-el-proxy)).

## Las subidas fallan, o las fotos grandes nunca llegan

**Causa:** Kept rechaza un archivo mayor a `KEPT_MAX_FILE_MB` (25 MB por defecto) con 413. Un proxy al frente suele tener su propio límite de cuerpo más pequeño y falla primero.

**Solución:** aumenta el límite del proxy a al menos `KEPT_MAX_FILE_MB` ([dejar pasar las subidas](/es/install/reverse-proxy/#deja-pasar-las-subidas)).

## La cámara, la instalación, las notificaciones push o la ubicación no funcionan en los teléfonos

**Causa:** los teléfonos los permiten solo en un origen seguro; una dirección de LAN con HTTP simple no lo es. Con HTTP, Kept también se niega a mostrar valores secretos, exportaciones, tokens de acceso, conexiones OAuth, la descarga del kit de recuperación y la configuración de copias de seguridad.

**Solución:** [pon Kept en HTTPS](/es/install/https/) y configura `KEPT_PUBLIC_URL` a la dirección `https://`.

## Guardar un proveedor de IA o un webhook falla: "Esa dirección está en una red privada."

**Causa:** las solicitudes salientes se rechazan hacia direcciones privadas, de bucle local y reservadas (`private_address`). Un proveedor en tu propia red, incluido el `http://ollama:11434/v1` de Compose, se resuelve a una de ellas.

**Solución:** un administrador de la instancia activa **Administrador → Configuración → Permitir direcciones privadas**. Consulta el [modelo de seguridad](/es/admin/security-model/#solicitudes-salientes-ssrf).

## No llega correo

**Causa:** sin `KEPT_SMTP_URL` y `KEPT_SMTP_FROM`, el correo solo se registra como pendiente, y Administrador → Estado dice que el correo no está configurado.

**Solución:** configura ambos y reinicia ([instalación](/es/install/compose/#5-qué-sigue)).

## Las copias de seguridad no se ejecutan, o se activa la alerta "Copia de seguridad desactualizada"

**Causa:** normalmente una de estas: sin destino o sin contraseña (no hay copia de seguridad sin cifrar), el worker sin `KEPT_OWNER_DATABASE_URL`, un destino de directorio no montado en el contenedor o uno que no pertenece al usuario de Kept (uid 10001).

**Solución:** sigue [copias de seguridad](/es/admin/backups/#activarlo), luego ejecuta una manualmente y lee lo que dice:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup
```

Termina con 1 ante una advertencia, por su nombre:

| Advertencia | Significado y qué hacer |
|---|---|
| `backup_suspicious_size` | mucho más pequeña que la última buena; si la reducción es real, `kept admin backup --accept-size` |
| `files_unreadable` | restic no pudo leer algunos archivos; verifica los permisos del volumen de datos |
| `blob_checksum_mismatch` | un archivo almacenado ya no coincide con su SHA-256; verifica el disco |
| `readable_incomplete` | falló la copia legible de una ubicación; el registro la nombra |

Tras un fallo, un bloqueo obsoleto de restic puede bloquear cada ejecución: `kept admin backup unlock` lo elimina (se niega si se está ejecutando una copia de seguridad).

## Una restauración se niega a iniciar

**Causa:** Kept restaura solo en una base de datos **vacía**, y verifica que `pg_restore` coincida con la versión mayor de Postgres del servidor y que existan las extensiones.

**Solución:** crea una base de datos vacía nueva con las extensiones, como en [restauración](/es/admin/restore/#restaurar); nunca apuntes la restauración a la base de datos en vivo.

## Después de una restauración, no se pueden leer los valores secretos ni las claves de IA

**Causa:** están sellados con `KEPT_SECRET_KEY`, que no está en la copia de seguridad.

**Solución:** pon las claves del kit de recuperación en `.env` (con `KEPT_SECRET_KEY_VERSION` y `KEPT_SECRET_KEYS_RETIRED` si las enumera) y reinicia. Si el kit enumera claves retiradas, ejecuta `kept admin rotate-key --resume` una vez que Kept esté activo. Sin la clave esos valores se han perdido para siempre.

## `kept admin` dice `KEPT_OWNER_DATABASE_URL … is required`

**Causa:** la mayoría de los comandos de administración necesitan el login del propietario de la base de datos, que solo tiene el servicio `migrate`.

**Solución:** ejecútalos como `docker compose run --rm migrate admin <command>`, o para `rotate-key`, `backup`, `restore` y `export`, dale al servicio `kept` el login del propietario en `compose.override.yaml` ([la CLI](/es/admin/cli/#ejecutarlo-bajo-compose)).

## Un contenedor solo de worker está no saludable

**Causa:** con `KEPT_ROLE=worker` el healthcheck lee el archivo que toca el bucle de trabajos (`/tmp/kept-worker-alive`); falla cuando el bucle no ha consultado la base de datos durante dos minutos.

**Solución:** revisa el registro del worker y su conexión a la base de datos; se aplican las mismas comprobaciones de base de datos que para `/readyz`.

## Aún bloqueado

Abre un issue con la versión de `/version`, cómo se ejecuta Kept, y las líneas relevantes del registro con lo privado eliminado. Un problema de seguridad se trata mediante el reporte privado de vulnerabilidades en su lugar ([modelo de seguridad](/es/admin/security-model/#informar-de-una-vulnerabilidad)).
