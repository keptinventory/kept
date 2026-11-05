# Changelog

The app's version is Kept's. Newest first; Kept's full notes:
<https://github.com/keptinventory/kept/blob/main/CHANGELOG.md>.

## 1.14.5

- Caddy or Ollama: one step before you upgrade. `compose.yaml` now runs Kept alone. If you use either, download `compose.full.yaml` and set `COMPOSE_FILE=compose.full.yaml` in `.env`, or the next download of `compose.yaml` leaves Kept on plain http. Behind your own proxy, `KEPT_TRUSTED_PROXIES` in `.env` now takes effect. New settings need the new `compose.yaml`: bumping only `KEPT_IMAGE` keeps the old file (#414).
- One Kept on more than one address, and longer sign-ins over http. `KEPT_EXTRA_ADDRESSES` adds a tailnet or LAN address beside your main one, and `KEPT_HTTP_SIGN_IN_DAYS` keeps you signed in longer over plain http. Admin, Status shows both (#405, #404).
- Connectors stay signed in. MCP connectors now use refresh tokens. Each existing one sees the consent page once, then stays connected (#411).
- Ukrainian, Hide Personal, and a place tree you can size. Kept now comes in Ukrainian. Personal can leave your menu, Home, lists and search. Drag the place tree's edge to change its width, or collapse it (#444, #392, #427).

## 1.14.4

- Edit a purchase from its thing. Date, shop, price, total, tax, notes and receipts by name, on the thing's page (#348).
- Furniture you can turn, merge and split. A cube shelf on its side, renumbered or keeping its codes; merged and split compartments keep their labels, and show on the map (#238).
- Rooms at their real size. Width and length to the centimetre when you add a room or arrange the map, from 50 cm (#372).
- Vietnamese, and your date format. Kept in a sixth language; dates in your region's style, ISO included (#391, #362).

## 1.14.3

- The first version of the app, experimental: Kept and its own database, Home Assistant backups,
  Kept inside Home Assistant (ingress) with Kept's own address on port 8080.
