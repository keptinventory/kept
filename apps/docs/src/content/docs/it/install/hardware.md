---
title: Cosa serve
description: Su cosa è stato testato Kept, la memoria usata e cosa lo fa richiedere di più.
sidebar:
  order: 6
---

**Testato: 1 GB di RAM, uno o due core della CPU**, con un provider AI esterno o nessuno. Tutto
è passato, backup durante il caricamento delle foto incluso. 2 GB lasciano margine.

## Cosa è stato testato

- **Versione:** le modifiche di Kept 1.14.3 (una build precedente il rilascio), `compose.yaml` come pubblicato
  (Kept, Postgres 18 con pgvector). 1.14.2 aveva bisogno di 2 GB per il suo Backup.
- **Macchina:** emulata in Docker su un Mac arm64. Docker, Kept e Postgres condividono un unico budget di memoria e
  CPU, come su una piccola VM, con 128 MB riservati al sistema operativo. Niente swap.
- **Dati:** una casa, più una posizione con 3.000 oggetti in 206 posti e 200 contenitori, e
  300 foto reali.
- **Lavori:** 20 foto da 12 megapixel, due PDF, 120 caricamenti della mappa e del grafo di quella posizione, 120
  letture di liste e ricerche, `kept admin backup` mentre si caricano le foto, il backup pianificato, poi
  10 minuti idle.

| Macchina | Foto, mappa, ricerca, PDF | Backup durante i caricamenti | Backup pianificato | Picco |
|---|---|---|---|---|
| 1 GB, 2 core (3 esecuzioni) | superato | superato | superato | 730–745 MB |
| 1 GB, 1 core | superato | superato | superato | 740 MB |
| 768 MB, 1 core | superato finché il Backup non ha esaurito la memoria; 9 caricamenti e entrambi i PDF hanno fallito mentre Kept si riavviava | memoria esaurita | superato da solo (un'esecuzione) | — |

I picchi sono memoria che non può essere restituita (page cache non conteggiata), per l'intera macchina, Docker
incluso. Memoria esaurita, il sistema ha terminato il processo di Kept e Docker lo ha riavviato.

- **A riposo:** dopo un avvio, Kept circa 160 MB e Postgres circa 30–70 MB. Una volta ridimensionate le foto,
  Kept resta a circa 300 MB.
- **Dati reali:** su un server domestico amd64, Kept 206 MB e Postgres 119 MB (una lettura).
- **Velocità** (mediane): una pagina di lista 30–40 ms, una ricerca 50–70 ms, un caricamento foto 0,3–0,4 s, la mappa
  della posizione da 3.000 oggetti 0,4–0,5 s.
- **Non ancora testato:** una VM reale, amd64 a queste dimensioni, 512 MB, AI locale. I test di prestazione continuano: [#379](https://github.com/keptinventory/kept/issues/379).

## Cosa significa

- **1 GB, 1 o 2 core:** testato, ogni esecuzione è passata, con circa 150 MB di margine al picco.
- **2 GB:** margine per altri servizi oltre a Kept.
- **768 MB:** Kept ha funzionato, e così anche Esegui backup ora (il percorso del backup pianificato); `kept admin backup`
  durante il caricamento delle foto ha esaurito la memoria. Non consigliato.

## Raspberry Pi

Non testato su uno. L'immagine arm64 è quella su cui questi test sono stati eseguiti, quindi un Pi con 1 GB o più potrebbe stare
come le righe da 1 GB; aspettati che sia più lento. Nessun rilascio è testato su un Pi.

## Cosa è pesante

- **Backup.** `kept admin backup` aggiunge circa 300–400 MB mentre è in esecuzione, il backup pianificato circa
  150 MB; restic da solo circa 100 MB di questi. Non nell'
  [app Home Assistant](/it/install/home-assistant/): i backup di Home Assistant vengono eseguiti al suo posto.
- **Ridimensionamento delle foto.** Ogni caricamento viene ridimensionato all'arrivo. Sotto i 3 GB di RAM, o un limite del container
  sotto i 3 GB, Kept ridimensiona una alla volta, altrimenti due (`KEPT_IMAGE_CONCURRENCY` lo sovrascrive). La memoria
  sale di circa 150 MB sulle prime foto e resta così.
- **La mappa e il grafo di una posizione molto grande.** Il server legge l'intera posizione per ogni
  caricamento: circa 670 KB per 3.000 oggetti.
- **Non sul server:** la mappa, il grafo e Grid sono disegnati dal tuo browser e non aggiungono memoria al server
  a riposo; la mappa e il grafo vengono scaricati solo quando aperti.
- **AI locale con Ollama.** Un modello sulla stessa macchina condivide la sua memoria con Kept e ne richiede molti di più
  di Kept; vedi [Ollama](/it/admin/ollama/).
- **Disco.** Il database è piccolo; i file sono ciò che cresce. Lascia spazio per i backup su un altro disco, e
  Admin → Status avvisa, e gli amministratori vengono avvisati, quando un disco supera l'85 % di utilizzo.

## Postgres

Kept ha bisogno di PostgreSQL 18 con pgvector. Compose esegue l'immagine `pgvector/pgvector`, bloccata per
digest; per un database di un provider vedi [Postgres gestito](/it/install/managed-postgres/).
