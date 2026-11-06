---
title: Dashboards
description: Kepts Zähler auf einem Dashboard. Copy-Paste-Widgets für Homepage, Glance und Homarr, die aus Kepts Summary lesen, was überfällig, fällig und bald abläuft.
---

Ein Dashboard kann dir zeigen, worum du dich in Kept kümmern musst: überfällig, fällig, bald ablaufend, ausgeliehen, unsicher und niedriger Bestand, insgesamt und pro Standort. Jedes Widget unten liest einen Aufruf,
`GET /api/v1/summary`, mit einem [persönlichen Token](/de/users/mcp-clients/#persönliches-token-erstellen)
(**Nur lesen**, die Standorte, die du gezählt haben willst). [Home Assistant](/de/users/home-assistant/) liest
denselben Aufruf.

## Die Zusammenfassung

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

- Jede Zahl ist die von Kepts Startseite, für die Standorte, die der Token erreicht.
- `null` an einem Standort: Das Modul ist dort aus (Ausleihe bei `lentOut` und `borrowedIn`,
  Verbrauchsgüter bei `lowStock`). `totals` addiert die Standorte, wo es gilt, also sind sie
  immer Zahlen.
- Keine Namen von Dingen, kein Geld.

Bewahre den Token in den Secrets des Dashboards, nicht in einer Datei, die du teilst. Jedes Beispiel nutzt
`https://kept.example.org`: trage die Adresse deines Kept ein.

## Homepage

Ein [Custom API](https://gethomepage.dev/widgets/services/customapi/)-Widget, in
`services.yaml`. Der Token kommt aus einer Umgebungsvariablen, `HOMEPAGE_VAR_KEPT_TOKEN`
([Umgebungs-Secrets](https://gethomepage.dev/installation/docker/#using-environment-secrets)).
Geprüft anhand der Docs von Homepage 2.5.0.

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

Stattdessen pro Standort, jeweils eine Zeile:

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

Ein [`custom-api`](https://github.com/glanceapp/glance/blob/main/docs/configuration.md#custom-api)-Widget, in `glance.yml`. `${KEPT_TOKEN}` wird aus Glances Umgebung gelesen. Geprüft anhand der Docs von Glance 0.8.6.

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

Füge `allow-insecure: true` für ein selbstsigniertes Zertifikat hinzu.

## Homarr

Ein Custom-Widget (Homarr 2.x). Speichere die untenstehende Definition als `kept.homarr-widget.json`, dann in
Homarr: **Custom widgets → Import**. In **Configure API sources**, setze die Adresse deines Kept anstelle
der vorgeschlagenen ein, setze den Haken bei der Bestätigung, und füge den Token in **API key or token** ein. Dann
füge es einem Board hinzu: **Choose item to add → Custom widget**. Homarr ruft Kept von seinem Server aus auf und
hält den Token aus dem Browser heraus.

Geprüft anhand des Import-Schemas von Homarr 2.5.2, noch nicht durch die Vorschau laufen gelassen: nutze **Test and
preview**, bevor du dich darauf verlässt.

- `networkScope: private` lässt Homarr Kept in deinem LAN erreichen. Homarr lehnt Tailscales
  `100.x`-Adressen unter jeder Einstellung ab und folgt keinen Weiterleitungen: nutze die LAN-Adresse deines Kept,
  die endgültige.
- Ein selbstsigniertes Zertifikat wird wahrscheinlich abgelehnt; nutze ein vertrauenswürdiges oder `http://` in
  deinem LAN.

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
