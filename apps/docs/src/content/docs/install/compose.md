---
title: Install with Docker Compose
description: Run Kept and its Postgres with Docker Compose on your own server or homelab, sign in for the first time, and keep the keys safe.
sidebar:
  order: 1
---

Docker Compose is the way to run Kept on one machine: Kept itself, Postgres 18 with pgvector, and,
if you want it, Caddy for HTTPS. You need Docker with the Compose plugin, and a machine with at
least 2 GB of RAM and 2 CPU cores ([what it needs](/install/hardware/)).

Four steps, with no copy of the repository and no passwords to make:

```sh
mkdir kept && cd kept
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.2/compose.yaml
docker compose run --rm init
docker compose up -d
```

`compose.yaml` works on its own, so it also pastes into Portainer, Dockge and the like (see
[without a terminal](#without-a-terminal)).

:::note[Images]
Releases are published to `ghcr.io/keptinventory/kept`, tagged `1`, `1.2` and `1.2.3`, never
`latest`; `1.0.0` is the first signed one. The same images, signed with the same key, are on Docker
Hub as `keptinventory/kept`. `compose.yaml` runs the release it was published with unless
`KEPT_IMAGE` in `.env` names another; `init` writes the version it ran as there.
[Verify it](/admin/verify-release/) first if you like. To run your own build, in a checkout:
`docker build -t kept:local .` and `KEPT_IMAGE=kept:local`.
:::

## 1. Write `.env`

```sh
docker compose run --rm init
```

`init` asks for **the address you'll open Kept at**, such as `http://kept.home.arpa:8080` or
`https://kept.example.org`. Links, the QR codes on printed labels and the same-site check are built
from it, so it must be exactly what the browser shows, and it should not change: **use a name
rather than an IP address.** A home router can give this machine a new address one day, and the
labels you printed would then point nowhere. Set the name in your router's DNS, or in the hosts
file of each device. An IP address still works if you confirm it.

It then writes `.env` next to `compose.yaml` with that address (`KEPT_PUBLIC_URL`), the port
(`KEPT_HTTP_PORT`, from an `http://` address), the image and a setup code (`KEPT_SETUP_CODE`), and
shows the code. `.env` holds no password and is readable by you only. Run `init` again to change
the address: it updates those lines and keeps everything else you added. Without a terminal, give
the address on the command line: `docker compose run --rm init --url http://kept.home.arpa:8080`.

Everything else is optional; `compose.env.example` and the
[configuration reference](/reference/configuration/) say what each variable does.

## 2. Start it

```sh
docker compose up -d
```

Compose starts the database and waits for it to be healthy. Then:

- **`bootstrap`** (one-shot, `kept bootstrap`) makes Kept's four database logins and the
  `pg_trgm`, `unaccent` and `vector` extensions. On the first start it generates each login's
  password into a volume; on every start it sets each login's password to that value, so Postgres
  and Kept always agree.
- **`migrate`** (one-shot, `kept migrate`) applies the database migrations once, under a lock.
- **Kept** starts on port 8080 (`KEPT_HTTP_PORT` changes the host port).

## 3. Finish setup

Open the address, enter the setup code `init` showed, and create the first account: it becomes the
instance admin. Kept also prints the code in its log on its first start:

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

A lost code is issued again with:

```sh
docker compose run --rm migrate admin setup-code
```

Wrong codes lock out for a while, per address and for the whole instance. If Kept sits behind a
proxy it doesn't trust, everyone shares the proxy's address; see
[reverse proxies](/install/reverse-proxy/).

## 4. Keep the keys

On first start, with `KEPT_SECRET_KEY` and `KEPT_AUTH_SECRET` unset, Kept generates both into the
`kept-config` volume and logs one line saying where. The secret key seals every secret value (AI
keys, the passwords you store in Kept): **a backup restores everything except those values unless
you also have the key.**

Print the keys and keep them somewhere other than this server, such as a password manager:

```sh
docker compose exec kept kept admin recovery-kit
```

Admin → Status asks you to acknowledge the recovery kit, and Kept requires it before the first
secret value, AI key or backup setting. See [the recovery kit](/admin/recovery-kit/).

## 5. Next

- [Put Kept on HTTPS](/install/https/): the camera, installing the app, push notifications and
  location only work over HTTPS.
- [Set up backups](/admin/backups/).
- Mail: set `KEPT_SMTP_URL` (`smtp://` or `smtps://`, with credentials) and `KEPT_SMTP_FROM` for
  password resets, invitations and reminders by email. Without them, reminders reach people in the
  app only, and Admin → Status says mail isn't configured.

## What Compose creates

| Volume | Holds | Back it up? |
|---|---|---|
| `kept-db` | the Postgres database | through Kept's backup, never by copying the volume while it runs |
| `kept-data` | uploaded files (with `KEPT_STORAGE=local`, the default) | through Kept's backup |
| `kept-config` | the generated `KEPT_SECRET_KEY` and `KEPT_AUTH_SECRET`, and the passwords of the `kept_app`, `kept_auth` and `kept_system` logins | keep the recovery kit; the passwords are made again if lost |
| `kept-owner` | the password of the `kept_owner` login | no; it is made again if lost |
| `caddy-data`, `caddy-config` | Caddy's certificates (the `https` profile) | no; Caddy gets new ones |

The database's superuser has no password anyone needs: it is reached only from inside the
database container, as `docker compose exec db psql -U postgres`, and by the bootstrap, which
shares that container's network. Over the network every login needs its password. Never publish
the `db` service's port (no `ports:` on it): Kept reaches it over the compose network.

Kept's containers run as a non-root user (uid 10001) with a read-only root filesystem, every Linux
capability dropped and `no-new-privileges`. The `migrate` service holds the database owner's
login; the serving container never sees it (the `kept-owner` volume isn't mounted there) until you
give it one for the nightly backup ([backups](/admin/backups/#turning-it-on)). `init` is the one
exception to the non-root rule: it runs as root, with no network and only the capabilities that
create `.env` in your folder and give it to you, and exits.

## Without a terminal

Portainer, Dockge and similar tools take `compose.yaml` as it is. They don't run `init`, so set two
variables in their environment editor instead: `KEPT_PUBLIC_URL` (the address, as above) and
`KEPT_SETUP_CODE` (six characters of 0–9 and A–Z without I, L, O and U, such as `KPT-2X9`; or leave
it empty and read the code from Kept's log). Pin `KEPT_IMAGE` to a release if the tool doesn't.

## An install from before 1.13.0

An install made with a copy of the repository has the five `KEPT_DB_*_PASSWORD` lines in `.env`.
With this `compose.yaml` they are used exactly as given, and nothing is generated: update the
checkout (or download the new `compose.yaml` next to the old `.env`) and run
`docker compose up -d`. Removing those lines later, or writing `.env` again with `init`, is safe
too: the next start generates new passwords and sets them in Postgres. An empty `KEPT_IMAGE` used
to build the checkout; it now runs the release `compose.yaml` names, so set `KEPT_IMAGE=kept:local`
if you build your own.

## Web and worker on their own

One container serves the web app and runs the background jobs (`KEPT_ROLE=all`, the default). To
split them, run a second Kept service with `KEPT_ROLE=worker` beside one with `KEPT_ROLE=web`. A
worker serves no HTTP; the image's healthcheck follows `KEPT_ROLE` and checks the worker's job loop
instead, so neither needs an override (`compose.yaml` has the two services commented out). The
worker runs the nightly backup, so it is the one that needs the owner login and a directory
target's mount.
