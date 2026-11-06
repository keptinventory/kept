---
title: Backup
description: Istantanee restic cifrate nightly del database, dei file e di una copia leggibile, verso un altro disco, un bucket S3 o un server SFTP.
sidebar:
  order: 1
---

Ogni notte Kept scatta un'**istantanea restic**: cifrata con una password da te scelta,
deduplicata (una notte senza novità aggiunge quasi nulla), e inviata in un posto che non sia il
disco stesso del server.

## Cosa contiene un'istantanea

- **Il database**, esportato da un momento coerente, con un manifesto del conteggio righe di ogni
  tabella e un digest dei suoi dati, così un ripristino può dimostrare di aver riportato esattamente
  ciò che c'era.
- **I file** (foto, ricevute, documenti), quando sono memorizzati sul disco del server. Con
  archiviazione S3 dei file non lo sono: vedi [sotto](#quando-i-file-vivono-in-s3).
- **Una copia leggibile di ogni luogo**: pagine web, fogli di calcolo, miniature e ricevute che si
  aprono in un browser solo con restic. Vedi
  [leggere l'inventario solo con restic](/it/admin/read-with-restic/).

Le chiavi **non** sono nel backup. Conserva [il kit di recupero](/it/admin/recovery-kit/) altrove.

## Dove può andare

| Destinazione | Impostato con | Il repository restic |
|---|---|---|
| Una directory: un altro disco, o una condivisione NAS montata sul server | `KEPT_BACKUP_DIR` (assoluto, fuori da `KEPT_DATA_DIR`) | `<directory>/restic` |
| Un bucket compatibile S3: AWS, o l'endpoint S3 di un altro provider | `KEPT_BACKUP_S3_BUCKET` e gli altri `KEPT_BACKUP_S3_*` | `restic/` sotto `KEPT_BACKUP_S3_PREFIX` |
| Un server SFTP | `KEPT_BACKUP_SFTP` (sintassi `sftp:` di restic), `KEPT_BACKUP_SFTP_KEY_FILE`, `KEPT_BACKUP_SFTP_KNOWN_HOSTS` | la posizione che indichi |

Imposta una sola destinazione. Meglio un'altra macchina o un altro sito: una directory sullo stesso
disco dei dati di Kept viene rifiutata, e la pagina di stato avvisa quando la destinazione condivide
un disco con essi. Gli endpoint S3 di Backblaze B2 e Cloudflare R2 dovrebbero funzionare ma non sono
stati testati. SFTP fissa la chiave host del server dal file known-hosts e si connette solo se
corrisponde.

## Come attivarlo

Gli amministratori dell'istanza impostano destinazione e password in **Admin → Backup**, via HTTPS,
dopo aver preso atto del kit di recupero. "Test" verifica che Kept possa aprire (o creare) il
repository; "Backup ora" esegue subito un backup. Una variabile d'ambiente ha precedenza sulla
schermata e lì risulta bloccata, così un operatore può sistemare la destinazione nel deployment.

**La password** è di almeno 12 caratteri (`KEPT_BACKUP_PASSWORD`, oppure impostata sulla schermata).
**Nessuna password, nessun backup:** Kept non scrive mai un backup non cifrato. Se perdi la
password, il backup è illeggibile, ed è per questo che è nel kit di recupero.

Il backup viene eseguito nel worker come proprietario del database, quindi il worker ha bisogno anche
di `KEPT_OWNER_DATABASE_URL`. Con Compose, `compose.yaml` passa già ogni variabile `KEPT_BACKUP_*`
da `.env` a Kept e a `migrate` (che fa un'istantanea prima di un aggiornamento); un
`compose.override.yaml` accanto aggiunge il login del proprietario e, per una destinazione
directory, il mount su entrambi:

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

La password del proprietario proviene dal volume `kept-owner`, dove il bootstrap la conserva (un'installazione
precedente alla 1.13.0 con `KEPT_DB_OWNER_PASSWORD` in `.env` usa invece quella, e la riga del file non
fa nulla).

Poi imposti la destinazione e la password sulla schermata, oppure bloccale in `.env`
(`KEPT_BACKUP_DIR=/backups`, `KEPT_BACKUP_PASSWORD=…`).

La directory deve appartenere all'utente di Kept:

```sh
sudo mkdir -p /mnt/backup/kept
sudo chown 10001:10001 /mnt/backup/kept
sudo chmod 700 /mnt/backup/kept
```

## Quando e per quanto tempo

- **Quando:** ogni notte all'orario impostato in Admin → Backup, `HH:MM` in UTC (predefinito `02:30`).
  Un nuovo orario si applica dalla notte successiva, senza riavvio; `KEPT_BACKUP_TIME` lo fissa invece.
- **Backup ora** esegue uno subito; ripremendolo mentre quello è in attesa o in esecuzione viene
  rifiutato ("Un backup è già in esecuzione") invece di metterlo due volte in coda. Un backup
  interrotto da un riavvio o dalla mancanza di memoria non lo blocca; l'esecuzione successiva lo
  segna come interrotto.
- **Su una macchina piccola** (meno di 4 GB, o un limite del container inferiore a 4 GB) restic gira
  su al più due core con un limite morbido di memoria; `GOMAXPROCS` e `GOMEMLIMIT` nell'ambiente di
  Kept (con Compose, un `compose.override.yaml`) sovrascrivono entrambi.
- **Per quanto tempo si conservano:** l'istantanea più recente di ciascuno degli ultimi **7 giorni,
  4 settimane e 6 mesi** (`KEPT_BACKUP_KEEP_DAILY`, `_WEEKLY`, `_MONTHLY`). Il `KEPT_BACKUP_KEEP`
  dell'alpha è letto come conteggio giornaliero per una release. Le istantanee prese prima di un
  aggiornamento conservano le ultime 3.
- **Un backup sospettosamente piccolo** (un dump inferiore alla metà delle dimensioni dell'ultimo
  buono, o con molti meno oggetti, luoghi o file) viene comunque eseguito, ma quella notte non si
  rimuove nulla di vecchio e gli amministratori vengono avvisati, così una brutta notte non può mai
  spingere fuori gli snapshot buoni.

## Monitorarlo

Admin → Status mostra l'ultimo backup e la sua età, il numero di snapshot, la dimensione del
repository, l'ultima prova di ripristino e i dischi. Gli amministratori vengono avvisati per email e
push quando:

| Avviso | Quando |
|---|---|
| Backup non riuscito | fallisce un'esecuzione |
| Backup non aggiornato | nessun buon backup da 36 ore con destinazione impostata |
| Dimensione sospetta | un'esecuzione è stata molto più piccola dell'ultima buona |
| Spazio su disco basso | il disco dei dati o una destinazione directory è all'85 % |
| Versioning del bucket disattivato | i file sono in S3 e il bucket non conserva vecchie versioni |
| Prova di ripristino in scadenza | nessuna [prova di ripristino](/it/admin/restore/#la-prova-mensile) da 30 giorni |

`/metrics` (con `KEPT_METRICS_TOKEN`) aggiunge l'orario dell'ultimo buon backup e l'uso dei dischi.
Vedi [monitoraggio](/it/admin/observability/).

## Quando i file vivono in S3

restic fa il backup dei file su disco, non degli oggetti in un bucket. Con `KEPT_STORAGE=s3`,
l'istantanea contiene il database, il manifesto e la copia leggibile, e **è il bucket stesso a
tenere al sicuro i file**: attiva il **versioning del bucket** (e, se il tuo provider lo offre, la
replica in un'altra regione). Kept controlla il versioning a ogni esecuzione e avvisa finché è
disattivato. Il controllo settimanale e la prova di ripristino confrontano l'hash di ogni file nel
manifesto con il bucket.

## I backup dell'alpha

I backup fatti prima di restic, dall'alpha (`runs/` e `blobs/` accanto alla nuova directory
`restic/`), non vengono più scritti, e restano ripristinabili con
`kept admin restore --legacy <id>` per una release. Eliminali una volta che un'istantanea restic ha
superato una prova di ripristino.
