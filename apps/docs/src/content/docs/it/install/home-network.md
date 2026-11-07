---
title: Kept su una rete di casa
description: Esegui Kept sulla tua rete di casa con HTTP in chiaro - cosa funziona, cosa richiede HTTPS e perché, e i due modi per aggiungere HTTPS senza un dominio pubblico - Tailscale o Caddy con la sua autorità di certificazione.
sidebar:
  order: 3
---

Kept funziona sulla tua rete di casa a un indirizzo `http://` in chiaro, come `http://192.0.2.20:8080`
o `http://kept.home.arpa:8080`. I tuoi dati funzionano lì: aggiungere, trovare e spostare oggetti,
foto e file, etichette, report, importazioni ed esportazioni senza valori segreti.

Alcune cose richiedono HTTPS. Alcune perché Kept rifiuta di consegnare una chiave o mostrare un segreto su una connessione che chiunque sulla rete può leggere; altre perché i browser le permettono solo su un indirizzo sicuro, cosa che Kept non può modificare.

## Cosa funziona con HTTP in chiaro

| | Con HTTP in chiaro | Perché |
|---|---|---|
| Oggetti, posti, ricerca, spostamenti, etichette, report | Funziona | |
| Foto e file, scelti dal dispositivo | Funziona | |
| Importazione (Homebox, CSV, un'esportazione di Kept) | Funziona | |
| Aprire i segreti di un'esportazione durante l'importazione | Richiede HTTPS. Con HTTP in chiaro il resto dell'esportazione viene importato senza di essi | Kept: la passphrase e i valori segreti |
| Esportazione senza valori segreti | Funziona. Ogni valore segreto viene omesso e segnato come omesso; l'esportazione viene importata come al solito | I tuoi dati |
| Impostare un valore segreto | Funziona | |
| Mostrare un valore segreto | Richiede HTTPS | Kept: un segreto non viene mai inviato su HTTP in chiaro |
| Esportazione con valori segreti | Richiede HTTPS | Kept: i segreti e la loro passphrase |
| Token per app IA (MCP) e Home Assistant | Non dal browser. Creane uno sul server: `kept admin token create` ([CLI](/it/admin/cli/#un-token-dal-server)) | Kept: un token è una chiave |
| Collegare un'app con OAuth (un connettore) | Richiede HTTPS | Kept: OAuth richiede un indirizzo sicuro |
| Scaricare il kit di ripristino | Non dal browser. Sul server: `kept admin recovery-kit` ([CLI](/it/admin/cli/)) | Kept: contiene le chiavi del server |
| Impostazioni di backup e il loro test | Richiede HTTPS, oppure impostale nell'ambiente del server ([configurazione](/it/reference/configuration/)) | Kept: la password del backup |
| Passkey | Richiede HTTPS | Il browser: niente passkey su un indirizzo HTTP in chiaro |
| Fotocamera, installare Kept, lavorare offline, notifiche push, posizione | Richiede HTTPS | Il browser |

Con HTTP in chiaro anche un accesso dura 12 ore e non viene rinnovato; con HTTPS dura 30 giorni. Per cambiare le 12 ore, consulta [Restare sulla tua rete](#restare-sulla-tua-rete).

La sezione Inizia da Home chiede a un amministratore dell'istanza di mettere Kept su HTTPS. Se resti sulla tua rete di casa, scegli **Resto sulla mia rete di casa** e il passaggio conta come completato. Anche la riga HTTPS in alto su ogni pagina si può chiudere.

`localhost` conta come indirizzo sicuro nei browser, ma Kept segue `KEPT_PUBLIC_URL`: finché è
`http:`, le funzioni che Kept rifiuta sopra valgono anche su `localhost`.

## Restare sulla tua rete

Chi gestisce Kept può cambiare due cose sul server: quanto dura un accesso con HTTP in chiaro e a quali indirizzi Kept risponde. Nessuna delle due si può cambiare dall'app; Admin → Status mostra ciò che è in vigore.

### Accessi più lunghi con HTTP in chiaro

Con HTTP in chiaro ti accedi di nuovo ogni 12 ore. `KEPT_HTTP_SIGN_IN_DAYS` in `.env` lo rende
tanti giorni, da 1 a 30, rinnovati mentre lo usi. 7 va bene per una rete di casa o Tailscale:

```sh
KEPT_HTTP_SIGN_IN_DAYS=7
```

Poi `docker compose up -d`. Nell'app Home Assistant è l'opzione **Sign-in length over http**.

Un'installazione aggiornata dalla 1.14.4 cambiando solo `KEPT_IMAGE` ha ancora il vecchio `compose.yaml`,
che non passa questa impostazione: [scarica quello nuovo](/it/admin/upgrades/#impostazioni-che-richiedono-il-nuovo-composeyaml)
prima.

**Il costo:** con HTTP in chiaro un cookie di accesso può essere copiato da chiunque veda il traffico.
Con l'impostazione attiva, una copia continua a funzionare finché viene usata, finché quel dispositivo si disconnette o i tuoi altri dispositivi vengono disconnessi. Quindi limitati a una rete di cui ti fidi, e disconnettiti su un dispositivo che perdi.

| | Non impostato | Impostato |
|---|---|---|
| Un accesso con HTTP in chiaro dura | 12 ore | Tanti giorni |
| Rinnovato | No | Una volta al giorno di utilizzo (a 1 giorno, dopo mezza giornata) |
| Con HTTPS | 30 giorni, rinnovato | 30 giorni, rinnovato: l'impostazione non fa nulla |
| Segreti e chiavi su HTTP in chiaro | Rifiutati | Rifiutati |
| Azioni sensibili | Password, oppure un accesso negli ultimi dieci minuti | Lo stesso; un rinnovo non conta come accesso |
| Disconnetti ovunque | Termina ogni accesso | Termina ogni accesso |

Qualsiasi altro valore (0, 31, `7d`) ferma Kept all'avvio con un messaggio che dice cosa è richiesto. Lasciarlo
vuoto equivale a non impostarlo.

Se attivato, un accesso già fatto assume la durata più lunga la prossima volta che viene usato. Se disattivato, uno
scade con i suoi tempi, fino alla durata che aveva; per terminarli prima, usa **Disconnetti ovunque**
in Admin → Users.

### Più di un indirizzo

Kept accetta accessi e salvataggi solo da `KEPT_PUBLIC_URL`, quindi un secondo modo per raggiungere lo stesso Kept,
un nome Tailscale accanto a un nome LAN o un IP accanto a un nome, dice "Questo Kept è configurato per …".
`KEPT_EXTRA_ADDRESSES` elenca gli altri, separati da virgola, esattamente come li mostra il browser:

```sh
KEPT_PUBLIC_URL=http://kept.lan:8080
KEPT_EXTRA_ADDRESSES=http://192.0.2.20:8080,http://<machine>.<tailnet>.ts.net:8080
```

Poi `docker compose up -d`. Nell'app Home Assistant è l'opzione **Extra addresses**. Funziona
allo stesso modo con HTTPS.

Un'installazione aggiornata dalla 1.14.4 cambiando solo `KEPT_IMAGE` ha ancora il vecchio `compose.yaml`,
che non passa questa impostazione: [scarica quello nuovo](/it/admin/upgrades/#impostazioni-che-richiedono-il-nuovo-composeyaml)
prima.

| | `KEPT_PUBLIC_URL` | Un indirizzo extra |
|---|---|---|
| Usare Kept, accedere con password o codice monouso | Sì | Sì |
| Link email o reimpostazione password | Si apre qui | Si apre a `KEPT_PUBLIC_URL` |
| Passkey | Sì, con HTTPS | No; una passkey appartiene a un solo indirizzo |
| Accesso con Google e OIDC | Sì | Il pulsante apre `KEPT_PUBLIC_URL` |
| App IA (MCP, OAuth) | Sì | Collegali su `KEPT_PUBLIC_URL`: `/mcp` rifiuta questo indirizzo e il consenso OAuth è rifiutato qui |
| Link, etichette, codici QR, posta, feed calendario | Puntano qui | Puntano ancora a `KEPT_PUBLIC_URL` |

- **Ogni indirizzo accede separatamente e si installa come app a sé,** perché i browser conservano cookie
  e dati offline per indirizzo. Disconnettersi su uno lascia connesso l'altro; **Disconnetti ovunque**
  termina entrambi. Le notifiche push, dove HTTPS le permette, si aprono sull'indirizzo su cui il
  dispositivo le ha attivate. Due porte su un stesso nome host condividono i cookie: i browser non li conservano
  per porta.
- **Un link email** richiesto su un indirizzo extra si apre su `KEPT_PUBLIC_URL` e ti accede lì,
  non dove lo hai richiesto. Una reimpostazione della password imposta la password lì; poi accedi sull'indirizzo su cui
  eri. Se `KEPT_PUBLIC_URL` non è raggiungibile da dove ti trovi, usa la tua password.
- **Passkey:** aggiungile e usale su `KEPT_PUBLIC_URL`. Un indirizzo extra offre la tua password o un
  link email e spiega il perché.
- **Indirizzi esatti:** schema, host e porta, confrontati per intero. `http://kept.lan` non è
  `http://kept.lan:8080`, e `kept.lan.example.com` non è `kept.lan`. Un carattere jolly, un percorso, un accesso o
  un mix di `http` e `https` ferma Kept all'avvio con un messaggio che dice quale. Lasciarlo vuoto equivale
  a non impostarlo.
- **Intestazioni inoltrate:** `Host` e `X-Forwarded-*` non hanno alcun ruolo, quindi il tuo proxy non può aggiungere un indirizzo
  per errore, né toglierne uno. Punta il proxy a Kept per ogni indirizzo che elenchi.

**Il costo:** una pagina servita a un indirizzo elencato conta come lo stesso Kept e può usare l'accesso di
chi la apre lì. Quindi elenca solo indirizzi che raggiungono questo Kept, su nomi e IP che controlli.

## Aggiungere HTTPS: prima Tailscale

Il minimo lavoro per una famiglia: installa Tailscale sulla macchina che esegue Kept e su ogni telefono
e computer che lo usa, attiva i certificati HTTPS per la tua tailnet e servi Kept con

```sh
tailscale serve --bg 8080
```

Kept è quindi su `https://<machine>.<tailnet>.ts.net`, con un certificato di cui ogni dispositivo già
si fida, da casa o lontano. Imposta `KEPT_PUBLIC_URL` su quell'indirizzo e riavvia Kept. Altro in
[Metti Kept su HTTPS](/it/install/https/#tailscale).

## Aggiungere HTTPS: Caddy con la sua autorità di certificazione

Senza Tailscale e senza un dominio pubblico, Caddy può firmare un certificato per un nome della rete di casa
da solo (`tls internal`). Funziona, ma non è rapido: **ogni dispositivo che apre Kept va istruito a
fidarsi del certificato root di Caddy**, uno per uno, per ogni persona in casa. Finché un dispositivo
non si fida, il suo browser mostra un avviso di sicurezza.

1. Scegli un nome che ogni dispositivo possa risolvere verso la macchina, per esempio `kept.home.arpa` (una voce DNS
   sul tuo router, o una voce nel file hosts di ogni dispositivo).
2. Impostalo in `.env`:

   ```sh
   KEPT_DOMAIN=kept.home.arpa
   KEPT_PUBLIC_URL=https://kept.home.arpa
   ```

3. Caddy è fornito con `compose.full.yaml`: scaricalo insieme a `docker/caddy/Caddyfile` e imposta
   `COMPOSE_FILE=compose.full.yaml` in `.env`, come in
   [Metti Kept su HTTPS](/it/install/https/#profilo-caddy-di-compose). Poi aggiungi `tls internal` al
   Caddyfile:

   ```caddy
   {$KEPT_DOMAIN} {
   	tls internal
   	encode zstd gzip
   	reverse_proxy kept:8080
   }
   ```

4. Avvia Caddy e copia il suo certificato root fuori dal volume dei dati:

   ```sh
   docker compose --profile https up -d
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./kept-root.crt
   ```

5. Installa `kept-root.crt` su ogni dispositivo e fidatene:
   - **iPhone e iPad:** invialo al dispositivo (AirDrop o mail), installa il profilo in
     Impostazioni → Generali → VPN e gestione dispositivi, poi attiva la fiducia completa in Impostazioni →
     Generali → Info → Impostazioni fiducia certificati.
   - **Android:** nelle impostazioni di sicurezza, installalo come certificato CA (il nome del menu varia
     in base al produttore). Alcune app ignorano i certificati installati dall'utente.
   - **Computer:** aggiungilo ai certificati attendibili del sistema (Accesso Portachiavi su Mac, il
     gestore certificati su Windows, lo store CA della distribuzione su Linux). Firefox può mantenere la
     propria lista.

La root di Caddy dura dieci anni; i certificati che firma con essa si rinnovano da soli. La chiave
privata della root resta nel volume `caddy-data`: chiunque la copi può firmare per qualsiasi nome a cui i tuoi
dispositivi ora si fidano, quindi proteggi quel volume come una password. [mkcert](/it/install/https/#un-certificato-fidato-solo-dai-tuoi-dispositivi) è la stessa idea con
un altro strumento.

## Aprire Kept all'indirizzo giusto

Apri Kept all'indirizzo in `KEPT_PUBLIC_URL`. Aperto a un altro (per esempio l'indirizzo IP della macchina
mentre l'URL chiama `kept.home.arpa`), l'accesso dice a quale indirizzo questo Kept è configurato,
con un link per raggiungerlo.
