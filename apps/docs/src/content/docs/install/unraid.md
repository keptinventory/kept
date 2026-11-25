---
title: Install on Unraid
description: Install Kept from Unraid's Community Applications as one container, Kept and its own database, with everything in the appdata folder.
sidebar:
  order: 2
  label: Unraid
---

Kept runs on Unraid as one container from **Community Applications** (the **Apps** tab): Kept and
its own PostgreSQL database, everything in `/mnt/user/appdata/kept`. No Compose, no passwords to
make.

## What you need

| | |
|---|---|
| Unraid | With the **Apps** tab (the Community Applications plugin) |
| Memory | About 500 MB free for Kept and its database, 1 GB for imports and backups |
| An address | The one you'll open Kept at, such as `http://tower.local:8080`. Use a name rather than an IP address: printed labels carry it |

## Install

1. **Apps**, search for **Kept**, then **Install**.
2. **Kept's address**: the address you'll open Kept at, with no path. The rest can stay as it is.
   **Show more settings** holds the optional ones: mail, OIDC and Google sign-in, a reverse
   proxy, sign-up.
3. **Apply.** Unraid pulls the image and starts the container.
4. **Docker** tab, Kept's icon, **Logs**: the setup code.

   ```text
   app: Kept is at http://tower.local:8080
   KEPT SETUP CODE: XXX-XXX
   ```

5. Kept's icon, **WebUI**. Kept shows **Enter the setup code**: type the code, then
   **Create the first account**. It becomes the instance admin.
6. **Keep the keys.** Kept's icon, **Console**, then:

   ```sh
   kept admin recovery-kit
   ```

   Copy the text that starts with `KEPT RECOVERY KIT` somewhere other than this server, such as a
   password manager. Without the keys, a backup can't bring back secret values.

The first start makes the database and takes about a minute. Docker reports the container
healthy once Kept answers.

## What's in the appdata folder

| Folder | What |
|---|---|
| `postgres/` | The live database. Owned by the container's `postgres` user |
| `kept/` | Photos and files. Owned by uid 10001, the user Kept runs as |
| `config/` | Kept's keys (`secrets.json`) and the database passwords. Owned by uid 10001 |
| `owner/` | The database owner's password. Root's alone: Kept's own process never reads it |
| `backup/kept.pgdump` | A dump of the database, written each time the container stops |

The container starts as root, gives these folders to their owners, then runs Postgres and Kept as
their own users. The folder itself is left to root: nobody else can list it.

## Backups

- **Back up the appdata folder** with the container stopped, for example with Unraid's Appdata
  Backup plugin. A stop writes `backup/kept.pgdump` first, so the backup holds a consistent copy
  of the database even if the live files are not.
- **Restore:** put the folder back and start Kept. With no `postgres/` folder and a dump in
  `backup/`, Kept restores the database from the dump on its start; the log says
  `database restored from the backup`.
- **Kept's own nightly backups** (Admin → Backups) aren't set up in this container: they need the
  database owner's login, which the running Kept doesn't hold. Back up the appdata folder.

## Updates

The template follows Kept's major version (`kept-unraid:1`). When a release is out, the **Docker**
tab shows an update for Kept: **apply update**. The container stops (writing its dump), the new
image starts, and Kept upgrades its database on start.

## Kept's address

Change it in the template (Kept's icon, **Edit**) and **Apply**. To serve Kept on https, put a
reverse proxy in front of port 8080 and set **Kept's address** to its https address, and
**Trusted reverse proxies** to the proxy's address as Kept sees it
([behind a reverse proxy](/install/reverse-proxy/)). The camera, installing the phone app, push and
passkeys need https ([Kept on a home network](/install/home-network/)).

## Removal

1. **Docker** tab, Kept's icon, **Remove**. The appdata folder stays.
2. To remove the data too, delete `/mnt/user/appdata/kept`, from the terminal or a file manager.
   This can't be undone: keep a backup first if you might want it back.
