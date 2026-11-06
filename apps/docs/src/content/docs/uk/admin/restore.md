---
title: Відновлення та тренування
description: Поверніть резервну копію у нову порожню базу даних, доведіть їхню відповідність, підмініть її — і репетицію щомісяця.
sidebar:
  order: 2
---

Kept відновлює **тільки у нову порожню базу даних**, перевіряє її та залишає підміну вам. Він
відмовляється від бази даних, у якій щось є, тож його не можна випадково спрямувати на живу.

## Відновлення

1. **Перелічіть знімки:**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   Це запускає CLI в одноразовому контейнері `kept`, який має том даних, ключі, логін
   власника з вашого `compose.override.yaml`, а також налаштування резервного копіювання (`.env`'s або збережені в
   Admin → Backups; див. [резервні копії](/uk/admin/backups/#увімкнення)).

2. **Створіть порожню базу даних** поруч із живою, як суперкористувач бази даних:

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   На керованому Postgres натомість виконайте рядки розширень і
   власності з [SQL постачальника](/uk/install/managed-postgres/#sql) для нової бази даних.

3. **Відновіть у неї**, попередньо завантаживши `.env` у оболонку (`set -a; . ./.env; set +a`):

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <snapshot>
   ```

   Kept витягує базу даних і файли зі знімка, перевіряє дамп за маніфестом,
   перевіряє, що `pg_restore` відповідає основній версії сервера та розширення існують, відновлює в
   одній транзакції, потім порівнює **кількість рядків і дайджест даних кожної таблиці** з маніфестом:
   будь-яка таблиця, чиї дані відрізняються, навіть за однакової кількості рядків, призводить до збою відновлення. Файли повертаються
   у сховище, яке вказує `KEPT_STORAGE`, з перевіркою SHA-256 кожного. На завершення він друкує
   підміну.

4. **Підмініть**, зупинивши Kept, як суперкористувач:

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   Залишайте `kept_before_restore`, доки не впевнитесь, потім видаліть його.

Перейменування бази даних потребує суперкористувача, а жоден із логінів Kept ним не є: тому Kept друкує
ці команди, а не виконує їх.

## Після втрати сервера

На новій машині: встановіть Kept як описано в [Встановлення за допомогою Docker Compose](/uk/install/compose/), і перед
першим запуском помістіть **ключі відновлювального комплекту** у `.env` (`KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET`,
а також `KEPT_SECRET_KEY_VERSION` і `KEPT_SECRET_KEYS_RETIRED`, якщо комплект їх містить), а ціль
резервного копіювання з паролем — у `compose.override.yaml`. Потім:

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

База даних `kept` нового встановлення залишається порожньою (служба `migrate` ще не запустилася), тож вона
приймає відновлення безпосередньо; нічого підміняти.
Без ключів повертається все, крім секретних значень і ключів AI, які залишаються нечитабельними.

## Щомісячне тренування

Резервна копія, яку ніхто не відновлював, — це сподівання, а не резервна копія. Раз на місяць відновлюйте найсвіжіший знімок
у чернеткову базу даних і дозвольте Kept порівняти її (з завантаженим `.env`, як вище):

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

Тренування відновлює найсвіжіший придатний знімок, порівнює кількості та дайджести, перевіряє SHA-256 50
файлів (`--all-files` перевіряє їх усіх) і записує тренування у **живу** базу даних, що знімає
сповіщення "restore drill due" у Admin → Status. Воно ніколи не торкається живих даних.

## Перевірка репозиторію

Воркер щотижня перевіряє репозиторій (`restic check`). Щоб перевірити зараз або прочитати назад частину
даних також:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

За файлового сховища S3 verify також перевіряє кожен файл у маніфесті відносно бакета. Якщо збій
залишив застаріле блокування на репозиторії, `kept admin backup unlock` видаляє його; він відмовляється, поки
резервне копіювання виконується.
