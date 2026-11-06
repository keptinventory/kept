---
title: PostgreSQL gestionado
description: Ejecuta Kept en el PostgreSQL 18 de un proveedor - qué proveedores funcionan y el SQL que crea los roles y las extensiones de Kept
sidebar:
  order: 5
---

Kept puede usar un PostgreSQL gestionado en lugar del incluido. Necesita **PostgreSQL 18** y tres
extensiones en el esquema `public`: `pg_trgm`, `unaccent` y `vector` (pgvector).

## Qué proveedores funcionan

Basado en la documentación de cada proveedor del 2026-10-06; ninguno se ha ejecutado todavía contra Kept.

| Proveedor | PostgreSQL 18 | Notas |
|---|---|---|
| AWS RDS for PostgreSQL | Sí | El usuario maestro crea las extensiones. Si un admin ha restringido `rds.allowed_extensions`, lista las tres. |
| Google Cloud SQL | Sí | El usuario `postgres` por defecto (miembro de `cloudsqlsuperuser`) las crea. |
| Azure Database for PostgreSQL, flexible server | Sí | **Primero la lista de permitidos:** añade `pg_trgm,unaccent,vector` al parámetro de servidor `azure.extensions`, luego ejecuta el SQL como admin del servidor. |
| DigitalOcean Managed PostgreSQL | Sí | **Solo Standard Edition**, como `doadmin`. Advanced Edition no puede crear extensiones, así que no puede ejecutar Kept. |
| Neon | Sí | El rol propio del proyecto (miembro de `neon_superuser`) las crea. |
| Supabase | **No** | No ofrece PostgreSQL 18 y pone las extensiones en un esquema `extensions`, no en `public`. |

## El SQL

`pg_trgm` y `unaccent` son extensiones de confianza, pero `vector` de pgvector no lo es, así que un
usuario sin privilegios de superusuario no puede crearla. Ejecuta esto **como el usuario admin del
proveedor**, conectado a la base de datos que Kept usará, con tus propias contraseñas en lugar de
`…` y el nombre de la base de datos en lugar de `<database>`:

```sql
-- Azure: allow-list pg_trgm,unaccent,vector in azure.extensions first.
CREATE ROLE kept_owner  LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_app    LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_auth   LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_system LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
-- A request can't run away or sit idle inside a transaction.
ALTER ROLE kept_app SET statement_timeout = '15s';
ALTER ROLE kept_app SET idle_in_transaction_session_timeout = '30s';
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA public;
-- A non-superuser admin may hand ownership to a role only while it is a member of that role.
GRANT kept_owner TO CURRENT_USER;
ALTER DATABASE <database> OWNER TO kept_owner;
ALTER SCHEMA public OWNER TO kept_owner;
REVOKE kept_owner FROM CURRENT_USER;
```

Cada instrucción se ejecutó localmente en PostgreSQL 18.6 como un usuario sin privilegios de
superusuario con los atributos que Azure documenta para su admin; solo `CREATE EXTENSION vector`
necesitó más, que es lo que otorga el rol admin del proveedor.

Los dos tiempos de espera de `kept_app` importan: la configuración de Compose de Kept establece
los mismos, y sus migraciones no pueden hacerlo (el rol propietario no puede modificar otros
roles).

## Los cuatro accesos

| Variable | Acceso | Se usa para |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | cada petición, bajo seguridad a nivel de fila |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | inicio de sesión |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | tareas en segundo plano y configuración inicial |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`, `kept admin`, y el volcado del respaldo |

**No apuntes nunca ninguno de ellos al usuario admin del proveedor.** Varios proveedores le dan
`BYPASSRLS` (el `doadmin` de DigitalOcean, el `neon_superuser` de Neon), lo que desactivaría la
seguridad a nivel de fila que separa los datos de un hogar de los de otro. Los cuatro roles de
Kept son todos `NOBYPASSRLS`.

La mayoría de los proveedores exige TLS: añade el `sslmode` que su documentación indique a cada
URL.
