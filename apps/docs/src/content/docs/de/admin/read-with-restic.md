---
title: Lies dein Inventar nur mit restic
description: Der Server ist weg. Mit restic, dem Passwort des Backups und jedem Computer kannst du die lesbare Kopie von allem, was du besitzt, öffnen – ohne Kept, ohne Netzwerk.
sidebar:
  order: 3
---

Jeder nächtliche Snapshot enthält eine **lesbare Kopie** jedes Standorts: eine `index.html`, die du in einem Browser öffnest, eine Tabellenkalkulation (CSV) der Dinge, Miniaturansichten sowie die Belege und Dokumente, zu denen die Seiten verlinken. Er wird für den Tag geschrieben, an dem Kept nicht läuft: der Server ist abgebrannt, die Festplatte ist kaputt gegangen, oder Kept ist seit langem verschwunden. Alles, was du brauchst, ist:

- **restic**, das Backup-Programm, auf jedem Computer (Windows, macOS oder Linux). Seine Dokumentation listet ein Paket oder einen Download für jedes auf. Verwende Version 0.19.1, die Kept verwendet, oder neuer.
- **Das Repository und sein Passwort**, aus [dem Wiederherstellungskit](/de/admin/recovery-kit/), und für einen S3-Bucket oder einen SFTP-Server, die Anmeldeinformationen, die das Kit zusammen mit ihnen auflistet.
- Das Backup selbst: die Festplatte, der Bucket oder der SFTP-Server, zu dem es gesendet wurde.

## 1. Zeig restic auf das Backup

Der Abschnitt „Backup“ im Wiederherstellungskit gibt den Standort und das Passwort des Repositorys preis, und für S3 die beiden Schlüssel. In einem Terminal:

```sh
export RESTIC_REPOSITORY='<the repository line from the kit>'
export RESTIC_PASSWORD='<the backup password from the kit>'
# S3 only:
export AWS_ACCESS_KEY_ID='<from the kit>'
export AWS_SECRET_ACCESS_KEY='<from the kit>'
```

In der Windows PowerShell: `$env:RESTIC_REPOSITORY = '…'` und so weiter. Ein Verzeichnis-Backup, das auf einen Laptop kopiert wurde, ist einfach sein Pfad: der `restic`-Ordner innerhalb des Backup-Verzeichnisses.

## 2. Wähle einen Snapshot

```sh
restic snapshots
```

listet jeden Snapshot mit seiner Zeit und seinen Tags auf. Nimm den neuesten mit dem Tag `nightly` (oder `manual`); ein `pre_upgrade`-Snapshot enthält nur die Datenbank, nicht die lesbare Kopie. Notiere seine ID.

## 3. Stelle die lesbare Kopie wieder her

```sh
restic restore <snapshot ID> --target ./kept-readable --include /backup/readable
```

Dies stellt nur die lesbare Kopie wieder her, nicht den Datenbankdump oder die vollständigen Dateien, in einem neuen Ordner `kept-readable`.

## 4. Öffne es

Öffne `kept-readable/backup/readable/index.html` in einem Browser. Es listet jeden Standort mit seinem Besitzer und dem Zeitpunkt, zu dem die Kopie erstellt wurde auf; jede Standort-eigene `index.html` listet ihre Orte und Dinge auf, mit ihren Fotos, Kaufdetails und Dokumenten. Die `README.txt` daneben sagt das gleiche aus.

Die Seiten benötigen kein Netzwerk und laden nichts von irgendwo anders. Die CSV jedes Standorts öffnet sich in einer Tabellenkalkulation.

Die Kopie jedes Standorts zeigt, was dessen **Besitzer** in Kept sehen konnte: Geld erscheint so, wie es der Besitzer sah, und geheime Werte (das WLAN-Passwort, das du auf dem Router gespeichert hast) sind niemals darin enthalten. Bei einem Standort, dessen Kopie jene Nacht fehlgeschlagen ist, wird als „nicht heute Nacht enthalten“ angezeigt; nimm den Snapshot davor.

## Durchsuchen ohne Wiederherstellung

Unter Linux und unter macOS mit macFUSE zeigt `restic mount ./mnt` jeden Snapshot als Ordner an, die du direkt öffnen kannst.
Es benötigt FUSE, was Windows nicht hat; `restore` funktioniert überall.
