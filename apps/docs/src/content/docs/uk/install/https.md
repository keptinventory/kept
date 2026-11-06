---
title: Поставте Kept на HTTPS
description: Чому Kept потребує HTTPS, і як його отримати — Caddy з compose.full.yaml, Tailscale, NetBird, Twingate, Cloudflare Tunnel або власний проксі.
sidebar:
  order: 2
---

Kept працює через звичайний HTTP, але телефон вважає адресу зі звичайним HTTP небезпечною, і кілька функцій перестають працювати:

- **камера** (Kept переходить до вибору файлу),
- **встановлення Kept** на домашній екран і робота з ним офлайн,
- **push-сповіщення**,
- **локація**.

`localhost` вважається безпечним; адреса в локальній мережі через HTTP — ні. З `https:` у `KEPT_PUBLIC_URL` Kept також позначає свої cookie як `Secure` і надсилає HSTS; `KEPT_HSTS=off` вимикає це, якщо HTTP-сервіси спільно використовують назву хоста ([HSTS](/uk/install/reverse-proxy/#hsts)).

Деякі дії Kept категорично відхиляє, поки `KEPT_PUBLIC_URL` має значення `http:`, навіть на `localhost`, бо вони видають або змінюють секрет: показ значення секрету, експорт зі значеннями секретів, відкриття секретів експорту під час його імпорту, створення токена доступу в браузері, підключення застосунку через OAuth, завантаження набору відновлення та зміна чи перевірка налаштувань резервного копіювання. Експорт без значень секретів працює, і імпорт без них — також. Сеанси також коротші через HTTP. Поки Kept працює через HTTP, контрольний список «Початок роботи» на Головній ставить "Поставте Kept на HTTPS" першим, доки адміністратор не вибере "Залишаюся в домашній мережі". Усе, що працює через звичайний HTTP, в одній таблиці: [Kept у домашній мережі](/uk/install/home-network/).

Яким би способом ви не скористалися, встановіть `KEPT_PUBLIC_URL` на адресу `https://`, яку відкриватимуть люди, і перезапустіть Kept.

## Профіль Caddy у Compose

Для доменного імені, що вказує на цю машину, коли порти 80 і 443 доступні з інтернету
(Caddy доводить власність домену для Let's Encrypt або ZeroSSL через них). Caddy постачається разом із
`compose.full.yaml`, а не з `compose.yaml` ([Caddy і Ollama](/uk/install/compose/#caddy-і-ollama)):

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

Caddy читає `docker/caddy/Caddyfile` поруч із файлом Compose. Клон репозиторію має
обидва файли; встановлення без одного з них завантажує їх один раз:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/docker/caddy/Caddyfile
docker compose --profile https up -d
```

Без цього файлу `docker compose --profile https up -d` зупиняється з повідомленням "bind source path does not
exist". Замість нього працює будь-який інший проксі; він переспрямовує на порт Kept, як у розділах нижче.

Caddy отримує й оновлює сертифікат та переспрямовує все до Kept. Compose надає Caddy фіксовану
адресу у власній мережі й передає цю адресу до Kept як `KEPT_TRUSTED_PROXIES`, тож Kept
довіряє заголовку `X-Forwarded-For` від Caddy і нічому іншому. Після цього можна прив'язати звичайний HTTP лише до loopback,
з `KEPT_HTTP_PORT=127.0.0.1:8080`.

Якщо `172.29.72.0/24` конфліктує з вашою локальною мережею, змініть підмережу мережі, її `ip_range`, `ipv4_address` Caddy
та `KEPT_TRUSTED_PROXIES` разом у `compose.full.yaml`.

## Tailscale

Для Kept, до якого можуть дістатися лише ваші власні пристрої, без відкритого порту в інтернет: на машині,
що запускає Kept, з увімкненими HTTPS-сертифікатами для вашого tailnet,

```sh
tailscale serve --bg 8080
```

надає Kept за адресою `https://<machine>.<tailnet>.ts.net` зі справжнім сертифікатом будь-якому пристрою в
tailnet. Встановіть `KEPT_PUBLIC_URL` на цю адресу.

Проксі Tailscale працює на тій самій машині й підключається до Kept з `127.0.0.1`; Kept бачить кожен
запит як такий, що надійшов звідти, якщо ви не довіряєте йому. В екземплярі для одного домогосподарства це має значення лише для
[блокування налаштування](/uk/install/reverse-proxy/#блокування-налаштування).

## NetBird

Зворотний проксі NetBird надає порту піра публічну адресу `https://` із сертифікатом:

```sh
netbird expose 8080
```

Він виводить адресу. Встановіть `KEPT_PUBLIC_URL` на неї (або на власний домен із
`--with-custom-domain kept.example.org`, налаштований у NetBird спершу). Адреса публічна, якщо тільки ви
не виберете **NetBird-Only Access** для сервісу в панелі керування, що обмежує її вашими пірами.
Адміністратор облікового запису вмикає **Peer Expose** у Налаштування → Клієнти спершу.

## Twingate

Twingate робить Kept досяжним для ваших пристроїв без відкриття порту, але сертифікат — ваш: надайте Kept назву хоста в домені, що вам належить (`kept.example.org`), отримайте для неї сертифікат із DNS challenge (це вміють Caddy, Traefik або cert-manager), і додайте цю назву хоста як ресурс Twingate. Встановіть `KEPT_PUBLIC_URL` на `https://kept.example.org`.

## Cloudflare Tunnel

Для публічної адреси без відкритого порту. Cloudflare надає назву хоста через HTTPS і переспрямовує до
Kept через `cloudflared`:

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

з `~/.cloudflared/config.yml`:

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

Встановіть `KEPT_PUBLIC_URL` на `https://kept.example.org`. Cloudflare Access може додати вхід перед
ним. Публічна адреса також потрібна вебзастосунку, наприклад claude.ai, щоб
[підключитися до MCP-сервера Kept](/uk/users/mcp-clients/#підключити-як-конектор-oauth).

`cloudflared`, як і інші тунелі тут, досягає Kept з тієї самої машини; довіряйте йому як у
[зворотних проксі](/uk/install/reverse-proxy/#довіряйте-проксі-і-тільки-проксі).

## Власний зворотний проксі

Будь-який проксі, що завершує TLS і переспрямовує на порт 8080, працює. Читайте
[зворотні проксі](/uk/install/reverse-proxy/) про три налаштування, що мають значення.

## Сертифікат, якому довіряють лише ваші пристрої

У локальній мережі без домену mkcert може створити сертифікат
для адреси машини, що подається через будь-який TLS-проксі. Тоді кожен телефон має довіряти кореневому сертифікату mkcert; на iPhone це означає встановити його як профіль і увімкнути повну довіру в
Налаштування → Загальні → Про пристрій → Налаштування довіри сертифікатів. Зазвичай Tailscale вимагає менше роботи.
