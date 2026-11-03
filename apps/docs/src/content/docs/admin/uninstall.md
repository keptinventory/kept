---
title: Uninstalling
description: Remove Kept and everything it stored - after taking what you want to keep.
sidebar:
  order: 9
---

**Take your data out first.** Once the volumes are gone, nothing brings them back except a backup.

1. Each owner exports their locations (**Settings → Export**), or keep the latest backup and the
   [recovery kit](/admin/recovery-kit/) somewhere safe: with restic alone you can still
   [read your inventory](/admin/read-with-restic/) later.
2. Stop and remove the containers **and their volumes**, in the folder with `.env`:

   ```sh
   docker compose --profile https --profile ollama down --volumes
   ```

   This removes `kept-db` (the database), `kept-data` (the files), `kept-config` (the generated
   keys and database passwords) and `kept-owner` (the owner login's password); with
   `compose.full.yaml`, Caddy's certificates and Ollama's models too. Without `--volumes`, the data
   stays on the machine.
3. Remove the image: `docker image rm ghcr.io/keptinventory/kept:<version>` (the tag you ran, or
   `kept:local` for your own build), and `.env` next to the Compose file.
4. Outside the machine, remove what you set up for Kept yourself:
   - **the file bucket**, with `KEPT_STORAGE=s3` (and its old versions, if versioning was on);
   - **the backup**: the `restic` directory on the backup disk, the `restic/` prefix in the backup
     bucket, or the repository on the SFTP server, and any alpha `runs/` and `blobs/` beside it;
   - the database, if it was a provider's: the `kept_*` roles and the database itself;
   - DNS records, proxy routes and the Tailscale `serve` you added.
