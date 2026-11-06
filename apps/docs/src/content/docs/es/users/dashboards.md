---
title: "Paneles"
description: "Los conteos de Kept en un panel. Copia y pega widgets para Homepage, Glance y Homarr que lean qué está vencido, vence pronto y expira del resumen de Kept."
---

Un panel puede mostrar lo que necesitas en Kept: vencido, vence pronto, expira, prestado, incierto y stock bajo, en total y por ubicación. Cada widget de abajo lee una llamada, `GET /api/v1/summary`, con un [token personal](/es/users/mcp-clients/#crea-un-token-personal) (**Solo lectura**, las ubicaciones que quieres que cuente). [Home Assistant](/es/users/home-assistant/) lee la misma llamada.

## El resumen

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

- Cada conteo es el que está en el Inicio de Kept, para las ubicaciones que alcanza el token.
- `null` en una ubicación: ese módulo está apagado allí (Préstamos para `lentOut` y `borrowedIn`, Consumibles para `lowStock`). `totals` suma las ubicaciones donde aplica, así que siempre son números.
- Sin nombres de objetos, sin dinero.

Guarda el token en los secretos del panel, no en un archivo que compartas. Cada ejemplo usa `https://kept.example.org`: pon la dirección de tu Kept.

## Homepage

Un widget de [API personalizada](https://gethomepage.dev/widgets/services/customapi/), en `services.yaml`. El token viene de una variable de entorno, `HOMEPAGE_VAR_KEPT_TOKEN` ([secretos de entorno](https://gethomepage.dev/installation/docker/#using-environment-secrets)). Probado contra la documentación de Homepage 2.5.0.

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

Por ubicación en su lugar, una fila cada una:

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

Un widget [`custom-api`](https://github.com/glanceapp/glance/blob/main/docs/configuration.md#custom-api), en `glance.yml`. `${KEPT_TOKEN}` se lee del entorno de Glance. Probado contra la documentación de Glance 0.8.6.

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

Añade `allow-insecure: true` para un certificado autofirmado.

## Homarr

Un widget personalizado (Homarr 2.x). Guarda la definición de abajo como `kept.homarr-widget.json`, luego en Homarr: **Custom widgets → Importar**. En **Configure API sources**, pon la dirección de tu Kept en lugar de la sugerida, marca la confirmación y pega el token en **API key or token**. Luego añádelo a un tablero: **Choose item to add → Custom widget**. Homarr llama a Kept desde su servidor y mantiene el token fuera del navegador.

Probado contra el esquema de importación de Homarr 2.5.2, aún no pasado por su previsualización: usa **Test and preview** antes de confiar en él.

- `networkScope: private` permite a Homarr alcanzar Kept en tu LAN. Homarr rechaza las direcciones `100.x` de Tailscale bajo cualquier ajuste, y no sigue redirecciones: usa la dirección LAN de Kept, la final.
- Un certificado autofirmado probablemente será rechazado; usa uno de confianza o `http://` en tu LAN.

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
