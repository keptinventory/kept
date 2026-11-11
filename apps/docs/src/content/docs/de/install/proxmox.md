---
title: Installation auf Proxmox VE
description: Ein Befehl in der Shell des Proxmox-VE-Hosts erstellt einen unprivilegierten Debian-13-Container mit Kept darin, ohne Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Noch nicht auf einem echten Proxmox-VE-Host getestet]
Die Skripte werden bei jeder Änderung geprüft: shellcheck, dann die Installation, ein Update und ein
Zurückrollen auf einem frischen Debian 13 mit systemd, und das Host-Skript gegen Ersatz für die
Werkzeuge von Proxmox. Auf einem echten Proxmox-VE-Host liefen sie noch nicht. Geschrieben für
Proxmox VE 8 und 9 auf amd64; arm64-Hosts sind ungetestet. Behandle eine erste Installation als
Test.
:::

Kept läuft in einem eigenen unprivilegierten Debian-13-Container, ohne Docker, wie Proxmox es
empfiehlt: PostgreSQL, Node und Kept unter systemd. Die Backups von Proxmox erfassen ihn, und sonst
ändert sich nichts auf dem Host.

## Installation

In der Shell des Proxmox-VE-Hosts, als root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default:** fragt nur nach der Bestätigung, mit den Einstellungen unten.
- **Advanced:** fragt jede Einstellung ab: die ID, den Namen, CPU, Arbeitsspeicher, Speicherplatz,
  Storage, Bridge, eine feste Adresse mit Gateway, ein VLAN, DNS, einen SSH-Schlüssel, ein
  root-Passwort, die Zeitzone.
- **Die Bestätigung** zeigt jede Einstellung und den genauen `pct create`-Befehl, bevor etwas
  erstellt wird.

Zuerst prüft es den Host (root, Proxmox VE 8 oder 9, die Bridge, ein Storage mit Platz, DNS), lädt
die Debian-13-Vorlage, falls sie fehlt, erstellt den Container, installiert Kept darin und gibt die
Adresse aus. Schlägt etwas fehl, sagt es was und entfernt den unfertigen Container.

### Erst lesen

Lade das Skript und die `SHA256SUMS` der Release herunter, prüfe, lies, dann führe es aus:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` enthält die SHA-256 von `kept.sh`, `kept-install.sh` (was im Container läuft) und den
Release-Tarballs. Es ist mit dem Release-Schlüssel signiert: `kept.sh` und `kept-install.sh` prüfen
diese Signatur mit openssl, bevor sie etwas aus der Release verwenden. Um sie selbst zu prüfen, lade
`SHA256SUMS.sigstore.json` aus derselben Release und siehe
[Release verifizieren](/de/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## Was es erstellt

- **Der Container:** unprivilegiertes Debian 13, `nesting=1` (das systemd von Debian 13 braucht
  es), startet mit dem Host, Tag `kept`.
- **Darin:** PostgreSQL 18 mit pgvector (aus dem Repository von PostgreSQL), Node 24 (von
  nodejs.org), restic und der Release-Tarball von Kept, jedes gepinnt und geprüft.
- **Dienste:** `kept-bootstrap` (die Datenbank und ihre Logins, bei jedem Start) und `kept` (die
  Migrationen, dann Kept auf Port 8080 als Benutzer `kept`).
- **Dateien:** Kept in `/opt/kept`, seine Einstellungen in `/etc/kept/kept.env`, seine Schlüssel in
  `/etc/kept/config`, Fotos und Dokumente in `/var/lib/kept`, Adresse und Einrichtungscode in
  `/root/kept.creds`.

Keine Telemetrie, keine Timer, keine automatischen Updates, keine Änderung am Host außer dem
Container.

## Standardwerte

| Einstellung | Standard | Vorbelegen mit |
|---|---|---|
| CPU | 2 Kerne | `var_cpu` |
| Arbeitsspeicher | 2048 MB, Swap 512 MB | `var_ram`, `var_swap` |
| Speicherplatz | 8 GB | `var_disk` |
| Storage | das erste, das Container aufnimmt | `var_storage` |
| Netzwerk | DHCP an `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, Name | die nächste freie ID, `kept` | `var_ctid`, `var_hostname` |
| Zeitzone | die des Hosts | `var_timezone` |
| SSH-Schlüssel | keiner | `var_ssh_key` (eine Public-Key-Datei auf dem Host) |

