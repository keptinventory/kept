---
title: Kept im Heimnetz
description: Kept in deinem Heimnetz über plain HTTP betreiben - was funktioniert, was HTTPS benötigt und warum, sowie zwei Wege, HTTPS ohne öffentliche Domain hinzuzufügen - Tailscale oder Caddy mit eigener Zertifizierungsstelle.
sidebar:
  order: 3
---

Kept funktioniert in deinem Heimnetz unter einer einfachen `http://`-Adresse, zum Beispiel `http://192.0.2.20:8080`
oder `http://kept.home.arpa:8080`. Deine eigenen Daten funktionieren dort: Dinge hinzufügen, finden und
verschieben, Fotos und Dateien, Beschriftungen, Berichte, Importe und Exporte ohne geheime Werte.

Ein paar Dinge benötigen HTTPS. Einiges, weil Kept sich weigert, einen Schlüssel herauszugeben oder ein
Geheimnis über eine Verbindung zu zeigen, die jeder im Netzwerk lesen kann; anderes, weil Browser dies nur auf
einer sicheren Adresse erlauben, was Kept nicht ändern kann.

## Was über plain HTTP funktioniert

| | Über plain HTTP | Warum |
|---|---|---|
| Dinge, Orte, Suche, Verschiebungen, Beschriftungen, Berichte | Funktioniert | |
| Fotos und Dateien, vom Gerät gewählt | Funktioniert | |
| Import (Homebox, CSV, ein Kept-Export) | Funktioniert | |
| Die Geheimnisse eines Exports beim Importieren öffnen | Benötigt HTTPS. Über plain HTTP importiert der Rest des Exports ohne sie | Kept: die Passphrase und die geheimen Werte |
| Export ohne geheime Werte | Funktioniert. Jeder geheime Wert wird ausgelassen und als ausgelassen markiert; der Export importiert wie üblich | Deine eigenen Daten |
| Einen geheimen Wert setzen | Funktioniert | |
| Einen geheimen Wert anzeigen | Benötigt HTTPS | Kept: ein Geheimnis wird niemals über plain HTTP gesendet |
| Export mit geheimen Werten | Benötigt HTTPS | Kept: die Geheimnisse und ihre Passphrase |
| Tokens für KI-Apps (MCP) und Home Assistant | Nicht aus dem Browser. Auf dem Server erstellen: `kept admin token create` ([CLI](/de/admin/cli/#ein-token-vom-server)) | Kept: ein Token ist ein Schlüssel |
| Eine App mit OAuth verbinden (ein Connector) | Benötigt HTTPS | Kept: OAuth benötigt eine sichere Adresse |
| Das Wiederherstellungskit herunterladen | Nicht aus dem Browser. Auf dem Server: `kept admin recovery-kit` ([CLI](/de/admin/cli/)) | Kept: es enthält die Schlüssel des Servers |
| Backup-Einstellungen und ihr Test | Benötigt HTTPS, oder in der Umgebung des Servers setzen ([Konfiguration](/de/reference/configuration/)) | Kept: das Backup-Passwort |
| Passkeys | Benötigt HTTPS | Der Browser: keine Passkeys auf einer plain-HTTP-Adresse |
| Kamera, Kept installieren, offline arbeiten, Push-Benachrichtigungen, Standort | Benötigt HTTPS | Der Browser |

Über plain HTTP hält eine Anmeldung auch nur 12 Stunden und wird nicht erneuert; über HTTPS hält sie 30
Tage. Um die 12 Stunden zu ändern, siehe [Bleiben in deinem Heimnetz](#bleiben-in-deinem-heimnetz).

Loslegen auf der Startseite fordert einen Instanz-Admin auf, Kept auf HTTPS zu setzen. Wenn du in deinem
Heimnetz bleibst, wähle **Ich bleibe in meinem Heimnetz** und der Schritt gilt als erledigt. Die HTTPS-Zeile
oben auf jeder Seite kann auch geschlossen werden.

`localhost` gilt in Browsern als sichere Adresse, aber Kept orientiert sich an `KEPT_PUBLIC_URL`: solange
dort `http:` steht, gelten Kepts eigene Verweigerungen oben auch auf `localhost`.

## Bleiben in deinem Heimnetz

Wer Kept betreibt, kann zwei Dinge auf dem Server ändern: wie lange eine Anmeldung über plain HTTP hält,
und auf welche Adressen Kept antwortet. Beides lässt sich nicht in der App ändern, und Admin → Status
zeigt, was aktuell gilt.

### Längere Anmeldungen über plain HTTP

Über plain HTTP meldest du dich alle 12 Stunden neu an. `KEPT_HTTP_SIGN_IN_DAYS` in `.env` macht daraus
so viele Tage, 1 bis 30, erneuert nach Nutzung. 7 passt zu einem Heimnetz oder Tailscale:

```sh
KEPT_HTTP_SIGN_IN_DAYS=7
```

Dann `docker compose up -d`. In der Home Assistant-App ist es die Option **Sign-in length over http**. Es
funktioniert über HTTPS gleich.

Eine Installation, die von 1.14.4 nur durch Ändern von `KEPT_IMAGE` aktualisiert wurde, hat noch das alte
`compose.yaml`, das diese Einstellung nicht übergibt: [lade das neue herunter](/de/admin/upgrades/#einstellungen-die-die-neue-composeyaml-brauchen)
zuerst.

**Der Preis:** über plain HTTP kann ein Anmelde-Cookie von jedem kopiert werden, der den Verkehr sehen kann.
Mit der Einstellung bleibt eine kopierte solange gültig, wie sie genutzt wird, bis sich dieses Gerät
abmeldet oder deine anderen Geräte abgemeldet werden. Beschränke es also auf ein Netzwerk, dem du
vertraust, und melde dich von einem Gerät ab, das du verlierst.

| | Nicht gesetzt | Gesetzt |
|---|---|---|
| Eine Anmeldung über plain HTTP hält | 12 Stunden | So viele Tage |
| Erneuert | Nein | Einmal pro Nutzungstag (bei 1 Tag, nach einem halben Tag) |
| Über HTTPS | 30 Tage, erneuert | 30 Tage, erneuert: die Einstellung bewirkt nichts |
| Geheimnisse und Schlüssel über plain HTTP | Abgelehnt | Abgelehnt |
| Sensible Aktionen | Passwort oder eine Anmeldung in den letzten zehn Minuten | Gleiches gilt; eine Erneuerung zählt nicht als Anmeldung |
| Überall abmelden | Beendet jede Anmeldung | Beendet jede Anmeldung |

Jeder andere Wert (0, 31, `7d`) stoppt Kept beim Start mit einer Meldung, die sagt, was nötig ist.
Leergelassen ist dasselbe wie ausgelassen.

Eingeschaltet nimmt eine bereits bestehende Anmeldung beim nächsten Nutzen die längere Dauer.
Ausgeschaltet läuft eine bis zu ihrer bisherigen Dauer aus; um sie früher zu beenden, nutze
**Überall abmelden** in Admin → Benutzer.

### Mehr als eine Adresse

Kept nimmt Anmeldungen und Speicherungen nur von `KEPT_PUBLIC_URL` entgegen, daher sagt eine zweite
Möglichkeit, denselben Kept zu erreichen - ein Tailscale-Name neben einem LAN-Namen oder eine IP neben
einem Namen - „Dieser Kept ist eingerichtet für …“. `KEPT_EXTRA_ADDRESSES` listet die anderen
kommagetrennt, genau wie der Browser sie anzeigt:

```sh
KEPT_PUBLIC_URL=http://kept.lan:8080
KEPT_EXTRA_ADDRESSES=http://192.0.2.20:8080,http://<machine>.<tailnet>.ts.net:8080
```

Dann `docker compose up -d`. In der Home Assistant-App ist es die Option **Extra addresses**. Es
funktioniert über HTTPS gleich.

Eine Installation, die von 1.14.4 nur durch Ändern von `KEPT_IMAGE` aktualisiert wurde, hat noch das alte
`compose.yaml`, das diese Einstellung nicht übergibt: [lade das neue herunter](/de/admin/upgrades/#einstellungen-die-die-neue-composeyaml-brauchen)
zuerst.

| | `KEPT_PUBLIC_URL` | Eine zusätzliche Adresse |
|---|---|---|
| Kept nutzen, Anmeldung mit Passwort oder Einmalcode | Ja | Ja |
| Ein E-Mail-Link oder Passwort-Zurücksetzen | Öffnet hier | Öffnet bei `KEPT_PUBLIC_URL` |
| Passkeys | Ja, über HTTPS | Nein; ein Passkey gehört zu einer Adresse |
| Google- und OIDC-Anmeldung | Ja | Der Button öffnet `KEPT_PUBLIC_URL` |
| KI-Apps (MCP, OAuth) | Ja | Dort verbinden bei `KEPT_PUBLIC_URL`: `/mcp` lehnt diese Adresse ab, und OAuths Zustimmung wird hier abgelehnt |
| Links, Beschriftungen, QR-Codes, Mail, Kalender-Feeds | Zeigen hierhin | Zeigen weiter auf `KEPT_PUBLIC_URL` |

- **Jede Adresse meldet sich separat an und installiert sich als eigene App,** weil Browser Cookies und
  Offline-Daten pro Adresse halten. Abmelden auf einer lässt die andere angemeldet; **Überall abmelden**
  beendet beide. Push-Benachrichtigungen, wo HTTPS sie erlaubt, öffnen auf der Adresse, auf der das Gerät
  sie eingeschaltet hat. Zwei Ports auf einem Hostnamen teilen sich ihre Cookies: Browser halten diese nicht
  pro Port.
- **Ein E-Mail-Link**, der auf einer zusätzlichen Adresse angefordert wird, öffnet bei `KEPT_PUBLIC_URL`
  und meldet dich dort an, nicht wo du gefragt hast. Ein Passwort-Zurücksetzen setzt das Passwort dort; dann
  melde dich auf der Adresse an, auf der du warst. Wenn `KEPT_PUBLIC_URL` von dort, wo du bist, nicht
  erreichbar ist, nutze dein Passwort.
- **Passkeys:** füge sie hinzu und nutze sie bei `KEPT_PUBLIC_URL`. Eine zusätzliche Adresse bietet dein
  Passwort oder einen E-Mail-Link an und sagt warum.
- **Exakte Adressen:** Schema, Host und Port, ganz verglichen. `http://kept.lan` ist nicht
  `http://kept.lan:8080`, und `kept.lan.example.com` ist nicht `kept.lan`. Ein Platzhalter, ein Pfad, ein
  Login oder eine Mischung aus `http` und `https` stoppt Kept beim Start mit einer Meldung, die sagt,
  welche. Leergelassen ist dasselbe wie ausgelassen.
- **Weitergeleitete Header:** `Host` und `X-Forwarded-*` spielen keine Rolle, sodass dein Proxy nicht aus
  Versehen eine Adresse hinzufügen oder entfernen kann. Richte ihn für jede Adresse, die du listest, auf
  Kept.

**Der Preis:** eine Seite, die unter einer gelisteten Adresse ausgeliefert wird, gilt als Kept selbst und kann
die Anmeldung desjenigen nutzen, der sie dort öffnet. Liste also nur Adressen, die diesen Kept erreichen,
unter Namen und IPs, die du kontrollierst.

## HTTPS hinzufügen: zuerst Tailscale

Der geringste Aufwand für einen Haushalt: Tailscale auf der Maschine installieren, die Kept betreibt, und auf
jedem Telefon und Computer, der es nutzt, HTTPS-Zertifikate für dein Tailnet einschalten, und Kept bereitstellen
mit

```sh
tailscale serve --bg 8080
```

Kept ist dann unter `https://<machine>.<tailnet>.ts.net`, mit einem Zertifikat, dem jedes Gerät bereits
vertraut, von zu Hause oder von unterwegs. Setze `KEPT_PUBLIC_URL` auf diese Adresse und starte Kept neu.
Mehr in [Kept auf HTTPS setzen](/de/install/https/#tailscale).

## HTTPS hinzufügen: Caddy mit eigener Zertifizierungsstelle

Ohne Tailscale und ohne öffentliche Domain kann Caddy ein Zertifikat für einen Heimnetz-Namen selbst
signieren (`tls internal`). Es funktioniert, aber es ist nicht schnell: **jedes Gerät, das Kept öffnet, muss
angewiesen werden, Caddys Root-Zertifikat zu vertrauen**, für jede Person im Haus einzeln. Bis ein Gerät ihm
vertraut, zeigt dessen Browser eine Sicherheitswarnung.

1. Wähle einen Namen, den jedes Gerät zur Maschine auflösen kann, zum Beispiel `kept.home.arpa` (ein
   DNS-Eintrag auf deinem Router oder ein Eintrag in der hosts-Datei jedes Geräts).
2. Setze ihn in `.env`:

   ```sh
   KEPT_DOMAIN=kept.home.arpa
   KEPT_PUBLIC_URL=https://kept.home.arpa
   ```

3. Caddy kommt mit `compose.full.yaml`: lade sie und `docker/caddy/Caddyfile` herunter, und setze
   `COMPOSE_FILE=compose.full.yaml` in `.env`, wie in [Kept auf HTTPS setzen](/de/install/https/#das-caddy-profil-von-compose).
   Dann füge `tls internal` zur Caddyfile hinzu:

   ```caddy
   {$KEPT_DOMAIN} {
   	tls internal
   	encode zstd gzip
   	reverse_proxy kept:8080
   }
   ```

4. Starte Caddy und kopiere dessen Root-Zertifikat aus dem Daten-Volume:

   ```sh
   docker compose --profile https up -d
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./kept-root.crt
   ```

5. Installiere `kept-root.crt` auf jedem Gerät und vertraue ihm:
   - **iPhone und iPad:** sende es an das Gerät (AirDrop oder Mail), installiere das Profil in
     Einstellungen → Allgemein → VPN & Geräteverwaltung, dann schalte volles Vertrauen dafür in
     Einstellungen → Allgemein → Info → Zertifikats-Vertrauenseinstellungen ein.
   - **Android:** in den Sicherheitseinstellungen installiere es als CA-Zertifikat (der Name des Menüs
     variiert je nach Hersteller). Manche Apps ignorieren nutzerinstallierte Zertifikate.
   - **Computer:** füge es den vertrauenswürdigen Zertifikaten des Systems hinzu (Schlüsselbundverwaltung
     auf einem Mac, der Zertifikatsmanager unter Windows, der CA-Speicher der Distribution unter Linux).
     Firefox kann eigene Listen behalten.

Caddys Root hält zehn Jahre; die Zertifikate, die er damit signiert, erneuern sich selbst. Der private
Schlüssel des Roots bleibt im `caddy-data`-Volume: wer ihn kopiert, kann für jeden Namen signieren, dem
deine Geräte nun vertrauen, also hüte dieses Volume wie ein Passwort. [mkcert](/de/install/https/#ein-zertifikat-das-nur-deinen-geräten-vertraut-wird)
ist dieselbe Idee mit einem anderen Werkzeug.

## Kept unter der richtigen Adresse öffnen

Öffne Kept unter der Adresse in `KEPT_PUBLIC_URL`. Wird es unter einer anderen geöffnet (etwa der
IP-Adresse der Maschine, während die URL `kept.home.arpa` heißt), sagt die Anmeldung, für welche
Adresse dieser Kept eingerichtet ist, mit einem Link dorthin.
