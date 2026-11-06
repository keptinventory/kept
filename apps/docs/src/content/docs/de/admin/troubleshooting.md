---
title: Fehlerbehebung
description: Echte Fehlerfälle eines Kept-Servers, was jeweils die Ursache ist und die Lösung.
---

Jeder Eintrag ist ein Symptom mit seiner Ursache und der Lösung. Die Befehle setzen Docker Compose voraus; unter Helm gelten dieselben Prüfungen für die Pods.

## Zuerst nachsehen

- **Admin → Status** nennt die meisten Probleme von selbst: Mail, fehlgeschlagene Hintergrundjobs, den Erinnerungsscan, Backups und den Wiederherstellungstest, Laufwerke, die Veröffentlichung und ihre Migrationen, HTTPS.
- **Die Logs:** `docker compose logs kept` und `docker compose logs migrate`. `KEPT_LOG_FORMAT=pretty` macht sie fürs Auge lesbar; `KEPT_LOG_LEVEL` (Standard `info`) setzt das Level.
- **Eine Anfrage-ID:** jede Antwort trägt `x-request-id`; suche im Log danach, um die Zeile zu finden, die zu einer Meldung gehört.
- **Die Probes:** `/healthz` (der Prozess bedient HTTP), `/readyz` (beide Datenbankverbindungen antworten), `/version` (Version, Commit, Quelle). Siehe [Monitoring](/de/admin/observability/).
- **Prüfungen, die du ausführen kannst:** `kept admin backup verify`, `kept admin storage verify --store local` (oder `s3`) und `kept admin config` ([die CLI](/de/admin/cli/)).

## `docker compose up` bleibt beim `bootstrap`-Dienst stehen

**Ursache:** der einmalige `bootstrap` (`kept bootstrap`) konnte die Datenbank-Logins nicht einrichten. Sein Log sagt warum: `docker compose logs bootstrap`. Häufige Fälle: das Image ist älter als 1.13.0 und hat keinen `bootstrap`-Befehl (setze `KEPT_IMAGE` auf 1.13.0 oder später); oder der Loopback der Datenbank wurde so eingerichtet, dass er ein Passwort braucht, und `KEPT_DB_SUPERUSER_PASSWORD` in `.env` enthält es nicht.

**Lösung:** korrigiere, was die Zeile nennt, und führe `docker compose up -d` erneut aus; den bootstrap kannst du beliebig oft laufen lassen.

## Kept beendet sich beim Start mit `kept: invalid environment: …` oder einer anderen `kept:`-Zeile

**Ursache:** die Umgebung wird geprüft, bevor etwas startet, und das erste Problem stoppt den Prozess mit einer Zeile, die es nennt. Häufige Fälle:

