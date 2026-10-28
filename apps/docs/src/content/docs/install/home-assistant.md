---
title: Install as a Home Assistant app
description: Install Kept from Home Assistant's app store, with its own database, backed up with Home Assistant's backups and opened from the sidebar.
sidebar:
  order: 2
  label: Home Assistant
---

:::caution[Not available yet]
The Home Assistant app is being tested and isn't in the repository's app list yet. Until it is,
install Kept [with Docker Compose](/install/compose/) and connect it with the
[Kept integration](/users/home-assistant/).
:::

Kept runs as a Home Assistant app: Kept and its own database in one app, on Home Assistant OS. No
Docker Compose, no passwords to make, and Home Assistant's backups include it.

## Install

[![Open your Home Assistant instance and show the add app repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fkeptinventory%2Fkept)

1. **Settings → Apps → Install app → ⋮ → Repositories**, add
   `https://github.com/keptinventory/kept` (or use the button above).
2. Find **Kept**, then **Install**, then **Start**.
3. **Open Web UI**. Kept opens inside Home Assistant, in the sidebar too.

| You need | |
|---|---|
| Home Assistant OS | Apps need the Supervisor: not Home Assistant Container or Core |
| `aarch64` or `amd64` | A Raspberry Pi 4 or 5 on 64-bit, a mini PC, a VM |
| 4 GB of memory | 2 GB works with few other apps; Kept with its database uses about 250–320 MB idle |

## First start

- A Home Assistant **administrator** who opens Kept from Home Assistant sets it up without a code.
- Anyone else types the setup code from the app's **Log** tab (`KEPT SETUP CODE: XXX-XXX`).
- Kept has its own accounts. People sign in to Kept once, also inside Home Assistant; household
  members don't need to be Home Assistant administrators to use it from the sidebar.

## Kept's address

Inside Home Assistant, Kept opens from the sidebar. Phones, printed QR labels, mail links, the
integration and AI apps need an address that works outside a Home Assistant session, so the app
also serves Kept on **port 8080**. The **Log** tab names it, for example
`Kept is at http://homeassistant.local:8080`.

| Option | What |
|---|---|
| Kept's address | Set it when `homeassistant.local` doesn't resolve on your network, or the port changed. `http(s)://host[:port]`, no path. |
| https on Kept's port | Serves the port over https with Home Assistant's certificate from `/ssl` (from the DuckDNS or Let's Encrypt apps). Restart the app after the certificate renews. |
| Outgoing mail | An `smtps://` URL: sign-in links, invites and reminders by mail. |

Turning port 8080 off (Configuration → Network) leaves only the sidebar: labels and the phone app
then don't open.

## What needs https

| | Plain http | https |
|---|---|---|
| Things, places, search, labels, photos from a file | yes | yes |
| Personal tokens (the integration), showing secrets, exports | no | yes |
| Passkeys, the camera, installing the phone app, push | no | yes |

Inside Home Assistant, Kept counts as https only when Home Assistant itself is served over https.
Passkeys belong to Kept's own address: sign in with one there. More on
[the home network](/install/home-network/).

## Backups and updates

- **Backups:** Home Assistant's backups include Kept: the database (dumped at backup time), photos,
  files and Kept's keys. Keep Home Assistant's backup encryption on. Restoring the backup brings
  Kept back; the first start after a restore takes a little longer.
- **Kept's own backups** (Admin → Backups) aren't available in the app: they need the database
  owner's login, which the app keeps from the running server.
- **Updates:** the app's version is Kept's. An update keeps Kept's data and upgrades its database
  on start.

## The integration

[The Kept integration](/users/home-assistant/) brings what's due into Home Assistant. Give it
Kept's address and a personal token made over https. Setting it up without a token, straight from
the app, comes in a later release.
