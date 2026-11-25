---
title: Install on Proxmox VE
description: One command in the Proxmox VE host's shell makes an unprivileged Debian 13 container with Kept in it, without Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Not yet tested on a real Proxmox VE host]
The scripts are checked on every change: shellcheck, then the install, an update and a rollback
on a clean Debian 13 with systemd, and the host script against stand-ins for Proxmox's tools. They
haven't run on a real Proxmox VE host yet. Written for Proxmox VE 8 and 9 on amd64; arm64 hosts
are untested. Treat a first install as a test.
:::

Kept runs in its own unprivileged Debian 13 container, without Docker, as Proxmox advises:
PostgreSQL, Node and Kept under systemd. Proxmox's backups cover it, and nothing else on the host
changes.

## Install

In the Proxmox VE host's shell, as root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default:** asks only for the confirmation, with the settings below.
- **Advanced:** asks every setting: the ID, the name, CPU, memory, disk, storage, bridge, a static
  address with its gateway, a VLAN, DNS, an SSH key, a root password, the time zone.
- **The confirmation** shows every setting and the exact `pct create` command before anything is
  made.

It checks the host first (root, Proxmox VE 8 or 9, the bridge, a storage with room, DNS), downloads
the Debian 13 template if it isn't there, creates the container, installs Kept in it and prints the
address. If anything fails, it says what and removes the unfinished container.

### Read it first

Download the script and the release's `SHA256SUMS`, check, read, then run it:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` holds the SHA-256 of `kept.sh`, `kept-install.sh` (what runs inside the container)
and the release tarballs. It is signed with the release key: `kept.sh` and `kept-install.sh`
check that signature with openssl before they use anything from the release. To check it
yourself, download `SHA256SUMS.sigstore.json` from the same release and see
[verifying a release](/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## What it creates

- **The container:** unprivileged Debian 13, `nesting=1` (Debian 13's systemd needs it), started
  at boot, tagged `kept`.
- **Inside it:** PostgreSQL 18 with pgvector (from PostgreSQL's own repository), Node 24 (from
  nodejs.org), restic, and Kept's release tarball, each pinned and checked.
- **Services:** `kept-bootstrap` (the database and its logins, on every boot) and `kept` (the
  migrations, then Kept on port 8080 as the user `kept`).
- **Files:** Kept in `/opt/kept`, its settings in `/etc/kept/kept.env`, its keys in
  `/etc/kept/config`, photos and documents in `/var/lib/kept`, and the address and setup code in
  `/root/kept.creds`.

No telemetry, no timers, no automatic updates, no change to the host beyond the container.

## Defaults

| Setting | Default | Preset with |
|---|---|---|
| CPU | 2 cores | `var_cpu` |
| Memory | 2048 MB, swap 512 MB | `var_ram`, `var_swap` |
| Disk | 8 GB | `var_disk` |
| Storage | the first that holds containers | `var_storage` |
| Network | DHCP on `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, name | the next free ID, `kept` | `var_ctid`, `var_hostname` |
| Time zone | the host's | `var_timezone` |
| SSH key | none | `var_ssh_key` (a public key file on the host) |

Kept was tested on 1 GB ([what it needs](/install/hardware/)); 2 GB leaves room for imports and
backups. Photos take most of the disk.

Every value can be preset, and `var_unattended=yes` runs it with no questions:

```sh
var_unattended=yes var_ram=4096 var_ip=192.0.2.50/24 var_gateway=192.0.2.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## First run

1. Open the address it printed, `http://<address>:8080`. Kept shows **Enter the setup code**.
2. The code is in the container: `pct exec <CTID> -- cat /root/kept.creds`. Enter it, then
   **Create the first account**: it becomes the instance admin.
3. Keep the keys off this server: `pct exec <CTID> -- kept admin recovery-kit` prints the recovery
   kit.

Printed labels carry the address. Give the container a fixed one (a DHCP reservation in your
router, or `var_ip`) before you print any. To change it later, set `KEPT_PUBLIC_URL` in
`/etc/kept/kept.env`, then `systemctl restart kept`. HTTPS:
[behind a reverse proxy](/install/reverse-proxy/).

## Update

In the container's console (`pct enter <CTID>`, or the container's **Console** in the web
interface):

```sh
update
```

`update` names the running and the newest version and asks first. It prints the backup command to
run on the host before you answer. Then it downloads the new release and checks it against the
release's signed `SHA256SUMS`, stops Kept, switches to the new release beside the old one and
starts it (the migrations run first). If Kept doesn't answer `/readyz` with the new version, it
switches back and starts the previous release. `update 1.15.0` installs a given version. Older
versions need `KEPT_ALLOW_DOWNGRADE=1`, for a restore ([going back one version](/admin/upgrades/#going-back-one-version)).
Nothing updates on its own.

Debian's own updates are `apt update && apt upgrade` in the container, as on any Debian.

## Backups

Everything lives on the container's disk, so a Proxmox backup holds Kept whole: add the container
to a backup job (**Datacenter → Backup**) in snapshot mode, or once:

```sh
vzdump <CTID> --mode snapshot
```

Snapshot mode needs storage that takes snapshots (LVM-thin, ZFS, Ceph); on other storage use
`--mode stop`. Restore it with the web interface's **Restore**, or `pct restore`.

For a second copy off the box, turn on Kept's own nightly backups ([backups](/admin/backups/)).
They run as the database owner, so give Kept that login first, in the container:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

S3 and SFTP targets work as they are. A directory target must be writable by the service: add it
with `systemctl edit kept` (`[Service]` then `ReadWritePaths=/your/backup/dir`), owned by the user
`kept`.

## Remove

This deletes the container and everything in it, Kept's data included. Back up first if you may
want it again:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## Something not working?

- **The install stopped:** the script printed the step and removed the container. Run it again
  with `var_keep_failed=yes` to keep the container, then `pct enter <CTID>` and
  `journalctl -u kept`.
- **Kept doesn't start:** `journalctl -u kept-bootstrap -u kept` in the container names the
  problem, such as `kept: invalid environment:` for a setting in `/etc/kept/kept.env`.
- **The console is black:** Debian 13 needs `nesting=1`, which the script sets; a container made
  by hand without it shows this.
