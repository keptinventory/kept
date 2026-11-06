---
title: Dashboard
description: "I conteggi di Kept su una dashboard. Widget copia-incolla per Homepage, Glance e Homarr che leggono cosa è scaduto, in scadenza e in prestito dal riepilogo di Kept."
---

Una dashboard può mostrare di cosa hai bisogno in Kept: scaduti, in scadenza, in prestito, incerti e scorte basse, in totale e per luogo. Ogni widget sotto fa una sola chiamata,
`GET /api/v1/summary`, con un [token personale](/it/users/mcp-clients/#crea-un-token-personale)
(**Sola lettura**, i luoghi che vuoi contare). [Home Assistant](/it/users/home-assistant/) legge
la stessa chiamata.

## Il riepilogo

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

- Ogni conteggio è quello sulla Home di Kept, per i luoghi che il token raggiunge.
- `null` in un luogo: quel modulo è spento lì (Prestiti per `lentOut` e `borrowedIn`,
  Consumabili per `lowStock`). `totals` somma i luoghi dove si applica, quindi sono
  sempre numeri.
- Niente nomi di oggetti, niente soldi.

Tieni il token nei segreti della dashboard, non in un file che condividi. Ogni esempio usa
`https://kept.example.org`: metti l'indirizzo del tuo Kept.

## Homepage

Un widget [Custom API](https://gethomepage.dev/widgets/services/customapi/), in
`services.yaml`. Il token viene da una variabile d'ambiente, `HOMEPAGE_VAR_KEPT_TOKEN`
([segreti d'ambiente](https://gethomepage.dev/installation/docker/#using-environment-secrets)).
Verificato contro la documentazione di Homepage 2.5.0.

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

Per luogo invece, una riga ciascuno:

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

Un widget [`custom-api`](https://github.com/glanceapp/glance/blob/main/docs/configuration.md#custom-api),
in `glance.yml`. `${KEPT_TOKEN}` viene letto dall'ambiente di Glance. Verificato contro
la documentazione di Glance 0.8.6.

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

Aggiungi `allow-insecure: true` per un certificato auto-firmato.

## Homarr

Un widget personalizzato (Homarr 2.x). Salva la definizione sotto come `kept.homarr-widget.json`, poi in
Homarr: **Custom widgets → Importa**. In **Configure API sources**, metti l'indirizzo del tuo Kept al posto
di quello suggerito, spunta la conferma e incolla il token in **API key or token**. Poi
aggiungilo a una board: **Choose item to add → Custom widget**. Homarr chiama Kept dal suo server e
tiene il token fuori dal browser.

Verificato contro lo schema d'importazione di Homarr 2.5.2, non ancora provato nell'anteprima: usa **Test and
preview** prima di farci affidamento.

- `networkScope: private` permette a Homarr di raggiungere Kept sulla tua LAN. Homarr rifiuta gli indirizzi
  `100.x` di Tailscale sotto ogni impostazione, e non segue i redirect: usa l'indirizzo LAN di Kept,
  quello finale.
- Un certificato auto-firmato è probabilmente rifiutato; usane uno affidabile o `http://` sulla tua LAN.

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
