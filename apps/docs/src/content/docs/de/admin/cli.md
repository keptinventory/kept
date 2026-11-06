---
title: Die Betreiber-CLI
description: kept migrate und kept admin – was jeder Befehl tut und wie man ihn unter Compose ausführt.
sidebar:
  order: 7
---

Das Image hat einen `kept`-Befehl für die Person, die den Server betreibt: Migrationen, den Weg zurück, wenn sich niemand mehr anmelden kann, Schlüssel, Backups. `kept admin --help` listet alles auf; jeder Befehl, der etwas ändert, wird protokolliert, und die Person, deren Konto betroffen ist, wird per E-Mail informiert.

## Unter Compose ausführen

Die meisten Befehle benötigen den Login des **Datenbankinhabers** (`KEPT_OWNER_DATABASE_URL`), den nur der einmalige `migrate`-Dienst hält; der Kept-Container hat ihn nie. Sein Einstiegspunkt ist `kept`, also:

```sh
docker compose run --rm migrate admin <command>
```

Zwei Arten von Befehl benötigen stattdessen die Volumes des Kept-Containers:

- `recovery-kit` liest die Schlüssel aus dem Config-Volume und gibt sie aus, auch ohne Datenbank: `docker compose exec kept kept admin recovery-kit`. Mit `KEPT_OWNER_DATABASE_URL` (unten) enthält er außerdem das Backup-Repository, dessen Passwort und dessen Zugangsdaten.
- `token create` benötigt die Schlüssel und die Zugangsdaten des Dienstes, die der `kept`-Container hat: `docker compose exec kept kept admin token create …` ([unten](#ein-token-vom-server)).
- `rotate-key`, `backup`, `restore` und `export` benötigen die Schlüssel oder die Dateien sowie den Login des Datenbankinhabers. Gib dem `kept`-Dienst `KEPT_OWNER_DATABASE_URL` in einer `compose.override.yaml` ([wie bei Backups](/de/admin/backups/#aktivieren)), und führe sie dann in einem einmaligen Container aus: `docker compose run --rm --no-deps --entrypoint kept kept admin <command>`.

## Befehle

| Befehl | Was der Befehl tut |
|---|---|
| `kept migrate` | Wendet ausstehende Migrationen einmal an, unter einer Datenbanksperre (der `migrate`-Dienst führt sie bei jedem Start aus). |
| `kept admin setup-code` | Stellt den Einrichtungscode für den ersten Start erneut aus, solange die Einrichtung noch aussteht, und hebt die instanzweite Sperre auf. |
| `kept admin reset-password <login>` | Ein einmaliger Code zum Zurücksetzen des Passworts, gültig für eine Stunde; meldet das Konto überall ab. |
| `kept admin disable-user <login>` / `enable-user <login>` | Verhindert, dass sich ein Konto anmelden kann (und beendet dessen Sitzungen), oder erlaubt es wieder. |
| `kept admin transfer-ownership <locationId> <toUserId>` | Gibt einen Ort an einen anderen Inhaber weiter; der vorherige Inhaber wird Administrator des Orts. |
| `kept admin recovery-kit [--format text\|html] [--out <file>]` | Das Wiederherstellungskit, das außerhalb des Servers aufbewahrt werden soll: die Schlüssel, das Backup-Repository und seine Zugangsdaten, die Wiederherstellungsschritte. Siehe [das Wiederherstellungskit](/de/admin/recovery-kit/). |
| `kept admin token create --user <login> --scope read\|write --name <name>` | Ein persönliches Token für MCP-Clients und Home Assistant, einmalig angezeigt; `--expires <days>`, `--location <id or name>` (wiederholbar), `--confirm-cross-location`. Ab 1.13.0. Siehe [ein Token vom Server](#ein-token-vom-server). |
| `kept admin gen-key` | Druckt einen neuen Schlüssel aus, um `KEPT_SECRET_KEY` oder `KEPT_AUTH_SECRET` selbst zu setzen. |
| `kept admin rotate-key` | Setzt einen neuen geheimen Schlüssel als aktuellen fest und umschlüsselt jedes gespeicherte Geheimnis neu. `--resume` schließt einen unterbrochenen Vorgang ab; `--drop <version>` entfernt einen stillgelegten Schlüssel, den nichts mehr verwendet. |
| `kept admin backup` | Erstellt jetzt ein Backup (ein restic-Snapshot); `--list` listet die Snapshots sowie alle älteren Backups vor restic auf; `--accept-size` akzeptiert ein viel kleineres Backup als neuen Normalzustand. Siehe [Backups](/de/admin/backups/). |
| `kept admin backup verify` | Prüft das Backup-Repository; `--read-data <percent>` liest zudem diesen Anteil der Daten; bei S3-Dateispeicher prüft es die Dateien gegen den Bucket (`--all-files` für alle, nicht jede 20.). |
| `kept admin backup drill --into <database>` | Stellt das neueste Backup in eine **leere** Testdatenbank wieder her und prüft es: die [monatliche Übung](/de/admin/restore/#die-monatliche-übung). |
| `kept admin backup unlock` | Entfernt eine veraltete restic-Sperre nach einem Absturz; wird verweigert, während ein Backup läuft. |
| `kept admin restore <snapshot>` | Stellt einen Snapshot (oder `latest`) in eine **leere** Datenbank wieder her und prüft ihn; `--legacy <id>` stellt ein Backup vor restic für eine Version wieder her. Siehe [Wiederherstellung](/de/admin/restore/). |
| `kept admin readable --out <dir>` | Schreibt die lesbare Kopie jedes Ortes ([lesbare Kopie](/de/admin/read-with-restic/) (HTML, CSV, Dateien)) in ein Verzeichnis; `--location <id>` für einen, `--no-pdf` ohne die Inventar-PDFs. |
| `kept admin storage copy --to s3\|local` | Kopiert jede Datei in den anderen Speicher und prüft den Hash jeder einzelnen; `--dry-run` zählt nur. Siehe [Dateispeicher wechseln](/de/admin/storage/). |
| `kept admin storage verify --store s3\|local` | Prüft, ob jede Datei, auf die sich die Datenbank bezieht, mit den richtigen Bytes in diesem Speicher vorliegt. |
| `kept admin export --out <dir>` | Jede Zeile, roh, mit noch versiegelten Geheimnissen, und jede Datei in ein neues Verzeichnis: der Ausweg, ebenso sensibel wie ein Backup. |
| `kept admin backfill-pdf-text` | Liest den Text von PDFs, die hochgeladen wurden, bevor Kept PDFs lesen konnte, sodass die Suche sie findet. |
| `kept admin config` | Druckt die [Konfigurationsreferenz](/de/reference/configuration/) für diese Version aus. |

`kept admin seed` ist für die Entwicklung vorgesehen und verweigert den Start in der Produktion.

## Ein Token vom Server

Die App erstellt persönliche Token nur über HTTPS (Einstellungen → Verbindungen lehnt es über unverschlüsseltes `http` ab). Eine Kept-Instanz im Heimnetzwerk über `http` lässt sich trotzdem mit einer KI-App oder [Home Assistant](/de/users/home-assistant/) verbinden: die Person, die den Server betreibt, erstellt das Token auf dem Server. Ab 1.13.0:

```sh
docker compose exec kept kept admin token create \
  --user ibrahim@example.com --scope read --name "Home Assistant"
```

- `--user` ist die Person, für die das Token handelt: ihre E-Mail-Adresse oder der Benutzername eines verwalteten Kontos. Es darf tun, was sie darf, und nichts weiter.
- `--scope read` kann nur lesen; `--scope write` kann auch Dinge ändern.
- Ohne `--location` erreicht es jeden Ort, zu dem die Person gehört, außer denen, auf die es nicht zugreifen kann: einen Ort, der Zwei-Faktor-Authentifizierung verlangt (ein hier erstelltes Token hat keinen zweiten Faktor; erstelle diesen in Einstellungen → Verbindungen über HTTPS) und für ein Schreib-Token die Orte, bei denen sie nur Betrachterin ist. Jeder ausgelassene Ort wird namentlich genannt. `--location` (eine ID oder ein Name, wiederholbar) wählt sie stattdessen aus.
- Ein Schreib-Token über Orte hinweg mit unterschiedlichen Mitgliedern bleibt mit einer Warnung stehen, wie in der App; `--confirm-cross-location` erzwingt es trotzdem.
- `--expires <days>` lässt es nach dieser Anzahl Tagen ablaufen; ohne diese Option funktioniert es bis zum Widerruf.

Es gibt das Token einmal aus, in der Zeile, die mit `KEPT TOKEN:` beginnt, und die MCP-Serveradresse. Kept behält nur einen Fingerabdruck davon. Die Person sieht es in **Einstellungen → Verbindungen**, wo sie es widerrufen kann, und wird per E-Mail informiert.
