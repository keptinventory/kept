---
title: Upgrades and rollback
description: Upgrading Kept, the snapshot it takes first, going back one version, and Postgres major upgrades.
sidebar:
  order: 5
---

## Upgrading

With Compose, point `KEPT_IMAGE` in `.env` at the new release and:

```sh
docker compose pull
docker compose up -d
```

Your own build from a checkout instead: `git pull`, `docker build -t kept:local .`, then
`docker compose up -d` with `KEPT_IMAGE=kept:local`.

A release can change `compose.yaml` too; its notes say so. Download the release's file over yours
(`curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.yaml`); `.env`
stays as it is.

### Sign-in links (1.14.0)

1.14.0 moves Kept to better-auth 1.7.13, which fixes an advisory where an OAuth sign-in's state
could be used as a magic link to sign in as someone else (GHSA-965c-763c-88jm). A magic link
mailed, or a Google or OIDC sign-in started, before the upgrade no longer works: ask for a new
link, or sign in again.

### Install without a clone (1.13.0)

Since 1.13.0 `compose.yaml` needs no copy of the repository and no database passwords: a one-shot
`bootstrap` service makes the logins on every start. An install made before keeps working as it
is: its five `KEPT_DB_*_PASSWORD` lines in `.env` are used as given
([an install from before 1.13.0](/install/compose/#an-install-from-before-1130)). Two things to
know: an empty `KEPT_IMAGE` no longer builds the checkout (it runs the release `compose.yaml`
names), and the nightly backup's `compose.override.yaml` reads the owner's password from the
`kept-owner` volume once `.env` no longer holds it ([backups](/admin/backups/#turning-it-on)).

The one-shot `migrate` service runs `kept migrate` first: the migrations apply **once, under a
database lock**, before the new version serves a request. Kept's migrations only add (a column or
table is dropped or renamed only across two releases), so the previous version still runs against
the new schema, which is what makes going back possible.

Read the release notes before a major version (`1.x` to `2.0`).

### The image moved (1.8.0)

Since 1.8.0 the image is `ghcr.io/keptinventory/kept` and the chart
`oci://ghcr.io/keptinventory/charts/kept`. Releases up to 1.7.1 stay at
`ghcr.io/ibrahimroshdy/kept`, which gets no new versions. To upgrade, change the image name once:

- Compose: `KEPT_IMAGE=ghcr.io/keptinventory/kept:1.8.0`.
- Helm: `image.repository: ghcr.io/keptinventory/kept`, or install the chart from its new address.

The signing key is the same, so `cosign verify --key cosign.pub ghcr.io/keptinventory/kept:<version>`
works as before ([Verify a release](/admin/verify-release/)).

### Knowing there's a new version

Kept can check for new versions, and it is **off by default**. On, it asks GitHub once a day for
the latest release of the repository its image was built from, sending nothing but the request (no
version, no instance identifier). Nothing is downloaded or installed. `KEPT_UPDATE_CHECK=true`
turns it on and locks it; `false` locks it off.

The switch is in Admin → Sign-up, under "New versions". Admin → Status says "Kept X is available"
when a newer release exists, and its **Check now** asks at once.

## The snapshot before every upgrade

When `kept migrate` finds pending migrations on a database that already has data, and a backup
target is configured, it first takes a database-only restic snapshot tagged `pre_upgrade`. **If the
snapshot fails, nothing is migrated** and the command stops with the reason. The last 3
pre-upgrade snapshots are kept.

- No backup target: Kept migrates anyway, logs it loudly, and Admin → Status says it was "upgraded
  without a backup" until the next good backup.
- `KEPT_UPGRADE_SNAPSHOT=off` (or `kept migrate --skip-snapshot`) skips it on purpose.
- A brand-new database never takes one.

For this to work, the `migrate` service needs the keys and the backup settings as well as the owner
login. The Compose file gives it all three; a directory target also needs its mount on `migrate`
([backups](/admin/backups/#turning-it-on)).

## Going back one version

To roll back, run the previous release's image again: `KEPT_IMAGE` back to the old tag, then
`docker compose up -d`. There are no down migrations; the previous version runs on the newer schema.

Kept records each release's migrations in the database, and checks at start:

- the database is **one release ahead** of the image: Kept starts, and Admin → Status says it was
  rolled back from X;
- **more than one** release ahead, or ahead by migrations no recorded release made: Kept refuses to
  start (`downgrade_refused`) and names both versions. That is the moment to
  [restore](/admin/restore/) the pre-upgrade snapshot instead. `KEPT_ALLOW_DOWNGRADE=1` forces the
  start, and the force is audited.

## Postgres major upgrades

Kept's Compose file pins Postgres 18 by digest, and its dependency updates never propose a major
bump. A new major version is a **dump and restore**, never a tag change on the existing volume
(the data files of one major version don't open in another):

1. Take a backup and let it finish: `docker compose run --rm --no-deps --entrypoint kept kept admin backup`.
2. Stop Kept: `docker compose stop kept`.
3. Change the `db` image to the new major version, on a **new** volume (rename `kept-db` in
   `compose.yaml`, or move the old one aside); keep the old volume until you're done.
4. `docker compose up -d db`: the init script creates the roles and extensions in the empty database.
5. [Restore](/admin/restore/#after-losing-the-server) the backup into it, then `docker compose up -d`.

Kept's image carries the client tools of the Postgres major version it supports, and the restore
checks they match the server's.
