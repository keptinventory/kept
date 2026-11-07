---
title: La CLI dell'operatore
description: kept migrate e kept admin - cosa fa ogni comando e come eseguirli sotto Compose.
sidebar:
  order: 7
---

L'immagine ha un comando `kept` per chi gestisce il server: migrazioni, il modo per rientrare quando
nessuno può accedere, chiavi, backup. `kept admin --help` elenca tutto; ogni comando che cambia
qualcosa viene inserito nel registro di audit, e la persona a cui è legato l'account viene avvisata per email.

## Eseguirlo sotto Compose

La maggior parte dei comandi richiede il login del **proprietario** del database (`KEPT_OWNER_DATABASE_URL`), che solo il
servizio `migrate` una-tantum detiene; il container che serve non lo detiene mai. Il suo entrypoint è `kept`, quindi:

```sh
docker compose run --rm migrate admin <command>
```

Due tipi di comando necessitano invece dei volumi del container che serve:

- `recovery-kit` legge le chiavi dal volume di configurazione e le stampa anche senza database:
  `docker compose exec kept kept admin recovery-kit`. Con `KEPT_OWNER_DATABASE_URL` (sotto) contiene anche
  il repository di backup, la sua password e le sue credenziali.
- `token create` richiede le chiavi e i login del servizio, che il container `kept` possiede:
  `docker compose exec kept kept admin token create …` ([sotto](#un-token-dal-server)).
- `rotate-key`, `backup`, `restore` e `export` richiedono le chiavi o i file oltre al login
  del proprietario. Dai al servizio `kept` `KEPT_OWNER_DATABASE_URL` in un `compose.override.yaml`
  ([come per i backup](/it/admin/backups/#come-attivarlo)), poi eseguili in un container usa-e-getta:
  `docker compose run --rm --no-deps --entrypoint kept kept admin <command>`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `kept migrate` | Applica una sola volta le migrazioni in sospeso, con un lock del database (il servizio `migrate` lo esegue ad ogni avvio). |
| `kept admin setup-code` | Emette di nuovo il codice di configurazione iniziale, mentre la configurazione è in corso, e toglie il blocco a livello di istanza. |
| `kept admin reset-password <login>` | Un codice di reimpostazione della password valido una sola volta, valido un'ora; disconnette l'account ovunque. |
| `kept admin disable-user <login>` / `enable-user <login>` | Impedisce a un account di accedere (e chiude le sue sessioni), oppure lo permette di nuovo. |
| `kept admin transfer-ownership <locationId> <toUserId>` | Assegna un luogo a un altro proprietario; il precedente proprietario diventa amministratore del luogo. |
| `kept admin recovery-kit [--format text\|html] [--out <file>]` | Il kit di ripristino da tenere fuori dal server: le chiavi, il repository di backup e le sue credenziali, le istruzioni di ripristino. Vedi [il kit di ripristino](/it/admin/recovery-kit/). |
| `kept admin token create --user <login> --scope read\|write --name <name>` | Un token personale per client MCP e Home Assistant, stampato una sola volta; `--expires <days>`, `--location <id or name>` (ripetibile), `--confirm-cross-location`. Dalla 1.13.0. Vedi [un token dal server](#un-token-dal-server). |
| `kept admin gen-key` | Stampa una nuova chiave, per impostare da sé `KEPT_SECRET_KEY` o `KEPT_AUTH_SECRET`. |
| `kept admin rotate-key` | Rende attiva una nuova chiave segreta e ricifra tutti i segreti salvati. `--resume` completa uno interrotto; `--drop <version>` rimuove una chiave ritirata che nessuno usa. |
| `kept admin backup` | Esegue ora il backup (uno snapshot restic); `--list` elenca gli snapshot e gli eventuali backup precedenti a restic; `--accept-size` accetta un backup molto più piccolo come nuovo normale. Vedi [backup](/it/admin/backups/). |
| `kept admin backup verify` | Controlla il repository di backup; `--read-data <percent>` legge anche quella quota di dati; con storage file S3, controlla i file rispetto al bucket (`--all-files` per tutti, non uno su 20). |
| `kept admin backup drill --into <database>` | Ripristina il backup più recente in un database di prova **vuoto** e lo controlla: l'[esercitazione mensile](/it/admin/restore/#la-prova-mensile). |
| `kept admin backup unlock` | Rimuove un lock restic rimasto dopo un crash; rifiutato mentre un backup è in esecuzione. |
| `kept admin restore <snapshot>` | Ripristina uno snapshot (o `latest`) in un database **vuoto** e lo verifica; `--legacy <id>` ripristina un backup precedente a restic, per una versione. Vedi [ripristino](/it/admin/restore/). |
| `kept admin readable --out <dir>` | Scrive la [copia leggibile](/it/admin/read-with-restic/) di ogni luogo (HTML, CSV, file) in una directory; `--location <id>` per uno solo, `--no-pdf` senza i PDF dell'inventario. |
| `kept admin storage copy --to s3\|local` | Copia ogni file nell'altro archivio, controllando l'hash di ciascuno; `--dry-run` conta solo. Vedi [cambiare archivio file](/it/admin/storage/). |
| `kept admin storage verify --store s3\|local` | Controlla che ogni file a cui fa riferimento il database sia in quell'archivio con i byte giusti. |
| `kept admin export --out <dir>` | Ogni riga, grezza, con i segreti ancora sigillati, e ogni file, in una nuova directory: la via di fuga, sensibile come un backup. |
| `kept admin backfill-pdf-text` | Legge il testo dei PDF caricati prima che Kept leggesse i PDF, così la ricerca li trova. |
| `kept admin config` | Stampa la [guida alla configurazione](/it/reference/configuration/) per questa versione. |

`kept admin seed` esiste per lo sviluppo e si rifiuta di essere eseguito in produzione.

## Un token dal server

L'app crea token personali solo via HTTPS (Impostazioni → Connessioni rifiuta su `http` semplice).
Un Kept su una rete domestica su `http` può comunque connettere un'app di AI oppure
[Home Assistant](/it/users/home-assistant/): chi gestisce il server crea il token lì.
Dalla 1.13.0:

```sh
docker compose exec kept kept admin token create \
  --user ibrahim@example.com --scope read --name "Home Assistant"
```

- `--user` è la persona per cui il token agisce: il suo indirizzo email, oppure il nome utente di un account gestito.
  Può fare quello che possono fare loro, e nulla più.
- `--scope read` legge soltanto; `--scope write` può anche modificare gli oggetti.
- Senza `--location`, raggiunge ogni luogo a cui la persona appartiene, tranne quelli che non può:
  un luogo che richiede il secondo fattore (un token creato qui non ha secondo fattore; crealo in
  Impostazioni → Connessioni, via HTTPS) e, per un token con permesso di scrittura, quelli in cui è un visualizzatore. Ciascuno
  escluso viene segnalato. `--location` (un id o un nome, ripetibile) li seleziona invece.
- Un token con permesso di scrittura che coinvolge luoghi con membri diversi si ferma con un avviso, come nell'app;
  `--confirm-cross-location` lo crea comunque.
- `--expires <days>` lo fa scadere dopo tanti giorni; senza, funziona fino alla revoca.

Stampa il token una sola volta, sulla riga che inizia con `KEPT TOKEN:`, e l'indirizzo del server MCP. Kept conserva
solo un'impronta di esso. La persona lo vede in **Impostazioni → Connessioni**, dove può revocarlo,
e viene avvisata per email.
