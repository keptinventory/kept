---
title: Restaurar y el simulacro
description: Trae una copia de seguridad de vuelta a una base de datos nueva y vacía, compruébalo, cámbialo - y ensáyalo mensualmente.
sidebar:
  order: 2
---

Kept restaura **solo en una base de datos nueva y vacía**, la verifica y deja el intercambio a tu cargo.
Se niega a restaurar en una base de datos que contenga algo, por lo que no se puede apuntar por error a la activa.

## Restaurar

1. **Lista las instantáneas:**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   Esto ejecuta la CLI en un contenedor `kept` desechable, que tiene el volumen de datos, las claves, el inicio de sesión del propietario
   desde tu `compose.override.yaml`, y la configuración de copias de seguridad (`.env`'s, o las guardadas en
   Administración → Copias de seguridad; mira [copias de seguridad](/es/admin/backups/#activarlo)).

2. **Crear una base de datos vacía** junto a la activa, como el superusuario de la base de datos:

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   En Postgres administrado, ejecuta [el SQL del proveedor](/es/install/managed-postgres/#el-sql) extensión y
   líneas de propiedad para la nueva base de datos en su lugar.

3. **Restaurar en ella**, con `.env` cargado en el shell primero (`set -a; . ./.env; set +a`):

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <snapshot>
   ```

   Kept toma la base de datos y los archivos de la instantánea, comprueba el volcado frente a su manifiesto,
   comprueba que `pg_restore` coincida con la versión mayor del servidor y que existen las extensiones, restaura en
   una transacción, luego compara **el recuento de filas y el resumen de datos de cada tabla** con el manifiesto:
   cualquier tabla cuyos datos difieran, incluso con el mismo número de filas, falla la restauración. Los archivos vuelven
   al almacén `KEPT_STORAGE` con sus nombres, verificando el SHA-256 de cada uno. Termina imprimiendo el intercambio.

4. **Intercambio**, con Kept detenido, como el superusuario:

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   Mantén `kept_before_restore` hasta que estés seguro, luego elimínalo.

Renombrar una base de datos necesita al superusuario, que ningún inicio de sesión de Kept es: 
por eso Kept muestra estos comandos en lugar de ejecutarlos.

## Después de perder el servidor

En la nueva máquina: instala Kept como en [Instalar con Docker Compose](/es/install/compose/), y antes
del primer inicio coloca las **claves del kit de recuperación** en `.env` (`KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET`,
y `KEPT_SECRET_KEY_VERSION` y `KEPT_SECRET_KEYS_RETIRED` si el kit las enumera), con el
objetivo de la copia de seguridad y su contraseña en `compose.override.yaml`. Luego:

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

La base de datos `kept` de la nueva instalación sigue estando vacía (el servicio `migrate` aún no se ha ejecutado), 
así que toma la restauración directamente; no hay nada que intercambiar.
Sin las claves, todo vuelve excepto los valores secretos y las claves de IA, que permanecen ilegibles.

## El simulacro mensual

Una copia de seguridad que nadie ha restaurado es una esperanza, no una copia de seguridad. 
Una vez al mes, restaura la instantánea más reciente en una base de datos de prueba y deja que Kept la compare 
(con `.env` cargado, como se indicó anteriormente):

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

El simulacro restaura la instantánea buena más reciente, compara cantidades y resúmenes, verifica el SHA-256 de 50
archivos (`--all-files` los verifica todos), y registra el simulacro en la base de datos **activa**, lo que elimina 
la alerta "simulacro de restauración pendiente" en Administration → Estado. Nunca toca los datos activos.

## Verificando el repositorio

El trabajador verifica el repositorio semanalmente (`restic check`). Para verificar ahora o para leer atrás parte de los datos también:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

Con el almacenamiento de archivos S3, la verificación también comprueba cada archivo en el manifiesto frente al depósito. 
Si un bloqueo dejado por un fallo permanece en el repositorio, `kept admin backup unlock` lo elimina; 
se niega a hacerlo mientras se ejecuta una copia de seguridad.
