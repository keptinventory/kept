---
title: وضع Kept على HTTPS
description: لماذا يريد Kept HTTPS، وكيف تحصل عليه - Caddy من compose.full.yaml، وTailscale، وNetBird، وTwingate، وCloudflare Tunnel، أو وكيل خاص بك.
sidebar:
  order: 2
---

يعمل Kept عبر HTTP العادي، لكن الهاتف يعتبر عنوان HTTP العادي غير آمن، وتتوقف عدة أمور عن العمل:

- **الكاميرا** (يعود Kept إلى أداة اختيار الملفات),
- **تثبيت Kept** على الشاشة الرئيسية، والعمل دون إنترنت منها,
- **إشعارات الدفع**,
- **الموقع**.

`localhost` تُعتبر آمنة؛ وعنوان شبكة محلية عبر HTTP ليس آمنًا. مع `KEPT_PUBLIC_URL` الذي يبدأ بـ `https:`، يضع Kept علامة `Secure` على ملفات تعريف الارتباط الخاصة به ويرسل HSTS؛ و`KEPT_HSTS=off` يزيلها عندما تشارك خدمات HTTP العادية اسم المضيف نفسه ([HSTS](/ar/install/reverse-proxy/#hsts)).

ترفض Kept بعض الأمور بشكل قاطع بينما `KEPT_PUBLIC_URL` هو `http:`، حتى على `localhost`، لأنها تسلّم سرًا أو تغيره: إظهار قيمة سرية، وتصدير يحتوي على قيم سرية، وفتح أسرار التصدير عند استيراده، وإنشاء رمز وصول في المتصفح، وربط تطبيق عبر OAuth، وتنزيل مجموعة الاستعادة، وتغيير إعدادات النسخ الاحتياطي أو اختبارها. يعمل التصدير بدون قيم سرية، وكذلك الاستيراد بدونها. الجلسات أقصر أيضًا عبر HTTP. بينما يُقدَّم Kept عبر HTTP، تضع قائمة مراجعة البدء على الرئيسية "وضع Kept على HTTPS" أولاً، حتى يختار مسؤول "البقاء على شبكة منزلي". كل ما يعمل عبر HTTP العادي، في جدول واحد: [Kept على شبكة منزلية](/ar/install/home-network/).

أياً كانت الطريقة التي تختارها، اضبط `KEPT_PUBLIC_URL` على عنوان `https://` الذي سيفتحه الناس، وأعد تشغيل Kept.

## ملف تعريف Caddy في Compose

لنطاق يشير إلى هذه الآلة، مع منفذي ٨٠ و ٤٤٣ يمكن الوصول إليهما من الإنترنت (يثبت Caddy النطاق لـ Let's Encrypt أو ZeroSSL عبرهما). يأتي Caddy مع `compose.full.yaml`، وليس `compose.yaml` ([Caddy و Ollama](/ar/install/compose/#caddy-وollama)):

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

يقرأ Caddy ملف `docker/caddy/Caddyfile` بجوار ملف Compose. تحتوي نسخة مستخرجة من المستودع على الملفين؛ والتثبيت بدون أحدهما يحملهما مرة واحدة:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.6/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.6/docker/caddy/Caddyfile
docker compose --profile https up -d
```

بدون الملف، يتوقف `docker compose --profile https up -d` مع "bind source path does not exist". أي وكيل آخر يعمل بدلاً منه؛ فهو يحول إلى منفذ Kept، كما في الأقسام أدناه.

يحصل Caddy على الشهادة ويجدّدها ويحيل كل شيء إلى Kept. يمنح Compose Caddy عنوانًا ثابتًا على شبكته الخاصة ويمرر هذا العنوان إلى Kept كـ `KEPT_TRUSTED_PROXIES`, حتى يثق Kept في `X-Forwarded-For` الخاصة بـ Caddy وليس في أي شيء آخر. يمكنك بعد ذلك ربط HTTP العادي بالحلقة الداخلية فقط، باستخدام `KEPT_HTTP_PORT=127.0.0.1:8080`.

إذا تعارضت `172.29.72.0/24` مع شبكتك المحلية، غيّر الشبكة الفرعية للشبكة، و `ip_range` الخاصة بها، و `ipv4_address` الخاصة بـ Caddy و `KEPT_TRUSTED_PROXIES` معًا في `compose.full.yaml`.

## Tailscale

إذا كان Kept لا يصل إليه إلا أجهزتك فقط، ومن دون فتح أي منفذ على الإنترنت: على الآلة التي يعمل عليها Kept، مع تمكين شهادات HTTPS لشبكة tailnet الخاصة بك،

```sh
tailscale serve --bg 8080
```

يخدم Kept على `https://<machine>.<tailnet>.ts.net` بشهادة حقيقية، لأي جهاز على شبكة tailnet. اضبط `KEPT_PUBLIC_URL` على ذلك العنوان.

يعمل وكيل Tailscale على نفس الآلة ويتصل بـ Kept من `127.0.0.1`؛ يرى Kept كل طلب على أنه يأتي من هناك ما لم تثق به. في مثيل لعائلة واحدة، يهم ذلك فقط لـ [قفل الإعداد](/ar/install/reverse-proxy/#قفل-الإعداد).

## NetBird

يمنح وكيل NetBird العكسي منفذًا لزميل عنوانًا عامًا `https://` بشهادة:

```sh
netbird expose 8080
```

يطبع العنوان. اضبط `KEPT_PUBLIC_URL` عليه (أو على نطاقك الخاص، باستخدام `--with-custom-domain kept.example.org`، الذي تضبطه في NetBird أولاً). العنوان عام ما لم تختر **وصول NetBird فقط** للخدمة في لوحة المعلومات، مما يقصره على أقرانك. يقوم مسؤول الحساب بتشغيل **عرض الأقران** ضمن الإعدادات → العملاء أولاً.

## Twingate

يجعل Twingate Kept في متناول أجهزتك دون فتح منفذ، ولكن الشهادة خاصة بك: أعطِ Kept اسم مضيف على نطاق تملكه (`kept.example.org`)، واحصل على شهادة له من خلال تحدٍ DNS (يمكن لـ Caddy أو Traefik أو cert-manager القيام بذلك)، وأضف ذلك الاسم كمورد في Twingate. اضبط `KEPT_PUBLIC_URL` على `https://kept.example.org`.

## Cloudflare Tunnel

لعنوان عام من دون منفذ مفتوح. تخدم Cloudflare اسم المضيف عبر HTTPS وتحول إلى Kept عبر `cloudflared`:

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

مع `~/.cloudflared/config.yml`:

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

اضبط `KEPT_PUBLIC_URL` على `https://kept.example.org`. يمكن لـ Cloudflare Access وضع تسجيل دخول أمامه. العنوان العام هو أيضًا ما يحتاجه تطبيق ويب مثل claude.ai لـ [الاتصال بخادم MCP الخاص بـ Kept](/ar/users/mcp-clients/#اربط-كمُربِّط-oauth).

مثل بقية الأنفاق هنا، يصل `cloudflared` إلى Kept من نفس الآلة؛ ثق به كما في [البروكسيات العكسية](/ar/install/reverse-proxy/#ثق-بالوكيل-والوكيل-فقط).

## الوكيل العكسي الخاص بك

يعمل أي وكيل ينهي TLS ويحول إلى المنفذ ٨٠٨٠. اقرأ [البروكسيات العكسية](/ar/install/reverse-proxy/) للإعدادات الثلاث المهمة.

## شهادة تثق بها أجهزتك فقط

في شبكة محلية من دون نطاق، يمكن لـ mkcert صنع شهادة لعنوان الآلة، تُقدّم عبر أي وكيل TLS. يجب على كل هاتف بعد ذلك الوثوق بجذر شهادة mkcert؛ على iPhone يعني ذلك تثبيتها كملف تعريف وتشغيل الثقة الكاملة في الإعدادات → عام → حول → إعدادات اعتماد الثقة. عادةً ما يكون Tailscale أقل جهدًا.
