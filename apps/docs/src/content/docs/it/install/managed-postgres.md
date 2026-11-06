---
title: PostgreSQL gestito
description: "Esegui Kept su un PostgreSQL 18 di un provider: quali provider funzionano e il SQL che crea i ruoli e le estensioni di Kept."
sidebar:
  order: 5
---

Kept può usare un PostgreSQL gestito invece di quello incluso. Ha bisogno di **PostgreSQL 18** e tre
estensioni nello schema `public`: `pg_trgm`, `unaccent` e `vector` (pgvector).

## Quali provider funzionano

Letto dalla documentazione di ogni provider il 2026-10-06; nessuno è stato ancora testato con Kept.

| Provider | PostgreSQL 18 | Notes |
|---|---|---|
| AWS RDS for PostgreSQL | sì | L'utente master crea le estensioni. Se un admin ha ristretto `rds.allowed_extensions`, elenca tutte e tre. |
| Google Cloud SQL | sì | L'utente predefinito `postgres` (membro di `cloudsqlsuperuser`) le crea. |
| Azure Database for PostgreSQL, flexible server | sì | **Prima la allow list:** aggiungi `pg_trgm,unaccent,vector` al parametro server `azure.extensions`, poi esegui il SQL come admin del server. |
| DigitalOcean Managed PostgreSQL | sì | **Solo Standard Edition**, come `doadmin`. Advanced Edition non può creare estensioni, quindi non può eseguire Kept. |
| Neon | sì | Il ruolo del progetto (membro di `neon_superuser`) le crea. |
| Supabase | **no** | Non offre PostgreSQL 18 e mette le estensioni in uno schema `extensions`, non in `public`. |

## Il SQL

`pg_trgm` e `unaccent` sono estensioni fidate, ma `vector` di pgvector non lo è, quindi un semplice
non-superutente non può crearla. Esegui questo **come utente admin del provider**, connesso al database
che Kept userà, con le tue password al posto di `…` e il nome del database al posto di
`<database>`:

```sql
-- Azure: allow-list pg_trgm,unaccent,vector in azure.extensions first.
CREATE ROLE kept_owner  LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_app    LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_auth   LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE kept_system LOGIN PASSWORD '…' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
-- A request can't run away or sit idle inside a transaction.
ALTER ROLE kept_app SET statement_timeout = '15s';
ALTER ROLE kept_app SET idle_in_transaction_session_timeout = '30s';
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector   WITH SCHEMA public;
-- A non-superuser admin may hand ownership to a role only while it is a member of that role.
GRANT kept_owner TO CURRENT_USER;
ALTER DATABASE <database> OWNER TO kept_owner;
ALTER SCHEMA public OWNER TO kept_owner;
REVOKE kept_owner FROM CURRENT_USER;
```

Ogni istruzione è stata eseguita localmente su PostgreSQL 18.6 come non-superutente con gli attributi che Azure
documenta per il suo admin; solo `CREATE EXTENSION vector` ha richiesto di più, ed è ciò che il ruolo admin del provider
fornisce.

I due timeout su `kept_app` contano: la configurazione Compose di Kept imposta gli stessi, e le sue migrazioni
non possono farlo (il ruolo owner non può cambiare altri ruoli).

## I quattro login

| Variabile | Login | Usato per |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | ogni richiesta, sotto row-level security |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | accesso |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | job in background e configurazione del primo avvio |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`, `kept admin` e il dump del backup |

**Non puntare mai nessuno di loro all'utente admin del provider.** Diversi provider gli danno `BYPASSRLS`
(il `doadmin` di DigitalOcean, il `neon_superuser` di Neon), il che disattiverebbe la row-level security
che tiene i dati di una casa separati da quelli di un'altra. I quattro ruoli di Kept sono tutti `NOBYPASSRLS`.

La maggior parte dei provider richiede TLS: aggiungi a ogni URL lo `sslmode` indicato dalla loro documentazione.
