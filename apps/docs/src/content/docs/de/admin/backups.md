---
title: Sicherungen
description: Nächtliche verschlüsselte restic-Snapshots der Datenbank, der Dateien und einer lesbaren Kopie, auf eine andere Festplatte, in einen S3-Bucket oder auf einen SFTP-Server.
sidebar:
  order: 1
---

Jede Nacht erstellt Kept einen **restic-Snapshot**: mit einem Passwort deiner Wahl verschlüsselt,
dedupliziert (eine Nacht, in der nichts Neues hinzukommt, fügt fast nichts hinzu) und an einen Ort gesendet, der nicht die eigene Festplatte des Servers ist.

## Was ein Snapshot enthält

- **Die Datenbank**, aus einem konsistenten Moment heraus gedumpt, mit einem Manifest der Zeilenanzahl jeder Tabelle
  und einem Digest ihrer Daten, damit eine Wiederherstellung beweisen kann, dass genau das zurückgeholt wurde, was da war.
- **Die Dateien** (Fotos, Belege, Dokumente), wenn sie auf der Festplatte des Servers gespeichert sind. Mit
  S3-Dateispeicher sind sie es nicht: siehe [unten](#wenn-dateien-in-s3-liegen).
- **Eine lesbare Kopie jedes Orts**: Webseiten, Tabellen, Vorschaubilder und Belege, die
  in einem Browser mit nichts als restic geöffnet werden. Siehe
  [dein Inventar mit restic allein lesen](/de/admin/read-with-restic/).

Die Schlüssel sind **nicht** im Backup. Bewahre [das Recovery-Kit](/de/admin/recovery-kit/) an anderer Stelle auf.

## Wohin es gehen kann

| Ziel | Festgelegt mit | Das restic-Repository |
|---|---|---|
| Ein Verzeichnis: eine andere Festplatte oder eine auf dem Server gemountete NAS-Freigabe | `KEPT_BACKUP_DIR` (absolut, außerhalb von `KEPT_DATA_DIR`) | `<directory>/restic` |
| Ein S3-kompatibler Bucket: AWS oder der S3-Endpoint eines anderen Anbieters | `KEPT_BACKUP_S3_BUCKET` und die anderen `KEPT_BACKUP_S3_*` | `restic/` unter `KEPT_BACKUP_S3_PREFIX` |
| Ein SFTP-Server | `KEPT_BACKUP_SFTP` (restic's `sftp:`-Syntax), `KEPT_BACKUP_SFTP_KEY_FILE`, `KEPT_BACKUP_SFTP_KNOWN_HOSTS` | der Ort, den du angibst |

Setze ein Ziel. Bevorzuge einen anderen Rechner oder einen anderen Standort: Ein Verzeichnis auf derselben Festplatte wie Kepts
Daten wird abgelehnt, und die Statusseite warnt, wenn das Ziel sich eine Festplatte mit ihnen teilt. Die S3-Endpoints von Backblaze B2 und
Cloudflare R2 sollten funktionieren, wurden aber nicht getestet. SFTP heftet den Host-Key des Servers aus der known-hosts-Datei an und verbindet sich nur, wenn er übereinstimmt.

## Aktivieren

Instanz-Admins setzen das Ziel und das Passwort in **Admin → Sicherungen**, über HTTPS, nach
der Bestätigung des Recovery-Kits. "Testen" prüft, ob Kept das Repository öffnen (oder erstellen) kann; "Jetzt sichern"
führt eine sofort aus. Eine Umgebungsvariable übertrumpft den Bildschirm und erscheint dort als gesperrt, damit ein
Operator das Ziel im Deployment korrigieren kann.

**Das Passwort** besteht aus mindestens 12 Zeichen (`KEPT_BACKUP_PASSWORD` oder auf dem Bildschirm eingestellt).
**Kein Passwort, kein Backup:** Kept schreibt niemals ein unverschlüsseltes Backup. Verlierst du das Passwort, ist das
Backup unlesbar – darum ist es im Recovery-Kit.

Das Backup läuft im Worker als Datenbankbesitzer, daher braucht der Worker auch `KEPT_OWNER_DATABASE_URL`.
Mit Compose übergibt `compose.yaml` bereits jede `KEPT_BACKUP_*`-Variable aus `.env`
an Kept und an `migrate` (das vor einem Upgrade einen Snapshot macht); eine `compose.override.yaml`
nebenan ergänzt den Besitzer-Login und, für ein Verzeichnisziel, den Mount bei beiden:

```yaml
services:
  kept:
    environment:
      KEPT_OWNER_DATABASE_URL: postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD:-}@db:5432/kept
      KEPT_DB_OWNER_PASSWORD_FILE: /owner/kept_owner
    volumes:
      - kept-owner:/owner:ro
      - /mnt/backup/kept:/backups
  migrate:
    volumes:
      - /mnt/backup/kept:/backups
```

Das Passwort des Besitzers stammt aus dem `kept-owner`-Volume, wo der Bootstrap es aufbewahrt (eine Installation
vor 1.13.0 mit `KEPT_DB_OWNER_PASSWORD` in `.env` nutzt stattdessen dieses, und die Dateizeile
bewirkt nichts).

Dann setze entweder das Ziel und das Passwort auf dem Bildschirm, oder fixiere sie in `.env`
(`KEPT_BACKUP_DIR=/backups`, `KEPT_BACKUP_PASSWORD=…`).

Das Verzeichnis muss Kepts Benutzer gehören:

```sh
sudo mkdir -p /mnt/backup/kept
sudo chown 10001:10001 /mnt/backup/kept
sudo chmod 700 /mnt/backup/kept
```

## Wann und wie lange

- **Wann:** jede Nacht zur in Admin → Sicherungen eingestellten Zeit, `HH:MM` in UTC (Standard `02:30`).
  Eine neue Zeit gilt ab der nächsten Nacht, ohne Neustart; `KEPT_BACKUP_TIME` fixiert sie stattdessen.
- **Jetzt sichern** führt eine sofort aus; wird sie erneut gedrückt, während jene wartet oder läuft, wird das abgelehnt
  ("Es läuft bereits eine Sicherung") statt zweimal in die Warteschlange zu kommen. Ein durch Neustart oder
  durch Speichermangel abgebrochenes Backup blockiert nicht; der nächste Lauf markiert dieses als unterbrochen.
- **Auf einer kleinen Maschine** (unter 4 GB oder einem Container-Limit unter 4 GB) läuft restic auf höchstens zwei
  Kernen mit einem weichen Speicherlimit; `GOMAXPROCS` und `GOMEMLIMIT` in Kepts Umgebung (mit Compose,
  eine `compose.override.yaml`) überschreiben beides.
- **Wie lange sie aufbewahrt werden:** der neueste Snapshot von jedem der letzten **7 Tage, 4 Wochen und 6
  Monate** (`KEPT_BACKUP_KEEP_DAILY`, `_WEEKLY`, `_MONTHLY`). Des Alphas `KEPT_BACKUP_KEEP` wird
  für eine Release als Tagesanzahl gelesen. Vor einem Upgrade angelegte Snapshots behalten ihre letzten 3.
- **Ein verdächtig kleines Backup** (ein Dump unter der Hälfte der Größe des letzten guten, oder deutlich weniger
  Dinge, Orte oder Dateien) wird trotzdem erstellt, aber in dieser Nacht wird nichts Altes entfernt und Admins werden
  benachrichtigt, sodass eine schlechte Nacht die guten Snapshots nie verdrängen kann.

## Überwachung

Admin → Status zeigt das letzte Backup und sein Alter, die Anzahl der Snapshots, die Größe des Repositories,
die letzte Wiederherstellungsübung und die Festplatten. Admins werden per Mail und Push benachrichtigt, wenn:

| Hinweis | Wann |
|---|---|
| Sicherung fehlgeschlagen | ein Lauf fehlschlägt |
| Sicherung veraltet | 36 Stunden lang keine gute Sicherung bei gesetztem Ziel |
| Verdächtige Größe | ein Lauf war deutlich kleiner als der letzte gute |
| Wenig Speicherplatz | die Datenfestplatte oder ein Verzeichnisziel ist zu 85 % voll |
| Bucket-Versionierung aus | Dateien sind in S3 und der Bucket behält keine alten Versionen |
| Wiederherstellungsübung fällig | 30 Tage keine [Wiederherstellungsübung](/de/admin/restore/#die-monatliche-übung) |

`/metrics` (mit `KEPT_METRICS_TOKEN`) ergänzt die Zeit des letzten guten Backups und die Nutzung der Festplatten. Siehe
[Monitoring](/de/admin/observability/).

## Wenn Dateien in S3 liegen

restic sichert Dateien auf der Festplatte, nicht Objekte in einem Bucket. Mit `KEPT_STORAGE=s3` hält der Snapshot
die Datenbank, das Manifest und die lesbare Kopie, und **der Bucket sichert die Dateien selbst**:
aktiviere **Bucket-Versionierung** (und, falls dein Anbieter sie hat, Replikation in eine andere Region). Kept
prüft die Versionierung bei jedem Lauf und warnt, solange sie aus ist. Die wöchentliche Prüfung und die Wiederherstellungsübung
vergleichen den Hash jeder Datei im Manifest mit dem Bucket.

## Die Backups der Alpha

Backups, die vor restic von der Alpha gemacht wurden (`runs/` und `blobs/` neben dem neuen `restic/`-Verzeichnis), werden nie
wieder geschrieben und bleiben mit `kept admin restore --legacy <id>` für eine Release wiederherstellbar. Lösche
sie, sobald ein restic-Snapshot eine Wiederherstellungsübung bestanden hat.
