---
title: Desinstalando
description: Elimina Kept y todo lo que almacenó - después de guardar lo que quieras mantener.
sidebar:
  order: 9
---

**Saca tus datos primero.** Una vez que los volúmenes se hayan ido, nada los devuelve excepto una copia de seguridad.

1. Cada usuario exporta sus ubicaciones (**Configuración → Exportar**), o guarda la última copia de seguridad y el
   [kit de recuperación](/es/admin/recovery-kit/) en un lugar seguro: con restic solo puedes todavía
   [leer tu inventario](/es/admin/read-with-restic/) más tarde.

2. Detén y elimina los contenedores **y sus volúmenes**, en la carpeta con `.env`:
   ```sh
   docker compose --profile https --profile ollama down --volumes
   ```
   Esto elimina `kept-db` (la base de datos), `kept-data` (los archivos), `kept-config` (las claves generadas
   y las contraseñas de la base de datos) y `kept-owner` (la contraseña de inicio de sesión del propietario); con
   `compose.full.yaml`, los certificados de Caddy y los modelos de Ollama también. Sin `--volumes`, los
   datos permanecen en la máquina.

3. Elimina la imagen: `docker image rm ghcr.io/keptinventory/kept:<version>` (la etiqueta que ejecutaste, o
   `kept:local` para tu propia compilación), y `.env` junto al archivo Compose.

4. Fuera de la máquina, elimina lo que configuraste para Kept tú mismo:
   - **el depósito de archivos**, con `KEPT_STORAGE=s3` (y sus versiones antiguas, si estaba activada la versión);
   - **la copia de seguridad**: el directorio `restic` en el disco de copia de seguridad, el prefijo `restic/` en el depósito de copia de seguridad
     depósito, o el repositorio en el servidor SFTP, y cualquier alpha `runs/` y `blobs/` al lado;
   - la base de datos, si era de un proveedor: los roles `kept_*` y la base de datos misma;
   - los registros DNS, las rutas de proxy y el `serve` de Tailscale que añadiste;
