---
title: Installare su Unraid
description: Installa Kept dalle Community Applications di Unraid come un solo container, Kept e il suo database, con tutto nella cartella appdata.
sidebar:
  order: 2
  label: Unraid
---

Kept gira su Unraid come un solo container dalle **Community Applications** (la scheda **Apps**):
Kept e il suo database PostgreSQL, tutto in `/mnt/user/appdata/kept`. Niente Compose, nessuna
password da inventare.

## Cosa ti serve

| | |
|---|---|
| Unraid | Con la scheda **Apps** (il plugin Community Applications) |
| Memoria | Circa 500 MB liberi per Kept e il suo database, 1 GB per importazioni e backup |
| Un indirizzo | Quello a cui aprirai Kept, come `http://tower.local:8080`. Usa un nome invece di un indirizzo IP: le etichette stampate lo riportano |

## Installare

1. **Apps**, cerca **Kept**, poi **Install**.
2. **Kept's address**: l’indirizzo a cui aprirai Kept, senza percorso. Il resto può restare
   com’è. **Show more settings** contiene le impostazioni facoltative: posta, accesso con OIDC e
   Google, un reverse proxy, la registrazione.
3. **Apply.** Unraid scarica l’immagine e avvia il container.
4. Scheda **Docker**, l’icona di Kept, **Logs**: il codice di configurazione.

   ```text
   app: Kept is at http://tower.local:8080
   KEPT SETUP CODE: XXX-XXX
   ```

5. L’icona di Kept, **WebUI**. Kept mostra **Inserisci il codice di configurazione**: digita il
   codice, poi **Crea il primo account**. Diventa l’amministratore dell’istanza.
6. **Conserva le chiavi.** L’icona di Kept, **Console**, poi:

   ```sh
   kept admin recovery-kit
   ```

   Copia il testo che inizia con `KEPT RECOVERY KIT` in un posto diverso da questo server, come un
   gestore di password. Senza le chiavi, un backup non riporta indietro i valori segreti.

Il primo avvio crea il database e richiede circa un minuto. Docker segnala il container come sano
non appena Kept risponde.

## Cosa c’è nella cartella appdata

| Cartella | Cosa |
|---|---|
| `postgres/` | Il database in uso. Dell’utente `postgres` del container |
| `kept/` | Foto e file. Dell’uid 10001, l’utente con cui gira Kept |
| `config/` | Le chiavi di Kept (`secrets.json`) e le password del database. Dell’uid 10001 |
| `owner/` | La password del proprietario del database. Solo di root: il processo di Kept non la legge mai |
| `backup/kept.pgdump` | Un dump del database, scritto a ogni arresto del container |

Il container parte come root, assegna queste cartelle ai loro proprietari, poi avvia Postgres e
Kept con i loro utenti. La cartella stessa resta di root: nessun altro può elencarne il contenuto.

## Backup

- **Fai il backup della cartella appdata** a container fermo, per esempio con il plugin Appdata
  Backup di Unraid. Un arresto scrive prima `backup/kept.pgdump`, quindi il backup contiene una
  copia coerente del database anche se i file in uso non lo sono.
- **Ripristino:** rimetti la cartella al suo posto e avvia Kept. Senza cartella `postgres/` e con un
  dump in `backup/`, Kept ripristina il database dal dump all’avvio; il log dice
  `database restored from the backup`.
- **I backup notturni di Kept** (Admin → Backup) non sono predisposti in questo container: servono
  le credenziali del proprietario del database, che il Kept in esecuzione non ha. Fai il backup
  della cartella appdata.

## Aggiornamenti

Il modello segue la versione principale di Kept (`kept-unraid:1`). Quando esce una release, la scheda
**Docker** mostra un aggiornamento per Kept: **apply update**. Il container si ferma (scrivendo il
suo dump), parte la nuova immagine e Kept aggiorna il database all’avvio.

## L’indirizzo di Kept

Cambialo nel modello (l’icona di Kept, **Edit**) e **Apply**. Per servire Kept in https, metti un
reverse proxy davanti alla porta 8080, imposta **Kept's address** sul suo indirizzo https e
**Trusted reverse proxies** sull’indirizzo del proxy come lo vede Kept
([dietro un reverse proxy](/it/install/reverse-proxy/)). La fotocamera, l’installazione dell’app
sul telefono, le notifiche push e le passkey richiedono https
([Kept su una rete domestica](/it/install/home-network/)).

## Rimozione

1. Scheda **Docker**, l’icona di Kept, **Remove**. La cartella appdata resta.
2. Per rimuovere anche i dati, cancella `/mnt/user/appdata/kept`, dal terminale o da un file
   manager. Non si può annullare: fai prima un backup se potresti volerli indietro.
