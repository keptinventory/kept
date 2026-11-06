---
title: Hinter einem Reverse-Proxy
description: Die Einstellungen, die wichtig sind, wenn Kept hinter nginx, Traefik, Caddy oder einem anderen Proxy läuft – vertrauenswürdige Adressen, Upload-Größen, welchen Hostnamen du verwendest, der Adressfehler und HSTS.
sidebar:
  order: 3
---

Kept lauscht auf Port 8080 und spricht Klartext-HTTP; der Proxy davor beendet TLS. Richte den
Proxy auf Port 8080, setze `KEPT_PUBLIC_URL` auf die Adresse, die Menschen öffnen, und prüfe die
Dinge unten. Das eigene [Caddy-Profil](/de/install/https/#das-caddy-profil-von-compose) von Compose macht die
ersten drei bereits.

## Vertraue dem Proxy – und nur dem Proxy

Kept begrenzt Anmeldungen, Setup-Codes und andere sensible Anfragen **pro Client-Adresse**. Hinter
einem Proxy kommt die Client-Adresse in `X-Forwarded-For` an, was jeder schreiben kann. Kept glaubt
das nur zu den Adressen in `KEPT_TRUSTED_PROXIES`:

```sh
KEPT_TRUSTED_PROXIES=10.0.0.5            # one proxy
KEPT_TRUSTED_PROXIES=10.0.0.5,10.0.1.0/24  # several, or a range
```

Kept geht `X-Forwarded-For` von rechts durch und hört bei der ersten Adresse auf, der es nicht
vertraut: Das ist der Client. Ist es leer (Standard), ist die Adresse des Sockets der Client. Trage
die Proxy-Adresse ein, wie Kept sie sieht (im Docker-Netzwerk die Adresse des Proxy-Containers,
nicht die des Hosts), und nichts, von wo ein Fremder Anfragen schicken könnte.

Mit Compose legst du es in `.env` neben `compose.yaml`. Vor 1.14.5 setzte `compose.yaml` seinen
eigenen Wert und eine Zeile in `.env` erreichte Kept nie; bei diesen Versionen setze es für den
`kept`-Dienst in einer `compose.override.yaml`. Bei Caddy aus `compose.full.yaml` lässt du es leer
(die Adresse von Caddy ist der Standard) oder behältst `172.29.72.200` in der Liste.

### Die Setup-Sperre

Falsche Setup-Codes sperren die Adresse, die sie geschickt hat, für eine Weile aus, und viele
falsche Codes sperren die ganze Instanz aus. Ist der Proxy nicht in `KEPT_TRUSTED_PROXIES`, teilen
sich alle Besucher die Adresse des Proxys, dann sperren die Versuche einer Person alle aus.
`kept admin setup-code` stellt einen neuen Code aus und hebt die instanzweite Sperre auf, aber nicht
die pro Adresse: diese endet von selbst.

## Lass Uploads durch

Der Proxy muss einen Request-Body akzeptieren, der mindestens so groß ist wie bei Kept, und sollte
Uploads nicht zwischenspeichern, wenn er sie nicht braucht:

| Upload | Kepts Limit |
|---|---|
| Ein Foto, Beleg oder Dokument | `KEPT_MAX_FILE_MB`, standardmäßig 25 MB; gestreamt, bei zu großer Größe vor dem Lesen mit 413 abgelehnt |
| Ein CSV-Import | 8 MB |

Die Standardwerte der meisten Proxies sind kleiner (zum Beispiel `client_max_body_size` von nginx);
erhöhe ihn auf mindestens `KEPT_MAX_FILE_MB`. Timeouts sollten einen großen Upload über eine
langsame Handyverbindung erlauben.

## Gib Kept einen eigenen Hostnamen

Betreib Kept auf einem Hostnamen, dessen übergeordnete Domain keine Seiten enthält, die du nicht
kontrollierst, oder auf einer eigenen Domain. Über HTTPS hat Kepts Session-Cookie das Präfix
`__Secure-`, was immer noch erlaubt, dass eine Seite auf einer **Geschwister**-Subdomain
(`other.example.org` neben `kept.example.org`) ein Cookie für `example.org` setzt, das Browser auch
an Kept senden. Ein von jemand anderem betriebener Geschwister könnte das nutzen, um eine Session
festzusetzen. Deine eigenen anderen Dienste auf Geschwister-Subdomains sind in Ordnung.

## "Diese Kept-Instanz ist für … eingerichtet"

Die App sagt "Diese Kept-Instanz ist für *address* eingerichtet. Öffne sie dort.", wenn sie unter
einer anderen Adresse als `KEPT_PUBLIC_URL` geöffnet wird.

- **Warum:** Kept akzeptiert Schreibvorgänge nur von der Adresse in `KEPT_PUBLIC_URL`, genau über
  den `Origin` des Browsers: Scheme, Host und Port. Der Proxy spielt keine Rolle; seine eigene
  Adresse und `X-Forwarded-*`-Header ändern das nicht.
- **Beheben:** Setze `KEPT_PUBLIC_URL` genau auf die Adresse, die Menschen öffnen
  (`https://kept.example.org`, nicht das Upstream des Proxys `http://kept:8080`), und starte Kept
  neu.
- **Mehr als eine Adresse:** `KEPT_EXTRA_ADDRESSES` listet die anderen auf, und jede muss ebenfalls
  über deinen Proxy zu Kept gelangen ([Mehr als eine Adresse](/de/install/home-network/#mehr-als-eine-adresse)).

Mehr dazu in [Fehlerbehebung](/de/admin/troubleshooting/#dieses-kept-ist-für--eingerichtet-oder-die-anfrage-kam-nicht-von-dieser-website).

## HSTS

Bei einem `https:` `KEPT_PUBLIC_URL` sendet Kept `Strict-Transport-Security: max-age=31536000`:
Browser öffnen diesen Hostnamen dann nur noch über https, für ein Jahr. Über `http:` sendet es
nichts.

- **Ganzer Hostname, jeder Port:** Ein Browser wendet die Richtlinie auf den Hostnamen an, nicht
  auf Kepts Port. Ein plain-http-Dienst unter dem gleichen Namen, etwa `http://server.lan:8081`
  neben Kept auf `https://server.lan`, wird dann zu https gezwungen und lädt nicht mehr. Browser
  ignorieren HSTS von einer IP-Adresse.
- **Ausschalten:** Setze `KEPT_HSTS=off`, wenn andere plain-http-Dienste Kepts Hostnamen teilen,
  und starte neu. Kept sendet dann `max-age=0`, sodass ein Browser, der die Richtlinie gespeichert
  hat, sie bei seinem nächsten https-Besuch bei Kept vergisst. Den Header einfach wegzulassen würde
  sie nicht löschen.
- **Dein Proxy:** Wenn er seinen eigenen `Strict-Transport-Security`-Header hinzufügt, schalte ihn
  dort ebenfalls aus.
- **Vorgeladene Domains:** Unter einer Top-Level-Domain auf der HSTS-Preload-Liste der Browser, wie
  `.dev` oder `.app`, ist jeder Name nur https, egal was Kept sendet.

### Eine gespeicherte Richtlinie manuell löschen

Wenn Kept über https nicht mehr erreichbar ist, gelangt `max-age=0` nicht zum Browser. Lösche den
Hostnamen in jedem Browser, der ihn besucht hat:

- **Chrome, Edge und andere Chromium-Browser:** Öffne `chrome://net-internals/#hsts` (in Edge
  `edge://net-internals/#hsts`), gib den Hostnamen unter **Delete domain security policies** ein
  und wähle **Löschen**.
- **Firefox:** History → Manage History, finde die Website, klicke mit rechts darauf und wähle
  **Forget About This Site**. Dadurch werden auch deren Verlauf, Cookies und gespeicherte Logins
  entfernt.
- **Safari auf einem Mac:** hat keine Seite für HSTS. Entferne die Daten der Website (Settings →
  Privacy → Manage Website Data, wähle sie aus, **Entfernen**); wenn plain http immer noch zu https
  wird, lösche auch den Verlauf (History → Clear History).
- **Safari auf einem iPhone oder iPad:** Settings → Apps → Safari (Settings → Safari vor iOS 18) →
  Advanced → Website Data, finde die Website und lösche sie; wenn das nicht reicht, **Clear
  History and Website Data** auf der Safari-Seite.
