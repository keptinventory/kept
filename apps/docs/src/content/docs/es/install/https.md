---
title: Pon Kept en HTTPS
description: "Por qué Kept quiere HTTPS y cómo conseguirlo: Caddy desde compose.full.yaml, Tailscale, NetBird, Twingate, Cloudflare Tunnel o tu propio proxy."
sidebar:
  order: 2
---

Kept funciona sobre HTTP sin cifrar, pero un teléfono considera insegura una dirección HTTP sin
cifrar, y varias cosas dejan de funcionar:

- **la cámara** (Kept pasa a un selector de archivos),
- **instalar Kept** en la pantalla de inicio, y trabajar sin conexión desde ella,
- **las notificaciones push**,
- **la ubicación**.

`localhost` cuenta como seguro; una dirección de la LAN sobre HTTP, no. Con un `KEPT_PUBLIC_URL` con
`https:`, Kept también marca sus cookies como `Secure` y envía HSTS; `KEPT_HSTS=off` lo desactiva
cuando servicios HTTP sin cifrar comparten el nombre de host ([HSTS](/es/install/reverse-proxy/#hsts)).

Algunas cosas que Kept rechaza directamente mientras `KEPT_PUBLIC_URL` sea `http:`, incluso en
`localhost`, porque entregan o cambian un secreto: mostrar un valor secreto, una exportación con
valores secretos, abrir los secretos de una exportación al importarla, crear un token de acceso en
el navegador, conectar una app con OAuth, descargar el kit de recuperación, y cambiar o probar los
ajustes de copia de seguridad. Una exportación sin valores secretos funciona, y una importación sin
ellos también. Las sesiones también son más cortas sobre HTTP. Mientras Kept se sirve sobre HTTP,
la lista de primeros pasos en Inicio pone "Pon Kept en HTTPS" primero, hasta que un admin elige
"Quedarme en mi red doméstica". Todo lo que funciona sobre HTTP sin cifrar, en una tabla: [Kept
en una red doméstica](/es/install/home-network/).

Sea cual sea la opción que elijas, pon `KEPT_PUBLIC_URL` en la dirección `https://` que la gente
abrirá y reinicia Kept.

## El perfil de Caddy de Compose

Para un nombre de dominio que apunta a esta máquina, con los puertos 80 y 443 accesibles desde
internet (Caddy acredita el dominio ante Let's Encrypt o ZeroSSL a través de ellos). Caddy viene
con `compose.full.yaml`, no con `compose.yaml` ([Caddy y Ollama](/es/install/compose/#caddy-y-ollama)):

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

Caddy lee `docker/caddy/Caddyfile` junto al archivo de Compose. Un clon del repositorio tiene ambos
archivos; una instalación sin uno los descarga una vez:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/docker/caddy/Caddyfile
docker compose --profile https up -d
```

Sin el archivo, `docker compose --profile https up -d` se detiene con "bind source path does not
exist". Cualquier otro proxy funciona en su lugar; reenvía al puerto de Kept, como en las
secciones siguientes.

Caddy obtiene y renueva el certificado y reenvía todo a Kept. Compose da a Caddy una dirección
fija en su propia red y pasa esa dirección a Kept como `KEPT_TRUSTED_PROXIES`, así que Kept
confía en el `X-Forwarded-For` de Caddy y en el de ningún otro. Luego puedes enlazar el HTTP sin
cifrar solo al loopback, con `KEPT_HTTP_PORT=127.0.0.1:8080`.

Si `172.29.72.0/24` choca con tu LAN, cambia la subred de la red, su `ip_range`, la
`ipv4_address` de Caddy y `KEPT_TRUSTED_PROXIES` juntos en `compose.full.yaml`.

## Tailscale

Para un Kept al que solo llegan tus propios dispositivos, sin ningún puerto abierto a internet: en
la máquina que ejecuta Kept, con los certificados HTTPS activados para tu tailnet,

```sh
tailscale serve --bg 8080
```

sirve Kept en `https://<machine>.<tailnet>.ts.net` con un certificado real, a cualquier dispositivo
del tailnet. Pon `KEPT_PUBLIC_URL` en esa dirección.

El proxy de Tailscale se ejecuta en la misma máquina y se conecta a Kept desde `127.0.0.1`; Kept
ve cada petición como si viniera de allí, a menos que confíes en él. En una instancia de un solo
hogar eso solo importa para [el bloqueo de configuración](/es/install/reverse-proxy/#el-bloqueo-de-la-configuración).

## NetBird

El proxy inverso de NetBird da a un puerto de un peer una dirección pública `https://` con un
certificado:

```sh
netbird expose 8080
```

Imprime la dirección. Pon `KEPT_PUBLIC_URL` en ella (o en tu propio dominio, con
`--with-custom-domain kept.example.org`, configurado primero en NetBird). La dirección es pública
a menos que elijas **NetBird-Only Access** para el servicio en el panel, lo que la limita a tus
peers. Un admin de la cuenta activa **Peer Expose** en Settings → Clients primero.

## Twingate

Twingate hace que Kept sea alcanzable para tus dispositivos sin abrir ningún puerto, pero el
certificado es tuyo: dale a Kept un nombre de host en un dominio que poseas (`kept.example.org`),
obtén un certificado para él con un desafío DNS (Caddy, Traefik o cert-manager pueden), y añade
ese nombre de host como un recurso de Twingate. Pon `KEPT_PUBLIC_URL` en `https://kept.example.org`.

## Cloudflare Tunnel

Para una dirección pública sin puerto abierto. Cloudflare sirve el nombre de host sobre HTTPS y
reenvía a Kept a través de `cloudflared`:

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

con `~/.cloudflared/config.yml`:

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

Pon `KEPT_PUBLIC_URL` en `https://kept.example.org`. Cloudflare Access puede poner un inicio de
sesión delante. Una dirección pública es también lo que necesita una app web como claude.ai para
[conectarse al servidor MCP de Kept](/es/users/mcp-clients/#conecta-como-conector-oauth).

`cloudflared`, como los otros túneles de aquí, llega a Kept desde la misma máquina; confía en él
como en [los proxies inversos](/es/install/reverse-proxy/#confía-en-el-proxy-y-solo-en-el-proxy).

## Tu propio proxy inverso

Cualquier proxy que termine TLS y reenvíe al puerto 8080 funciona. Lee [proxies
inversos](/es/install/reverse-proxy/) para ver las tres configuraciones que importan.

## Un certificado en el que solo confían tus dispositivos

En una LAN sin dominio, mkcert puede crear un certificado para la dirección de la máquina, servido
a través de cualquier proxy TLS. Cada teléfono debe entonces confiar en el certificado raíz de
mkcert; en un iPhone eso significa instalarlo como un perfil y activar la confianza total en
Settings → General → About → Certificate Trust Settings. Tailscale suele dar menos trabajo.
