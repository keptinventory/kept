---
title: Kept en una red doméstica
description: "Ejecuta Kept en tu red doméstica por HTTP sin cifrar: qué funciona, qué necesita HTTPS y por qué, y las dos formas de añadir HTTPS sin un dominio público: Tailscale, o Caddy con su propia autoridad de certificación."
sidebar:
  order: 3
---

Kept funciona en tu red doméstica en una dirección `http://` sin cifrar, como `http://192.0.2.20:8080`
o `http://kept.home.arpa:8080`. Tus propios datos funcionan ahí: añadir, encontrar y mover objetos,
fotos y archivos, etiquetas, informes, importaciones y exportaciones sin valores secretos.

Algunas cosas necesitan HTTPS. Unas porque Kept se niega a entregar una clave o mostrar un secreto
por una conexión que cualquiera en la red puede leer; otras porque los navegadores solo las permiten
en una dirección segura, algo que Kept no puede cambiar.

## Qué funciona por HTTP sin cifrar

| | Por HTTP sin cifrar | Por qué |
|---|---|---|
| Cosas, lugares, búsqueda, movimientos, etiquetas, informes | Funciona | |
| Fotos y archivos, elegidos desde el dispositivo | Funciona | |
| Importación (Homebox, CSV, una exportación de Kept) | Funciona | |
| Abrir los secretos de una exportación al importarla | Necesita HTTPS. Por HTTP sin cifrar el resto de la exportación se importa sin ellos | Kept: la frase de contraseña y los valores secretos |
| Exportación sin valores secretos | Funciona. Cada valor secreto se omite y se marca como omitido; la exportación se importa como de costumbre | Tus propios datos |
| Establecer un valor secreto | Funciona | |
| Mostrar un valor secreto | Necesita HTTPS | Kept: un secreto nunca se envía por HTTP sin cifrar |
| Exportación con valores secretos | Necesita HTTPS | Kept: los secretos y su frase de contraseña |
| Tokens para apps de IA (MCP) y Home Assistant | No desde el navegador. Créalos en el servidor: `kept admin token create` ([CLI](/es/admin/cli/#un-token-desde-el-servidor)) | Kept: un token es una clave |
| Conectar una app con OAuth (un conector) | Necesita HTTPS | Kept: OAuth necesita una dirección segura |
| Descargar el kit de recuperación | No desde el navegador. En el servidor: `kept admin recovery-kit` ([CLI](/es/admin/cli/)) | Kept: contiene las claves del servidor |
| Configuración de copias de seguridad y su prueba | Necesita HTTPS, o configúralas en el entorno del servidor ([configuración](/es/reference/configuration/)) | Kept: la contraseña de la copia de seguridad |
| Llaves de acceso | Necesita HTTPS | El navegador: no hay llaves de acceso en una dirección HTTP sin cifrar |
| La cámara, instalar Kept, trabajar sin conexión, notificaciones push, ubicación | Necesita HTTPS | El navegador |

Por HTTP sin cifrar un inicio de sesión también dura 12 horas y no se renueva; por HTTPS dura 30 días. Para
cambiar las 12 horas, consulta [Permanecer en tu red](#permanecer-en-tu-red).

Empezar en Home pide a un administrador de la instancia que ponga Kept en HTTPS. Si te quedas en tu red
doméstica, elige **Permaneciendo en mi red doméstica** y el paso cuenta como hecho. La línea HTTPS en la
parte superior de cada página también se puede descartar.

`localhost` cuenta como dirección segura en los navegadores, pero Kept se guía por `KEPT_PUBLIC_URL`: mientras sea
`http:`, las restricciones propias de Kept que se listan arriba también se aplican a `localhost`.

## Permanecer en tu red

Quien administre Kept puede cambiar dos cosas en el servidor: cuánto dura un inicio de sesión por HTTP sin cifrar,
y a qué direcciones responde Kept. Ninguna se puede cambiar desde la app, y Admin → Estado muestra
lo que está en vigor.

### Inicios de sesión más largos por HTTP sin cifrar

Por HTTP sin cifrar vuelves a iniciar sesión cada 12 horas. `KEPT_HTTP_SIGN_IN_DAYS` en `.env` lo hace durar esos
días, de 1 a 30, renovado a medida que lo usas. 7 va bien para una red doméstica o Tailscale:

```sh
KEPT_HTTP_SIGN_IN_DAYS=7
```

Luego `docker compose up -d`. En la app de Home Assistant es la opción **Sign-in length over http**.

Una instalación actualizada desde 1.14.4 cambiando solo `KEPT_IMAGE` conserva el `compose.yaml` antiguo,
que no pasa esta opción: [descarga el nuevo](/es/admin/upgrades/#configuraciones-que-necesitan-el-nuevo-composeyaml)
primero.

**El coste:** por HTTP sin cifrar una cookie de inicio de sesión puede ser copiada por cualquiera que vea el tráfico.
Con la opción activada, una copiada sigue funcionando mientras se use, hasta que ese dispositivo cierre sesión o se cierre la sesión en tus otros dispositivos. Así que úsala solo en una red en la
que confíes, y cierra sesión en un dispositivo que pierdas.

| | Sin configurar | Configurado |
|---|---|---|
| Un inicio de sesión por HTTP sin cifrar dura | 12 horas | Esos días |
| Se renueva | No | Una vez al día de uso (al día 1, tras medio día) |
| Por HTTPS | 30 días, renovado | 30 días, renovado: la opción no hace nada |
| Secretos y claves por HTTP sin cifrar | Rechazados | Rechazados |
| Acciones sensibles | Contraseña, o un inicio de sesión en los últimos diez minutos | Lo mismo; una renovación no cuenta como inicio de sesión |
| Cerrar sesión en todas partes | Finaliza todos los inicios de sesión | Finaliza todos los inicios de sesión |

Cualquier otro valor (0, 31, `7d`) detiene Kept al arrancar con un mensaje que indica lo que acepta. Dejarlo
vacío es lo mismo que omitirlo.

Activado, un inicio de sesión ya creado toma la duración más larga la próxima vez que se use. Desactivado, uno
caduca en su propio tiempo, hasta la duración que tuviera; para acabar con ellos antes, usa **Cerrar sesión en todas partes**
en Admin → Usuarios.

### Más de una dirección

Kept acepta inicios de sesión y guardados solo desde `KEPT_PUBLIC_URL`, por eso una segunda forma de llegar al mismo Kept,
un nombre de Tailscale junto a un nombre de LAN, o una IP junto a un nombre, dice "Este Kept está configurado para …".
`KEPT_EXTRA_ADDRESSES` lista las demás, separadas por comas, exactamente como las muestra el navegador:

```sh
KEPT_PUBLIC_URL=http://kept.lan:8080
KEPT_EXTRA_ADDRESSES=http://192.0.2.20:8080,http://<machine>.<tailnet>.ts.net:8080
```

Luego `docker compose up -d`. En la app de Home Assistant es la opción **Extra addresses**. Funciona
igual por HTTPS.

Una instalación actualizada desde 1.14.4 cambiando solo `KEPT_IMAGE` conserva el `compose.yaml` antiguo,
que no pasa esta opción: [descarga el nuevo](/es/admin/upgrades/#configuraciones-que-necesitan-el-nuevo-composeyaml)
primero.

| | `KEPT_PUBLIC_URL` | Una dirección extra |
|---|---|---|
| Usar Kept, iniciar sesión con contraseña o código de un solo uso | Sí | Sí |
| Un enlace por correo o restablecimiento de contraseña | Se abre aquí | Se abre en `KEPT_PUBLIC_URL` |
| Llaves de acceso | Sí, por HTTPS | No; una llave de acceso pertenece a una dirección |
| Inicio de sesión con Google y OIDC | Sí | El botón abre `KEPT_PUBLIC_URL` |
| Apps de IA (MCP, OAuth) | Sí | Conéctalas en `KEPT_PUBLIC_URL`: `/mcp` rechaza esta dirección, y el consentimiento de OAuth se rechaza aquí |
| Enlaces, etiquetas, códigos QR, correo, feeds de calendario | Apuntan aquí | Siguen apuntando a `KEPT_PUBLIC_URL` |

- **Cada dirección inicia sesión por separado y se instala como su propia app,** porque los navegadores guardan cookies
  y datos sin conexión por dirección. Cerrar sesión en una deja la otra con sesión iniciada; **Cerrar sesión
  en todas partes** cierra ambas. Las notificaciones push, cuando HTTPS las permite, se abren en la dirección en la
  que el dispositivo las activó. Dos puertos en un mismo nombre de host comparten sus cookies: los navegadores no las guardan
  por puerto.
- **Un enlace por correo** pedido en una dirección extra se abre en `KEPT_PUBLIC_URL` e inicia sesión ahí,
  no donde lo pediste. Un restablecimiento de contraseña establece la contraseña ahí; luego inicia sesión en la dirección en la
  que estabas. Si `KEPT_PUBLIC_URL` no se puede alcanzar desde donde estás, usa tu contraseña.
- **Llaves de acceso:** añádelas y úsalas en `KEPT_PUBLIC_URL`. Una dirección extra ofrece tu contraseña o un
  enlace por correo y explica por qué.
- **Direcciones exactas:** esquema, host y puerto, comparados completos. `http://kept.lan` no es
  `http://kept.lan:8080`, y `kept.lan.example.com` no es `kept.lan`. Un comodín, una ruta, un login o
  una mezcla de `http` y `https` detiene Kept al arrancar con un mensaje que indica cuál. Dejarlo vacío es
  lo mismo que omitirlo.
- **Cabeceras reenviadas:** `Host` y `X-Forwarded-*` no tienen ningún papel, así que tu proxy no puede añadir una dirección
  por accidente, ni quitarla. Apúntalo a Kept para cada dirección que listes.

**El coste:** una página servida en una dirección listada cuenta como el propio Kept, y puede usar el inicio de sesión de
quien la abra ahí. Así que lista solo las direcciones que lleguen a este Kept, con nombres e IPs que controles.

## Añadir HTTPS: primero Tailscale

El menor trabajo para un hogar: instala Tailscale en la máquina que ejecuta Kept y en cada teléfono
y equipo que lo use, activa los certificados HTTPS para tu tailnet y sirve Kept con

```sh
tailscale serve --bg 8080
```

Kept estará entonces en `https://<machine>.<tailnet>.ts.net`, con un certificado en el que ya confía
cada dispositivo, desde casa o fuera. Configura `KEPT_PUBLIC_URL` en esa dirección y reinicia Kept. Más en
[Poner Kept en HTTPS](/es/install/https/#tailscale).

## Añadir HTTPS: Caddy con su propia autoridad de certificación

Sin Tailscale y sin un dominio público, Caddy puede firmar un certificado para un nombre de red doméstica
él mismo (`tls internal`). Funciona, pero no es rápido: **cada dispositivo que abra Kept tiene que ser avisado
para confiar en el certificado raíz de Caddy**, uno por uno, por cada persona de la casa. Hasta que un dispositivo
confíe en él, su navegador muestra una advertencia de seguridad.

1. Elige un nombre que cada dispositivo pueda resolver hacia la máquina, por ejemplo `kept.home.arpa` (una entrada DNS
   en tu router, o una entrada en el archivo hosts de cada dispositivo).

2. Configúralo en `.env`:

   ```sh
   KEPT_DOMAIN=kept.home.arpa
   KEPT_PUBLIC_URL=https://kept.home.arpa
   ```

3. Caddy viene con `compose.full.yaml`: descárgalo junto con `docker/caddy/Caddyfile`, y configura
   `COMPOSE_FILE=compose.full.yaml` en `.env`, como en
   [Poner Kept en HTTPS](/es/install/https/#el-perfil-de-caddy-de-compose). Luego añade `tls internal` al
   Caddyfile:

   ```caddy
   {$KEPT_DOMAIN} {
   	tls internal
   	encode zstd gzip
   	reverse_proxy kept:8080
   }
   ```

4. Arranca Caddy y copia su certificado raíz desde su volumen de datos:

   ```sh
   docker compose --profile https up -d
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./kept-root.crt
   ```

5. Instala `kept-root.crt` en cada dispositivo y confía en él:
   - **iPhone y iPad:** envíalo al dispositivo (AirDrop o correo), instala el perfil en
     Ajustes → General → VPN y gestión de dispositivos, luego activa la confianza total para él en Ajustes →
     General → Información → Ajustes de confianza de certificados.
   - **Android:** en los ajustes de seguridad, instálalo como certificado de CA (el nombre del menú varía
     según el fabricante). Algunas apps ignoran los certificados instalados por el usuario.
   - **Equipos:** añádelo a los certificados de confianza del sistema (Llavero en un Mac, el
     administrador de certificados en Windows, el almacén de CAs de la distribución en Linux). Firefox puede mantener su
     propia lista.

La raíz de Caddy dura diez años; los certificados que firma con ella se renuevan por sí solos. La clave
privada de la raíz permanece en el volumen `caddy-data`: cualquiera que la copie puede firmar para cualquier nombre en el
que tus dispositivos confíen ahora, así que guarda ese volumen como una contraseña. [mkcert](/es/install/https/#un-certificado-en-el-que-solo-confían-tus-dispositivos) es la misma idea con
otra herramienta.

## Abrir Kept en la dirección correcta

Abre Kept en la dirección de `KEPT_PUBLIC_URL`. Si se abre en otra (la dirección IP de la máquina
mientras la URL llama a `kept.home.arpa`, por ejemplo), el inicio de sesión dice para qué dirección está configurado este Kept,
con un enlace a ella.
