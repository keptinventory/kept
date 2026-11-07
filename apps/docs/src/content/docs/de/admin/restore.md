---
title: Wiederherstellen und die Übung
description: Ein Backup in eine neue, leere Datenbank zurückbringen, nachweisen, dass es passt, einhängen - und monatlich üben.
sidebar:
  order: 2
---

Kept stellt **nur in eine neue, leere Datenbank** wieder her, prüft sie und überlässt dir das Austauschen. Eine Datenbank, die schon etwas enthält, lehnt es ab, damit es nicht aus Versehen auf die aktive Datenbank gerichtet werden kann.

## Wiederherstellen

1. **Snapshots auflisten:**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   Das führt die CLI in einem einmaligen `kept`-Container aus, der das Daten-Volume, die Schlüssel, das Besitzer-Login aus deiner `compose.override.yaml` und die Backup-Einstellungen (die aus `.env` oder die in Admin → Sicherungen gespeicherten; siehe [Sicherungen](/de/admin/backups/#aktivieren)) hat.

2. **Eine leere Datenbank** neben der aktiven Datenbank erstellen, als Datenbank-Superuser:

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   Bei verwaltetem Postgres stattdessen für die neue Datenbank die Erweiterungs- und Besitzzeilen aus [dem SQL des Anbieters](/de/install/managed-postgres/#das-sql) ausführen.

3. **In sie wiederherstellen**, mit vorher in die Shell geladener `.env` (`set -a; . ./.env; set +a`):

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <snapshot>
   ```

   Kept holt Datenbank und Dateien aus dem Snapshot, prüft den Dump gegen sein Manifest, prüft, ob `pg_restore` zur Hauptversion des Servers passt und die Erweiterungen vorhanden sind, stellt in einer Transaktion wieder her und vergleicht dann **Zeilenanzahl und Daten-Digest jeder Tabelle** mit dem Manifest: Jede Tabelle, deren Daten abweichen, selbst bei gleicher Zeilenanzahl, lässt die Wiederherstellung fehlschlagen. Dateien gelangen zurück in den Speicher, den `KEPT_STORAGE` benennt, und bei jeder wird SHA-256 geprüft. Am Ende gibt es die Befehle für den Austausch aus.

4. **Austauschen**, mit gestopptem Kept, als Superuser:

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   Behalte `kept_before_restore`, bis du dir sicher bist, und lösche es dann.

Das Umbenennen einer Datenbank benötigt den Superuser, und keiner von Kepts Logins ist einer: Deshalb gibt Kept diese Befehle aus, statt sie selbst auszuführen.

## Nach dem Verlust des Servers

Auf der neuen Maschine: Installiere Kept wie unter [Installation mit Docker Compose](/de/install/compose/), und lege vor dem ersten Start die **Schlüssel des Wiederherstellungskits** in `.env` (`KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET` und `KEPT_SECRET_KEY_VERSION` sowie `KEPT_SECRET_KEYS_RETIRED`, falls das Kit sie aufführt) und das Backup-Ziel samt Passwort in `compose.override.yaml`. Dann:

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

Die `kept`-Datenbank der neuen Installation ist noch leer (der `migrate`-Dienst ist noch nicht gelaufen), deshalb nimmt sie die Wiederherstellung direkt an; es gibt nichts auszutauschen.
Ohne die Schlüssel kommt alles zurück außer Geheimwerten und KI-Schlüsseln, die unlesbar bleiben.

## Die monatliche Übung

Ein Backup, das niemand wiederhergestellt hat, ist eine Hoffnung, kein Backup. Stelle einmal im Monat den neuesten Snapshot in eine temporäre Datenbank wieder her und lass Kept ihn vergleichen (mit geladener `.env`, wie oben):

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

Die Übung stellt den neuesten guten Snapshot wieder her, vergleicht Zähler und Digests, prüft die SHA-256 von 50 Dateien (`--all-files` prüft sie alle) und speichert die Übung in der **aktiven** Datenbank, was die Warnung "Wiederherstellungsübung fällig" auf Admin → Status aufhebt. Sie berührt die aktiven Daten nie.

## Das Repository prüfen

Der Worker prüft das Repository wöchentlich (`restic check`). Um jetzt zu prüfen oder auch einen Teil der Daten zurückzulesen:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

Bei S3-Dateispeicher prüft Verify auch jede Datei im Manifest gegen den Bucket. Wenn ein Absturz eine veraltete Sperre auf dem Repository hinterlassen hat, entfernt `kept admin backup unlock` sie; während ein Backup läuft, verweigert der Befehl das.
