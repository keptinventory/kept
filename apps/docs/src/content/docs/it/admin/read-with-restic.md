---
title: Leggi il tuo inventario con restic da solo
description: Il server è sparito. Con restic, la password del backup e qualsiasi computer, apri la copia leggibile di tutto ciò che possedevi - nessun Kept, nessuna rete.
sidebar:
  order: 3
---

Ogni snapshot notturno contiene una **copia leggibile** di ogni luogo: un `index.html` che apri in un
browser, un foglio di calcolo (CSV) degli oggetti, le miniature, e le ricevute e i documenti a cui le pagine
collegano. È scritto per il giorno in cui Kept non può funzionare: il server ha preso fuoco, il disco si è guastato, o Kept è
da tempo scomparso. Ti serve solo:

- **restic**, il programma di backup, su qualsiasi computer (Windows, macOS o Linux). La sua documentazione elenca
  un pacchetto o un download per ciascuno. Usa la versione 0.19.1, quella che usa Kept, o più recente.
- **Il repository e la sua password**, dal [kit di ripristino](/it/admin/recovery-kit/), e per un bucket S3
  o un server SFTP, le credenziali che il kit elenca insieme a loro.
- Il backup stesso: il disco, il bucket o il server SFTP a cui è stato inviato.

## 1. Punta restic al backup

La sezione backup del kit di ripristino fornisce la posizione e la password del repository, e, per S3, le
due chiavi. In un terminale:

```sh
export RESTIC_REPOSITORY='<the repository line from the kit>'
export RESTIC_PASSWORD='<the backup password from the kit>'
# S3 only:
export AWS_ACCESS_KEY_ID='<from the kit>'
export AWS_SECRET_ACCESS_KEY='<from the kit>'
```

Su PowerShell di Windows, `$env:RESTIC_REPOSITORY = '…'` e così via. Una copia di una directory di backup su un
laptop è semplicemente il suo percorso: la cartella `restic` dentro la directory di backup.

## 2. Seleziona uno snapshot

```sh
restic snapshots
```

elenca ogni snapshot con la sua ora e i suoi tag. Prendi quello più recente contrassegnato `nightly` (o
`manual`); uno snapshot `pre_upgrade` contiene solo il database, non la copia leggibile. Nota il suo ID.

## 3. Ripristina la copia leggibile

```sh
restic restore <snapshot ID> --target ./kept-readable --include /backup/readable
```

Questo ripristina solo la copia leggibile, non il dump del database né i file a grandezza naturale, in una nuova
cartella `kept-readable`.

## 4. Aprilo

Apri `kept-readable/backup/readable/index.html` in un browser. Elenca ogni luogo, con il suo
proprietario e quando la copia è stata fatta; ogni `index.html` di luogo elenca i suoi posti e oggetti, con
le loro foto, i dettagli dell'acquisto e i documenti. `README.txt` accanto dice lo stesso.

Le pagine non necessitano di rete e non caricano nulla da altrove. Il CSV di ogni luogo si apre in un
foglio di calcolo.

La copia di ogni luogo è ciò che il suo **proprietario** poteva vedere in Kept: i soldi appaiono come il proprietario li vedeva,
e i valori segreti (la password Wi-Fi che hai memorizzato sul router) non ci sono mai. Un luogo la cui copia è fallita quella notte è elencato come "not included tonight"; prendi lo snapshot precedente.

## Sfoglia senza ripristinare

Su Linux, e su macOS con macFUSE, `restic mount ./mnt` mostra ogni snapshot come cartelle che puoi
aprire sul posto. Richiede FUSE, che Windows non ha; `restore` funziona ovunque.
