---
title: "Ripristino e la prova"
description: "Riporta un backup in un nuovo database vuoto, verifica che corrisponda, scambialo - e prova il tutto ogni mese."
sidebar:
  order: 2
---

Kept ripristina **solo in un nuovo database vuoto**, lo verifica e lascia a te lo scambio. Rifiuta un database che contenga qualcosa, così non può essere indirizzato per errore a quello live.

## Ripristino

1. **Elenca gli snapshot:**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   Questo esegue la CLI in un container `kept` usa e getta, che ha il volume dati, le chiavi, il login
   del proprietario dal tuo `compose.override.yaml` e le impostazioni di backup (quelle del `.env`, o quelle salvate in
   Admin → Backup; vedi [backup](/it/admin/backups/#come-attivarlo)).

2. **Crea un database vuoto accanto a quello live, come superutente del database:**

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   Su Postgres gestito, esegui invece, per il nuovo database, le righe di estensione e di proprietà [del SQL del provider](/it/install/managed-postgres/#il-sql).

3. **Ripristina in esso, con `.env` caricato nella shell prima (`set -a; . ./.env; set +a`):**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <snapshot>
   ```

   Kept estrae dallo snapshot il database e i file, verifica il dump rispetto al suo manifest,
   verifica che `pg_restore` corrisponda alla versione major del server e che le estensioni esistano, ripristina in
   un'unica transazione, poi confronta **il numero di righe e il digest dei dati di ogni tabella** con il manifest:
   qualsiasi tabella i cui dati differiscano, anche con lo stesso numero di righe, fa fallire il ripristino. I file tornano
   nello store che `KEPT_STORAGE` indica, ciascuno con verifica SHA-256. Termina stampando lo
   scambio.

4. **Scambia, con Kept fermo, come superutente:**

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   Tieni `kept_before_restore` finché non sei sicuro, poi eliminalo.

Rinominare un database richiede il superutente, che nessuno dei login di Kept è: per questo Kept stampa
questi comandi invece di eseguirli.

## Dopo aver perso il server

Sulla nuova macchina: installa Kept come in [Installa con Docker Compose](/it/install/compose/) e, prima del
primo avvio, metti le **chiavi del kit di ripristino** in `.env` (`KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET`,
e `KEPT_SECRET_KEY_VERSION` e `KEPT_SECRET_KEYS_RETIRED` se il kit le elenca), con il
target di backup e la sua password in `compose.override.yaml`. Poi:

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

Il database `kept` della nuova installazione è ancora vuoto (il servizio `migrate` non ha ancora girato), quindi
accetta il ripristino direttamente; non c'è nulla da scambiare.
Senza le chiavi, torna tutto tranne i valori segreti e le chiavi AI, che restano illeggibili.

## La prova mensile

Un backup che nessuno ha ripristinato è una speranza, non un backup. Una volta al mese, ripristina l'ultimo snapshot
in un database temporaneo e lascia che Kept lo confronti (con `.env` caricato, come sopra):

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

La prova ripristina l'ultimo snapshot valido, confronta conteggi e digest, verifica lo SHA-256 di 50
file (`--all-files` li verifica tutti) e registra la prova nel database **live**, il che azzera
l'avviso "restore drill due" su Admin → Stato. Non tocca mai i dati live.

## Verifica del repository

Il worker verifica il repository ogni settimana (`restic check`). Per verificare ora, o per rileggere anche parte dei
dati:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

Con storage file S3, la verifica controlla anche ogni file del manifest rispetto al bucket. Se un crash
ha lasciato un lock obsoleto sul repository, `kept admin backup unlock` lo rimuove; rifiuta mentre un
backup è in esecuzione.
