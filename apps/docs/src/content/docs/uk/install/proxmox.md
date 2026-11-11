---
title: Встановлення на Proxmox VE
description: Одна команда в оболонці хоста Proxmox VE створює непривілейований контейнер Debian 13 з Kept усередині, без Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Ще не перевірено на справжньому хості Proxmox VE]
Скрипти перевіряються при кожній зміні: shellcheck, потім встановлення, оновлення та повернення
назад на чистому Debian 13 із systemd, а скрипт хоста проти замінників інструментів Proxmox. На
справжньому хості Proxmox VE вони ще не запускалися. Написані для Proxmox VE 8 і 9 на amd64; хости
arm64 не перевірені. Вважайте перше встановлення випробуванням.
:::

Kept працює у власному непривілейованому контейнері Debian 13, без Docker, як радить Proxmox:
PostgreSQL, Node і Kept під systemd. Резервні копії Proxmox його охоплюють, і більше нічого на хості
не змінюється.

## Встановлення

В оболонці хоста Proxmox VE, від root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default:** питає лише підтвердження, з налаштуваннями нижче.
- **Advanced:** питає кожне налаштування: ID, назву, CPU, пам’ять, диск, сховище, міст, фіксовану
  адресу зі шлюзом, VLAN, DNS, ключ SSH, пароль root, часовий пояс.
- **Підтвердження** показує кожне налаштування і точну команду `pct create`, перш ніж щось
  створити.

Спершу він перевіряє хост (root, Proxmox VE 8 або 9, міст, сховище з місцем, DNS), завантажує шаблон
Debian 13, якщо його немає, створює контейнер, встановлює в нього Kept і друкує адресу. Якщо щось
не вдається, він каже, що саме, і видаляє незавершений контейнер.

### Прочитати спершу

Завантажте скрипт і `SHA256SUMS` релізу, перевірте, прочитайте, потім запустіть:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` містить SHA-256 файлів `kept.sh`, `kept-install.sh` (те, що працює в контейнері) та
архівів релізу. Він підписаний ключем релізів: `kept.sh` і `kept-install.sh` перевіряють цей підпис
через openssl, перш ніж щось використати з релізу. Щоб перевірити самостійно, завантажте
`SHA256SUMS.sigstore.json` з того самого релізу і дивіться
[перевірка релізу](/uk/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## Що він створює

- **Контейнер:** непривілейований Debian 13, `nesting=1` (systemd у Debian 13 цього потребує),
  запускається разом із хостом, з тегом `kept`.
- **Усередині:** PostgreSQL 18 з pgvector (з репозиторію PostgreSQL), Node 24 (з nodejs.org),
  restic і архів релізу Kept, кожен зафіксований і перевірений.
- **Служби:** `kept-bootstrap` (база даних і її логіни, при кожному запуску) і `kept` (міграції,
  потім Kept на порту 8080 від користувача `kept`).
- **Файли:** Kept у `/opt/kept`, його налаштування в `/etc/kept/kept.env`, ключі в
  `/etc/kept/config`, фото й документи у `/var/lib/kept`, адреса й код налаштування в
  `/root/kept.creds`.

Без телеметрії, без таймерів, без автоматичних оновлень, без змін на хості, крім контейнера.

## Типові значення

| Налаштування | Типово | Задати наперед через |
|---|---|---|
| CPU | 2 ядра | `var_cpu` |
| Пам’ять | 2048 MB, swap 512 MB | `var_ram`, `var_swap` |
| Диск | 8 GB | `var_disk` |
| Сховище | перше, що вміщує контейнери | `var_storage` |
| Мережа | DHCP на `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, назва | наступний вільний ID, `kept` | `var_ctid`, `var_hostname` |
| Часовий пояс | як на хості | `var_timezone` |
| Ключ SSH | немає | `var_ssh_key` (файл публічного ключа на хості) |

