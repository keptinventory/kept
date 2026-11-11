---
title: Auf Unraid installieren
description: Installiere Kept aus den Community Applications von Unraid als einen Container, Kept und seine eigene Datenbank, alles im appdata-Ordner.
sidebar:
  order: 2
  label: Unraid
---

Kept läuft auf Unraid als ein Container aus den **Community Applications** (dem Tab **Apps**): Kept
und seine eigene PostgreSQL-Datenbank, alles in `/mnt/user/appdata/kept`. Kein Compose, keine
Passwörter zu erfinden.

## Was du brauchst

| | |
|---|---|
| Unraid | Mit dem Tab **Apps** (dem Plugin Community Applications) |
| Speicher | Etwa 300 MB frei für Kept und seine Datenbank |
| Eine Adresse | Die, unter der du Kept öffnest, etwa `http://tower.local:8080`. Nimm einen Namen statt einer IP-Adresse: gedruckte Etiketten tragen sie |

## Installieren

1. **Apps**, nach **Kept** suchen, dann **Install**.
2. **Kept's address**: die Adresse, unter der du Kept öffnest, ohne Pfad. Der Rest kann bleiben,
   wie er ist. **Show more settings** enthält die optionalen: Mail, Anmeldung mit OIDC und Google,
   ein Reverse Proxy, die Registrierung.
3. **Apply.** Unraid lädt das Image und startet den Container.
4. Tab **Docker**, das Symbol von Kept, **Logs**: der Einrichtungscode.

   ```text
   app: Kept is at http://tower.local:8080
   KEPT SETUP CODE: XXX-XXX
   ```

5. Symbol von Kept, **WebUI**. Kept zeigt **Einrichtungscode eingeben**: Tippe den Code, dann
   **Erstes Konto erstellen**. Es wird der Admin der Instanz.
6. **Bewahre die Schlüssel auf.** Symbol von Kept, **Console**, dann:

   ```sh
   kept admin recovery-kit
   ```

   Kopiere den Text, der mit `KEPT RECOVERY KIT` beginnt, an einen Ort außerhalb dieses Servers,
   etwa einen Passwortmanager. Ohne die Schlüssel bringt ein Backup geheime Werte nicht zurück.

Der erste Start legt die Datenbank an und dauert etwa eine Minute. Docker meldet den Container als
gesund, sobald Kept antwortet.

## Was im appdata-Ordner liegt

| Ordner | Was |
|---|---|
| `postgres/` | Die laufende Datenbank. Gehört dem Benutzer `postgres` des Containers |
| `kept/` | Fotos und Dateien. Gehören uid 10001, dem Benutzer, unter dem Kept läuft |
| `config/` | Die Schlüssel von Kept (`secrets.json`) und die Passwörter der Datenbank. Gehören uid 10001 |
| `owner/` | Das Passwort des Datenbank-Eigentümers. Nur für root: Der Prozess von Kept liest es nie |
| `backup/kept.pgdump` | Ein Dump der Datenbank, geschrieben bei jedem Stopp des Containers |

Der Container startet als root, gibt diese Ordner ihren Eigentümern und führt dann Postgres und
Kept als eigene Benutzer aus. Der Ordner selbst bleibt bei root: Niemand sonst kann ihn auflisten.

## Backups

- **Sichere den appdata-Ordner** bei gestopptem Container, zum Beispiel mit dem Plugin Appdata
  Backup von Unraid. Ein Stopp schreibt zuerst `backup/kept.pgdump`, also enthält das Backup eine
  stimmige Kopie der Datenbank, auch wenn die laufenden Dateien es nicht sind.
- **Wiederherstellen:** Lege den Ordner zurück und starte Kept. Ohne Ordner `postgres/` und mit
  einem Dump in `backup/` stellt Kept die Datenbank beim Start aus dem Dump wieder her; das Log
  sagt `database restored from the backup`.
- **Die eigenen nächtlichen Backups von Kept** (Admin → Sicherungen) sind in diesem Container nicht
  eingerichtet: Sie brauchen den Login des Datenbank-Eigentümers, den das laufende Kept nicht hat.
  Sichere den appdata-Ordner.

## Updates

Die Vorlage folgt der Hauptversion von Kept (`kept-unraid:1`). Ist eine Release erschienen, zeigt der
Tab **Docker** ein Update für Kept: **apply update**. Der Container stoppt (und schreibt seinen
Dump), das neue Image startet, und Kept aktualisiert seine Datenbank beim Start.

## Die Adresse von Kept

Ändere sie in der Vorlage (Symbol von Kept, **Edit**) und **Apply**. Für Kept über https setze einen
Reverse Proxy vor Port 8080, stelle **Kept's address** auf seine https-Adresse und
**Trusted reverse proxies** auf die Adresse des Proxys, wie Kept sie sieht
([hinter einem Reverse Proxy](/de/install/reverse-proxy/)). Die Kamera, die Installation der
Telefon-App, Push und Passkeys brauchen https ([Kept im Heimnetz](/de/install/home-network/)).

## Entfernen

1. Tab **Docker**, Symbol von Kept, **Remove**. Der appdata-Ordner bleibt.
2. Um auch die Daten zu entfernen, lösche `/mnt/user/appdata/kept`, im Terminal oder mit einem
   Dateimanager. Das lässt sich nicht rückgängig machen: Lege vorher ein Backup an, falls du sie
   zurückhaben willst.
