---
title: Instalar en Unraid
description: Instala Kept desde Community Applications de Unraid como un solo contenedor, Kept y su propia base de datos, con todo en la carpeta appdata.
sidebar:
  order: 2
  label: Unraid
---

Kept funciona en Unraid como un solo contenedor de **Community Applications** (la pestaña
**Apps**): Kept y su propia base de datos PostgreSQL, todo en `/mnt/user/appdata/kept`. Sin
Compose, sin contraseñas que inventar.

## Lo que necesitas

| | |
|---|---|
| Unraid | Con la pestaña **Apps** (el plugin Community Applications) |
| Memoria | Unos 500 MB libres para Kept y su base de datos, 1 GB para importaciones y copias de seguridad |
| Una dirección | La que abrirás para usar Kept, como `http://tower.local:8080`. Usa un nombre en lugar de una dirección IP: las etiquetas impresas la llevan |

## Instalar

1. **Apps**, busca **Kept** y luego **Install**.
2. **Kept's address**: la dirección con la que abrirás Kept, sin ruta. Lo demás puede quedarse
   como está. **Show more settings** tiene los opcionales: correo, inicio de sesión con OIDC y
   Google, un proxy inverso, el registro.
3. **Apply.** Unraid descarga la imagen e inicia el contenedor.
4. Pestaña **Docker**, el icono de Kept, **Logs**: el código de configuración.

   ```text
   app: Kept is at http://tower.local:8080
   KEPT SETUP CODE: XXX-XXX
   ```

5. El icono de Kept, **WebUI**. Kept muestra **Ingresa el código de configuración**: escribe el
   código y luego **Crear la primera cuenta**. Será la administradora de la instancia.
6. **Guarda las claves.** El icono de Kept, **Console**, y luego:

   ```sh
   kept admin recovery-kit
   ```

   Copia el texto que empieza por `KEPT RECOVERY KIT` en un lugar que no sea este servidor, como un
   gestor de contraseñas. Sin las claves, una copia de seguridad no recupera los valores secretos.

El primer inicio crea la base de datos y tarda alrededor de un minuto. Docker da el contenedor por
sano en cuanto Kept responde.

## Qué hay en la carpeta appdata

| Carpeta | Qué |
|---|---|
| `postgres/` | La base de datos en uso. Del usuario `postgres` del contenedor |
| `kept/` | Fotos y archivos. Del uid 10001, el usuario con el que se ejecuta Kept |
| `config/` | Las claves de Kept (`secrets.json`) y las contraseñas de la base de datos. Del uid 10001 |
| `owner/` | La contraseña del propietario de la base de datos. Solo de root: el proceso de Kept nunca la lee |
| `backup/kept.pgdump` | Un volcado de la base de datos, escrito cada vez que el contenedor se detiene |

El contenedor arranca como root, da cada carpeta a su propietario y después ejecuta Postgres y Kept
con sus propios usuarios. La carpeta en sí queda para root: nadie más puede listarla.

## Copias de seguridad

- **Copia la carpeta appdata** con el contenedor detenido, por ejemplo con el plugin Appdata Backup
  de Unraid. Al detenerse se escribe primero `backup/kept.pgdump`, así que la copia contiene una
  versión coherente de la base de datos aunque los archivos en uso no lo sean.
- **Restaurar:** devuelve la carpeta a su sitio e inicia Kept. Sin carpeta `postgres/` y con un
  volcado en `backup/`, Kept restaura la base de datos desde el volcado al iniciar; el registro dice
  `database restored from the backup`.
- **Las copias nocturnas propias de Kept** (Admin → Copias de seguridad) no están preparadas en
  este contenedor: necesitan el acceso del propietario de la base de datos, que el Kept en marcha no
  tiene. Copia la carpeta appdata.

## Actualizaciones

La plantilla sigue la versión mayor de Kept (`kept-unraid:1`). Cuando sale una versión, la pestaña
**Docker** muestra una actualización para Kept: **apply update**. El contenedor se detiene
(escribiendo su volcado), arranca la imagen nueva y Kept actualiza su base de datos al iniciar.

## La dirección de Kept

Cámbiala en la plantilla (el icono de Kept, **Edit**) y **Apply**. Para servir Kept por https, pon
un proxy inverso delante del puerto 8080, cambia **Kept's address** a su dirección https y
**Trusted reverse proxies** a la dirección del proxy tal como Kept la ve
([detrás de un proxy inverso](/es/install/reverse-proxy/)). La cámara, instalar la app del
teléfono, las notificaciones push y las passkeys necesitan https
([Kept en una red doméstica](/es/install/home-network/)).

## Desinstalar

1. Pestaña **Docker**, el icono de Kept, **Remove**. La carpeta appdata se queda.
2. Para borrar también los datos, elimina `/mnt/user/appdata/kept`, desde la terminal o un gestor
   de archivos. No se puede deshacer: haz antes una copia si quizá los quieras de vuelta.
