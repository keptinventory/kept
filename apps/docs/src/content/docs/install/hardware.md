---
title: What it needs
description: What Kept was tested on, the memory it used, and what makes it need more.
sidebar:
  order: 6
---

**Tested: 2 GB of RAM and 2 CPU cores**, with an external AI provider or none. Everything passed
there, a backup during photo uploads included. Kept itself needs much less: it ran on 768 MB and
one core. Its backup is what needs the room.

## What was tested

- **Version:** Kept 1.14.2, `compose.yaml` as published (Kept, Postgres 18 with pgvector).
- **Machine:** emulated in Docker on an arm64 Mac. Docker, Kept and Postgres share one memory and
  CPU budget, as on a small VM, with 128 MB set aside for the operating system. No swap.
- **Data:** a household, plus one location with 3,000 things in 206 places and 200 containers.
- **Work:** 20 photos of 12 megapixels, two PDFs, 120 loads of that location's map and graph, 120
  list and search reads, `kept admin backup`, then 10 minutes idle.

| Machine | Photos, map, search, PDFs | Backup | Peak without the backup | Peak with it |
|---|---|---|---|---|
| 2 GB, 2 cores | passed | passed, during photo uploads | 410 MB | 930 MB |
| 1 GB, 2 cores | passed | out of memory 2 times in 3 | 450–490 MB | 740 MB, the time it passed |
| 1 GB, 1 core | passed | passed (one try) | 490 MB | 820 MB |
| 768 MB, 1 core | passed | out of memory | 480 MB | — |

Peaks are memory that can't be given back (page cache not counted), for the whole machine, Docker
included. Out of memory, the system killed Kept's process and Docker restarted it. One run on
each machine, three on 1 GB with 2 cores.

- **At rest:** after a start, Kept about 160 MB and Postgres about 30–70 MB. Once photos have been
  resized, Kept stays at about 300 MB.
- **Real data:** on an amd64 home server, Kept 206 MB and Postgres 119 MB (one reading).
- **Speed** (medians): a list page 30 ms, a search 50 ms, a photo upload 0.2–0.5 s, the map of the
  3,000-thing location 0.4–0.7 s.
- **Not tested yet:** a real VM, amd64 at these sizes, anything between 1 and 2 GB, local AI.

## What it means

- **2 GB, 2 cores:** tested, with about 1 GB to spare at the peak.
- **1 GB:** Kept runs, but its backup can run out of memory and restart Kept; it did 2 times in 4.
  Not recommended until the backup is smaller.
- **768 MB:** Kept runs; its backup doesn't.
- **Making the backup smaller**, and a default memory limit for Kept:
  [#176](https://github.com/keptinventory/kept/issues/176).

## Raspberry Pi

Not tested on one. The arm64 image is the one these tests ran, so a Pi with 2 GB or more will
probably behave like the 2 GB row, but no release is tested on a Pi.

## What's heavy

- **Backups.** `kept admin backup` and the nightly backup add about 500 MB while they run, almost
  all of it in Kept's own backup process; restic itself used under 100 MB.
- **Photo resizing.** Each upload is resized as it arrives. With under 3 GB of RAM Kept resizes one
  at a time, else two (`KEPT_IMAGE_CONCURRENCY` overrides it). Memory rises by about 150 MB over the
  first photos and stays there.
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
