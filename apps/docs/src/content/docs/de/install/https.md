---
title: Kept auf HTTPS setzen
description: Warum Kept HTTPS möchte und wie du es bekommst - Caddy aus compose.full.yaml, Tailscale, NetBird, Twingate, Cloudflare Tunnel oder dein eigener Proxy.
sidebar:
  order: 2
---

Kept funktioniert über einfaches HTTP, aber ein Telefon behandelt eine HTTP-Adresse als unsicher, und mehrere Dinge
funktionieren nicht mehr:

- **die Kamera** (Kept fällt zurück auf einen Dateiauswahl),
- **Kept installieren** auf dem Startbildschirm, und offline davon arbeiten,
- **Push-Benachrichtigungen**,
- **Standort**.

`localhost` gilt als sicher; eine LAN-Adresse über HTTP nicht. Mit einem `https:` `KEPT_PUBLIC_URL`
markiert Kept auch seine Cookies als `Secure` und sendet HSTS; `KEPT_HSTS=off` hebt es auf, wenn plain-http
Dienste den Hostnamen teilen ([HSTS](/de/install/reverse-proxy/#hsts)).

Einige Dinge lehnt Kept ab, solange `KEPT_PUBLIC_URL` auf `http:` steht, sogar auf `localhost`,
weil sie ein Geheimnis herausgeben oder ändern: einen geheimen Wert anzeigen, ein Export mit geheimen Werten, die Geheimnisse eines Exports beim Import öffnen, ein Zugriffstoken im Browser erstellen, eine App mit OAuth verbinden, das Wiederherstellungskit herunterladen und die Backup-Einstellungen ändern oder testen. Ein Export
ohne Geheimwerte funktioniert, ebenso ein Import ohne sie.
Sitzungen sind auch über HTTP kürzer. Während Kept über HTTP bereitgestellt wird, setzt die
„Erste-Schritte“-Checkliste auf dem Startbildschirm „Put Kept on HTTPS“ zuerst, bis ein Administrator
„Ich bleibe in meinem Heimnetzwerk“ wählt. Alles, was über einfaches HTTP funktioniert, in einer Tabelle:
[Kept im Heimnetzwerk](/de/install/home-network/).

Egal welche Methode du wählst, setze `KEPT_PUBLIC_URL` auf die `https://` Adresse, die Leute öffnen werden, und starte Kept neu.

## Das Caddy-Profil von Compose

Für einen Domainnamen, der auf diese Maschine zeigt, mit den Ports 80 und 443, die vom Internet erreichbar sind
(Caddy bestätigt die Domain bei Let's Encrypt oder ZeroSSL über sie). Caddy liegt bei
`compose.full.yaml` vor, nicht bei `compose.yaml` ([Caddy und Ollama](/de/install/compose/#caddy-und-ollama)):

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

Caddy liest die `docker/caddy/Caddyfile` neben der Compose-Datei. Ein Checkout des Repositorys hat
beide Dateien; eine Installation ohne sie lädt sie einmal herunter:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/docker/caddy/Caddyfile
docker compose --profile https up -d
```

Ohne die Datei gibt `docker compose --profile https up -d` den Fehler „bind source path does not
exist“ aus. Andere Proxys funktionieren stattdessen; sie leiten an Kept's Port weiter, wie in den folgenden Abschnitten.

Caddy erhält und erneuert das Zertifikat und leitet alles an Kept weiter. Compose gibt Caddy eine feste
Adresse in seinem eigenen Netzwerk und übergibt diese Adresse an Kept als `KEPT_TRUSTED_PROXIES`, sodass Kept
nur die `X-Forwarded-For`-Angabe von Caddy vertraut und keiner anderen. Anschließend kannst du plain HTTP
nur auf Loopback binden, mit `KEPT_HTTP_PORT=127.0.0.1:8080`.

Wenn sich `172.29.72.0/24` mit deinem LAN überschneidet, ändere das Subnetz des Netzwerks, seinen `ip_range`,
die `ipv4_address` von Caddy und `KEPT_TRUSTED_PROXIES` zusammen in `compose.full.yaml`.

## Tailscale

Für ein Kept, das nur von deinen eigenen Geräten erreicht werden kann, ohne offenen Port zum Internet: auf der Maschine,
auf der Kept läuft, mit aktivierten HTTPS-Zertifikaten für dein Tailnet,

```sh
tailscale serve --bg 8080
```

stellt Kept unter `https://<machine>.<tailnet>.ts.net` mit einem echten Zertifikat zur Verfügung, für jedes Gerät im
Tailnet. Setze `KEPT_PUBLIC_URL` auf diese Adresse.

Der Proxy von Tailscale läuft auf derselben Maschine und verbindet sich von `127.0.0.1` mit Kept;
Kept sieht jede Anfrage als von dort kommend an, es sei denn, du vertraust ihm. Bei einer Instanz für einen
einzelnen Haushalt ist das nur relevant für [die Sperre während der Einrichtung](/de/install/reverse-proxy/#die-setup-sperre).

## NetBird

Der Reverse-Proxy von NetBird gibt einem Peer-Port eine öffentliche `https://` Adresse mit Zertifikat:

```sh
netbird expose 8080
```

Es gibt die Adresse aus. Setze `KEPT_PUBLIC_URL` darauf (oder auf deine eigene Domain, mit
`--with-custom-domain kept.example.org`, das zuerst in NetBird eingerichtet werden muss). Die Adresse ist öffentlich,
außer du wählst **NetBird-Only Zugriff** für den Dienst im Dashboard, wodurch sie auf deine Peers beschränkt wird.
Ein Konten-Administrator schaltet **Peer freigeben** unter Einstellungen → Clients zuerst ein.

## Twingate

Twingate macht Kept auf deinen Geräten erreichbar, ohne einen Port zu öffnen, aber das Zertifikat
gehört dir: gib Kept einen Hostnamen auf einer Domain, die du besitzt (`kept.example.org`), besorge
ein Zertifikat dafür mit einer DNS-Herausforderung (Caddy, Traefik oder cert-manager können das),
und füge diesen Hostnamen als Twingate-Ressource hinzu. Setze `KEPT_PUBLIC_URL` auf `https://kept.example.org`.

## Cloudflare Tunnel

Für eine öffentliche Adresse ohne offenen Port. Cloudflare dient den Hostnamen über HTTPS und leitet
ihn über `cloudflared` an Kept weiter:

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

mit `~/.cloudflared/config.yml`:

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

Setze `KEPT_PUBLIC_URL` auf `https://kept.example.org`. Cloudflare Access kann eine Anmeldung davor
schalten. Eine öffentliche adresse ist auch das, was eine Web-App wie claude.ai benötigt, um
[mit dem MCP-Server von Kept zu verbinden](/de/users/mcp-clients/#als-connector-verbinden-oauth).

`cloudflared` erreicht, wie die anderen Tunnel hier, Kept von derselben Maschine aus; vertraue ihm wie in
[Reverse-Proxys](/de/install/reverse-proxy/#vertraue-dem-proxy--und-nur-dem-proxy).

## Dein eigener Reverse-Proxy

Jeder Proxy, der TLS beendet und an Port 8080 weiterleitet, funktioniert. Lies
[Reverse-Proxys](/de/install/reverse-proxy/) für die drei wichtigen Einstellungen.

## Ein Zertifikat, das nur deinen Geräten vertraut wird

In einem LAN ohne Domain kann mkcert ein Zertifikat für die Adresse der Maschine erstellen,
das über jeden TLS-Proxy bereitgestellt wird. Danach muss jedes Telefon das Stammzertifikat von mkcert
vertrauen; auf einem iPhone bedeutet das, es als Profil zu installieren und die volle Vertrauenswürdigkeit
in den Einstellungen → Allgemein → Über → Zertifikatvertrauenseinstellungen zu aktivieren. Tailscale ist
in der Regel weniger Aufwand.
