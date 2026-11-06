---
title: "PostgreSQL المُدار"
description: "تشغيل Kept على PostgreSQL 18 من مزوّد - أي المزوّدين يعملون، و SQL الذي ينشئ أدوار Kept وامتداداته."
sidebar:
  order: 5
---

يمكن لـ Kept استخدام PostgreSQL مُدار بدلاً من المضمّن. يحتاج إلى **PostgreSQL 18** وثلاثة امتدادات في المخطط `public`: `pg_trgm`، `unaccent` و `vector` (pgvector).

## أي المزوّدين يعملون

مُقتبس من وثائق كل مزوّد في 2026-10-06؛ لم يُختبر أي منها مع Kept بعد.

| المزوّد | PostgreSQL 18 | ملاحظات |
|---|---|---|
| AWS RDS for PostgreSQL | نعم | المستخدم الرئيسي ينشئ الامتدادات. إذا ضيّق مسؤول `rds.allowed_extensions`، اذكر الثلاثة جميعًا. |
| Google Cloud SQL | نعم | المستخدم الافتراضي `postgres` (عضو في `cloudsqlsuperuser`) ينشئها. |
| Azure Database for PostgreSQL، الخادم المرن | نعم | **السماح بالقائمة أولًا:** أضف `pg_trgm,unaccent,vector` إلى معامل الخادم `azure.extensions`، ثم شغّل SQL كمسؤول خادم. |
| DigitalOcean Managed PostgreSQL | نعم | **الإصدار القياسي فقط**، كـ `doadmin`. الإصدار المتقدّم لا يستطيع إنشاء امتدادات، لذا لا يستطيع تشغيل Kept. |
| Neon | نعم | دور المشروع الخاص (عضو في `neon_superuser`) ينشئها. |
| Supabase | **لا** | لا يقدّم PostgreSQL 18، ويضع الامتدادات في مخطط `extensions`، لا `public`. |

## الـ SQL

`pg_trgm` و `unaccent` امتدادات موثوقة، لكن pgvector's `vector` ليس كذلك، لذا لا يستطيع مستخدم عادي غير فائق إنشاءه. شغّل هذا **بصفتك مستخدم المسؤول لدى المزوّد**، متصلًا بقاعدة البيانات التي سيستخدمها Kept، مع كلمات مرورك الخاصة مكان `…` واسم قاعدة البيانات مكان `<database>`:

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

كل عبارة شُغّلت محليًا على PostgreSQL 18.6 كمستخدم غير فائق بالسمات التي توثّقها Azure لمسؤولها؛ فقط `CREATE EXTENSION vector` احتاج أكثر، وهو ما يعطي دور مسؤول المزوّد.

المهلتان الزمنيتان على `kept_app` مهمتان: إعداد Compose الخاص بـ Kept يضبط نفسهما، وهجراته لا تستطيع (قد لا يغيّر دور المالك أدوارًا أخرى).

## تسجيلات الدخول الأربع

| المتغير | تسجيل الدخول | يُستخدم لـ |
|---|---|---|
| `KEPT_DATABASE_URL` | `kept_app` | كل طلب، تحت أمان مستوى الصف |
| `KEPT_AUTH_DATABASE_URL` | `kept_auth` | تسجيل الدخول |
| `KEPT_SYSTEM_DATABASE_URL` | `kept_system` | مهام الخلفية والإعداد الأولي |
| `KEPT_OWNER_DATABASE_URL` | `kept_owner` | `kept migrate`، `kept admin`، وتفريغ النسخة الاحتياطية |

**لا توجّه أيًا منها أبدًا إلى مستخدم مسؤول المزوّد.** عدة مزوّدين يعطونه `BYPASSRLS` (`doadmin` في DigitalOcean، `neon_superuser` في Neon)، مما سيعطّل أمان مستوى الصف الذي يفصل بيانات أسرة عن أخرى. أدوار Kept الأربع كلها `NOBYPASSRLS`.

معظم المزوّدين يتطلبون TLS: أضف `sslmode` الذي تعطيه وثائقهم إلى كل URL.
