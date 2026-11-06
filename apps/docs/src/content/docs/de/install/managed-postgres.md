---
title: Verwaltetes PostgreSQL
description: Kept auf dem PostgreSQL 18 eines Anbieters betreiben – welche Anbieter funktionieren und das SQL, das Kepts Rollen und Erweiterungen anlegt
sidebar:
  order: 5
---

Kept kann statt des mitgelieferten PostgreSQL ein verwaltetes PostgreSQL verwenden. Es benötigt **PostgreSQL 18** und drei
Erweiterungen im Schema `public`: `pg_trgm`, `unaccent` und `vector` (pgvector).

## Welche Anbieter funktionieren

Aus der Dokumentation der jeweiligen Anbieter gelesen am 2026-10-06; bisher wurde nichts davon gegen Kept ausgeführt.

| Anbieter | PostgreSQL 18 | Hinweise |
|---|---|---|
| AWS RDS for PostgreSQL | ja | Der Master-User legt die Erweiterungen an. Wenn ein Admin `rds.allowed_extensions` eingeschränkt hat, alle drei eintragen. |
| Google Cloud SQL | ja | Der Standard-User `postgres` (Mitglied von `cloudsqlsuperuser`) legt sie an. |
| Azure Database for PostgreSQL, flexible server | ja | **Zuerst auf die Allow-List setzen:** `pg_trgm,unaccent,vector` zum Serverparameter `azure.extensions` hinzufügen, dann das SQL als Server-Admin ausführen. |
| DigitalOcean Managed PostgreSQL | ja | **Nur Standard Edition**, als `doadmin`. Die Advanced Edition kann keine Erweiterungen anlegen und kann Kept daher nicht betreiben. |
| Neon | ja | Die eigene Rolle des Projekts (Mitglied von `neon_superuser`) legt sie an. |
| Supabase | **nein** | PostgreSQL 18 wird nicht angeboten, und Erweiterungen liegen in einem `extensions`-Schema, nicht in `public`. |

## Das SQL

`pg_trgm` und `unaccent` sind vertrauenswürdige Erweiterungen, aber pgvectors `vector` nicht, daher kann ein einfacher
Nicht-Superuser sie nicht anlegen. Führe dies **als Admin-User des Anbieters** aus, verbunden mit der Datenbank,
die Kept verwenden wird, mit deinen eigenen Passwörtern statt `…` und dem Namen der Datenbank statt
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

Jede Anweisung wurde lokal auf PostgreSQL 18.6 als Nicht-Superuser mit den Attributen ausgeführt, die Azure
für seinen Admin dokumentiert; nur `CREATE EXTENSION vector` brauchte mehr – und genau das gibt die Admin-Rolle des
Anbieters.

Die beiden Timeouts bei `kept_app` sind wichtig: Kepts eigene Compose-Einrichtung setzt dieselben, und seine Migrationen
können das nicht (die Owner-Rolle darf andere Rollen nicht ändern).

## Die vier Logins

| Variable | Login | Verwendet für |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | jede Anfrage, unter Row-Level Security |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | Anmeldung |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | Hintergrundjobs und Ersteinrichtung |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`, `kept admin` und der Dump des Backups |

**Verweise niemals einen davon auf den Admin-User des Anbieters.** Mehrere Anbieter geben ihm `BYPASSRLS`
(DigitalOceans `doadmin`, Neons `neon_superuser`), wodurch die Row-Level Security abgeschaltet würde, die verhindert, dass
ein Haushalt die Daten eines anderen sieht. Kepts vier Rollen sind alle `NOBYPASSRLS`.

Die meisten Anbieter verlangen TLS: füge das `sslmode`, das ihre Dokumentation angibt, zu jeder URL hinzu.
