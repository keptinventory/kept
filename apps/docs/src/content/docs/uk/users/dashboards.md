---
title: Інформаційні панелі
description: Підрахунки Kept на інформаційній панелі. Віджети для копіювання та вставки в Homepage, Glance і Homarr, що читають прострочене, термінове та те, що спливає, з підсумку Kept.
---

Інформаційна панель може показати, що вам потрібно в Kept: прострочене, термінове, що спливає, позичене, невизначене та низький
запас, загалом і за локацією. Кожен віджет нижче робить один виклик,
`GET /api/v1/summary`, з [персональним токеном](/uk/users/mcp-clients/#створити-особистий-токен)
(**Лише читання**, локації, які хочете врахувати). [Home Assistant](/uk/users/home-assistant/) читає
той самий виклик.

## Підсумок

```json
{
  "asOf": "2026-10-15T11:30:00.000Z",
  "totals": { "things": 61, "unplaced": 4, "overdue": 2, "due": 3, "expiring": 2,
              "lentOut": 2, "borrowedIn": 0, "uncertain": 2, "longUnseen": 0, "lowStock": 0 },
  "locations": [
    { "id": "…", "name": "Home", "kind": "home", "timeZone": "Africa/Cairo",
      "counts": { "things": 34, "unplaced": 1, "overdue": 2, "due": 1, "expiring": 1,
                  "lentOut": 1, "borrowedIn": 0, "uncertain": 1, "longUnseen": 0,
                  "lowStock": null } }
  ]
}
```

- Кожен підрахунок — той, що на Головній Kept, для локацій, до яких дотягується токен.
- `null` у локації: там модуль вимкнено (Позичання для `lentOut` і `borrowedIn`,
  Витратні матеріали для `lowStock`). `totals` підсумовує локації, де це застосовується, тому вони є
  завжди числами.
- Без назв речей, без грошей.

Тримайте токен у секретах інформаційної панелі, а не у файлі, яким ділитеся. Кожен приклад використовує
`https://kept.example.org`: вставте адресу вашого Kept.

## Homepage

Віджет [Custom API](https://gethomepage.dev/widgets/services/customapi/), у
`services.yaml`. Токен береться зі змінної середовища, `HOMEPAGE_VAR_KEPT_TOKEN`
([секрети середовища](https://gethomepage.dev/installation/docker/#using-environment-secrets)).
Перевірено за документацією Homepage 2.5.0.

```yaml
- Home:
    - Kept:
        href: https://kept.example.org
        description: What needs you
        widget:
          type: customapi
          url: https://kept.example.org/api/v1/summary
          refreshInterval: 300000 # 5 minutes
          headers:
            Authorization: Bearer {{HOMEPAGE_VAR_KEPT_TOKEN}}
          mappings:
            - field: totals.overdue
              label: Overdue
              format: number
            - field: totals.due
              label: Due
              format: number
            - field: totals.expiring
              label: Expiring
              format: number
            - field: totals.lowStock
              label: Low stock
              format: number
```

За локацією натомість, по одному рядку на кожну:

```yaml
        widget:
          type: customapi
          url: https://kept.example.org/api/v1/summary
          refreshInterval: 300000
          headers:
            Authorization: Bearer {{HOMEPAGE_VAR_KEPT_TOKEN}}
          display: dynamic-list
          mappings:
            items: locations
            name: name
            label: counts.overdue
```

## Glance

Віджет [`custom-api`](https://github.com/glanceapp/glance/blob/main/docs/configuration.md#custom-api)
у `glance.yml`. `${KEPT_TOKEN}` читається зі середовища Glance. Перевірено за
документацією Glance 0.8.6.

Додайте `allow-insecure: true` для самопідписаного сертифіката.

```yaml
- type: custom-api
  title: Kept
  cache: 5m
  url: https://kept.example.org/api/v1/summary
  headers:
    Authorization: Bearer ${KEPT_TOKEN}
    Accept: application/json
  template: |
    <div class="flex justify-between text-center">
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.overdue" }}</div>
        <div class="size-h6">OVERDUE</div>
      </div>
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.due" }}</div>
        <div class="size-h6">DUE</div>
      </div>
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.expiring" }}</div>
        <div class="size-h6">EXPIRING</div>
      </div>
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.lowStock" }}</div>
        <div class="size-h6">LOW STOCK</div>
      </div>
    </div>
    <ul class="list list-gap-10" style="margin-top: 1rem">
    {{ range .JSON.Array "locations" }}
      <li>{{ .String "name" }}: {{ .Int "counts.overdue" }} overdue, {{ .Int "counts.due" }} due</li>
    {{ end }}
    </ul>
```

## Homarr

Користувацький віджет (Homarr 2.x). Збережіть визначення нижче як `kept.homarr-widget.json`, тоді в
Homarr: **Власні віджети → Імпорт**. У **Налаштувати джерела API** вставте адресу вашого Kept замість
запропонованої, позначте підтвердження та вставте токен у **Ключ API або токен**. Потім
додайте його на дошку: **Обрати елемент для додавання → Власний віджет**. Homarr викликає Kept зі свого сервера та
тримає токен поза браузером.

Перевірено за схемою імпорту Homarr 2.5.2, ще не проганялося через його попередній перегляд: використайте **Тестувати та
попередній перегляд** перед тим, як покладатися на нього.

- `networkScope: private` дозволяє Homarr дотягуватися до Kept у вашій локальній мережі. Homarr відмовляється від
  адрес `100.x` за будь-яких налаштувань і не переходить за перенаправленнями: використовуйте LAN-адресу Kept,
  остаточну.
- Самопідписаний сертифікат, скоріше за все, буде відхилено; використовуйте довірений або `http://` у вашій локальній мережі.

```json
{
  "$schema": "homarr-custom-widget-v2",
  "name": "Kept",
  "description": "Overdue, due, expiring, lent out, uncertain and low stock from Kept.",
  "sources": {
    "default": {
      "name": "Kept",
      "baseUrl": "https://your-kept.example.com",
      "networkScope": "private",
      "auth": "bearer"
    }
  },
  "requests": {
    "summary": {
      "path": "/api/v1/summary",
      "cacheSeconds": 60
    }
  },
  "options": {
    "showLocations": {
      "label": "Show each location",
      "control": "switch",
      "default": true
    }
  },
  "template": "<Stack gap=\"sm\" p=\"sm\" h=\"100%\" style={{ minWidth: 0, minHeight: 0 }}>\n  <Group justify=\"space-between\" wrap=\"nowrap\"><Text size=\"xs\" c=\"dimmed\" tt=\"uppercase\" fw={700}>Kept</Text><RefreshButton requestId=\"summary\" label=\"Refresh\" size=\"xs\" /></Group>\n  {status.summary?.loading && <Skeleton height={120} radius=\"md\" />}\n  {status.summary?.ok === false && <Alert color=\"red\" title=\"Kept unavailable\">{status.summary.error || \"Check the address and token under Configure sources.\"}</Alert>}\n  {!status.summary?.loading && status.summary?.ok !== false && <ScrollArea style={{ flex: 1, minHeight: 0 }}><Stack gap=\"sm\">\n    <SimpleGrid type=\"container\" cols={{ base: 2, \"300px\": 3 }} spacing=\"xs\">{[{ label: \"Overdue\", value: data.summary?.totals?.overdue }, { label: \"Due\", value: data.summary?.totals?.due }, { label: \"Expiring\", value: data.summary?.totals?.expiring }, { label: \"Lent out\", value: data.summary?.totals?.lentOut }, { label: \"Uncertain\", value: data.summary?.totals?.uncertain }, { label: \"Low stock\", value: data.summary?.totals?.lowStock }].map(item => <Paper key={item.label} withBorder radius=\"md\" p=\"sm\"><Text size=\"xs\" c=\"dimmed\">{item.label}</Text><Text fw={700} size=\"xl\">{item.value ?? \"-\"}</Text></Paper>)}</SimpleGrid>\n    {options.showLocations && <Stack gap={0}>{(data.summary?.locations ?? []).map(location => <Group key={location.id} justify=\"space-between\" wrap=\"wrap\" gap=\"xs\" py=\"xs\"><Text size=\"sm\" fw={600}>{location.name}</Text><Text size=\"xs\" c=\"dimmed\">{\"Overdue \" + location.counts.overdue + \" \u00b7 Due \" + location.counts.due}</Text></Group>)}</Stack>}\n  </Stack></ScrollArea>}\n</Stack>"
}
```
