---
title: Installare su Proxmox VE
description: Un comando nella shell dell’host Proxmox VE crea un container Debian 13 non privilegiato con Kept dentro, senza Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Non ancora provato su un vero host Proxmox VE]
Gli script sono controllati a ogni modifica: shellcheck, poi l’installazione, un aggiornamento e un
ritorno indietro su un Debian 13 pulito con systemd, e lo script dell’host contro sostituti degli
strumenti di Proxmox. Non sono ancora stati eseguiti su un vero host Proxmox VE. Scritti per
Proxmox VE 8 e 9 su amd64; gli host arm64 non sono provati. Tratta la prima installazione come una
prova.
:::

Kept gira in un suo container Debian 13 non privilegiato, senza Docker, come consiglia Proxmox:
PostgreSQL, Node e Kept sotto systemd. I backup di Proxmox lo coprono, e nient’altro cambia
sull’host.

## Installare

Nella shell dell’host Proxmox VE, come root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default:** chiede solo la conferma, con le impostazioni qui sotto.
- **Advanced:** chiede ogni impostazione: l’ID, il nome, CPU, memoria, disco, storage, bridge, un
  indirizzo fisso con il suo gateway, una VLAN, il DNS, una chiave SSH, una password di root, il fuso
  orario.
- **La conferma** mostra ogni impostazione e il comando `pct create` esatto prima di creare
  qualcosa.

Prima controlla l’host (root, Proxmox VE 8 o 9, il bridge, uno storage con spazio, il DNS), scarica
il template Debian 13 se manca, crea il container, ci installa Kept e stampa l’indirizzo. Se
qualcosa non va, dice cosa e rimuove il container incompleto.

### Leggerlo prima

Scarica lo script e il `SHA256SUMS` della release, controlla, leggi, poi eseguilo:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` contiene lo SHA-256 di `kept.sh`, di `kept-install.sh` (ciò che gira nel container) e
degli archivi della release. È firmato con la chiave delle release: `kept.sh` e `kept-install.sh`
controllano quella firma con openssl prima di usare qualcosa della release. Per controllarla tu,
scarica `SHA256SUMS.sigstore.json` dalla stessa release e vedi
[verificare una release](/it/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## Cosa crea

- **Il container:** Debian 13 non privilegiato, `nesting=1` (il systemd di Debian 13 lo richiede),
  avviato con l’host, con il tag `kept`.
- **Dentro:** PostgreSQL 18 con pgvector (dal repository di PostgreSQL), Node 24 (da nodejs.org),
  restic e l’archivio della release di Kept, ognuno fissato e controllato.
- **Servizi:** `kept-bootstrap` (il database e i suoi accessi, a ogni avvio) e `kept` (le
  migrazioni, poi Kept sulla porta 8080 come utente `kept`).
- **File:** Kept in `/opt/kept`, le sue impostazioni in `/etc/kept/kept.env`, le sue chiavi in
  `/etc/kept/config`, foto e documenti in `/var/lib/kept`, indirizzo e codice di configurazione in
  `/root/kept.creds`.

Niente telemetria, niente timer, niente aggiornamenti automatici, nessuna modifica all’host oltre
al container.

## Valori predefiniti

| Impostazione | Predefinito | Da preimpostare con |
|---|---|---|
| CPU | 2 core | `var_cpu` |
| Memoria | 2048 MB, swap 512 MB | `var_ram`, `var_swap` |
| Disco | 8 GB | `var_disk` |
| Storage | il primo che ospita container | `var_storage` |
| Rete | DHCP su `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, nome | il prossimo ID libero, `kept` | `var_ctid`, `var_hostname` |
| Fuso orario | quello dell’host | `var_timezone` |
| Chiave SSH | nessuna | `var_ssh_key` (un file di chiave pubblica sull’host) |

Kept è stato provato con 1 GB ([cosa gli serve](/it/install/hardware/)); 2 GB lasciano spazio per
importazioni e backup. Le foto occupano quasi tutto il disco.

Ogni valore si può preimpostare, e `var_unattended=yes` lo esegue senza domande:

```sh
var_unattended=yes var_ram=4096 var_ip=192.0.2.50/24 var_gateway=192.0.2.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## Primo avvio

1. Apri l’indirizzo stampato, `http://<address>:8080`. Kept mostra
   **Inserisci il codice di configurazione**.
2. Il codice è nel container: `pct exec <CTID> -- cat /root/kept.creds`. Inseriscilo, poi
   **Crea il primo account**: diventa l’admin dell’istanza.
3. Tieni le chiavi lontano da questo server: `pct exec <CTID> -- kept admin recovery-kit` stampa il
   kit di recupero.

Le etichette stampate riportano l’indirizzo. Dai al container un indirizzo fisso (una
prenotazione DHCP nel router, o `var_ip`) prima di stamparne. Per cambiarlo in seguito, imposta
`KEPT_PUBLIC_URL` in `/etc/kept/kept.env`, poi `systemctl restart kept`. HTTPS:
[dietro un reverse proxy](/it/install/reverse-proxy/).

## Aggiornare

Nella console del container (`pct enter <CTID>`, o la **Console** del container nell’interfaccia
web):

```sh
update
```

`update` indica la versione in uso e la più recente e chiede prima. Stampa il comando di backup da
eseguire sull’host prima della tua risposta. Poi scarica la nuova release e la controlla con il
`SHA256SUMS` firmato della release, ferma Kept, passa alla nuova release accanto alla vecchia e la
avvia (prima girano le migrazioni). Se Kept non risponde a `/readyz` con la nuova versione, torna
indietro e avvia la precedente. `update 1.15.0` installa una versione precisa. Le versioni più
vecchie richiedono `KEPT_ALLOW_DOWNGRADE=1`, per un ripristino
([tornare indietro di una versione](/it/admin/upgrades/)). Niente si aggiorna da solo.

Gli aggiornamenti di Debian stesso sono `apt update && apt upgrade` nel container, come su ogni
Debian.

## Backup

Tutto sta sul disco del container, quindi un backup di Proxmox contiene Kept per intero: aggiungi
il container a un job di backup (**Datacenter → Backup**) in modalità snapshot, o una volta:

```sh
vzdump <CTID> --mode snapshot
```

La modalità snapshot richiede uno storage che fa snapshot (LVM-thin, ZFS, Ceph); su altri usa
`--mode stop`. Ripristina con **Restore** nell’interfaccia web, o `pct restore`.

Per una seconda copia fuori dalla macchina, attiva i backup notturni di Kept
([backup](/it/admin/backups/)). Girano come proprietario del database, quindi dai prima a Kept
quell’accesso, nel container:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

Le destinazioni S3 e SFTP funzionano così. Una cartella come destinazione deve essere scrivibile dal
servizio: aggiungila con `systemctl edit kept` (`[Service]` poi `ReadWritePaths=/la/tua/cartella/backup`),
di proprietà dell’utente `kept`.

## Rimuovere

Questo cancella il container e tutto ciò che contiene, dati di Kept compresi. Fai prima un backup
se potrebbero servirti:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## Qualcosa non funziona?

- **L’installazione si è fermata:** lo script ha indicato il passo e rimosso il container.
  Rieseguilo con `var_keep_failed=yes` per tenere il container, poi `pct enter <CTID>` e
  `journalctl -u kept`.
- **Kept non parte:** `journalctl -u kept-bootstrap -u kept` nel container indica il problema, come
  `kept: invalid environment:` per un’impostazione in `/etc/kept/kept.env`.
- **La console resta nera:** Debian 13 richiede `nesting=1`, che lo script imposta; un container
  creato a mano senza di esso mostra questo.