Kept перевіряли на 1 GB ([що йому потрібно](/uk/install/hardware/)); 2 GB лишають місце для імпорту
та резервних копій. Фото займають більшу частину диска.

Кожне значення можна задати наперед, а `var_unattended=yes` запускає без запитань:

```sh
var_unattended=yes var_ram=4096 var_ip=192.168.1.50/24 var_gateway=192.168.1.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## Перший запуск

1. Відкрийте надруковану адресу, `http://<address>:8080`. Kept показує
   **Введіть код налаштування**.
2. Код у контейнері: `pct exec <CTID> -- cat /root/kept.creds`. Введіть його, потім
   **Створіть перший обліковий запис**: він стає адміністратором екземпляра.
3. Зберігайте ключі не на цьому сервері: `pct exec <CTID> -- kept admin recovery-kit` друкує набір
   відновлення.

Надруковані етикетки містять адресу. Дайте контейнеру фіксовану (резервування DHCP у роутері або
`var_ip`), перш ніж друкувати. Щоб змінити її пізніше, задайте `KEPT_PUBLIC_URL` у
`/etc/kept/kept.env`, потім `systemctl restart kept`. HTTPS:
[за зворотним проксі](/uk/install/reverse-proxy/).

## Оновлення

У консолі контейнера (`pct enter <CTID>` або **Console** контейнера у вебінтерфейсі):

```sh
update
```

`update` називає поточну й найновішу версії та спершу питає. Він друкує команду резервного
копіювання для хоста, перш ніж ви відповісте. Потім завантажує новий реліз і перевіряє його за
підписаним `SHA256SUMS` релізу, зупиняє Kept, перемикається на новий реліз поруч зі старим і
запускає його (спершу міграції). Якщо Kept не відповідає на `/readyz` новою версією, він
перемикається назад і запускає попередній реліз. `update 1.15.0` встановлює конкретну версію.
Старіші версії потребують `KEPT_ALLOW_DOWNGRADE=1`, для відновлення
([назад на одну версію](/uk/admin/upgrades/)). Нічого не оновлюється саме.

Оновлення самого Debian: `apt update && apt upgrade` у контейнері, як у будь-якому Debian.

## Резервні копії

Усе лежить на диску контейнера, тож резервна копія Proxmox містить Kept повністю: додайте контейнер
до завдання резервного копіювання (**Datacenter → Backup**) у режимі snapshot, або один раз:

```sh
vzdump <CTID> --mode snapshot
```

Режим snapshot потребує сховища зі знімками (LVM-thin, ZFS, Ceph); на іншому використовуйте
`--mode stop`. Відновлюйте через **Restore** у вебінтерфейсі або `pct restore`.

Для другої копії поза машиною увімкніть нічні резервні копії Kept
([резервні копії](/uk/admin/backups/)). Вони працюють від власника бази даних, тож спершу дайте Kept
цей логін, у контейнері:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

Цілі S3 і SFTP працюють як є. Тека як ціль має бути доступна службі для запису: додайте її через
`systemctl edit kept` (`[Service]`, потім `ReadWritePaths=/ваша/тека/копій`), власник користувач
`kept`.

## Видалення

Це видаляє контейнер і все в ньому, разом із даними Kept. Спершу зробіть резервну копію, якщо вони
можуть знадобитися:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## Щось не працює?

- **Встановлення зупинилося:** скрипт назвав крок і видалив контейнер. Запустіть його знову з
  `var_keep_failed=yes`, щоб зберегти контейнер, потім `pct enter <CTID>` і `journalctl -u kept`.
- **Kept не запускається:** `journalctl -u kept-bootstrap -u kept` у контейнері називає проблему,
  наприклад `kept: invalid environment:` для налаштування в `/etc/kept/kept.env`.
- **Консоль чорна:** Debian 13 потребує `nesting=1`, яке встановлює скрипт; контейнер, створений
  вручну без нього, показує це.
