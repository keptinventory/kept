---
title: Das Wiederherstellungskit
description: Die Schlüssel und die Zugangsdaten für die Datensicherung, die eine Datensicherung wieder in ein funktionierendes Kept verwandeln. Bewahre sie überall, aber nicht auf dem Server.
sidebar:
  order: 4
---

Kept versiegelt jeden geheimen Wert, den es speichert (AI-Schlüssel, und die Geheimnisse, die du bei Dingen aufbewahrst, wie beispielsweise das WLAN-Passwort eines Routers), mit `KEPT_SECRET_KEY`, und signiert Sitzungen mit `KEPT_AUTH_SECRET`. Weder befindet sich etwas davon in der Datenbank noch im Backup, und das absichtlich: wer dein Backup bekommt, soll dadurch nicht an deine Geheimnisse gelangen. Die andere Seite davon: **ohne den Schlüssel stellt eine Wiederherstellung alles wieder her außer den geheimen Werten und AI-Schlüsseln, die für immer unlesbar bleiben.**

Das Wiederherstellungskit ist alles, was du benötigst, um Kept aus seinem Backup wiederherzustellen. Bewahre es in einem Passwort-Manager oder auf Papier auf, irgendwo sicher, wo es nicht zusammen mit dem Server verlorengehen würde.

## Was es enthält

- `KEPT_SECRET_KEY` und `KEPT_AUTH_SECRET`;
- nach einer Schlüsselrotierung, die Version des Schlüssels (`KEPT_SECRET_KEY_VERSION`) und jeder zurückgezogene Schlüssel
  (`KEPT_SECRET_KEYS_RETIRED`), die ältere Backups noch benötigen;
- das restic-Repository der Datensicherung, **sein Passwort und seine Speicheranmeldeinformationen** (die S3-Schlüssel und
  Region, oder der SFTP-Schlüssel und der gepinnte Hostschlüssel des Servers als Zeile in `known_hosts`), oder „Keine Datensicherung konfiguriert“;
- die Adresse der Instanz, die Version und Revision von Kept, wann das Kit erstellt wurde;
- die Wiederherstellungsschritte in einfachen Worten, und die Befehle zum
  [Lesen deines Bestands mit restic allein](/de/admin/read-with-restic/), mit dem Repository ausgefüllt.

Es ist reiner Text, oder eine druckbare Seite, die aus den gleichen Zeilen besteht (kein Skript, nichts von irgendwo geladen).

## Erhalten

Vom Server aus, zu jederzeit:

```sh
docker compose exec kept kept admin recovery-kit
```

Es wird im Terminal ausgegeben; nichts wird irgendwo geschrieben. `--format html` gibt die druckbare Seite,
und `--out <file>` schreibt sie in eine Datei, die nur du lesen kannst. Die Schlüssel werden auch ausgegeben, wenn die Datenbank
nicht verfügbar ist; der Backup-Teil benötigt den Login des Datenbankbesitzers (`KEPT_OWNER_DATABASE_URL`, 
die `compose.override.yaml`, die [Datensicherungen](/de/admin/backups/#aktivieren) verwendet, gibt den Login), und ohne ihn
sagt das Kit, dass es fehlt. Mit diesem Login zählt die Ausgabe als Download (unten) und wird geprüft.

Über das Web: **Admin → Status → Wiederherstellungskit → Wiederherstellungskit herunterladen**, 
als Instanz-Administrator, nur über HTTPS, nachdem du dein Passwort erneut eingegeben hast 
(oder, für ein Konto ohne eines, innerhalb von zehn Minuten nach der Anmeldung: eine Passkey-Anmeldung zählt; 
 sonst „Anmelden erneut“). Wähle eine Textdatei oder eine druckbare Seite. Jeder Download wird geprüft, 
 und nichts vom Kit wird irgendwo gespeichert, wo ein späterer Besucher darauf zugreifen könnte.

## Wenn Kept danach fragt

Die Einrichtung wartet nicht auf das Kit, aber Kept bittet dich, es zu bestätigen, bevor du eines der folgenden tust: 
einen geheimen Wert speicherst, einen AI-Schlüssel hinzufügst oder die Backups einrichtest. 
Bis dahin fragt Admin → Status danach; ein Download zählt als diese Bestätigung. 
Die Statusseite fragt erneut, wenn das von dir heruntergeladene Kit veraltet ist: 
nachdem sich die Backup-Einstellungen geändert haben oder der Schlüssel rotiert wurde (`kept admin rotate-key`).

## Wenn du die Schlüssel selbst setzt

Mit `KEPT_SECRET_KEY` und `KEPT_AUTH_SECRET` in deiner eigenen Umgebung (generiere jeweils mit 
`kept admin gen-key`), verwendet Kept sie wie gegeben und das `kept-config`-Volume bleibt leer. 
Das Kit druckt sie weiterhin aus; eine Kopie zu behalten bleibt deine Aufgabe.

## Den Schlüssel rotieren

```sh
docker compose exec kept kept admin rotate-key
```

macht einen neuen Schlüssel aktuell und wickelt jedes gespeicherte Geheimnis darin neu ein. 
Es benötigt den Login des Datenbankbesitzers, sodass der `kept`-Dienst `KEPT_OWNER_DATABASE_URL` 
haben muss (die `compose.override.yaml`, die [Datensicherungen](/de/admin/backups/#aktivieren) verwendet, gibt den Login). 
Es sagt, was du setzen müsstest, wenn du die Schlüssel selbst verwaltest. 
Der alte Schlüssel zieht in die Liste der zurückgezogenen Schlüssel ein, sodass Backups, die vor der 
Rotation erstellt wurden, weiterhin geöffnet werden können: lade danach ein neues Kit herunter.
