---
title: Postgres géré
description: Exécutez Kept sur une PostgreSQL 18 d'un fournisseur - quels fournisseurs fonctionnent, et le SQL qui crée les rôles et extensions de Kept.
sidebar:
  order: 5
---

Kept peut utiliser une PostgreSQL gérée au lieu de celle intégrée. Elle nécessite **PostgreSQL 18** et trois extensions dans le schéma `public` : `pg_trgm`, `unaccent` et `vector` (pgvector).

## Quels fournisseurs fonctionnent

Lisez la documentation de chaque fournisseur du 2026-10-06 ; aucun n'a encore été exécuté avec Kept.

| Provider | PostgreSQL 18 | Notes |
|---|---|---|
| AWS RDS for PostgreSQL | oui | L'utilisateur principal crée les extensions. Si un administrateur a réduit `rds.allowed_extensions`, listez les trois. |
| Google Cloud SQL | oui | L'utilisateur `postgres` par défaut (membre de `cloudsqlsuperuser`) les crée. |
| Azure Database for PostgreSQL, flexible server | oui | **Liste d'autorisation préalable :** ajoutez `pg_trgm,unaccent,vector` au paramètre de serveur `azure.extensions`, puis exécutez le SQL en tant qu'administrateur du serveur. |
| DigitalOcean Managed PostgreSQL | oui | **Édition Standard uniquement**, en tant que `doadmin`. L'édition Advanced ne peut pas créer d'extensions, donc elle ne peut pas exécuter Kept. |
| Neon | oui | Le rôle propre au projet (membre de `neon_superuser`) les crée. |
| Supabase | **non** | Il ne propose pas PostgreSQL 18, et il place les extensions dans le schéma `extensions`, pas dans `public`. |

## Le SQL

`pg_trgm` et `unaccent` sont des extensions de confiance, mais le `vector` de pgvector ne l'est pas, donc un utilisateur non superutilisateur ordinaire ne peut pas le créer. Exécutez ceci **en tant qu'utilisateur admin du fournisseur**, connecté à la base de données que Kept utilisera, avec vos propres mots de passe à la place de `…` et le nom de la base de données à la place de `<database>` :

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

Chaque instruction a été exécutée localement sur PostgreSQL 18.6 en tant qu'utilisateur non superutilisateur avec les attributs documentés par Azure pour son admin ; seul `CREATE EXTENSION vector` nécessitait davantage, ce que le rôle admin du fournisseur fournit.

Les deux délais d'attente sur `kept_app` sont importants : la configuration Compose propre à Kept les définit de la même manière, et ses migrations ne peuvent pas (le rôle propriétaire ne peut pas modifier les autres rôles).

## Les quatre connexions

| Variable | Connexion | Utilisé pour |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | chaque requête, sous sécurité au niveau de la ligne |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | connexion |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | tâches en arrière-plan et configuration initiale |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`, `kept admin`, et le vidage de la sauvegarde |

**Ne pointez jamais aucun d'entre eux vers l'utilisateur admin du fournisseur.** Plusieurs fournisseurs lui donnent `BYPASSRLS` (`doadmin` de DigitalOcean, `neon_superuser` de Neon), ce qui désactiverait la sécurité au niveau de la ligne qui empêchait les données d'un ménage d'être accessibles par un autre. Les quatre rôles de Kept sont tous `NOBYPASSRLS`.

La plupart des fournisseurs nécessitent TLS : ajoutez le `sslmode` indiqué dans leur documentation à chaque URL.
