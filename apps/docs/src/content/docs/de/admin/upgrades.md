---
title: Upgrades und Rollback
description: Kept aktualisieren, den Snapshot, den es zuerst erstellt, um eine Version zurückzugehen, sowie Postgres-Major-Upgrades.
sidebar:
  order: 5
---

## Aktualisieren

Mit Compose setzt du `KEPT_IMAGE` in `.env` auf die neue Version und:

```sh
docker compose pull
docker compose up -d
```

Dein eigener Build aus einem Checkout: `git pull`, `docker build -t kept:local .`, dann
`docker compose up -d` mit `KEPT_IMAGE=kept:local`.

Eine Version kann auch `compose.yaml` ändern; die Release-Notes sagen dir das. Lade die Datei der
Version über deine (`curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.yaml`,
oder `compose.full.yaml`, falls du diese nutzt); `.env` bleibt wie sie ist.

### Einstellungen, die die neue compose.yaml brauchen

`compose.yaml` gibt Kept nur die Einstellungen weiter, die es benennt, und keine anderen. Ein Upgrade
auf 1.14.5, das nur `KEPT_IMAGE` ändert, behält die Datei von 1.14.4 bei, die
`KEPT_HTTP_SIGN_IN_DAYS` oder `KEPT_EXTRA_ADDRESSES` nicht übergibt und `KEPT_TRUSTED_PROXIES` selbst
setzt. Diese Zeilen in `.env` tun nichts, bis du die `compose.yaml` von 1.14.5 (oder
`compose.full.yaml`) herunterlädst und `docker compose up -d` ausführst.

### Caddy und Ollama nach compose.full.yaml verschoben

Ab 1.14.5 läuft `compose.yaml` nur noch Kept und seine Datenbank. Caddy (das Profil `https`),
Ollama (das Profil `ollama`) und das auskommentierte Split-Deployment sind in `compose.full.yaml`:
die gleiche Datei plus diese. **Wenn du Caddy oder Ollama nutzt**, lade stattdessen
`compose.full.yaml` herunter und setze in `.env` `COMPOSE_FILE=compose.full.yaml`:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.full.yaml
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose --profile https up -d   # the profiles you use: https, ollama or both
```

Sonst wirft der nächste Download von `compose.yaml` Caddy weg: Compose nennt seinen Container
verwaist, und wenn er weg ist, läuft Kept nur noch auf http. Die Services von Kept, das Netzwerk
und die Volumes (Caddys Zertifikate in `caddy-data`, die Modelle in `ollama`) sind in beiden
Dateien gleich, also geht nichts verloren. Ohne Caddy oder Ollama ändert sich nichts.

**Hinter deinem eigenen Proxy** erreicht `KEPT_TRUSTED_PROXIES` in `.env` Kept ab 1.14.5. Vorher
setzte `compose.yaml` seinen eigenen Wert, sodass eine Zeile in `.env` ignoriert wurde und sich
alle Besucher das Anmelde-Limit der Proxy teilten. Ein Wert, der schon in `.env` steht, wirkt,
sobald du die `compose.yaml` von 1.14.5 heruntergeladen hast
([oben](#einstellungen-die-die-neue-composeyaml-brauchen)); einer in `compose.override.yaml` kann nach `.env`
umziehen. Mit Caddys in `compose.full.yaml` lässt du ihn leer oder behältst `172.29.72.200` in der
Liste ([Reverse-Proxies](/de/install/reverse-proxy/#vertraue-dem-proxy--und-nur-dem-proxy)).

### Anmeldelinks (1.14.0)

1.14.0 wechselt Kept zu better-auth 1.7.13, das eine Schwachstelle behebt: Der State eines
OAuth-Anmeldevorgangs konnte als Magischer Link genutzt werden, um sich als jemand anderes
anzumelden (GHSA-965c-763c-88jm). Ein per E-Mail verschickter Magischer Link oder eine vor dem
Upgrade gestartete Google- bzw. OIDC-Anmeldung funktioniert danach nicht mehr: Fordere einen neuen
Link an oder melde dich erneut an.

### Installation ohne Clone (1.13.0)

Seit 1.13.0 braucht `compose.yaml` keine Kopie des Repositorys und keine Datenbankpasswörter mehr:
ein Einmal-`bootstrap`-Dienst legt die Logins bei jedem Start an. Eine früher installierte Version
läuft wie bisher weiter: ihre fünf `KEPT_DB_*_PASSWORD`-Zeilen in `.env` werden wie angegeben
verwendet ([eine Installation von vor 1.13.0](/de/install/compose/#eine-installation-von-vor-1130)).
Zwei Dinge zu beachten: Ein leeres `KEPT_IMAGE` baut den Checkout nicht mehr (es führt die
`compose.yaml` der Version wie genannt aus), und die `compose.override.yaml` des nächtlichen
Backups liest das Passwort des Besitzers aus dem `kept-owner`-Volume, sobald `.env` es nicht mehr
enthält ([Backups](/de/admin/backups/#aktivieren)).

Der Einmal-`migrate`-Dienst führt zuerst `kept migrate` aus: die Migrationen laufen **einmal
unter einer Datenbank-Sperre**, bevor die neue Version Anfragen entgegennimmt. Kepts Migrationen
fügen nur hinzu (eine Spalte oder Tabelle wird nur über zwei Versionen hinweg entfernt oder
umbenannt), daher läuft die vorherige Version noch mit dem neuen Schema – das macht das
Zurückgehen überhaupt erst möglich.

Lies vor einem Major-Versionssprung (`1.x` auf `2.0`) die Release-Notes.

### Das Image ist umgezogen (1.8.0)

Seit 1.8.0 ist das Image `ghcr.io/keptinventory/kept` und das Chart
`oci://ghcr.io/keptinventory/charts/kept`. Versionen bis 1.7.1 bleiben unter
`ghcr.io/ibrahimroshdy/kept`, die keine neuen Versionen mehr bekommen. Zum Aktualisieren änderst
du den Imagenamen einmal:

