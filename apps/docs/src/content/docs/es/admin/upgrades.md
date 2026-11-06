---
title: Actualizaciones y reversión
description: Actualizando Kept, la instantánea que toma primero, volviendo atrás una versión y las actualizaciones mayores de Postgres.
sidebar:
  order: 5
---

## Actualizando

Con Compose, señalé `KEPT_IMAGE` en `.env` hacia la nueva versión y:

```sh
docker compose pull
docker compose up -d
```

Su propia compilación desde un checkout en su lugar: `git pull`, `docker build -t kept:local .`, luego
`docker compose up -d` con `KEPT_IMAGE=kept:local`.

Una versión puede cambiar `compose.yaml` también; sus notas lo indican. Descargue el archivo de la versión sobre el suyo
(`curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.yaml`, o
`compose.full.yaml` si ejecuta esa variante); `.env` permanece igual.

### Configuraciones que necesitan el nuevo compose.yaml

`compose.yaml` le proporciona a Kept las configuraciones que nombra, y ninguna más. Una actualización a 1.14.5 que solo
cambia `KEPT_IMAGE` mantiene el archivo de 1.14.4, que no pasa `KEPT_HTTP_SIGN_IN_DAYS` ni
`KEPT_EXTRA_ADDRESSES` y establece `KEPT_TRUSTED_PROXIES` por sí mismo. Esas líneas en `.env` no hacen nada hasta
que descargue el `compose.yaml` de 1.14.5 (o `compose.full.yaml`) y ejecute `docker compose up -d`.

### Caddy y Ollama se movieron a compose.full.yaml

Desde la versión 1.14.5, `compose.yaml` ejecuta únicamente Kept y su base de datos. Caddy (el perfil `https`),
Ollama (el perfil `ollama`) y la implementación dividida comentada están en
`compose.full.yaml`: el mismo archivo además de esos. **Si usa Caddy o Ollama**, descargue
`compose.full.yaml` en su lugar y establezca `COMPOSE_FILE=compose.full.yaml` en `.env`:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.full.yaml
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose --profile https up -d   # the profiles you use: https, ollama or both
```

De lo contrario, la próxima descarga de `compose.yaml` elimina Caddy: Compose llama huérfano a su contenedor,
y una vez que se ha ido, Kept queda en http sin cifrar. Los servicios de Kept, la red y los volúmenes
(los certificados de Caddy en `caddy-data`, los modelos en `ollama`) son idénticos en ambos archivos, por lo que
no se pierde nada. Sin Caddy o Ollama, nada cambia.

**Detrás de su propio proxy**, `KEPT_TRUSTED_PROXIES` en `.env` llega a Kept desde la versión 1.14.5. Antes,
`compose.yaml` establecía su propio valor, por lo que una línea en `.env` era ignorada y todos los visitantes compartían
los límites de inicio de sesión del proxy. Un valor ya presente en `.env` entra en vigor después de que haya descargado
el `compose.yaml` de 1.14.5 ([arriba](#configuraciones-que-necesitan-el-nuevo-composeyaml)); uno en un
`compose.override.yaml` puede trasladarse a `.env`. Con el `compose.full.yaml` que incluye Caddy, déjelo vacío o
mantenga `172.29.72.200` en la lista ([proxies inversos](/es/install/reverse-proxy/#confía-en-el-proxy-y-solo-en-el-proxy)).

### Enlaces de inicio de sesión (1.14.0)

La versión 1.14.0 traslada Kept a better-auth 1.7.13, que corrige un aviso donde el estado de un inicio de sesión de OAuth
podría usarse como un enlace mágico para iniciar sesión como otra persona (GHSA-965c-763c-88jm). Un enlace mágico
enviado por correo, o un inicio de sesión de Google u OIDC iniciado, antes de la actualización ya no funciona: solicite un
nuevo enlace, o vuelva a iniciar sesión.

### Instalación sin clonar (1.13.0)

Desde la versión 1.13.0, `compose.yaml` no necesita una copia del repositorio ni contraseñas de base de datos: un servicio
`bootstrap` de un solo disparo crea los inicios de sesión en cada arranque. Una instalación previa sigue funcionando como
está: sus cinco líneas `KEPT_DB_*_PASSWORD` en `.env` se usan tal cual
([una instalación anterior a 1.13.0](/es/install/compose/#una-instalación-anterior-a-la-1130)). Dos cosas que
debe saber: un `KEPT_IMAGE` vacío ya no compila el checkout (ejecuta el `compose.yaml` que indica la versión),
y el `compose.override.yaml` de la copia de seguridad nocturna lee la contraseña del propietario desde el
volumen `kept-owner` cuando `.env` ya no la contiene ([copias de seguridad](/es/admin/backups/#activarlo)).

El servicio `migrate` de un solo disparo ejecuta primero `kept migrate`: las migraciones se aplican **una sola vez, bajo
un bloqueo de base de datos**, antes de que la nueva versión atienda una solicitud. Las migraciones de Kept solo agregan
(una columna o tabla se elimina o renombra únicamente entre dos versiones), por lo que la versión anterior aún se ejecuta
contra el nuevo esquema, lo que hace posible volver atrás.

Lea las notas de la versión antes de una versión mayor (`1.x` a `2.0`).

### La imagen se movió (1.8.0)

Desde la versión 1.8.0, la imagen es `ghcr.io/keptinventory/kept` y el gráfico
`oci://ghcr.io/keptinventory/charts/kept`. Las versiones hasta la 1.7.1 permanecen en
`ghcr.io/ibrahimroshdy/kept`, que no recibe nuevas versiones. Para actualizar, cambie el nombre de la imagen una vez:

