---
title: La CLI del operador
description: "kept migrate y kept admin: qué hace cada comando y cómo ejecutarlos bajo Compose."
sidebar:
  order: 7
---

La imagen tiene un comando `kept` para quien administra el servidor: migraciones, la forma de volver a entrar cuando
nadie puede iniciar sesión, claves, copias de seguridad. `kept admin --help` lista todo; cada comando que cambia
algo se audita y la persona a quien se le toca la cuenta recibe un aviso por correo.

## Ejecutarlo bajo Compose

La mayoría de los comandos necesitan el inicio de sesión del **propietario** de la base de datos (`KEPT_OWNER_DATABASE_URL`), que solo tiene el
servicio de un solo uso `migrate`; el contenedor que sirve nunca lo tiene. Su punto de entrada es `kept`, así que:

```sh
docker compose run --rm migrate admin <command>
```

Dos tipos de comando necesitan en cambio los volúmenes del contenedor que sirve:

- `recovery-kit` lee las claves del volumen de configuración y las imprime aunque no haya base de datos:
  `docker compose exec kept kept admin recovery-kit`. Con `KEPT_OWNER_DATABASE_URL` (abajo) también
  incluye el repositorio de copias de seguridad, su contraseña y sus credenciales.
- `token create` necesita las claves y los inicios de sesión del servidor, que tiene el contenedor `kept`:
  `docker compose exec kept kept admin token create …` ([abajo](#un-token-desde-el-servidor)).
- `rotate-key`, `backup`, `restore` y `export` necesitan las claves o los archivos además del
  inicio de sesión del propietario. Dale a `kept` el valor `KEPT_OWNER_DATABASE_URL` en un
  `compose.override.yaml` ([como en las copias de seguridad](/es/admin/backups/#activarlo)), y luego ejecútalos en un contenedor de un solo uso:
  `docker compose run --rm --no-deps --entrypoint kept kept admin <command>`.

## Comandos

| Comando | Qué hace |
|---|---|
| `kept migrate` | Aplica las migraciones pendientes una vez, bajo un bloqueo de base de datos (el servicio `migrate` lo ejecuta en cada arranque). |
| `kept admin setup-code` | Vuelve a emitir el código de configuración inicial mientras la configuración está pendiente, y levanta el bloqueo de toda la instancia. |
| `kept admin reset-password <login>` | Un código de restablecimiento de contraseña de un solo uso, válido por una hora; cierra la sesión de la cuenta en todas partes. |
| `kept admin disable-user <login>` / `enable-user <login>` | Impide que una cuenta inicie sesión (y termina sus sesiones), o la permite de nuevo. |
| `kept admin transfer-ownership <locationId> <toUserId>` | Entrega una ubicación a otro propietario; el propietario anterior se convierte en administrador de ella. |
| `kept admin recovery-kit [--format text\|html] [--out <file>]` | El kit de recuperación para guardar fuera del servidor: las claves, el repositorio de copias de seguridad y sus credenciales, los pasos de restauración. Ver [el kit de recuperación](/es/admin/recovery-kit/). |
| `kept admin token create --user <login> --scope read\|write --name <name>` | Un token personal para clientes MCP y Home Assistant, impreso una sola vez; `--expires <days>`, `--location <id or name>` (repetible), `--confirm-cross-location`. Desde la 1.13.0. Ver [un token desde el servidor](#un-token-desde-el-servidor). |
| `kept admin gen-key` | Imprime una nueva clave, para configurar tú mismo `KEPT_SECRET_KEY` o `KEPT_AUTH_SECRET`. |
| `kept admin rotate-key` | Hace que una nueva clave secreta sea la actual y vuelve a envolver cada secreto almacenado. `--resume` termina una interrumpida; `--drop <version>` elimina una clave retirada que no usa nada. |
| `kept admin backup` | Hace una copia de seguridad ahora (una instantánea de restic); `--list` enumera las instantáneas, y las copias de seguridad anteriores a restic; `--accept-size` acepta una copia de seguridad mucho más pequeña como la nueva normal. Ver [copias de seguridad](/es/admin/backups/). |
| `kept admin backup verify` | Verifica el repositorio de copias de seguridad; `--read-data <percent>` también lee esa parte de los datos; con almacenamiento de archivos en S3, comprueba los archivos contra el bucket (`--all-files` para todos, no uno de cada 20). |
| `kept admin backup drill --into <database>` | Restaura la copia de seguridad más reciente en una base de datos de prueba **vacía** y la verifica: el [simulacro mensual](/es/admin/restore/#el-simulacro-mensual). |
| `kept admin backup unlock` | Elimina un bloqueo de restic obsoleto después de un fallo; se rechaza mientras corre una copia de seguridad. |
| `kept admin restore <snapshot>` | Restaura una instantánea (o `latest`) en una base de datos **vacía** y la verifica; `--legacy <id>` restaura una copia de seguridad anterior a restic, por un lanzamiento. Ver [restaurar](/es/admin/restore/). |
| `kept admin readable --out <dir>` | Escribe la [copia legible](/es/admin/read-with-restic/) de cada ubicación (HTML, CSV, archivos) en un directorio; `--location <id>` para una sola, `--no-pdf` sin los PDF del inventario. |
| `kept admin storage copy --to s3\|local` | Copia cada archivo a la otra tienda, comprobando el hash de cada uno; `--dry-run` solo cuenta. Ver [cambiar el almacenamiento de archivos](/es/admin/storage/). |
| `kept admin storage verify --store s3\|local` | Comprueba que cada archivo al que se refiere la base de datos esté en esa tienda con los bytes correctos. |
| `kept admin export --out <dir>` | Todas las filas, en bruto, con los secretos aún sellados, y todos los archivos, en un directorio nuevo: la vía de escape, tan sensible como una copia de seguridad. |
| `kept admin backfill-pdf-text` | Lee el texto de los PDF subidos antes de que Kept leyera PDFs, para que la búsqueda los encuentre. |
| `kept admin config` | Imprime la [referencia de configuración](/es/reference/configuration/) de esta versión. |

`kept admin seed` existe para desarrollo y se niega a ejecutarse en producción.

## Un token desde el servidor

La app crea tokens personales solo por HTTPS (Ajustes → Conexiones se niega con `http` simple).
Un Kept en una red doméstica por `http` aún puede conectar una app de IA o
[Home Assistant](/es/users/home-assistant/): quien administra el servidor crea el token ahí.
Desde la 1.13.0:

```sh
docker compose exec kept kept admin token create \
  --user ibrahim@example.com --scope read --name "Home Assistant"
```

- `--user` es la persona para la que actúa el token: su dirección de correo o el nombre de usuario de una cuenta administrada.
  Puede hacer lo que ella puede, y nada más.
- `--scope read` solo lee; `--scope write` también puede cambiar cosas.
- Sin `--location`, llega a cada ubicación a la que pertenece la persona, excepto las que no puede:
  una ubicación que pide autenticación de dos factores (un token creado aquí no tiene segundo factor; crea ese en
  Ajustes → Conexiones, por HTTPS) y, para un token de escritura, aquellas donde es solo observador. Se nombra
  cada una de las que se dejan fuera. `--location` (un id o un nombre, repetible) las elige en su lugar.
- Un token de escritura entre ubicaciones cuyos miembros difieren se detiene con una advertencia, como en la app;
  `--confirm-cross-location` lo crea de todos modos.
- `--expires <days>` lo termina después de esos días; sin él, funciona hasta que se revoque.

Imprime el token una sola vez, en la línea que empieza con `KEPT TOKEN:`, y la dirección del servidor MCP. Kept conserva
solo una huella de él. La persona lo ve en **Ajustes → Conexiones**, donde puede revocarlo,
y recibe un aviso por correo.
