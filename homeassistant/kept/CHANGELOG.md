# Changelog

The app's version is Kept's. Newest first; Kept's full notes:
<https://github.com/keptinventory/kept/blob/main/CHANGELOG.md>.

## 1.14.7

- Home Assistant in one click. Home Assistant finds Kept and asks; someone in Kept allows it with a code. No token to copy (#376).
- Racks in rack units. 19-inch and 10-inch racks, seen from the front or the rear, with gear placed at its unit (#373).
- Metric or imperial. Choose once in Settings: map and furniture sizes, label sizes and fuel use follow it. Odometers count in km or mi, and Change unit relabels or converts the readings, with Undo (#385).
- PDFs in your language. Reports, condition, vehicle and contents sheets, the readable copy and insurance claim packs, in each reader's language (#465). Claim pack wording reads differently from insurer to insurer: corrections are welcome in an issue.

## 1.14.6

- Kept in Spanish. The app, emails, reminders and the docs (#460).
- Docs in every language. User, admin and install pages in Arabic, English, French, German, Italian, Spanish, Ukrainian and Vietnamese (#461).
- Type to find your language. In the app's picker and on the docs site (#450). Emails and reminders now follow the language you pick.
- Emails and the assistant in Ukrainian and Vietnamese too. Reminders, push, built-in names, Try the map, shape search and the Home Assistant app's options follow. PDFs stay in English and Arabic for now.

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
