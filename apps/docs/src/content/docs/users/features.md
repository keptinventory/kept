---
title: All features
description: "Everything Kept does, in one list: inventory, the map, labels and scanning, lending, moving house, reminders, vehicles, the phone app, AI, integrations and backups. Each links to its page."
---

Everything Kept does, each with the page that explains it. Some features belong to a **module**:
a location turns them on in **Location settings → What to track**
([modules and presets](/users/modules/)). The module is named after the feature where it applies.

## Inventory

- **[Locations, rooms and boxes](/users/locations/)**: homes, garages, storage units; places
  inside places. Move a box and what's in it moves too.
- **[Things](/users/things/)**: types, custom fields, quantities, condition, an archive, and a
  trash you restore from.
- **[Photos, receipts, manuals and warranties](/users/photos-paperwork/)**: on each thing, with a
  paperwork library. Module: Receipts and warranties, Paperwork.
- **[Room photos](/users/room-photos/)**: photograph a room, a cupboard or a shelf; Kept lists
  what's in it as drafts for you to confirm. Needs an AI provider.
- **[The spreadsheet view](/users/spreadsheet/)**: many things at once, edited in a table.
- **[Search](/users/search/)**: part of a name, a serial, a receipt's text; where each match is.
- **[Tags](/users/tags/)**: across places and types.

## Finding things

- **[The location map](/users/location-map/)**: each location in 3D, with floors, rooms,
  furniture and what's inside. Starts from a floor plan if you have one.
- **[The graph](/users/graph/)**: a location's places, boxes and things in 2D or 3D.
- **[Short IDs and labels](/users/short-ids/)**: a short ID and a QR code on every box; scan one to
  open it. Label-maker rolls or office sheets. Module: Labels and QR codes.
- **[Scan sessions](/users/scanning-sessions/)**: count a shelf, pack a box, move a pile, one scan
  after another.
- **[Counts and stocktakes](/users/counts/)**: count a place, see what's missing, compare with the
  last count.

## The household

- **[Lending and borrowing](/users/lending/)**: who has what and when it's due back, with
  reminders and a polite message to copy. Borrowers need no account. Module: Lending.
- **[Kits and hand-overs](/users/kits/)**: lend a box with everything in it; each thing comes back
  on its own record. A kit remembers what belongs in it.
- **[Moving house](/users/moving/)**: numbered boxes, a label and a contents sheet for each,
  tracked in the van, unpacked by scanning. Works offline. Module: Moving house.
- **[Reminders and notifications](/users/reminders/)**: warranties, services, documents, loans and
  low stock, in the app, by mail, push, ntfy, Telegram and a calendar feed. Module: Reminders.
- **Things you run out of**: a minimum per thing; told when it runs low. Module: Things you run out
  of.
- **[Vehicles and machines](/users/vehicles/)**: readings, services, fuel and running costs.
  Module: Vehicles, Fuel.
- **Passwords and codes**: secret fields, hidden until someone allowed reveals one, and logged.
  Module: Passwords and codes.
- **[Condition reports](/users/condition-reports/)**: move-in and move-out, room by room, with
  photos.
- **[Reports, insurance and claims](/users/reports/)**: the inventory as a PDF, an insurance
  report, a claim pack.
- **[Insights](/users/insights/)**: spending by year and value by place, each currency on its own.
  Module: Money and spending.

## People

- **[Sharing a location](/users/sharing/)**: invite people with a role (admin, member, viewer)
  and an optional end date; managed accounts for people without email; read-only share links for
  someone without an account.
- **[Sign-in and security](/users/sign-in-security/)**: passkeys and two-factor sign-in.
- **Five languages**: English, Arabic (right to left), French, German and Italian.

## On your phone

- **[Kept on your phone](/users/phone-app/)**: installs from the browser; capture, scan and search
  with no signal, synced later.

## AI, optional

- **[AI providers](/users/ai-providers/)**: your own provider or none: OpenAI, Anthropic, Google,
  OpenRouter, Groq, or a local server such as [Ollama](/admin/ollama/). Capture drafts a thing
  from a photo; you confirm it.
- **The assistant**: ask in plain words; changes wait for your OK.
- **[Claude and other AI apps](/users/mcp-clients/)**: an MCP server at `/mcp`. Module: Connect
  ChatGPT or Claude.

## Works with

- **[Home Assistant](/users/home-assistant/)**: Kept as a Home Assistant app, and an integration
  for dashboards, automations and the calendar.
- **[Paperless-ngx](/users/paperless/)**: link documents instead of copying them.
- **[Dashboards](/users/dashboards/)** and **[webhooks](/users/webhooks/)**: a summary for your
  own dashboards; events posted to your own services.
- **[Import and export](/users/import-export/)**: from Homebox, a spreadsheet (CSV) or another
  Kept; a vehicle's history from LubeLogger; full exports.

## Running it

- **[Backups](/admin/backups/)**: nightly, encrypted, to a directory, S3 or SFTP, each with a copy
  that [opens without Kept](/admin/read-with-restic/).
- **[What it needs](/install/hardware/)**: one container and Postgres; tested on 1 GB of RAM and
  one CPU core.
- **[Security model](/admin/security-model/)**: no telemetry; nothing leaves the server unless you
  turn it on.
