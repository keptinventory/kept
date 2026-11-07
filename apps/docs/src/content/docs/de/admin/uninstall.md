---
title: Deinstallation
description: Entferne Kept und alles, was es gespeichert hat - nachdem du mitgenommen hast, was du behalten willst.
sidebar:
  order: 9
---

**Nimm zuerst deine Daten heraus.** Sobald die Volumes weg sind, bringt nichts sie zurück – außer einem Backup.

1. Jeder Eigentümer exportiert seine Standorte (**Einstellungen → Export**), oder bewahre das neueste Backup und das
   [Wiederherstellungskit](/de/admin/recovery-kit/) an einem sicheren Ort auf: Mit restic allein kannst du später trotzdem
   [dein Inventar lesen](/de/admin/read-with-restic/).
2. Stoppe und entferne die Container **und ihre Volumes**, im Ordner mit `.env`:

   ```sh
   docker compose --profile https --profile ollama down --volumes
   ```

   Das entfernt `kept-db` (die Datenbank), `kept-data` (die Dateien), `kept-config` (die generierten
   Schlüssel und Datenbankpasswörter) und `kept-owner` (das Passwort des Eigentümer-Logins); mit
   `compose.full.yaml` außerdem Caddys Zertifikate und Ollamas Modelle. Ohne `--volumes` bleiben die Daten
   auf der Maschine.
3. Entferne das Image: `docker image rm ghcr.io/keptinventory/kept:<version>` (den Tag, den du verwendet hast, oder
   `kept:local` für deinen eigenen Build) und `.env` neben der Compose-Datei.
4. Außerhalb der Maschine entfernst du, was du selbst für Kept eingerichtet hast:
   - **den Datei-Bucket**, mit `KEPT_STORAGE=s3` (und seine alten Versionen, falls Versionierung an war);
   - **das Backup**: das `restic`-Verzeichnis auf dem Backup-Datenträger, das Präfix `restic/` im
     Backup-Bucket oder das Repository auf dem SFTP-Server sowie alle `runs/` und `blobs/` aus der Alpha daneben;
   - die Datenbank, falls sie von einem Anbieter war: die `kept_*`-Rollen und die Datenbank selbst;
   - DNS-Einträge, Proxy-Routen und das Tailscale-`serve`, das du hinzugefügt hast.
