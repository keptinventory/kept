---
title: Installa con Docker Compose
description: Esegui Kept e il suo Postgres con Docker Compose sul tuo server o homelab, accedi per la prima volta e tieni al sicuro le chiavi.
sidebar:
  order: 1
---

Docker Compose è il modo per eseguire Kept su una sola macchina: Kept stesso e Postgres 18 con pgvector.
Caddy per HTTPS e Ollama per l'AI locale arrivano con un secondo file
([Caddy e Ollama](#caddy-e-ollama)). Ti serve Docker con il plugin Compose. Testato su una macchina con
1 GB di RAM e un core CPU; Kept e il suo database usano circa 200–400 MB di essa
([cosa è stato testato](/it/install/hardware/)).

Quattro passi, senza copiare il repository e senza creare password:

```sh
mkdir kept && cd kept
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.yaml
docker compose run --rm init
docker compose up -d
```

`compose.yaml` funziona da solo, quindi si incolla anche in Portainer, Dockge e simili (vedi
[senza terminale](#senza-terminale)).

:::note[Immagini]
Le release sono pubblicate su `ghcr.io/keptinventory/kept`, con tag `1`, `1.2` e `1.2.3`, mai
`latest`; `1.0.0` è la prima firmata. Le stesse immagini, firmate con la stessa chiave, sono su Docker
Hub come `keptinventory/kept`. `compose.yaml` esegue la release con cui è stato pubblicato, a meno che
`KEPT_IMAGE` in `.env` ne indichi un'altra; `init` scrive lì la versione che ha eseguito.
[Verifica](/it/admin/verify-release/) prima se vuoi. Per eseguire la tua build, in un checkout:
`docker build -t kept:local .` e `KEPT_IMAGE=kept:local`.
:::

## Cosa viene eseguito

| Servizio | Esegue |
|---|---|
| `db` | Postgres, e resta in esecuzione |
| `kept` | Kept sulla porta 8080, e resta in esecuzione |
| `bootstrap` | ad ogni avvio, poi esce: i login del database e le estensioni |
| `migrate` | ad ogni avvio, poi esce: le migrazioni del database |
| `init` | solo quando lo esegui (`docker compose run --rm init`): scrive `.env` |

## Caddy e Ollama

`compose.yaml` esegue solo Kept. `compose.full.yaml` è lo stesso file più Caddy per HTTPS (il
profilo `https`), Ollama per l'AI locale (il profilo `ollama`) e un deployment web e worker separati,
commentato. Funziona anche da solo. Per usarlo al posto:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.full.yaml
docker compose -f compose.full.yaml run --rm init
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose up -d
```

Con `COMPOSE_FILE` in `.env`, un semplice `docker compose` legge `compose.full.yaml`, così ogni comando
in questi documenti funziona così com'è. I servizi, la rete e i volumi di Kept sono gli stessi in
entrambi i file: un'installazione può passare dall'uno all'altro in qualsiasi momento e conservare i
suoi dati.

## 1. Scrivi `.env`

```sh
docker compose run --rm init
```

`init` chiede **l'indirizzo a cui aprirai Kept**, come `http://kept.home.arpa:8080` o
`https://kept.example.org`. Link, codici QR sulle etichette stampate e il controllo same-site vengono
costruiti da esso, quindi deve corrispondere esattamente a ciò che il browser mostra, e non dovrebbe
cambiare: **usa un nome invece che un indirizzo IP.** Un router domestico può un giorno assegnare a
questa macchina un nuovo indirizzo, e le etichette stampate punterebbero allora da nessuna parte. Imposta
il nome nel DNS del router, o nel file hosts di ogni dispositivo. Un indirizzo IP funziona comunque se
lo confermi.

Poi scrive `.env` accanto a `compose.yaml` con quell'indirizzo (`KEPT_PUBLIC_URL`), la porta
(`KEPT_HTTP_PORT`, da un indirizzo `http://`), l'immagine e un codice di setup (`KEPT_SETUP_CODE`), e
mostra il codice. `.env` non contiene password ed è leggibile solo da te. Esegui di nuovo `init` per
cambiare l'indirizzo: aggiorna quelle righe e mantiene tutto il resto che hai aggiunto. Senza terminale,
dai l'indirizzo sulla riga di comando: `docker compose run --rm init --url http://kept.home.arpa:8080`.

Tutto il resto è opzionale; `compose.env.example` e il
[riferimento alla configurazione](/it/reference/configuration/) indicano cosa fa ogni variabile.

## 2. Avvialo

```sh
docker compose up -d
```

Compose avvia il database e aspetta che sia sano. Poi:

- **`bootstrap`** (one-shot, `kept bootstrap`) crea i quattro login del database di Kept e le estensioni
  `pg_trgm`, `unaccent` e `vector`. Al primo avvio genera la password di ogni login in un volume; a
  ogni avvio imposta la password di ogni login a quel valore, così Postgres e Kept sono sempre
  d'accordo.
- **`migrate`** (one-shot, `kept migrate`) applica le migrazioni del database una volta sola, sotto
  blocco.
- **Kept** si avvia sulla porta 8080 (`KEPT_HTTP_PORT` cambia la porta dell'host).

## 3. Completa il setup

Apri l'indirizzo, inserisci il codice di setup che `init` ha mostrato, e crea il primo account: diventa
l'admin dell'istanza. Kept stampa anche il codice nel suo log al primo avvio:

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

Un codice smarrito viene riemesso con:

```sh
docker compose run --rm migrate admin setup-code
```

Codici sbagliati bloccano l'accesso per un po', per indirizzo e per tutta l'istanza. Se Kept si trova
dietro un proxy che non considera affidabile, tutti condividono l'indirizzo del proxy; vedi
[proxy inversi](/it/install/reverse-proxy/).

## 4. Tieni al sicuro le chiavi

Al primo avvio, con `KEPT_SECRET_KEY` e `KEPT_AUTH_SECRET` non impostate, Kept genera entrambe nel
volume `kept-config` e scrive nel log una riga che indica dove. La chiave segreta sigilla ogni valore
segreto (chiavi AI, le password che archivi in Kept): **un backup ripristina tutto tranne quei valori, a
meno che tu non abbia anche la chiave.**

Stampa le chiavi e tienile da qualche altra parte oltre a questo server, come un gestore di password:

```sh
docker compose exec kept kept admin recovery-kit
```

Admin → Status ti chiede di confermare il kit di recupero, e Kept lo richiede prima del primo valore
segreto, chiave AI o impostazione di backup. Vedi [il kit di recupero](/it/admin/recovery-kit/).

## 5. Prossimi passi

- [Metti Kept su HTTPS](/it/install/https/): la fotocamera, l'installazione dell'app, le notifiche push e
  la posizione funzionano solo su HTTPS.
- [Configura i backup](/it/admin/backups/).
- Mail: imposta `KEPT_SMTP_URL` (`smtp://` o `smtps://`, con credenziali) e `KEPT_SMTP_FROM` per i
  reset della password, gli inviti e i promemoria via email. Senza di essi, i promemoria arrivano alle
  persone solo nell'app, e Admin → Status dice che la mail non è configurata.

## Cosa crea Compose

| Volume | Contiene | Backup? |
|---|---|---|
| `kept-db` | il database Postgres | tramite il backup di Kept, mai copiando il volume mentre è in esecuzione |
| `kept-data` | file caricati (con `KEPT_STORAGE=local`, il default) | tramite il backup di Kept |
| `kept-config` | `KEPT_SECRET_KEY` e `KEPT_AUTH_SECRET` generate, e le password dei login `kept_app`, `kept_auth` e `kept_system` | conserva il kit di recupero; le password vengono rigenerate se perse |
| `kept-owner` | la password del login `kept_owner` | no; viene rigenerata se persa |
| `caddy-data`, `caddy-config` | i certificati di Caddy (profilo `https` di `compose.full.yaml`) | no; Caddy ne ottiene di nuovi |

Il superutente del database non ha password che serva a qualcuno: si raggiunge solo dall'interno del
container del database, come `docker compose exec db psql -U postgres`, e dal bootstrap, che condivide la
rete di quel container. Sulla rete ogni login richiede la propria password. Non pubblicare mai la porta
del servizio `db` (niente `ports:` su di esso): Kept lo raggiunge attraverso la rete di compose.

I container di Kept girano come utente non-root (uid 10001) con filesystem root in sola lettura, tutte
le capability Linux revocate e `no-new-privileges`. Il servizio `migrate` detiene il login del
proprietario del database; il container che serve non lo vede mai (il volume `kept-owner` non è montato
lì) finché non gliene dai uno per il backup notturno ([backup](/it/admin/backups/#come-attivarlo)). `init`
è l'unica eccezione alla regola non-root: gira come root, senza rete e con solo le capability che creano
`.env` nella tua cartella e te lo danno, poi esce.

## Senza terminale

Portainer, Dockge e strumenti simili prendono `compose.yaml` (o `compose.full.yaml`) così com'è. Non
eseguono `init`, quindi imposta invece due variabili nel loro editor di ambiente: `KEPT_PUBLIC_URL`
(l'indirizzo, come sopra) e `KEPT_SETUP_CODE` (sei caratteri tra 0–9 e A–Z senza I, L, O e U, come
`KPT-2X9`; oppure lascialo vuoto e leggi il codice dal log di Kept). Fissa `KEPT_IMAGE` a una release
se lo strumento non lo fa.

## Un'installazione precedente alla 1.13.0

Un'installazione fatta con una copia del repository ha le cinque righe `KEPT_DB_*_PASSWORD` in `.env`. Con
questo `compose.yaml` vengono usate esattamente come date, e non viene generato nulla: aggiorna il
checkout (o scarica il nuovo `compose.yaml` accanto al vecchio `.env`) ed esegui `docker compose up -d`.
Rimuovere quelle righe in seguito, o riscrivere `.env` con `init`, è comunque sicuro: l'avvio successivo
genera nuove password e le imposta in Postgres. Un `KEPT_IMAGE` vuoto serviva a compilare il checkout; ora
esegue la release che `compose.yaml` indica, quindi imposta `KEPT_IMAGE=kept:local` se compili tu.

## Web e worker da soli

Un container serve l'app web e esegue i job in background (`KEPT_ROLE=all`, il default). Per separarli,
esegui un secondo servizio Kept con `KEPT_ROLE=worker` accanto a uno con `KEPT_ROLE=web`. Un worker non
serve HTTP; l'healthcheck dell'immagine segue `KEPT_ROLE` e controlla invece il loop dei job del worker,
quindi nessuno dei due richiede un override (`compose.full.yaml` ha i due servizi commentati). Il worker
esegue il backup notturno, quindi è quello che ha bisogno del login owner e del mount di un obiettivo
directory.
