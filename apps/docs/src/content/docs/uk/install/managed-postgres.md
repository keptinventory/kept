---
title: Керований Postgres
description: Запустіть Kept на PostgreSQL 18 від провайдера - які провайдери працюють і який SQL створює ролі та розширення Kept.
sidebar:
  order: 5
---

Kept може використовувати керовану PostgreSQL замість вбудованої. Для цього потрібні **PostgreSQL 18** і три розширення в схемі `public`: `pg_trgm`, `unaccent` і `vector` (pgvector).

## Які провайдери працюють

Дані взято з документації кожного провайдера станом на 2026-10-06; жоден ще не перевірявся з Kept.

| Провайдер | PostgreSQL 18 | Примітки |
|---|---|---|
| AWS RDS for PostgreSQL | так | Користувач master створює розширення. Якщо адміністратор обмежив `rds.allowed_extensions`, вкажіть усі три. |
| Google Cloud SQL | так | Користувач `postgres` за замовчуванням (член `cloudsqlsuperuser`) створює їх. |
| Azure Database for PostgreSQL, flexible server | так | **Спочатку додайте до списку дозволених:** додайте `pg_trgm,unaccent,vector` до параметра сервера `azure.extensions`, потім виконайте SQL як адміністратор сервера. |
| DigitalOcean Managed PostgreSQL | так | **Лише Standard Edition**, як `doadmin`. Advanced Edition не може створювати розширення, тож не може запустити Kept. |
| Neon | так | Власна роль проєкту (член `neon_superuser`) створює їх. |
| Supabase | ні | Він не пропонує PostgreSQL 18 і кладе розширення в схему `extensions`, а не `public`. |

## SQL

`pg_trgm` і `unaccent` — довірені розширення, але `vector` з pgvector — ні, тому звичайний не-суперкористувач не може його створити. Виконайте це як адміністратор провайдера, підключившись до бази даних, яку використовуватиме Kept, підставивши власні паролі замість … та назву бази даних замість `<database>`:

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

Кожну інструкцію виконано локально на PostgreSQL 18.6 як не-суперкористувач із атрибутами, які Azure описує для свого адміністратора; лише `CREATE EXTENSION vector` вимагав більших прав, і саме їх надає роль адміністратора провайдера.

Два тайм-аути для `kept_app` важливі: власне Compose-налаштування Kept задає такі самі, а його міграції зробити це не можуть (роль власника не може змінювати інші ролі).

## Чотири логіни

| Змінна | Логін | Використовується для |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | кожен запит у режимі безпеки на рівні рядків |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | вхід |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | фонові завдання та початкове налаштування |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`, `kept admin` і дамп резервної копії |

**Ніколи не спрямовуйте жоден із них на адміністратора провайдера.** Кілька провайдерів дають йому `BYPASSRLS` (DigitalOcean `doadmin`, Neon `neon_superuser`), що вимкнуло б безпеку на рівні рядків, яка не дозволяє даним одного домогосподарства потрапити до іншого. Усі чотири ролі Kept мають `NOBYPASSRLS`.

Більшість провайдерів вимагає TLS: додайте `sslmode`, який указує їхня документація, до кожного URL.