| Was die Zeile sagt | Lösung |
|---|---|
| `kept: invalid environment: KEPT_PUBLIC_URL` | Setze die Adresse: `docker compose run --rm init` ([Installation](/de/install/compose/#1-env-schreiben)) |
| `KEPT_DATABASE_URL has no password, and KEPT_DB_APP_PASSWORD_FILE: … does not exist` | Der bootstrap ist noch nicht gelaufen: starte mit `docker compose up -d`, das ihn zuerst ausführt, nicht allein `docker compose up kept` |
| `KEPT_SECRET_KEY and KEPT_AUTH_SECRET are set together or not at all` | Setze beide, oder entferne beide, um das generierte Paar im Konfigurations-Volume zu nutzen |
| `<path>/secrets.json exists but …; fix or restore it` | Die generierte Keys-Datei ist beschädigt: stelle die Keys aus [dem Wiederherstellungskit](/de/admin/recovery-kit/) wieder her |
| `KEPT_BACKUP_DIR is inside KEPT_DATA_DIR …` | Zeige das Backup auf eine andere Festplatte |
| `a backup target is set, and the nightly backup dumps the database as kept_owner …` | Gib dem Worker `KEPT_OWNER_DATABASE_URL` ([Backups](/de/admin/backups/#aktivieren)) |
| `set one backup target, not …` | Behalte nur eine dieser Einstellungen: `KEPT_BACKUP_DIR`, `KEPT_BACKUP_S3_BUCKET`, `KEPT_BACKUP_SFTP` |
| `KEPT_STORAGE=s3 needs …` | Füge die S3-Einstellungen hinzu, die es nennt ([Speicher](/de/admin/storage/)) |
| `KEPT_OIDC_ISSUER is set without KEPT_OIDC_CLIENT_ID` | Füge die Client-ID hinzu, oder entferne den Issuer |

Jede Variable steht in der [Konfigurationsreferenz](/de/reference/configuration/).

## Datenbankpasswort in `.env` geändert, und jetzt verbindet sich nichts mehr

**Ursache:** mit dem `compose.yaml` von Kept 1.13.0 behebt sich das von selbst: der Bootstrap setzt bei jedem `docker compose up -d` das Passwort jedes Logins auf das in `.env` (oder dessen Datei). Es tritt mit einem älteren `compose.yaml` auf, das die Passwörter einmal setzte, als das `kept-db`-Volume erstellt wurde.

**Lösung:** nutze das aktuelle `compose.yaml` und führe `docker compose up -d` aus. Mit der alten Datei ändere das Passwort der Rolle in Postgres passend und starte dann neu:

```sh
docker compose exec db psql -U postgres -c "ALTER ROLE kept_app PASSWORD '<the new password>'"
```

(Die Rolle ist `kept_owner`, `kept_app`, `kept_auth` oder `kept_system`, passend zur Variable.)

## `/readyz` antwortet 503

**Ursache:** eine der beiden Datenbankverbindungen des Webs (`app` und `system`, im Antwortkörper als `false` angezeigt) kann keine Abfrage ausführen. Im Log steht `readiness check failed`. Beim Start wartet Kept etwa zwei Minuten auf eine Datenbank, die noch startet, bevor es aufgibt.

**Lösung:** prüfe, ob `docker compose ps db` gesund ist und ob der Login `false` das richtige Passwort hat (siehe oben). Bei verwaltetem Postgres prüfe, ob die vier Logins existieren ([verwaltetes Postgres](/de/install/managed-postgres/#die-vier-logins)).

## "Dieses Kept ist für … eingerichtet" oder "Die Anfrage kam nicht von dieser Website."

- **Die App:** "Dieses Kept ist für *Adresse* eingerichtet. Öffne es dort.", auf der Anmeldeseite oder als Leiste oben in der App, wenn ein Speichern verweigert wird.
- **Die API:** 403, "Die Anfrage kam nicht von dieser Website."

**Ursache:** ein Schreibvorgang, der Kepts Cookie trägt, muss genau vom Origin von `KEPT_PUBLIC_URL` kommen, oder von einer der `KEPT_EXTRA_ADDRESSES`: Schema, Host und Port. Kept vergleicht ihn mit dem `Origin`-Header des Browsers, der die Adresse in der Adressleiste ist; ein Reverse-Proxy dazwischen ändert nichts. Kept an einer anderen Adresse zu öffnen (eine IP statt des Namens, `http` statt `https`, ein anderer Port, die interne Adresse des Proxys) macht jeden Schreibvorgang zu einem 403. Links, QR-Codes und Einladungs-Mails werden aus demselben Wert gebaut, und Passkeys werden für dessen Host-Namen registriert.

**Lösung:** setze `KEPT_PUBLIC_URL` genau auf das, was die Adressleiste des Browsers zeigt, starte neu, und öffne Kept immer dort. Wenn du Kept unter zwei echten Adressen erreichst, etwa einem LAN-Namen und einem Tailscale-Namen, liste die anderen in `KEPT_EXTRA_ADDRESSES` auf ([Mehr als eine Adresse](/de/install/home-network/#mehr-als-eine-adresse)).

## Kept startet nach einem Upgrade nicht, und `migrate` endete mit einem Fehler

**Ursache:** der `kept`-Dienst startet erst, nachdem `migrate` erfolgreich war. Vor dem Migrieren einer Datenbank, die Daten enthält, nimmt `kept migrate` einen Vor-Upgrade-Snapshot, wenn ein Backup-Ziel gesetzt ist; **schlägt der Snapshot fehl, wird nichts migriert** und es endet mit dem Grund ([Upgrades](/de/admin/upgrades/#der-snapshot-vor-jedem-upgrade)).

**Lösung:** lies `docker compose logs migrate`, repariere das Backup (Ziel, Passwort, Einbindung bei `migrate`) und führe `docker compose up -d` erneut aus. Um bewusst ohne Snapshot zu aktualisieren, setze `KEPT_UPGRADE_SNAPSHOT=off` für diesen Lauf.

## Kept verweigert den Start mit `downgrade_refused`

**Ursache:** das Image ist mehr als eine Veröffentlichung älter als die Datenbank (oder die Datenbank hat Migrationen, die keine veröffentlichte Version gemacht hat). Eine Version zurück ist erlaubt; mehr nicht.

**Lösung:** führe die neuere Veröffentlichung erneut aus, oder [stelle](/de/admin/restore/) den Vor-Upgrade-Snapshot wieder her, den die ältere genommen hat. `KEPT_ALLOW_DOWNGRADE=1` erzwingt den Start und wird protokolliert; verwende es nur, wenn die Notizen einer Veröffentlichung es sagen ([eine Version zurückgehen](/de/admin/upgrades/#eine-version-zurückgehen)).

## Der Einrichtungscode ist verloren, oder die Einrichtung ist gesperrt

**Ursache:** der Code wird genau einmal ausgegeben, von dem Prozess, der ihn erstellt hat. Falsche Codes sperren die Adresse aus, die sie gesendet hat, und viele falsche Codes sperren die Instanz aus.

**Lösung:** `docker compose run --rm migrate admin setup-code` stellt einen neuen Code aus und hebt die instanzweite Sperre auf; eine Sperre pro Adresse endet von selbst. Wenn alle gleichzeitig ausgesperrt sind, lies den nächsten Eintrag.

## Alle stoßen an dieselben Anmeldegrenzen

**Ursache:** hinter einem Reverse-Proxy sieht Kept für jeden Besucher die Adresse des Proxys, sofern der Proxy nicht in `KEPT_TRUSTED_PROXIES` steht, also teilen sich alle einen Satz Grenzen.

**Lösung:** trage die Adresse des Proxys, wie Kept sie sieht, in `KEPT_TRUSTED_PROXIES` ein ([Reverse-Proxies](/de/install/reverse-proxy/#vertraue-dem-proxy--und-nur-dem-proxy)).

## Uploads schlagen fehl, oder große Fotos kommen nie an

**Ursache:** Kept lehnt eine Datei über `KEPT_MAX_FILE_MB` (standardmäßig 25 MB) mit 413 ab. Ein Proxy davor hat oft ein kleineres Body-Limit und schlägt zuerst fehl.

**Lösung:** setze das Limit des Proxys mindestens auf `KEPT_MAX_FILE_MB` ([Uploads durchlassen](/de/install/reverse-proxy/#lass-uploads-durch)).

## Kamera, Installation, Push oder Standort funktionieren auf Smartphones nicht

**Ursache:** Smartphones erlauben sie nur auf einem sicheren Origin; eine LAN-Adresse über einfaches HTTP ist keiner. Über HTTP lehnt Kept außerdem das Anzeigen von geheimen Werten, Exporten, Zugangs-Tokens, OAuth-Verbindungen, dem Download des Wiederherstellungskits und Backup-Einstellungen ab.

**Lösung:** [Setze Kept auf HTTPS](/de/install/https/) und setze `KEPT_PUBLIC_URL` auf die `https://`-Adresse.

## Speichern eines KI-Anbieters oder Webhooks schlägt fehl: "Diese Adresse liegt in einem privaten Netzwerk."

**Ursache:** ausgehende Anfragen werden zu privaten, Loopback- und reservierten Adressen abgelehnt (`private_address`). Ein Anbieter in deinem eigenen Netzwerk, einschließlich `http://ollama:11434/v1` von Compose, löst auf eine solche auf.

**Lösung:** ein Instanz-Admin schaltet **Admin → Einstellungen → Private Adressen erlauben** ein. Siehe das [Sicherheitsmodell](/de/admin/security-model/#ausgehende-anfragen-ssrf).

## Es kommt keine Mail an

**Ursache:** ohne `KEPT_SMTP_URL` und `KEPT_SMTP_FROM` wird Mail nur als fällig protokolliert, und Admin → Status sagt, dass Mail nicht konfiguriert ist.

**Lösung:** setze beide und starte neu ([Installation](/de/install/compose/#5-weiter)).

## Backups laufen nicht, oder die Meldung "Backup veraltet" erscheint

**Ursache:** meist eines von: kein Ziel oder kein Passwort (es gibt kein unverschlüsseltes Backup), der Worker ohne `KEPT_OWNER_DATABASE_URL`, ein Verzeichnisziel, das nicht in den Container eingebunden ist, oder eines, das nicht Kepts Benutzer gehört (uid 10001).

**Lösung:** folge [Backups](/de/admin/backups/#aktivieren), führe dann eine manuell aus und lies, was sie sagt:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup
```

Bei einer Warnung beendet es sich mit 1, namentlich:

| Warnung | Bedeutung und was zu tun ist |
|---|---|
| `backup_suspicious_size` | viel kleiner als das letzte gute; wenn die Schrumpfung real ist, `kept admin backup --accept-size` |
| `files_unreadable` | restic konnte einige Dateien nicht lesen; prüfe die Berechtigungen des Daten-Volumes |
| `blob_checksum_mismatch` | eine gespeicherte Datei stimmt nicht mehr mit ihrem SHA-256 überein; prüfe die Festplatte |
| `readable_incomplete` | die lesbare Kopie eines Speicherorts ist fehlgeschlagen; das Log nennt sie |

Nach einem Absturz kann ein veralteter restic-Lock jeden Lauf blockieren: `kept admin backup unlock` entfernt ihn (er verweigert, solange ein Backup läuft).

## Eine Wiederherstellung lässt sich nicht starten

**Ursache:** Kept stellt nur in eine **leere** Datenbank wieder her und prüft, dass `pg_restore` zur Postgres-Major-Version des Servers passt und dass die Erweiterungen existieren.

**Lösung:** erstelle eine neue leere Datenbank mit den Erweiterungen, wie in [Wiederherstellung](/de/admin/restore/#wiederherstellen); zeige die Wiederherstellung niemals auf die laufende.

## Nach einer Wiederherstellung lassen sich Geheimniswerte und KI-Schlüssel nicht lesen

**Ursache:** sie sind mit `KEPT_SECRET_KEY` versiegelt, das nicht im Backup enthalten ist.

**Lösung:** trage die Keys des Wiederherstellungskits in `.env` ein (mit `KEPT_SECRET_KEY_VERSION` und `KEPT_SECRET_KEYS_RETIRED`, falls es sie auflistet) und starte neu. Wenn das Kit zurückgezogene Keys auflistet, führe `kept admin rotate-key --resume` aus, sobald Kept läuft. Ohne den Key sind diese Werte für immer verloren.

## `kept admin` meldet `KEPT_OWNER_DATABASE_URL … is required`

**Ursache:** die meisten Admin-Befehle brauchen das Login des Datenbank-Eigentümers, das nur der `migrate`-Dienst hat.

**Lösung:** führe sie aus als `docker compose run --rm migrate admin <command>`, oder gib für `rotate-key`, `backup`, `restore` und `export` dem `kept`-Dienst das Eigentümer-Login in `compose.override.yaml` ([die CLI](/de/admin/cli/#unter-compose-ausführen)).

## Ein reiner Worker-Container gilt als ungesund

**Ursache:** mit `KEPT_ROLE=worker` liest der Healthcheck die Datei, die die Job-Schleife berührt (`/tmp/kept-worker-alive`); er schlägt fehl, wenn die Schleife zwei Minuten lang nicht bei der Datenbank abgefragt hat.

**Lösung:** prüfe das Log des Workers und seine Datenbankverbindung; dieselben Datenbankprüfungen wie für `/readyz` gelten.

## Immer noch nicht weitergekommen

Öffne ein Issue mit der Version aus `/version`, wie Kept läuft, und den relevanten Log-Zeilen, aus denen alle privaten Daten entfernt wurden. Ein Sicherheitsproblem läuft stattdessen über private Meldung von Sicherheitslücken ([Sicherheitsmodell](/de/admin/security-model/#melden-einer-sicherheitslücke)).