- Compose: `KEPT_IMAGE=ghcr.io/keptinventory/kept:1.8.0`.
- Helm: `image.repository: ghcr.io/keptinventory/kept`, oder das Chart von seiner neuen Adresse
  installieren.

Der Signaturschlüssel bleibt der gleiche, also funktioniert
`cosign verify --key cosign.pub ghcr.io/keptinventory/kept:<version>` wie zuvor
([Release verifizieren](/de/admin/verify-release/)).

### Wissen, dass es eine neue Version gibt

Kept kann nach neuen Versionen suchen und ist **standardmäßig aus**. Eingeschaltet fragt es GitHub
einmal am Tag nach der neuesten Version des Repositorys, aus dem sein Image gebaut wurde, und
sendet nichts als die Anfrage (keine Versionsnummer, kein Instanz-Bezeichner). Nichts wird
heruntergeladen oder installiert. `KEPT_UPDATE_CHECK=true` schaltet es ein und sperrt es ein;
`false` sperrt es aus.

Der Schalter liegt in Admin → Sign-up, unter "New versions". Admin → Status sagt "Kept X is
available", wenn eine neuere Version existiert, und **Jetzt prüfen** fragt sofort nach.

## Der Snapshot vor jedem Upgrade

Wenn `kept migrate` ausstehende Migrationen in einer Datenbank mit Daten findet und ein Backup-Ziel
konfiguriert ist, macht es zuerst einen reinen Datenbank-restic-Snapshot mit dem Tag
`pre_upgrade`. **Schlägt der Snapshot fehl, wird nichts migriert** und der Befehl stoppt mit der
Begründung. Die letzten 3 Pre-Upgrade-Snapshots werden behalten.

- Kein Backup-Ziel: Kept migriert trotzdem, protokolliert es lautstark, und Admin → Status sagt,
  es sei "upgraded without a backup" gewesen, bis zum nächsten guten Backup.
- `KEPT_UPGRADE_SNAPSHOT=off` (oder `kept migrate --skip-snapshot`) überspringt ihn absichtlich.
- Die [Home Assistant-App](/de/install/home-assistant/) macht nie einen: Home Assistants Backup vor dem
  Update ist der Weg zurück.
- Eine nagelneue Datenbank macht nie einen.

Damit das funktioniert, braucht der `migrate`-Dienst die Schlüssel und die Backup-Einstellungen
sowie den Besitzer-Login. Die Compose-Datei liefert alle drei; bei einem Verzeichnisziel braucht es
zusätzlich seinen Mount auf `migrate` ([Backups](/de/admin/backups/#aktivieren)).

## Eine Version zurückgehen

Um zurückzurufen, startest du das Image der vorherigen Version erneut: `KEPT_IMAGE` wieder auf den
alten Tag, dann `docker compose up -d`. Es gibt keine Down-Migrationen; die vorherige Version läuft
mit dem neueren Schema.

Kept speichert die Migrationen jeder Version in der Datenbank und prüft beim Start:

- die Datenbank ist **eine Version voraus** gegenüber dem Image: Kept startet, und Admin → Status
  sagt, es sei von X zurückgerollt worden;
- **mehr als eine** Version voraus, oder voraus durch Migrationen, die keine verzeichnete Version
  gemacht hat: Kept verweigert den Start (`downgrade_refused`) und nennt beide Versionen. Das ist
  der Moment, um stattdessen den Pre-Upgrade-Snapshot
  [wiederherzustellen](/de/admin/restore/). `KEPT_ALLOW_DOWNGRADE=1` erzwingt den Start, und das
  Erzwingen wird auditiert.

Von 1.14.4 zurück auf 1.14.3: Die Karte von 1.14.3 hat ein 1 m Minimum. Ein Raum unter 1 m
Kantenlänge behält seine Größe, bis jemand in **Anordnen** auf **Erledigt** tippt, was ihn auf
1 m speichert (oder ablehnt, falls er dann mit dem nächsten Raum überlappt). Um diese Größen zu
behalten, ordne die Karte nicht an, bis du wieder auf 1.14.4 bist.

## Postgres-Major-Upgrades

Kepts Compose-Datei pinnt Postgres 18 auf einen Digest, und seine Dependency-Updates schlagen nie
ein Major-Bump vor. Eine neue Major-Version ist ein **Dump und Restore**, nie eine Tag-Änderung am
bestehenden Volume (die Datenbankdateien einer Major-Version lassen sich in einer anderen nicht
öffnen):

1. Mach ein Backup und lass es fertiglaufen:
   `docker compose run --rm --no-deps --entrypoint kept kept admin backup`.
2. Stoppe Kept: `docker compose stop kept`.
3. Ändere das `db`-Image auf die neue Major-Version, auf einem **neuen** Volume (benenne
   `kept-db` in `compose.yaml` um, oder verschiebe das alte zur Seite); behalte das alte Volume,
   bis du fertig bist.
4. `docker compose up -d db`: das Init-Skript legt Rollen und Extensions in der leeren Datenbank
   an.
5. [Stelle](/de/admin/restore/#nach-dem-verlust-des-servers) das Backup darin wieder her, dann
   `docker compose up -d`.

Das Image von Kept enthält die Client-Werkzeuge der Postgres-Major-Version, die es unterstützt,
und die Wiederherstellung prüft, ob sie zum Server passen.
