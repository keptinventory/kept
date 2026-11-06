---
title: Dietro un reverse proxy
description: Le impostazioni che contano quando Kept è dietro nginx, Traefik, Caddy o un altro proxy - indirizzi fidati, dimensioni degli upload, quale hostname usare, l'errore dell'indirizzo e HSTS.
sidebar:
  order: 3
---

Kept è in ascolto sulla porta 8080 e parla HTTP in chiaro; il proxy davanti a lui termina il TLS. Indirizza il proxy verso la porta 8080, imposta `KEPT_PUBLIC_URL` all'indirizzo che le persone aprono e verifica le cose qui sotto. Il [profilo Caddy](/it/install/https/#profilo-caddy-di-compose) di Compose fa già le prime tre.

## Fidati del proxy, e solo del proxy

Kept applica un rate limit all'accesso, ai codici di setup e ad altre richieste sensibili **per indirizzo client**. Dietro un proxy, l'indirizzo del client arriva in `X-Forwarded-For`, che chiunque può scrivere. Kept gli crede solo dagli indirizzi in `KEPT_TRUSTED_PROXIES`:

```sh
KEPT_TRUSTED_PROXIES=10.0.0.5            # one proxy
KEPT_TRUSTED_PROXIES=10.0.0.5,10.0.1.0/24  # several, or a range
```

Kept percorre `X-Forwarded-For` da destra e si ferma al primo indirizzo di cui non si fida: quello è il client. Vuoto (il valore predefinito): il client è l'indirizzo del socket. Elenca l'indirizzo del proxy come lo vede Kept (sulla rete di Docker, l'indirizzo del container del proxy, non quello dell'host), e nient'altro da cui uno sconosciuto potrebbe inviare richieste.

Con Compose, mettilo in `.env` accanto a `compose.yaml`. Prima della 1.14.5, `compose.yaml` impostava il proprio valore e una riga in `.env` non arrivava mai a Kept; in quelle versioni impostalo per il servizio `kept` in un `compose.override.yaml`. Con il Caddy di `compose.full.yaml`, lascialo vuoto (l'indirizzo di Caddy è quello predefinito) o mantieni `172.29.72.200` nell'elenco.

### Il blocco del setup

I codici di setup sbagliati bloccano per un po' l'indirizzo che li ha inviati, e molti codici sbagliati bloccano l'intera istanza. Se il proxy non è in `KEPT_TRUSTED_PROXIES`, ogni visitatore condivide l'indirizzo del proxy, quindi i tentativi di una persona bloccano tutti. `kept admin setup-code` genera un nuovo codice e rimuove il blocco a livello di istanza, ma non quello per indirizzo: quello si risolve da solo.

## Lascia passare gli upload

Il proxy deve accettare un corpo di richiesta almeno grande quanto quello di Kept, e non dovrebbe mettere in buffer gli upload di cui non ha bisogno:

| Upload | Limite di Kept |
|---|---|
| Una foto, una ricevuta o un documento | `KEPT_MAX_FILE_MB`, 25 MB per impostazione predefinita; inviato in streaming, rifiutato con 413 prima di essere letto se troppo grande |
| Un'importazione CSV | 8 MB |

Il valore predefinito della maggior parte dei proxy è più piccolo (per esempio `client_max_body_size` di nginx); portalo almeno a `KEPT_MAX_FILE_MB`. I timeout dovrebbero permettere un upload grande su una connessione telefonica lenta.

## Dai a Kept un proprio hostname

Servi Kept su un hostname il cui dominio padre non ha siti che non controlli, oppure su un dominio tutto suo. Con HTTPS il cookie di sessione di Kept ha il prefisso `__Secure-`, il che permette comunque a una pagina su un sottodominio **fratello** (`other.example.org` accanto a `kept.example.org`) di impostare un cookie per `example.org` che i browser inviano anche a Kept. Un fratello gestito da qualcun altro potrebbe usarlo per fissare una sessione. I tuoi altri servizi su sottodomini fratelli vanno bene.

## "Questo Kept è configurato per …"

L'app dice "Questo Kept è configurato per *indirizzo*. Aprilo lì." quando è aperta a un indirizzo diverso da `KEPT_PUBLIC_URL`.

- **Perché:** Kept accetta scritture solo dall'indirizzo in `KEPT_PUBLIC_URL`, tramite l'`Origin` del browser: schema, host e porta, esattamente. Il proxy non c'entra; il proprio indirizzo e le intestazioni `X-Forwarded-*` non lo cambiano.
- **Soluzione:** imposta `KEPT_PUBLIC_URL` esattamente all'indirizzo che le persone aprono (`https://kept.example.org`, non l'upstream del proxy `http://kept:8080`), e riavvia Kept.
- **Più di un indirizzo:** `KEPT_EXTRA_ADDRESSES` elenca gli altri, e ognuno deve raggiungere Kept anche tramite il tuo proxy ([Più di un indirizzo](/it/install/home-network/#più-di-un-indirizzo)).

Altro in [Risoluzione dei problemi](/it/admin/troubleshooting/#questo-kept-è-configurato-per--oppure-la-richiesta-non-proveniva-da-questo-sito).

## HSTS

Se `KEPT_PUBLIC_URL` usa `https:`, Kept invia `Strict-Transport-Security: max-age=31536000`: i browser aprono quindi questo hostname solo su https, per un anno. Su `http:` non invia nulla.

- **Tutto l'hostname, ogni porta:** il browser applica la policy all'hostname, non alla porta di Kept. Un servizio http in chiaro con lo stesso nome, come `http://server.lan:8081` accanto a Kept su `https://server.lan`, viene quindi forzato su https e smette di caricarsi. I browser ignorano l'HSTS proveniente da un indirizzo IP.
- **Disattivalo:** imposta `KEPT_HSTS=off` quando altri servizi http in chiaro condividono l'hostname di Kept, e riavvia. Kept invia quindi `max-age=0`, così un browser che aveva memorizzato la policy la dimentica alla visita https successiva a Kept. Omettere l'intestazione non la cancellerebbe.
- **Il tuo proxy:** se aggiunge una propria intestazione `Strict-Transport-Security`, disattivala anche lì.
- **Domini precaricati:** sotto un dominio di primo livello nella lista di precaricamento HSTS dei browser, come `.dev` o `.app`, ogni nome è solo https, qualunque cosa invii Kept.

### Cancella a mano una policy salvata

Quando Kept non è più raggiungibile su https, `max-age=0` non può arrivare al browser. Cancella l'hostname in ogni browser che lo ha visitato:

- **Chrome, Edge e altri browser Chromium:** apri `chrome://net-internals/#hsts` (in Edge, `edge://net-internals/#hsts`), inserisci l'hostname sotto **Elimina le policy di sicurezza del dominio**, e scegli **Elimina**.
- **Firefox:** Cronologia → Gestisci la cronologia, trova il sito, fai clic col pulsante destro e scegli **Dimentica questo sito**. Rimuove anche la cronologia del sito, i cookie e gli accessi salvati.
- **Safari su Mac:** non ha una pagina per HSTS. Rimuovi i dati del sito (Impostazioni → Privacy → Gestisci dati dei siti web, selezionalo, **Rimuovi**); se l'http in chiaro diventa ancora https, cancella anche la cronologia (Cronologia → Cancella cronologia).
- **Safari su iPhone o iPad:** Impostazioni → App → Safari (Impostazioni → Safari prima di iOS 18) → Avanzate → Dati dei siti web, trova il sito ed eliminalo; se non basta, **Cancella cronologia e dati dei siti web** nella pagina di Safari.
