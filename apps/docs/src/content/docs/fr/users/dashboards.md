---
title: Tableaux de bord
description: Les compteurs de Kept sur un tableau de bord. Widgets à copier-coller pour Homepage, Glance et Homarr qui lisent ce qui est en retard, à échéance et bientôt périme depuis le résumé de Kept.
---

Un tableau de bord peut afficher ce dont vous avez besoin dans Kept : en retard, à échéance, bientôt périme, prêtés, incertains et stock faible, au total et par emplacement. Chaque widget ci-dessous lit un appel,
`GET /api/v1/summary`, avec un [jeton personnel](/fr/users/mcp-clients/#créer-un-jeton-personnel)
(**Lecture seule**, les emplacements que vous voulez compter). [Home Assistant](/fr/users/home-assistant/) lit
le même appel.

## Le résumé

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

- Chaque compteur est celui de l'accueil de Kept, pour les emplacements que le jeton atteint.
- `null` dans un emplacement : ce module est désactivé dans cet emplacement (Lending pour `lentOut` et `borrowedIn`,
  Consumables pour `lowStock`). Les `totals` additionnent les emplacements où cela s'applique, donc ce sont
  toujours des nombres.
- Pas de noms d'objets, pas d'argent.

Conservez le jeton dans les secrets du tableau de bord, pas dans un fichier que vous partagez. Chaque exemple utilise
`https://kept.example.org` : indiquez l'adresse de votre Kept.

## Homepage

Un widget [Custom API](https://gethomepage.dev/widgets/services/customapi/), dans
`services.yaml`. Le jeton vient d'une variable d'environnement, `HOMEPAGE_VAR_KEPT_TOKEN`
([secrets d'environnement](https://gethomepage.dev/installation/docker/#using-environment-secrets)).
Vérifié avec la documentation de Homepage 2.5.0.

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

Par emplacement plutôt, une ligne par emplacement :

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
dans `glance.yml`. `${KEPT_TOKEN}` est lu depuis l'environnement de Glance. Vérifié avec
la documentation de Glance 0.8.6.

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

Ajoutez `allow-insecure: true` pour un certificat auto-signé.

## Homarr

Un widget personnalisé (Homarr 2.x). Enregistrez la définition ci-dessous sous `kept.homarr-widget.json`, puis dans
Homarr : **Widgets personnalisés → Importer**. Dans **Configurer les sources API**, mettez l'adresse de votre Kept à la place
de celle suggérée, cochez la confirmation et collez le jeton dans **Clé API ou jeton**. Puis
ajoutez-le à un tableau : **Choisir un élément à ajouter → Widget personnalisé**. Homarr appelle Kept depuis son serveur et
garde le jeton hors du navigateur.

Vérifié avec le schéma d'import de Homarr 2.5.2, pas encore exécuté dans son aperçu : utilisez **Tester et
prévisualiser** avant de vous y fier.

- `networkScope: private` permet à Homarr d'atteindre Kept sur votre réseau local. Homarr refuse les adresses Tailscale en
  `100.x` sous tous les réglages, et ne suit pas les redirections : utilisez l'adresse LAN de votre Kept, la
  définitive.
- Un certificat auto-signé est probablement refusé ; utilisez un certificat de confiance ou `http://` sur votre réseau local.

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
