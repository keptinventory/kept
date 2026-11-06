---
title: Aggiornamenti e rollback
description: Aggiornare Kept, lo snapshot che prende prima, tornare indietro di una versione e i major upgrade di Postgres.
sidebar:
  order: 5
---

## Aggiornare

Con Compose, punta `KEPT_IMAGE` in `.env` al nuovo rilascio e:

```sh
docker compose pull
docker compose up -d
```

La tua build da un checkout, invece: `git pull`, `docker build -t kept:local .`, poi
`docker compose up -d` con `KEPT_IMAGE=kept:local`.

Anche un rilascio può cambiare `compose.yaml`; le sue note lo indicano. Scarica il file del rilascio sopra il tuo
(`curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.yaml`, oppure
`compose.full.yaml` se usi quello); `.env` resta com'è.

### Impostazioni che richiedono il nuovo compose.yaml

`compose.yaml` consegna a Kept le impostazioni che nomina, e nient'altro. Un aggiornamento a 1.14.5 che cambi solo
`KEPT_IMAGE` conserva il file di 1.14.4, che non passa `KEPT_HTTP_SIGN_IN_DAYS` né
`KEPT_EXTRA_ADDRESSES` e imposta da sé `KEPT_TRUSTED_PROXIES`. Quelle righe in `.env` non fanno nulla finché
non scarichi il `compose.yaml` (o il `compose.full.yaml`) di 1.14.5 e avvii `docker compose up -d`.

### Caddy e Ollama spostati in compose.full.yaml

Dal 1.14.5, `compose.yaml` avvia solo Kept e il suo database. Caddy (il profilo `https`),
Ollama (il profilo `ollama`) e il deployment diviso commentato sono in
`compose.full.yaml`: lo stesso file più quelli. **Se usi Caddy o Ollama**, scarica
`compose.full.yaml` invece e imposta `COMPOSE_FILE=compose.full.yaml` in `.env`:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.full.yaml
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose --profile https up -d   # the profiles you use: https, ollama or both
```

Altrimenti il prossimo scaricamento di `compose.yaml` elimina Caddy: Compose chiama il suo container un orfano,
e una volta sparito, Kept resta su http semplice. I servizi di Kept, la rete e i volumi
(certificati di Caddy in `caddy-data`, i modelli in `ollama`) sono uguali in entrambi i file, quindi
nulla va perso. Senza Caddy o Ollama, nulla cambia.

**Dietro il tuo proxy**, `KEPT_TRUSTED_PROXIES` in `.env` raggiunge Kept dal 1.14.5. Prima,
`compose.yaml` impostava il suo valore, così una riga in `.env` veniva ignorata e ogni visitatore condivideva i
limiti di accesso del proxy. Un valore già in `.env` ha effetto una volta scaricato il
`compose.yaml` del 1.14.5 ([sopra](#impostazioni-che-richiedono-il-nuovo-composeyaml)); uno in
`compose.override.yaml` può spostarsi in `.env`. Con il Caddy di `compose.full.yaml`, lascialo vuoto o
tieni `172.29.72.200` nella lista ([reverse proxy](/it/install/reverse-proxy/#fidati-del-proxy-e-solo-del-proxy)).

### Link di accesso (1.14.0)

Il 1.14.0 porta Kept a better-auth 1.7.13, che corregge un avviso in cui lo stato di un accesso OAuth
poteva essere usato come link magico per accedere come un altro (GHSA-965c-763c-88jm). Un link magico
inviato per email, o un accesso Google o OIDC iniziato, prima dell'aggiornamento non funziona più: chiedi un nuovo
link, o accedi di nuovo.

### Installazione senza clone (1.13.0)

Dal 1.13.0, `compose.yaml` non ha bisogno di una copia del repository né di password del database: un servizio
`bootstrap` a esecuzione singola crea gli accessi a ogni avvio. Un'installazione fatta prima continua a funzionare così
com'è: le sue cinque righe `KEPT_DB_*_PASSWORD` in `.env` vengono usate così come sono
([un'installazione da prima del 1.13.0](/it/install/compose/#uninstallazione-precedente-alla-1130)). Due cose da
sapere: un `KEPT_IMAGE` vuoto non compila più il checkout (avvia il rilascio che nomina `compose.yaml`),
e il `compose.override.yaml` del backup notturno legge la password del proprietario dal volume
`kept-owner` una volta che `.env` non la contiene più ([backup](/it/admin/backups/#come-attivarlo)).

Il servizio `migrate` a esecuzione singola avvia prima `kept migrate`: le migrazioni si applicano **una sola volta, sotto un
blocco del database**, prima che la nuova versione serva una richiesta. Le migrazioni di Kept aggiungono solo (una colonna o
una tabella viene scartata o rinominata solo tra due rilasci), quindi la versione precedente funziona ancora con
il nuovo schema, ed è questo che rende possibile tornare indietro.

Leggi le note di rilascio prima di una versione major (`1.x` a `2.0`).

### L'immagine si è spostata (1.8.0)

Dal 1.8.0 l'immagine è `ghcr.io/keptinventory/kept` e il chart
`oci://ghcr.io/keptinventory/charts/kept`. I rilasci fino al 1.7.1 restano su
`ghcr.io/ibrahimroshdy/kept`, che non riceve nuove versioni. Per aggiornare, cambia il nome dell'immagine una sola volta:

- Compose: `KEPT_IMAGE=ghcr.io/keptinventory/kept:1.8.0`.
- Helm: `image.repository: ghcr.io/keptinventory/kept`, oppure installa il chart dal suo nuovo indirizzo.

La chiave di firma è la stessa, quindi `cosign verify --key cosign.pub ghcr.io/keptinventory/kept:<version>`
funziona come prima ([Verificare un rilascio](/it/admin/verify-release/)).

### Sapere se c'è una nuova versione

Kept può controllare le nuove versioni, ed è **disattivato per impostazione predefinita**. Attivo, chiede una volta al giorno a GitHub l'ultima
release del repository da cui è stata compilata la sua immagine, inviando solo la richiesta (nessuna
versione, nessun identificatore dell'istanza). Non viene scaricato o installato nulla. `KEPT_UPDATE_CHECK=true`
lo attiva e lo blocca; `false` lo blocca disattivato.

Lo switch è in Admin → Sign-up, sotto "New versions". Admin → Status dice "Kept X is available"
quando esiste un rilascio più recente, e il suo **Controlla ora** chiede subito.

## Lo snapshot prima di ogni aggiornamento

Quando `kept migrate` trova migrazioni in sospeso su un database che ha già dati, e un target di backup
è configurato, prima fa uno snapshot restic solo del database etichettato `pre_upgrade`. **Se lo
snapshot fallisce, non viene migrato nulla** e il comando si ferma con il motivo. Gli ultimi 3
snapshot pre-aggiornamento vengono conservati.

- Nessun target di backup: Kept migra comunque, lo registra ad alta voce, e Admin → Status dice che è stato "upgraded
  without a backup" fino al prossimo backup buono.
- `KEPT_UPGRADE_SNAPSHOT=off` (o `kept migrate --skip-snapshot`) lo salta apposta.
- L'[app Home Assistant](/it/install/home-assistant/) non ne fa mai uno: il backup di Home Assistant
  prima dell'aggiornamento è il modo per tornare indietro.
- Un database nuovissimo non ne fa mai uno.

Perché questo funzioni, il servizio `migrate` ha bisogno delle chiavi e delle impostazioni di backup oltre al login del proprietario.
Il file Compose gli dà tutti e tre; un target directory ha anche bisogno del suo montaggio su `migrate`
([backup](/it/admin/backups/#come-attivarlo)).

## Tornare indietro di una versione

Per fare rollback, avvia di nuovo l'immagine del rilascio precedente: `KEPT_IMAGE` di nuovo al tag vecchio, poi
`docker compose up -d`. Non ci sono migrazioni in giù; la versione precedente funziona sullo schema più recente.

Kept registra le migrazioni di ogni rilascio nel database e controlla all'avvio:

- il database è **un rilascio avanti** rispetto all'immagine: Kept si avvia, e Admin → Status dice che è stato
  fatto rollback da X;
- **più di un** rilascio avanti, o avanti per migrazioni che nessun rilascio registrato ha fatto: Kept si rifiuta di
  avviarsi (`downgrade_refused`) e nomina entrambe le versioni. È il momento di
  [ripristinare](/it/admin/restore/) lo snapshot pre-aggiornamento. `KEPT_ALLOW_DOWNGRADE=1` forza l'
  avvio, e la forzatura è registrata.

Dal 1.14.4 al 1.14.3: la mappa del 1.14.3 ha un minimo di 1 m. Una stanza di meno di 1 m per lato mantiene la sua dimensione
finché qualcuno non tocca **Fatto** in **Sistema**, che la salva a 1 m (o rifiuta, se questo la fa
sovrapporre alla stanza successiva). Per conservare quelle dimensioni, non sistemare la mappa finché non sei tornato al 1.14.4.

## Major upgrade di Postgres

Il file Compose di Kept fissa Postgres 18 per digest, e i suoi aggiornamenti delle dipendenze non propongono mai un major
bump. Una nuova versione major è un **dump e restore**, mai un cambio di tag sul volume esistente
(i file di dati di una versione major non si aprono in un'altra):

1. Fai un backup e lascialo finire: `docker compose run --rm --no-deps --entrypoint kept kept admin backup`.
2. Ferma Kept: `docker compose stop kept`.
3. Cambia l'immagine `db` alla nuova versione major, su un volume **nuovo** (rinomina `kept-db` in
   `compose.yaml`, o sposta il vecchio di lato); tieni il volume vecchio finché non hai finito.
4. `docker compose up -d db`: lo script di init crea i ruoli e le estensioni nel database vuoto.
5. [Ripristina](/it/admin/restore/#dopo-aver-perso-il-server) il backup dentro, poi `docker compose up -d`.

L'immagine di Kept contiene gli strumenti client della versione major di Postgres che supporta, e il ripristino
controlla che corrispondano a quelli del server.
