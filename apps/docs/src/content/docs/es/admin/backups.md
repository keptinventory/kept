---
title: Copias de seguridad
description: Instantáneas restic cifradas que se toman cada noche de la base de datos, los archivos y una copia legible, hacia otro disco, un bucket de S3 o un servidor SFTP.
sidebar:
  order: 1
---

Cada noche Kept hace una **instantánea restic**: cifrada con una contraseña que tú eliges,
con deduplicación (una noche sin novedades añade casi nada) y enviada a un lugar que no es el
disco propio del servidor.

## Qué guarda una instantánea

- **La base de datos**, extraída en un momento coherente, con un manifiesto del número de filas de cada tabla y un resumen de sus datos, para que una restauración pueda probar que trajo de vuelta exactamente lo que había.
- **Los archivos** (fotos, recibos, documentos), cuando están guardados en el disco del servidor. Con almacenamiento de archivos en S3 no lo están: mira [abajo](#cuando-los-archivos-están-en-s3).
- **Una copia legible de cada ubicación**: páginas web, hojas de cálculo, miniaturas y recibos que se abren en un navegador con solo restic. Mira [leer tu inventario solo con restic](/es/admin/read-with-restic/).

Las claves **no** están en la copia de seguridad. Guarda [el kit de recuperación](/es/admin/recovery-kit/) en otro lugar.

## Dónde puede ir

| Destino | Se configura con | El repositorio restic |
|---|---|---|
| Un directorio: otro disco, o un recurso compartido NAS montado en el servidor | `KEPT_BACKUP_DIR` (absoluto, fuera de `KEPT_DATA_DIR`) | `<directory>/restic` |
| Un bucket compatible con S3: AWS, o el endpoint S3 de otro proveedor | `KEPT_BACKUP_S3_BUCKET` y las demás `KEPT_BACKUP_S3_*` | `restic/` bajo `KEPT_BACKUP_S3_PREFIX` |
| Un servidor SFTP | `KEPT_BACKUP_SFTP` (la sintaxis `sftp:` de restic), `KEPT_BACKUP_SFTP_KEY_FILE`, `KEPT_BACKUP_SFTP_KNOWN_HOSTS` | la ubicación que das |

Elige un solo destino. Mejor otra máquina o incluso otro sitio: un directorio en el mismo disco que los datos de Kept se rechaza, y la página de estado avisa si el destino comparte disco con ellos. Se espera que los endpoints S3 de Backblaze B2 y Cloudflare R2 funcionen, pero no se han probado. SFTP fija la clave del host del servidor desde el archivo known-hosts y solo se conecta si coincide.

## Activarlo

Los administradores de la instancia ponen el destino y la contraseña en **Administrador → Copias de seguridad**, por HTTPS, después de confirmar el kit de recuperación. "Prueba" comprueba que Kept puede abrir (o crear) el repositorio; "Hacer copia ahora" ejecuta uno de inmediato. Una variable de entorno supera a la pantalla y aparece ahí como bloqueada, para que un operador pueda corregir el destino en el despliegue.

**La contraseña** tiene al menos 12 caracteres (`KEPT_BACKUP_PASSWORD`, o se configura en la pantalla).
**Sin contraseña, no hay copia:** Kept nunca escribe una copia sin cifrar. Si pierdes la contraseña, la
copia será ilegible, por eso está en el kit de recuperación.

La copia se ejecuta en el worker como propietario de la base de datos, por lo que el worker también necesita `KEPT_OWNER_DATABASE_URL`.
Con Compose, `compose.yaml` ya pasa todas las variables `KEPT_BACKUP_*` de `.env`
a Kept y a `migrate` (que toma una instantánea antes de una actualización); un `compose.override.yaml`
junto a él añade el inicio de sesión del propietario y, para un destino de directorio, el montaje en ambos:

```yaml
services:
  kept:
    environment:
      KEPT_OWNER_DATABASE_URL: postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD:-}@db:5432/kept
      KEPT_DB_OWNER_PASSWORD_FILE: /owner/kept_owner
    volumes:
      - kept-owner:/owner:ro
      - /mnt/backup/kept:/backups
  migrate:
    volumes:
      - /mnt/backup/kept:/backups
```

La contraseña del propietario proviene del volumen `kept-owner`, donde el bootstrap la guarda (una instalación
anterior a 1.13.0 con `KEPT_DB_OWNER_PASSWORD` en `.env` usa esa en su lugar, y la línea del archivo
no hace nada).

Luego pon el destino y la contraseña en la pantalla, o fíjalos en `.env`
(`KEPT_BACKUP_DIR=/backups`, `KEPT_BACKUP_PASSWORD=…`).

El directorio debe pertenecer al usuario de Kept:

```sh
sudo mkdir -p /mnt/backup/kept
sudo chown 10001:10001 /mnt/backup/kept
sudo chmod 700 /mnt/backup/kept
```

## Cuándo y cuánto tiempo

- **Cuándo:** cada noche a la hora configurada en Admin → Backups, `HH:MM` en UTC (por defecto `02:30`).
  Un nuevo horario se aplica a partir de la noche siguiente, sin reinicio; `KEPT_BACKUP_TIME` lo fija en su lugar.
- **Hacer copia ahora** ejecuta uno de inmediato; al pulsarlo otra vez mientras ese espera o se ejecuta se rechaza
  ("Ya se está ejecutando una copia de seguridad") en lugar de ponerlo dos veces en cola. Una copia cortada por un reinicio o por
  quedarse sin memoria no la bloquea; la siguiente ejecución la marca como interrumpida.
- **En una máquina pequeña** (menos de 4 GB, o un límite del contenedor inferior a 4 GB) restic se ejecuta con como máximo dos
  núcleos con un límite suave de memoria; `GOMAXPROCS` y `GOMEMLIMIT` en el entorno de Kept (con Compose,
  un `compose.override.yaml`) anulan ambos.
- **Cuánto tiempo se guardan:** la instantánea más reciente de cada uno de los últimos **7 días, 4 semanas y 6
  meses** (`KEPT_BACKUP_KEEP_DAILY`, `_WEEKLY`, `_MONTHLY`). `KEPT_BACKUP_KEEP` del alfa se
  lee como el conteo diario durante un lanzamiento. Las instantáneas tomadas antes de una actualización conservan sus últimas 3.
- **Una copia sospechosamente pequeña** (un volcado menor de la mitad del tamaño de la última buena, o con muchos menos
  cosas, lugares o archivos) se toma igualmente, pero esa noche no se borra nada antiguo y se avisa
  a los administradores, para que una mala noche nunca pueda desplazar las instantáneas buenas.

## Supervisarlo

Admin → Status muestra la última copia y su antigüedad, el número de instantáneas, el tamaño del repositorio,
el último simulacro de restauración y los discos. Los administradores reciben avisos por correo y push cuando:

| Alerta | Cuándo |
|---|---|
| Copia fallida | una ejecución falla |
| Copia caducada | no hay una copia buena en 36 horas con un destino configurado |
| Tamaño sospechoso | una ejecución fue mucho menor que la última buena |
| Poco espacio en disco | el disco de datos o un destino de directorio está al 85 % de su capacidad |
| Versionado del bucket desactivado | los archivos están en S3 y el bucket no guarda versiones antiguas |
| Simulacro de restauración vencido | no hay [simulacro de restauración](/es/admin/restore/#el-simulacro-mensual) en 30 días |

`/metrics` (con `KEPT_METRICS_TOKEN`) añade el momento de la última copia buena y el uso de los discos. Mira
[monitorización](/es/admin/observability/).

## Cuando los archivos están en S3

restic hace copias de seguridad de los archivos del disco, no de los objetos de un bucket. Con `KEPT_STORAGE=s3`, la instantánea guarda
la base de datos, el manifiesto y la copia legible, y **el bucket mantiene los archivos a salvo por sí mismo**:
activa el **versionado del bucket** (y, si tu proveedor lo tiene, la replicación a otra región). Kept
comprueba el versionado en cada ejecución y avisa mientras esté desactivado. La comprobación semanal y el simulacro de restauración
comparan el hash de cada archivo del manifiesto con el bucket.

## Las copias de seguridad de la alpha

Las copias de seguridad hechas antes de restic, por la alpha (`runs/` y `blobs/` junto al nuevo directorio `restic/`), no se
vuelven a escribir nunca y siguen siendo restaurables con `kept admin restore --legacy <id>` durante un lanzamiento. Bórralas
cuando una instantánea restic haya superado un simulacro de restauración.
