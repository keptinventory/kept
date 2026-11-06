---
title: Disinstallazione
description: Rimuovi Kept e tutto ciò che ha memorizzato - dopo aver preso ciò che vuoi tenere.
sidebar:
  order: 9
---

**Prima prendi i tuoi dati.** Una volta spariti i volumi, niente li riporta indietro eccetto un backup.

1. Ogni proprietario esporta i propri luoghi (**Impostazioni → Esporta**), oppure tieni l'ultimo backup e il
   [kit di ripristino](/it/admin/recovery-kit/) al sicuro: con solo restic puoi ancora
   [leggere il tuo inventario](/it/admin/read-with-restic/) più tardi.
2. Ferma e rimuovi i container **e i loro volumi**, nella cartella con `.env`:

   ```sh
   docker compose --profile https --profile ollama down --volumes
   ```

   Questo rimuove `kept-db` (il database), `kept-data` (i file), `kept-config` (le chiavi generate
   e le password del database) e `kept-owner` (la password di accesso del proprietario); con
   `compose.full.yaml`, anche i certificati di Caddy e i modelli di Ollama. Senza `--volumes`, i dati
   restano sul computer.
3. Rimuovi l'immagine: `docker image rm ghcr.io/keptinventory/kept:<version>` (il tag che hai usato, oppure
   `kept:local` per la tua build), e `.env` accanto al file Compose.
4. Fuori dalla macchina, rimuovi ciò che hai configurato tu per Kept:
   - **il bucket dei file**, con `KEPT_STORAGE=s3` (e le sue vecchie versioni, se il versioning era attivo);
   - **il backup**: la directory `restic` sul disco di backup, il prefisso `restic/` nel bucket di backup,
     oppure il repository sul server SFTP, e tutte le `runs/` e `blobs/` alpha accanto ad esso;
   - il database, se era di un provider: i ruoli `kept_*` e il database stesso;
   - i record DNS, i percorsi del proxy e il `serve` di Tailscale che hai aggiunto.
