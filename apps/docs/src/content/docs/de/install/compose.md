---
title: Installation mit Docker Compose
description: Führe Kept und Postgres mit Docker Compose auf deinem eigenen Server oder Homelab aus, melde dich zum ersten Mal an und bewahre die Schlüssel sicher auf.
sidebar:
  order: 1
---

Docker Compose ist der Weg, Kept auf einem Rechner zu betreiben: Kept selbst und Postgres 18 mit pgvector.
Caddy für HTTPS und Ollama für lokale KI kommen mit einer zweiten Datei
([Caddy und Ollama](#caddy-und-ollama)). Du brauchst Docker mit dem Compose-Plugin. Getestet auf einem Rechner mit
1 GB RAM und einem CPU-Kern; Kept und seine Datenbank nutzen davon etwa 200–400 MB
([was getestet wurde](/de/install/hardware/)).

Vier Schritte, ohne dass du das Repository kopieren oder Passwörter erzeugen musst:

```sh
mkdir kept && cd kept
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.yaml
docker compose run --rm init
docker compose up -d
```

`compose.yaml` arbeitet eigenständig, daher lässt sie sich auch in Portainer, Dockge und Ähnliches einfügen (siehe
[ohne Terminal](#ohne-terminal)).

:::note[Images]
Releases werden nach `ghcr.io/keptinventory/kept` veröffentlicht, getaggt als `1`, `1.2` und `1.2.3`, nie
`latest`; `1.0.0` ist der erste signierte. Die gleichen Images, mit demselben Schlüssel signiert, sind auf Docker
Hub als `keptinventory/kept`. `compose.yaml` startet die Veröffentlichung, mit der es veröffentlicht wurde, außer
`KEPT_IMAGE` in `.env` benennt eine andere; `init` schreibt die Version, mit der es lief, dorthin.
[Überprüfe es](/de/admin/verify-release/) zuerst, wenn du willst. Um ein eigenes Build zu starten, in einem Checkout:
`docker build -t kept:local .` und `KEPT_IMAGE=kept:local`.
:::

## Was läuft

| Service | Läuft |
|---|---|
| `db` | Postgres und bleibt laufen |
| `kept` | Kept auf Port 8080 und bleibt laufen |
| `bootstrap` | bei jedem Start einmal, dann beendet es sich: die Datenbank-Logins und Erweiterungen |
| `migrate` | bei jedem Start einmal, dann beendet es sich: die Datenbank-Migrationen |
| `init` | nur, wenn du es startest (`docker compose run --rm init`): schreibt `.env` |

## Caddy und Ollama

`compose.yaml` betreibt Kept allein. `compose.full.yaml` ist dieselbe Datei plus Caddy für HTTPS (das
`https`-Profil), Ollama für lokale KI (das `ollama`-Profil) und eine getrennte Web- und Worker-Bereitstellung,
auskommentiert. Sie funktioniert auch eigenständig. Um stattdessen sie zu nutzen:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.full.yaml
docker compose -f compose.full.yaml run --rm init
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose up -d
```

Mit `COMPOSE_FILE` in `.env` liest reines `docker compose` die `compose.full.yaml`, sodass jeder Befehl
in diesen Docs genauso funktioniert. Kepts Services, Netzwerk und Volumes sind in beiden Dateien gleich:
Eine Installation kann jederzeit wechseln und ihre Daten behalten.

## 1. `.env` schreiben

```sh
docker compose run --rm init
```

`init` fragt nach **der Adresse, unter der du Kept öffnest**, wie zum Beispiel `http://kept.home.arpa:8080` oder
`https://kept.example.org`. Links, die QR-Codes auf gedruckten Etiketten und die Same-Site-Prüfung werden daraus
erstellt, daher muss sie genau das sein, was der Browser zeigt, und sie sollte sich nicht ändern: **Verwende einen Namen
statt einer IP-Adresse.** Ein Heimrouter kann dieser Maschine eines Tages eine neue Adresse geben, und die Etiketten,
die du gedruckt hast, würden dann ins Leere zeigen. Setze den Namen im DNS deines Routers oder in der hosts-Datei
jedes Geräts. Eine IP-Adresse funktioniert weiterhin, wenn du sie bestätigst.

Dann schreibt es `.env` neben `compose.yaml` mit dieser Adresse (`KEPT_PUBLIC_URL`), dem Port
(`KEPT_HTTP_PORT`, aus einer `http://`-Adresse), dem Image und einem Setup-Code (`KEPT_SETUP_CODE`) und
zeigt den Code. `.env` enthält kein Passwort und kann nur von dir gelesen werden. Starte `init` erneut, um die Adresse
zu ändern: Es aktualisiert diese Zeilen und behält alles andere bei, das du hinzugefügt hast. Ohne Terminal gibst du
die Adresse auf der Kommandozeile an: `docker compose run --rm init --url http://kept.home.arpa:8080`.

Alles andere ist optional; `compose.env.example` und die
[Konfigurationsreferenz](/de/reference/configuration/) sagen dir, was jede Variable bewirkt.

## 2. Starte es

```sh
docker compose up -d
```

Compose startet die Datenbank und wartet, bis sie fehlerfrei läuft. Dann:

- **`bootstrap`** (einmalig, `kept bootstrap`) erstellt Kepts vier Datenbank-Logins und die
  Erweiterungen `pg_trgm`, `unaccent` und `vector`. Beim ersten Start erzeugt es das Passwort jedes Logins in einem
  Volume; bei jedem Start setzt es das Passwort jedes Logins auf diesen Wert, damit Postgres und Kept immer
  übereinstimmen.
- **`migrate`** (einmalig, `kept migrate`) wendet die Datenbank-Migrationen einmal an, unter einer Sperre.
- **Kept** startet auf Port 8080 (`KEPT_HTTP_PORT` ändert den Host-Port).

## 3. Einrichtung abschließen

Öffne die Adresse, gib den Setup-Code ein, den `init` gezeigt hat, und erstelle das erste Konto: Es wird zum
Instanz-Admin. Kept gibt den Code beim ersten Start auch in seinem Log aus:

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

Ein verlorener Code wird erneut ausgegeben mit:

```sh
docker compose run --rm migrate admin setup-code
```

Falsche Codes sperren für eine Weile, pro Adresse und für die ganze Instanz. Wenn Kept hinter einem Proxy sitzt,
dem es nicht vertraut, teilen sich alle die Adresse des Proxies; siehe
[Reverse-Proxys](/de/install/reverse-proxy/).

## 4. Behalte die Schlüssel

Beim ersten Start, wenn `KEPT_SECRET_KEY` und `KEPT_AUTH_SECRET` nicht gesetzt sind, erzeugt Kept beide im
Volume `kept-config` und gibt eine Zeile aus, die angibt, wo. Der geheime Schlüssel versiegelt jeden geheimen Wert
(KI-Schlüssel, die Passwörter, die du in Kept speicherst): **Ein Backup stellt alles wieder her, außer diese Werte,
es sei denn, du hast auch den Schlüssel.**

Drucke die Schlüssel aus und bewahre sie irgendwo anders als auf diesem Server auf, zum Beispiel in einem Passwort-Manager:

```sh
docker compose exec kept kept admin recovery-kit
```

Admin → Status bittet dich, das Recovery-Kit zu bestätigen, und Kept verlangt diese Bestätigung, bevor der erste
geheime Wert, ein KI-Schlüssel oder eine Backup-Einstellung angelegt wird. Siehe [das Recovery-Kit](/de/admin/recovery-kit/).

## 5. Weiter

- [Kept auf HTTPS setzen](/de/install/https/): Kamera, App-Installation, Push-Benachrichtigungen und
  Standort funktionieren nur über HTTPS.
- [Backups einrichten](/de/admin/backups/).
- Mail: Setze `KEPT_SMTP_URL` (`smtp://` oder `smtps://`, mit Zugangsdaten) und `KEPT_SMTP_FROM` für
  Passwort-Zurücksetzungen, Einladungen und Erinnerungen per E-Mail. Ohne sie erreichen Erinnerungen Menschen nur in der
  App, und Admin → Status sagt, dass Mail nicht konfiguriert ist.

## Was Compose erstellt

| Volume | Enthält | Sichern? |
|---|---|---|
| `kept-db` | die Postgres-Datenbank | über Kepts Backup, niemals durch Kopieren des Volumes, während es läuft |
| `kept-data` | hochgeladene Dateien (mit `KEPT_STORAGE=local`, dem Standard) | über Kepts Backup |
| `kept-config` | die erzeugten `KEPT_SECRET_KEY` und `KEPT_AUTH_SECRET` sowie die Passwörter der Logins `kept_app`, `kept_auth` und `kept_system` | bewahre das Recovery-Kit; die Passwörter werden neu erzeugt, wenn sie verloren gehen |
| `kept-owner` | das Passwort des Logins `kept_owner` | nein; es wird neu erzeugt, wenn es verloren geht |
| `caddy-data`, `caddy-config` | Caddys Zertifikate (das `https`-Profil von `compose.full.yaml`) | nein; Caddy erhält neue |

Der Superuser der Datenbank hat kein Passwort, das jemand braucht: Er ist nur von innerhalb des
Datenbank-Containers erreichbar, als `docker compose exec db psql -U postgres`, und vom Bootstrap, der
das Netzwerk dieses Containers teilt. Über das Netzwerk braucht jeder Login sein Passwort. Veröffentliche niemals den
Port des `db`-Services (kein `ports:` darauf): Kept erreicht ihn über das Compose-Netzwerk.

Kepts Container laufen als Nicht-root-Benutzer (uid 10001) mit einem schreibgeschützten Root-Dateisystem, jeder Linux-
Capability verworfen und `no-new-privileges`. Der Service `migrate` hält den Login des Datenbank-Owners; der
bereitstellende Container sieht ihn nie (das Volume `kept-owner` ist dort nicht eingehängt), bis du ihm für das nächtliche
Backup einen gibst ([Backups](/de/admin/backups/#aktivieren)). `init` ist die einzige Ausnahme von der Nicht-root-Regel:
Es läuft als root, ohne Netzwerk und nur mit den Capabilities, die `.env` in deinem Ordner erstellen und dir übergeben,
und beendet sich dann.

## Ohne Terminal

Portainer, Dockge und ähnliche Werkzeuge nehmen `compose.yaml` (oder `compose.full.yaml`), wie sie ist. Sie führen `init`
nicht aus, daher setze stattdessen zwei Variablen in ihrem Umgebungs-Editor: `KEPT_PUBLIC_URL` (die Adresse, wie oben) und
`KEPT_SETUP_CODE` (sechs Zeichen aus 0–9 und A–Z ohne I, L, O und U, wie `KPT-2X9`; oder lass es
leer und lies den Code aus Kepts Log). Pinne `KEPT_IMAGE` auf ein Release, wenn das Werkzeug es nicht tut.

## Eine Installation von vor 1.13.0

Eine Installation, die mit einer Kopie des Repositories erstellt wurde, hat die fünf Zeilen `KEPT_DB_*_PASSWORD` in `.env`.
Mit diesem `compose.yaml` werden sie genau so verwendet, wie angegeben, und es wird nichts erzeugt: Aktualisiere den
Checkout (oder lade die neue `compose.yaml` neben der alten `.env` herunter) und führe
`docker compose up -d` aus. Diese Zeilen später zu entfernen oder `.env` mit `init` neu zu schreiben, ist ebenfalls
sicher: Der nächste Start erzeugt neue Passwörter und setzt sie in Postgres. Ein leeres `KEPT_IMAGE` wurde früher
verwendet, um den Checkout zu bauen; jetzt startet es das Release, das `compose.yaml` benennt, also setze
`KEPT_IMAGE=kept:local`, wenn du selbst baust.

## Web und Worker eigenständig

Ein Container liefert die Web-App aus und führt die Hintergrundjobs aus (`KEPT_ROLE=all`, die Standardeinstellung). Um
sie zu trennen, starte einen zweiten Kept-Service mit `KEPT_ROLE=worker` neben einem mit `KEPT_ROLE=web`. Ein
Worker stellt kein HTTP bereit; der Healthcheck des Images folgt `KEPT_ROLE` und prüft stattdessen die Job-Schleife des
Workers, daher braucht keiner eine Überschreibung (`compose.full.yaml` hat die beiden Services auskommentiert). Der
Worker führt das nächtliche Backup aus, daher ist er derjenige, der den Owner-Login und den Mount des Zielverzeichnisses
braucht.
