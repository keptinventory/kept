---
title: "لوحات المعلومات"
description: "عدادات Kept على لوحة معلومات. نسخ ولصق عناصر واجهة المستخدم لـ Homepage و Glance و Homarr التي تقرأ ما هو متأخر، مستحق، ومنتهي الصلاحية من ملخص Kept."
---

يمكن للوحة معلومات عرض ما يحتاجه منك Kept: متأخر، مستحق، منتهي الصلاحية، معار، غير مؤكد، ومنخفض المخزون، إجمالاً وحسب الموقع. كل عنصر واجهة أدناه يقرأ استدعاءً واحداً، `GET /api/v1/summary`، مع [رمز شخصي](/ar/users/mcp-clients/#اصنع-رمزًا-شخصيًا) (**قراءة فقط**، المواقع التي تريد حسابها). [Home Assistant](/ar/users/home-assistant/) يقرأ الاستدعاء نفسه.

## الملخص

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

- كل عدد هو الموجود على الرئيسية في Kept، للمواقع التي يصل إليها الرمز.
- `null` في موقع: تلك الوحدة معطلة هناك (الإعارة لـ `lentOut` و `borrowedIn`، المستهلكات لـ `lowStock`). `totals` تجمع المواقع التي تنطبق عليها، لذا فهي أرقام دائماً.
- لا أسماء أشياء، لا أموال.

احفظ الرمز في أسرار لوحة المعلومات، لا في ملف تشاركه. كل مثال يستخدم `https://kept.example.org`: ضع عنوان Kept الخاص بك.

## Homepage

عنصر واجهة [Custom API](https://gethomepage.dev/widgets/services/customapi/)، في `services.yaml`. الرمز يأتي من متغير بيئة، `HOMEPAGE_VAR_KEPT_TOKEN` ([أسرار البيئة](https://gethomepage.dev/installation/docker/#using-environment-secrets)). تم اختباره مقابل توثيق Homepage 2.5.0.

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

حسب الموقع بدلاً من ذلك، صف لكل موقع:

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

عنصر واجهة [`custom-api`](https://github.com/glanceapp/glance/blob/main/docs/configuration.md#custom-api)، في `glance.yml`. `${KEPT_TOKEN}` يُقرأ من بيئة Glance. تم اختباره مقابل توثيق Glance 0.8.6.

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

أضف `allow-insecure: true` لشهادة موقعة ذاتياً.

## Homarr

عنصر واجهة مخصص (Homarr ٢.x). احفظ التعريف أدناه باسم `kept.homarr-widget.json`، ثم في Homarr: **العناصر المخصصة → الاستيراد**. في **تهيئة مصادر API**، ضع عنوان Kept الخاص بك مكان المقترح، حدد التأكيد، والصق الرمز في **مفتاح API أو الرمز**. ثم أضفه للوحة: **اختر عنصراً للإضافة → عنصر واجهة مخصص**. Homarr يستدعي Kept من خادمه ويحفظ الرمز خارج المتصفح.

تم اختباره مقابل مخطط استيراد Homarr 2.5.2، لم يُمرر بعد عبر معاينة: استخدم **اختبار ومعاينة** قبل الاعتماد عليه.

- `networkScope: private` يسمح لـ Homarr بالوصول لـ Kept على شبكة LAN. Homarr يرفض عناوين Tailscale `100.x` تحت كل إعداد، ولا يتبع إعادة التوجيه: استخدم عنوان LAN الخاص بـ Kept، النهائي.
- من المرجح رفض شهادة موقعة ذاتياً؛ استخدم موثوقاً أو `http://` على LAN الخاص بك.

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