Kept wurde mit 1 GB getestet ([was es braucht](/de/install/hardware/)); 2 GB lassen Platz für
Importe und Backups. Fotos belegen den meisten Speicherplatz.

Jeder Wert lässt sich vorbelegen, und `var_unattended=yes` läuft ohne Fragen:

```sh
var_unattended=yes var_ram=4096 var_ip=192.168.1.50/24 var_gateway=192.168.1.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## Erster Start

1. Öffne die ausgegebene Adresse, `http://<address>:8080`. Kept zeigt **Einrichtungscode eingeben**.
2. Der Code liegt im Container: `pct exec <CTID> -- cat /root/kept.creds`. Gib ihn ein, dann
   **Erstes Konto erstellen**: Es wird zum Instanz-Admin.
3. Bewahre die Schlüssel woanders als auf diesem Server auf: `pct exec <CTID> -- kept admin recovery-kit`
   gibt das Wiederherstellungskit aus.

Gedruckte Etiketten tragen die Adresse. Gib dem Container eine feste (eine DHCP-Reservierung im
Router oder `var_ip`), bevor du welche druckst. Um sie später zu ändern, setze `KEPT_PUBLIC_URL` in
`/etc/kept/kept.env`, dann `systemctl restart kept`. HTTPS:
[hinter einem Reverse Proxy](/de/install/reverse-proxy/).

## Update

In der Konsole des Containers (`pct enter <CTID>` oder **Console** des Containers in der
Weboberfläche):

```sh
update
```

`update` nennt die laufende und die neueste Version und fragt zuerst. Es gibt den Backup-Befehl
für den Host aus, bevor du antwortest. Dann lädt es die neue Release und prüft sie gegen die
signierte `SHA256SUMS` der Release, stoppt Kept, wechselt zur neuen Release neben der alten und
startet sie (die Migrationen laufen zuerst). Antwortet Kept auf `/readyz` nicht mit der neuen
Version, wechselt es zurück und startet die vorige Release. `update 1.15.0` installiert eine
bestimmte Version. Ältere Versionen brauchen `KEPT_ALLOW_DOWNGRADE=1`, für eine Wiederherstellung
([eine Version zurück](/de/admin/upgrades/)). Nichts aktualisiert sich von selbst.

Die Updates von Debian selbst sind `apt update && apt upgrade` im Container, wie bei jedem Debian.

## Backups

Alles liegt auf dem Speicher des Containers, also enthält ein Proxmox-Backup Kept vollständig:
füge den Container einem Backup-Job hinzu (**Datacenter → Backup**) im Modus Snapshot, oder einmal:

```sh
vzdump <CTID> --mode snapshot
```

Der Modus Snapshot braucht Storage mit Snapshots (LVM-thin, ZFS, Ceph); auf anderem Storage nimm
`--mode stop`. Wiederherstellen mit **Restore** in der Weboberfläche oder `pct restore`.

Für eine zweite Kopie außerhalb des Rechners schalte die eigenen nächtlichen Backups von Kept ein
([Backups](/de/admin/backups/)). Sie laufen als Eigentümer der Datenbank, also gib Kept zuerst diesen
Login, im Container:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

Ziele über S3 und SFTP funktionieren so. Ein Verzeichnis als Ziel muss für den Dienst beschreibbar
sein: füge es mit `systemctl edit kept` hinzu (`[Service]`, dann `ReadWritePaths=/dein/backup/ordner`),
im Besitz des Benutzers `kept`.

## Entfernen

Das löscht den Container und alles darin, auch die Daten von Kept. Mach vorher ein Backup, wenn du
sie vielleicht wieder brauchst:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## Klappt etwas nicht?

- **Die Installation brach ab:** Das Skript nannte den Schritt und entfernte den Container. Führe es
  mit `var_keep_failed=yes` erneut aus, um den Container zu behalten, dann `pct enter <CTID>` und
  `journalctl -u kept`.
- **Kept startet nicht:** `journalctl -u kept-bootstrap -u kept` im Container nennt das Problem,
  etwa `kept: invalid environment:` für eine Einstellung in `/etc/kept/kept.env`.
- **Die Konsole bleibt schwarz:** Debian 13 braucht `nesting=1`, das das Skript setzt; ein von Hand
  ohne es erstellter Container zeigt das.
