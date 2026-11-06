---
title: "الاستعادة والتدريب"
description: "إعادة نسخة احتياطية إلى قاعدة بيانات جديدة فارغة، والتحقق من مطابقتها، وتبديلها — والتدرب على ذلك شهريًا."
sidebar:
  order: 2
---

تستعيد Kept **في قاعدة بيانات جديدة فارغة فقط**، وتتحقق منها، وتترك التبديل لك. وهي ترفض قاعدة بيانات تحتوي على أي بيانات، حتى لا يمكن توجيهها عن طريق الخطأ إلى قاعدة البيانات الحية.

## الاستعادة

1. **عرض اللقطات (snapshots):**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   يؤدي هذا إلى تشغيل واجهة سطر الأوامر (CLI) في حاوية `kept` لمرة واحدة، والتي تحتوي على وحدة تخزين البيانات، والمفاتيح، وبيانات دخول المالك من ملف `compose.override.yaml`، وإعدادات النسخ الاحتياطي (من ملف `.env`، أو تلك المحفوظة في الإدارة → النسخ الاحتياطية؛ راجع [النسخ الاحتياطي](/ar/admin/backups/#التفعيل)).

2. **إنشاء قاعدة بيانات فارغة** بجانب قاعدة البيانات الحية، كمستخدم فائق (superuser) لقاعدة البيانات:

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   في حالة PostgreSQL المُدار، شغّل [تعليمات SQL الخاصة بالمزوّد](/ar/install/managed-postgres/#الـ-sql) الخاصة بالامتدادات والملكية لقاعدة البيانات الجديدة بدلاً من ذلك.

3. **الاستعادة فيها**، مع تحميل ملف `.env` في الغلاف (shell) أولاً (`set -a; . ./.env; set +a`):

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <snapshot>
   ```

   تستخرج Kept قاعدة البيانات والملفات من اللقطة، وتتحقق من التفريغ (dump) مقابل البيان (manifest)، وتتحقق من أن `pg_restore` يطابق الإصدار الرئيسي للخادم وأن الامتدادات موجودة، وتستعيد في معاملة واحدة، ثم تقارن **عدد صفوف كل جدول وبصمة بياناته (data digest)** بما في البيان: وتفشل الاستعادة إذا اختلفت بيانات أي جدول، حتى مع تساوي عدد الصفوف. وتعود الملفات إلى المخزن الذي يحدده `KEPT_STORAGE`، مع التحقق من SHA-256 لكل ملف. وتنتهي بطباعة أوامر التبديل.

4. **التبديل**، مع إيقاف Kept، كمستخدم فائق:

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   احتفظ بـ `kept_before_restore` حتى تتأكد، ثم احذفها.

إعادة تسمية قاعدة بيانات تتطلب المستخدم الفائق، وليس أيٌّ من حسابات دخول Kept مستخدمًا فائقًا: لهذا السبب تطبع Kept هذه الأوامر بدلاً من تشغيلها.

## بعد فقدان الخادم

على الجهاز الجديد: ثبّت Kept كما في [التثبيت باستخدام Docker Compose](/ar/install/compose/)، وقبل التشغيل الأول ضع **مفاتيح حقيبة الاسترداد** في ملف `.env` (`KEPT_SECRET_KEY`، `KEPT_AUTH_SECRET`، و `KEPT_SECRET_KEY_VERSION` و `KEPT_SECRET_KEYS_RETIRED` إذا كانت الحقيبة تسردها)، مع هدف النسخ الاحتياطي وكلمة مروره في `compose.override.yaml`. ثم:

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

قاعدة بيانات `kept` في التثبيت الجديد لا تزال فارغة (لم تعمل خدمة `migrate` بعد)، لذا تقبل الاستعادة مباشرة؛ ولا يوجد ما يستدعي التبديل.
بدون المفاتيح، يعود كل شيء ما عدا القيم السرية ومفاتيح الذكاء الاصطناعي، التي تظل غير قابلة للقراءة.

## التدريب الشهري

نسخة احتياطية لم يقم أحد باستعادتها هي أمل، وليست نسخة احتياطية. مرة واحدة شهريًا، استعد أحدث لقطة في قاعدة بيانات تجريبية (scratch) ودع Kept تقارنها (مع تحميل `.env`، كما أعلاه):

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

يستعيد التمرين أحدث لقطة سليمة، ويقارن الأعداد والبصمات، ويتحقق من SHA-256 لـ ٥٠ ملفًا (`--all-files` يتحقق منها جميعًا)، ويسجّل التمرين في قاعدة البيانات **الحية**، مما يزيل تنبيه "حان تمرين الاستعادة" في الإدارة → الحالة. ولا يمس البيانات الحية أبدًا.

## التحقق من المستودع (repository)

يتحقق العامل (worker) من المستودع أسبوعيًا (`restic check`). للتحقق الآن، أو لقراءة جزء من البيانات أيضًا:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

مع تخزين الملفات على S3، يتحقق `verify` أيضًا من كل ملف في البيان مقابل الحاوية (bucket). إذا ترك تعطل قفلًا قديمًا (stale lock) على المستودع، فإن `kept admin backup unlock` يزيله؛ وهو يرفض أثناء تشغيل نسخة احتياطية.