- Compose: `KEPT_IMAGE=ghcr.io/keptinventory/kept:1.8.0`.
- Helm: `image.repository: ghcr.io/keptinventory/kept`, o instale el gráfico desde su nueva dirección.

La clave de firma es la misma, por lo que `cosign verify --key cosign.pub ghcr.io/keptinventory/kept:<version>`
funciona como antes ([Verificar una versión](/es/admin/verify-release/)).

### Saber si hay una nueva versión

Kept puede buscar nuevas versiones, y está **desactivado por defecto**. Activado, consulta a GitHub una vez al día
por la última versión del repositorio del cual se construyó su imagen, enviando solo la solicitud (sin versión,
sin identificador de instancia). Nada se descarga o instala. `KEPT_UPDATE_CHECK=true`
lo activa y lo bloquea; `false` lo desactiva y lo bloquea.

El interruptor está en Admin → Registro, bajo "Nuevas versiones". Admin → Estado dice "Kept X está disponible"
cuando existe una versión más reciente, y su **Comprobar ahora** pregunta de inmediato.

## La instantánea antes de cada actualización

Cuando `kept migrate` encuentra migraciones pendientes en una base de datos que ya tiene datos, y está configurado
un objetivo de copia de seguridad, primero toma una instantánea solo de la base de datos con restic etiquetada como
`pre_upgrade`. **Si la instantánea falla, no se migra nada** y el comando se detiene con la razón. Se conservan
las últimas 3 instantáneas previas a la actualización.

- Sin objetivo de copia de seguridad: Kept migra de todas formas, lo registra claramente, y Admin → Estado indica que fue
  "actualizado sin copia de seguridad" hasta la próxima copia de seguridad correcta.
- `KEPT_UPGRADE_SNAPSHOT=off` (o `kept migrate --skip-snapshot`) lo omite intencionalmente.
- La [aplicación de Home Assistant](/es/install/home-assistant/) nunca toma una: la copia de seguridad de Home Assistant
  antes de la actualización es el método para volver atrás.
- Una base de datos completamente nueva nunca toma una.

Para que esto funcione, el servicio `migrate` necesita las claves y la configuración de copia de seguridad,
así como el inicio de sesión del propietario. El archivo Compose lo proporciona todo; un objetivo de directorio
también necesita su montaje en `migrate` ([copias de seguridad](/es/admin/backups/#activarlo)).

## Volver atrás una versión

Para revertir, vuelva a ejecutar la imagen de la versión anterior: `KEPT_IMAGE` hacia la etiqueta antigua, luego
`docker compose up -d`. No existen migraciones hacia abajo; la versión anterior se ejecuta en el esquema más reciente.

Kept registra las migraciones de cada versión en la base de datos y verifica al iniciar:

- la base de datos está **un lanzamiento por delante** de la imagen: Kept inicia, y Admin → Estado indica que se
  retrocedió desde X;
- **más de un lanzamiento** por delante, o por delante por migraciones que ningún lanzamiento registrado realizó: Kept se niega a
  iniciar (`downgrade_refused`) y menciona ambas versiones. Ese es el momento de
  [restaurar](/es/admin/restore/) la instantánea previas a la actualización en su lugar. `KEPT_ALLOW_DOWNGRADE=1` fuerza el
  inicio, y dicha fuerza es auditada.

Desde la versión 1.14.4 hasta la 1.14.3: el mapa de 1.14.3 tiene un mínimo de 1 m. Una habitación con menos de 1 m
de lado mantiene su tamaño hasta que alguien toca **Listo** en **Organizar**, lo que lo guarda a 1 m (o lo rechaza, si
eso provoca que se solape con la siguiente habitación). Para mantener esos tamaños, no organice el mapa hasta que
vuelva a la versión 1.14.4.

## Actualizaciones mayores de Postgres

El archivo Compose de Kept fija Postgres 18 por resumen, y sus actualizaciones de dependencia nunca proponen un
aumento importante. Una nueva versión importante es un **volcado y restauración**, nunca un cambio de etiqueta en el
volumen existente (los archivos de datos de una versión importante no se abren en otra):

1. Realice una copia de seguridad y déjela terminar: `docker compose run --rm --no-deps --entrypoint kept kept admin backup`.
2. Detenga Kept: `docker compose stop kept`.
3. Cambie la imagen de `db` a la nueva versión importante, en un volumen **nuevo** (cambie el nombre de `kept-db` en
   `compose.yaml`, o mueva el antiguo aparte); conserve el volumen antiguo hasta que termine.
4. `docker compose up -d db`: el script de inicialización crea los roles y las extensiones en la base de datos vacía.
5. [Restaure](/es/admin/restore/#después-de-perder-el-servidor) la copia de seguridad en él, luego `docker compose up -d`.

La imagen de Kept incluye las herramientas cliente de la versión importante de Postgres que soporta, y la restauración
verifica que coincidan con las del servidor.
