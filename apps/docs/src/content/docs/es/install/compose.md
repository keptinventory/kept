---
title: Instalar con Docker Compose
description: Ejecuta Kept y su Postgres con Docker Compose en tu propio servidor o homelab, inicia sesión por primera vez y guarda las claves con seguridad.
sidebar:
  order: 1
---

Docker Compose es la forma de ejecutar Kept en una máquina: Kept y Postgres 18 con pgvector.
Caddy para HTTPS y Ollama para IA local vienen con un segundo archivo
([Caddy y Ollama](#caddy-y-ollama)). Necesitas Docker con el plugin Compose. Probado en una máquina con
1 GB de RAM y un núcleo de CPU; Kept y su base de datos usan alrededor de 200–400 MB de ella
([lo que se probó](/es/install/hardware/)).

Cuatro pasos, sin copiar el repositorio y sin contraseñas que crear:

```sh
mkdir kept && cd kept
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.yaml
docker compose run --rm init
docker compose up -d
```

`compose.yaml` funciona por sí solo, así que también se puede pegar en Portainer, Dockge y similares (consulta
[sin terminal](#sin-terminal)).

:::note[Images]
Las versiones se publican en `ghcr.io/keptinventory/kept`, etiquetadas `1`, `1.2` y `1.2.3`, nunca
`latest`; `1.0.0` es la primera firmada. Las mismas imágenes, firmadas con la misma clave, están en Docker
Hub como `keptinventory/kept`. `compose.yaml` ejecuta la versión con la que se publicó, salvo que
`KEPT_IMAGE` en `.env` nombre otra; `init` escribe allí la versión con la que se ejecutó.
[Verifícalo](/es/admin/verify-release/) primero si quieres. Para ejecutar tu propia compilación, en un checkout:
`docker build -t kept:local .` y `KEPT_IMAGE=kept:local`.
:::

## Qué se ejecuta

| Servicio | Se ejecuta |
|---|---|
| `db` | Postgres y permanece en ejecución |
| `kept` | Kept en el puerto 8080 y permanece en ejecución |
| `bootstrap` | una vez en cada inicio y luego termina: los inicios de sesión y las extensiones de la base de datos |
| `migrate` | una vez en cada inicio y luego termina: las migraciones de la base de datos |
| `init` | solo cuando lo ejecutas (`docker compose run --rm init`): escribe `.env` |

## Caddy y Ollama

`compose.yaml` ejecuta Kept solo. `compose.full.yaml` es el mismo archivo más Caddy para HTTPS (el
perfil `https`), Ollama para IA local (el perfil `ollama`) y un despliegue separado de web y worker,
comentado. También funciona por sí solo. Para usarlo en su lugar:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.full.yaml
docker compose -f compose.full.yaml run --rm init
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose up -d
```

Con `COMPOSE_FILE` en `.env`, el `docker compose` normal lee `compose.full.yaml`, así que todos los comandos
de esta documentación funcionan tal como están. Los servicios, la red y los volúmenes de Kept son los mismos en ambos archivos:
una instalación puede cambiar en cualquier momento y conservar sus datos.

## 1. Escribe `.env`

```sh
docker compose run --rm init
```

`init` pide **la dirección en la que abrirás Kept**, como `http://kept.home.arpa:8080` o
`https://kept.example.org`. Los enlaces, los códigos QR de las etiquetas impresas y la verificación same-site se construyen
a partir de ella, así que debe ser exactamente lo que muestra el navegador y no debería cambiar: **usa un nombre
en lugar de una dirección IP.** Un router doméstico puede dar a esta máquina una dirección nueva algún día, y las
etiquetas que imprimiste entonces apuntarían a ningún lado. Configura el nombre en el DNS de tu router, o en el archivo
hosts de cada dispositivo. Una dirección IP sigue funcionando si la confirmas.

Luego escribe `.env` junto a `compose.yaml` con esa dirección (`KEPT_PUBLIC_URL`), el puerto
(`KEPT_HTTP_PORT`, a partir de una dirección `http://`), la imagen y un código de configuración (`KEPT_SETUP_CODE`), y
muestra el código. `.env` no contiene contraseña y solo tú puedes leerlo. Ejecuta `init` de nuevo para cambiar
la dirección: actualiza esas líneas y conserva todo lo demás que agregaste. Sin terminal, da
la dirección en la línea de comandos: `docker compose run --rm init --url http://kept.home.arpa:8080`.

Todo lo demás es opcional; `compose.env.example` y la
[referencia de configuración](/es/reference/configuration/) dicen qué hace cada variable.

## 2. Inícialo

```sh
docker compose up -d
```

Compose inicia la base de datos y espera a que esté en buen estado. Luego:

- **`bootstrap`** (ejecución única, `kept bootstrap`) crea los cuatro inicios de sesión de base de datos de Kept y las
  extensiones `pg_trgm`, `unaccent` y `vector`. En el primer inicio genera la contraseña de cada inicio de sesión
  en un volumen; en cada inicio establece la contraseña de cada inicio de sesión con ese valor, para que Postgres
  y Kept siempre coincidan.
- **`migrate`** (ejecución única, `kept migrate`) aplica las migraciones de la base de datos una sola vez, bajo un bloqueo.
- **Kept** se inicia en el puerto 8080 (`KEPT_HTTP_PORT` cambia el puerto del host).

## 3. Termina la configuración

Abre la dirección, introduce el código de configuración que mostró `init` y crea la primera cuenta: se convierte en
el administrador de la instancia. Kept también imprime el código en su registro en su primer inicio:

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

Un código perdido se vuelve a emitir con:

```sh
docker compose run --rm migrate admin setup-code
```

Los códigos incorrectos bloquean por un tiempo, por dirección y para toda la instancia. Si Kept está detrás de un
proxy en el que no confía, todos comparten la dirección del proxy; consulta
[proxies inversos](/es/install/reverse-proxy/).

## 4. Guarda las claves

En el primer inicio, con `KEPT_SECRET_KEY` y `KEPT_AUTH_SECRET` sin definir, Kept genera ambas en el
volumen `kept-config` y registra una línea que indica dónde. La clave secreta sella todos los valores secretos (claves
de IA, las contraseñas que guardas en Kept): **una copia de seguridad restaura todo excepto esos valores a menos que
también tengas la clave.**

Imprime las claves y guárdalas en algún lugar distinto de este servidor, como un gestor de contraseñas:

```sh
docker compose exec kept kept admin recovery-kit
```

Admin → Status te pide que confirmes el kit de recuperación, y Kept lo exige antes del primer
valor secreto, clave de IA o configuración de copia de seguridad. Consulta [el kit de recuperación](/es/admin/recovery-kit/).

## 5. Qué sigue

- [Poner Kept en HTTPS](/es/install/https/): la cámara, instalar la app, las notificaciones push y
  la ubicación solo funcionan con HTTPS.
- [Configurar copias de seguridad](/es/admin/backups/).
- Correo: configura `KEPT_SMTP_URL` (`smtp://` o `smtps://`, con credenciales) y `KEPT_SMTP_FROM` para
  restablecimientos de contraseña, invitaciones y recordatorios por correo. Sin ellas, los recordatorios llegan a las personas solo
  en la app, y Admin → Status dice que el correo no está configurado.

## Qué crea Compose

| Volumen | Contiene | ¿Respaldarlo? |
|---|---|---|
| `kept-db` | la base de datos Postgres | mediante la copia de seguridad de Kept, nunca copiando el volumen mientras se ejecuta |
| `kept-data` | archivos subidos (con `KEPT_STORAGE=local`, el valor predeterminado) | mediante la copia de seguridad de Kept |
| `kept-config` | las `KEPT_SECRET_KEY` y `KEPT_AUTH_SECRET` generadas, y las contraseñas de los inicios de sesión `kept_app`, `kept_auth` y `kept_system` | guarda el kit de recuperación; las contraseñas se vuelven a crear si se pierden |
| `kept-owner` | la contraseña del inicio de sesión `kept_owner` | no; se vuelve a crear si se pierde |
| `caddy-data`, `caddy-config` | los certificados de Caddy (el perfil `https` de `compose.full.yaml`) | no; Caddy obtiene unos nuevos |

El superusuario de la base de datos no tiene contraseña que alguien necesite: se accede solo desde dentro del
contenedor de la base de datos, como `docker compose exec db psql -U postgres`, y por bootstrap, que
comparte la red de ese contenedor. A través de la red cada inicio de sesión necesita su contraseña. Nunca publiques
el puerto del servicio `db` (sin `ports:` en él): Kept lo alcanza a través de la red de compose.

Los contenedores de Kept se ejecutan como un usuario sin privilegios de root (uid 10001) con un sistema de archivos raíz de solo lectura, todas las capacidades de Linux
eliminadas y `no-new-privileges`. El servicio `migrate` tiene el inicio de sesión del propietario
de la base de datos; el contenedor que sirve no lo ve (el volumen `kept-owner` no está montado allí) hasta que le
das uno para la copia de seguridad nocturna ([copias de seguridad](/es/admin/backups/#activarlo)). `init` es la única
excepción a la regla de no-root: se ejecuta como root, sin red y solo con las capacidades que
crean `.env` en tu carpeta y te lo dan, y luego termina.

## Sin terminal

Portainer, Dockge y herramientas similares toman `compose.yaml` (o `compose.full.yaml`) tal cual. No ejecutan `init`, así que define dos
variables en su editor de entorno en su lugar: `KEPT_PUBLIC_URL` (la dirección, como arriba) y
`KEPT_SETUP_CODE` (seis caracteres de 0–9 y A–Z sin I, L, O y U, como `KPT-2X9`; o déjalo
vacío y lee el código del registro de Kept). Fija `KEPT_IMAGE` a una versión si la herramienta no lo hace.

## Una instalación anterior a la 1.13.0

Una instalación hecha con una copia del repositorio tiene las cinco líneas `KEPT_DB_*_PASSWORD` en `.env`.
Con este `compose.yaml` se usan exactamente como se dan, y no se genera nada: actualiza el
checkout (o descarga el nuevo `compose.yaml` junto al `.env` anterior) y ejecuta
`docker compose up -d`. Eliminar esas líneas más tarde, o volver a escribir `.env` con `init`, también es seguro:
el siguiente inicio genera nuevas contraseñas y las establece en Postgres. Un `KEPT_IMAGE` vacío solía compilar el
checkout; ahora ejecuta la versión que nombra `compose.yaml`, así que configura `KEPT_IMAGE=kept:local`
si compilas el tuyo.

## Web y worker por separado

Un contenedor sirve la app web y ejecuta los trabajos en segundo plano (`KEPT_ROLE=all`, el valor predeterminado). Para
separarlos, ejecuta un segundo servicio Kept con `KEPT_ROLE=worker` junto a uno con `KEPT_ROLE=web`. Un
worker no sirve HTTP; el healthcheck de la imagen sigue `KEPT_ROLE` y comprueba el bucle de trabajos del worker
en su lugar, así que ninguno necesita una sobrescritura (`compose.full.yaml` tiene los dos servicios comentados). El
worker ejecuta la copia de seguridad nocturna, por lo que es el que necesita el inicio de sesión del propietario y el
montaje del directorio de destino.
