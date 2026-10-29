---
title: What it needs
description: What Kept was tested on, the memory it used, and what makes it need more.
sidebar:
  order: 6
---

**Tested: 1 GB of RAM, one or two CPU cores**, with an external AI provider or none. Everything
passed there, a backup during photo uploads included. 2 GB leaves room to spare.

## What was tested

- **Version:** Kept 1.14.3's changes (a build before the release), `compose.yaml` as published
  (Kept, Postgres 18 with pgvector). 1.14.2 needed 2 GB for its backup.
- **Machine:** emulated in Docker on an arm64 Mac. Docker, Kept and Postgres share one memory and
  CPU budget, as on a small VM, with 128 MB set aside for the operating system. No swap.
- **Data:** a household, plus one location with 3,000 things in 206 places and 200 containers, and
  300 real photos.
- **Work:** 20 photos of 12 megapixels, two PDFs, 120 loads of that location's map and graph, 120
  list and search reads, `kept admin backup` while the photos upload, the scheduled backup, then
  10 minutes idle.

| Machine | Photos, map, search, PDFs | Backup during uploads | Scheduled backup | Peak |
|---|---|---|---|---|
| 1 GB, 2 cores (3 runs) | passed | passed | passed | 730–745 MB |
| 1 GB, 1 core | passed | passed | passed | 740 MB |
| 768 MB, 1 core | passed until the backup ran out of memory; 9 uploads and both PDFs failed while Kept restarted | out of memory | passed on its own (one run) | — |

Peaks are memory that can't be given back (page cache not counted), for the whole machine, Docker
included. Out of memory, the system killed Kept's process and Docker restarted it.

- **At rest:** after a start, Kept about 160 MB and Postgres about 30–70 MB. Once photos have been
  resized, Kept stays at about 300 MB.
- **Real data:** on an amd64 home server, Kept 206 MB and Postgres 119 MB (one reading).
- **Speed** (medians): a list page 30–40 ms, a search 50–70 ms, a photo upload 0.3–0.4 s, the map
  of the 3,000-thing location 0.4–0.5 s.
- **Not tested yet:** a real VM, amd64 at these sizes, 512 MB, local AI.

## What it means

- **1 GB, 1 or 2 cores:** tested, every run passed, with about 150 MB to spare at the peak.
- **2 GB:** room to spare, for other services beside Kept.
- **768 MB:** Kept ran, and so did Back up now (the scheduled backup's path); `kept admin backup`
  while photos uploaded ran out of memory. Not recommended.

## Raspberry Pi

Not tested on one. The arm64 image is the one these tests ran, so a Pi with 1 GB or more may fit
like the 1 GB rows; expect it to be slower. No release is tested on a Pi.

## What's heavy

- **Backups.** `kept admin backup` adds about 300–400 MB while it runs, the scheduled backup about
  150 MB; restic itself about 100 MB of that.
- **Photo resizing.** Each upload is resized as it arrives. Under 3 GB of RAM, or a container limit
  under 3 GB, Kept resizes one at a time, else two (`KEPT_IMAGE_CONCURRENCY` overrides it). Memory
  rises by about 150 MB over the first photos and stays there.
- **The map and graph of a very large location.** The server reads the whole location for each
  load: about 670 KB for 3,000 things.
- **Not on the server:** the map, graph and Grid are drawn by your browser and add no server memory
  at rest; the map and graph are downloaded only when opened.
- **Local AI with Ollama.** A model on the same machine shares its memory with Kept and needs far
  more than Kept does; see [Ollama](/admin/ollama/).
- **Disk.** The database is small; files are what grow. Leave room for backups on another disk, and
  Admin → Status warns, and admins are alerted, when a disk passes 85 % full.

## Postgres

Kept needs PostgreSQL 18 with pgvector. Compose runs the `pgvector/pgvector` image, pinned by
digest; for a provider's database see [managed Postgres](/install/managed-postgres/).
