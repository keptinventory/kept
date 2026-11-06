---
title: Risoluzione dei problemi
description: Modalità di errore reali di un server Kept, la causa di ciascuna e la soluzione.
---

Ogni voce è un sintomo, la sua causa e la soluzione. I comandi presuppongono Docker Compose; con Helm gli stessi controlli si applicano ai pod.

## Prima di tutto, controlla

- **Admin → Stato** elenca da sola la maggior parte dei problemi: posta, job in background falliti, scansione dei promemoria, backup e prova di ripristino, dischi, release e relative migrazioni, HTTPS.
- **I log:** `docker compose logs kept` e `docker compose logs migrate`. `KEPT_LOG_FORMAT=pretty` li rende leggibili ad occhio; `KEPT_LOG_LEVEL` (predefinito `info`) imposta il livello.
- **Un id della richiesta:** ogni risposta porta `x-request-id`; cerca nel log per trovare la riga che appartiene a una segnalazione.
- **Le probe:** `/healthz` (il processo serve HTTP), `/readyz` (entrambe le connessioni al database rispondono), `/version` (versione, commit, sorgente). Vedi [monitoraggio](/it/admin/observability/).
- **Controlli da eseguire:** `kept admin backup verify`, `kept admin storage verify --store local` (oppure `s3`) e `kept admin config` ([la CLI](/it/admin/cli/)).

## `docker compose up` si ferma al servizio `bootstrap`

**Causa:** il `bootstrap` one-shot (`kept bootstrap`) non ha potuto configurare i login del database. Il suo log spiega perché: `docker compose logs bootstrap`. I casi più comuni: l'immagine è precedente alla 1.13.0 e non ha il comando `bootstrap` (imposta `KEPT_IMAGE` a 1.13.0 o successiva); oppure il loopback del database è stato configurato per richiedere una password, e `KEPT_DB_SUPERUSER_PASSWORD` in `.env` non la contiene.

**Soluzione:** correggi quanto la riga nomina ed esegui di nuovo `docker compose up -d`; il bootstrap è sicuro da eseguire un numero qualsiasi di volte.

## Kept si ferma all'avvio con `kept: invalid environment: …` o un'altra riga `kept:`

**Causa:** l'ambiente viene controllato prima dell'avvio, e il primo problema blocca il processo con una riga che lo nomina. I più comuni:

| La riga dice | Soluzione |
|---|---|
| `kept: invalid environment: KEPT_PUBLIC_URL` | Imposta l'indirizzo: `docker compose run --rm init` ([installazione](/it/install/compose/#1-scrivi-env)) |
| `KEPT_DATABASE_URL has no password, and KEPT_DB_APP_PASSWORD_FILE: … does not exist` | Il bootstrap non è stato eseguito: avvia con `docker compose up -d`, che lo esegue prima, non `docker compose up kept` da solo |
| `KEPT_SECRET_KEY and KEPT_AUTH_SECRET are set together or not at all` | Imposta entrambe oppure non impostarne nessuna per usare la coppia generata nel volume di configurazione |
| `<path>/secrets.json exists but …; fix or restore it` | Il file delle chiavi generate è danneggiato: rimetti le chiavi dal [kit di ripristino](/it/admin/recovery-kit/) |
| `KEPT_BACKUP_DIR is inside KEPT_DATA_DIR …` | Punta il backup su un altro disco |
| `a backup target is set, and the nightly backup dumps the database as kept_owner …` | Dai al worker `KEPT_OWNER_DATABASE_URL` ([i backup](/it/admin/backups/#come-attivarlo)) |
| `set one backup target, not …` | Mantieni solo una tra `KEPT_BACKUP_DIR`, `KEPT_BACKUP_S3_BUCKET`, `KEPT_BACKUP_SFTP` |
| `KEPT_STORAGE=s3 needs …` | Aggiungi le impostazioni S3 che nomina ([archiviazione](/it/admin/storage/)) |
| `KEPT_OIDC_ISSUER is set without KEPT_OIDC_CLIENT_ID` | Aggiungi il client id, oppure non impostare l'issuer |

Ogni variabile è nel [riferimento di configurazione](/it/reference/configuration/).

## Password del database cambiata in `.env`, e ora nulla si connette

**Causa:** con il `compose.yaml` di Kept 1.13.0 questo si risolve da solo: il bootstrap imposta la password di ogni login a quella in `.env` (o nel suo file) a ogni `docker compose up -d`. Accade con un `compose.yaml` più vecchio, che ha impostato le password una sola volta, quando il volume `kept-db` è stato creato per la prima volta.

**Soluzione:** usa il `compose.yaml` attuale ed esegui `docker compose up -d`. Con quello vecchio, cambia la password del ruolo in Postgres per farla corrispondere, poi riavvia:

```sh
docker compose exec db psql -U postgres -c "ALTER ROLE kept_app PASSWORD '<the new password>'"
```

(Il ruolo è `kept_owner`, `kept_app`, `kept_auth` o `kept_system`, in base alla variabile.)

## `/readyz` risponde 503

**Causa:** una delle due connessioni al database del web (`app` e `system`, mostrate come `false` nel corpo della risposta) non riesce a eseguire una query. Nel log compare `readiness check failed`. All'avvio, Kept aspetta circa due minuti per un database che si sta ancora avviando prima di arrendersi.

**Soluzione:** verifica che `docker compose ps db` sia healthy e che il login indicato da `false` abbia la password giusta (sopra). Su Postgres gestito, verifica che esistano i quattro login ([Postgres gestito](/it/install/managed-postgres/#i-quattro-login)).

## "Questo Kept è configurato per …" oppure "La richiesta non proveniva da questo sito."

- **L'app:** "Questo Kept è configurato per *address*. Aprilo lì.", nella pagina di accesso o come striscia sopra l'app quando un salvataggio viene rifiutato.
- **L'API:** 403, "La richiesta non proveniva da questo sito."

**Causa:** una scrittura che porta il cookie di Kept deve provenire dall'origine esatta di `KEPT_PUBLIC_URL`, oppure da uno degli indirizzi in `KEPT_EXTRA_ADDRESSES`: schema, host e porta. Kept la confronta con l'header `Origin` del browser, che è l'indirizzo nella barra degli indirizzi; un reverse proxy nel mezzo non cambia nulla. Aprire Kept a un altro indirizzo (un IP invece del nome, `http` invece di `https`, una porta diversa, l'indirizzo interno del proxy) rende ogni scrittura una 403. Link, codici QR e mail di invito vengono costruiti dallo stesso valore, e le passkey vengono registrate per il suo nome host.

**Soluzione:** imposta `KEPT_PUBLIC_URL` esattamente su quello che mostra la barra degli indirizzi del browser, riavvia e apri sempre Kept lì. Se raggiungi Kept a due indirizzi reali, ad esempio un nome della LAN e un nome Tailscale, elenca gli altri in `KEPT_EXTRA_ADDRESSES` ([Più di un indirizzo](/it/install/home-network/#più-di-un-indirizzo)).

## Kept non si avvia dopo un aggiornamento e `migrate` è terminato con un errore

**Causa:** il servizio `kept` parte solo dopo che `migrate` riesce. Prima di migrare un database che contiene dati, `kept migrate` crea una snapshot pre-aggiornamento se è impostata una destinazione di backup; **se la snapshot fallisce, non viene migrato nulla** e termina con il motivo ([aggiornamenti](/it/admin/upgrades/#lo-snapshot-prima-di-ogni-aggiornamento)).

**Soluzione:** leggi `docker compose logs migrate`, sistema il backup (destinazione, password, mount su `migrate`) ed esegui di nuovo `docker compose up -d`. Per aggiornare senza snapshot di proposito, imposta `KEPT_UPGRADE_SNAPSHOT=off` per quella esecuzione.

## Kept rifiuta di avviarsi con `downgrade_refused`

**Causa:** l'immagine è più vecchia di più di una release rispetto al database (oppure il database ha migrazioni che nessuna release registrata ha prodotto). Un passo indietro è consentito; di più no.

**Soluzione:** esegui di nuovo la release più recente, oppure [ripristina](/it/admin/restore/) la snapshot pre-aggiornamento creata da quella precedente. `KEPT_ALLOW_DOWNGRADE=1` forza l'avvio ed è tracciato; usalo solo quando le note di una release lo indicano ([tornare indietro di una versione](/it/admin/upgrades/#tornare-indietro-di-una-versione)).

## Il codice di setup è perso, oppure il setup è bloccato

**Causa:** il codice viene stampato una sola volta, dal processo che lo ha creato. Codici sbagliati bloccano l'indirizzo che li ha inviati, e molti codici sbagliati bloccano l'istanza.

**Soluzione:** `docker compose run --rm migrate admin setup-code` emette un nuovo codice e rimuove il blocco a livello di istanza; un blocco per indirizzo termina da solo. Se tutti sono bloccati contemporaneamente, leggi la voce successiva.

## Tutti raggiungono gli stessi limiti di accesso

**Causa:** dietro un reverse proxy, Kept vede l'indirizzo del proxy per ogni visitatore a meno che il proxy non sia in `KEPT_TRUSTED_PROXIES`, quindi tutti condividono un unico insieme di limiti.

**Soluzione:** elenca l'indirizzo del proxy così come Kept lo vede in `KEPT_TRUSTED_PROXIES` ([i reverse proxy](/it/install/reverse-proxy/#fidati-del-proxy-e-solo-del-proxy)).

## I caricamenti falliscono o le foto grandi non arrivano mai

**Causa:** Kept rifiuta un file oltre `KEPT_MAX_FILE_MB` (25 MB per impostazione predefinita) con 413. Un proxy davanti spesso ha un limite del corpo più piccolo e fallisce per primo.

**Soluzione:** alza il limite del proxy ad almeno `KEPT_MAX_FILE_MB` ([fai passare i caricamenti](/it/install/reverse-proxy/#lascia-passare-gli-upload)).

## Su telefono non funzionano la fotocamera, l'installazione, i push o la posizione

**Causa:** i telefoni li consentono solo su un'origine sicura; un indirizzo LAN su HTTP semplice non lo è. Su HTTP, Kept rifiuta anche di mostrare valori segreti, esportazioni, token di accesso, connessioni OAuth, lo scaricamento del kit di ripristino e le impostazioni dei backup.

**Soluzione:** [metti Kept su HTTPS](/it/install/https/) e imposta `KEPT_PUBLIC_URL` sull'indirizzo `https://`.

## Il salvataggio di un fornitore AI o di un webhook fallisce: "Quell'indirizzo è su una rete privata."

**Causa:** le richieste in uscita vengono rifiutate verso indirizzi privati, di loopback e riservati (`private_address`). Un fornitore sulla tua rete, incluso `http://ollama:11434/v1` di Compose, si risolve in uno di essi.

**Soluzione:** un amministratore dell'istanza attiva **Admin → Impostazioni → Consenti gli indirizzi privati**. Vedi il [modello di sicurezza](/it/admin/security-model/#richieste-in-uscita-ssrf).

## Non arriva posta

**Causa:** senza `KEPT_SMTP_URL` e `KEPT_SMTP_FROM`, la posta viene solo registrata come da inviare, e Admin → Stato dice che la posta non è configurata.

**Soluzione:** imposta entrambe e riavvia ([installazione](/it/install/compose/#5-prossimi-passi)).

## I backup non partono o si attiva l'allarme "Backup obsoleto"

**Causa:** di solito una di queste: nessuna destinazione o nessuna password (non esiste un backup non cifrato), il worker senza `KEPT_OWNER_DATABASE_URL`, una destinazione directory non montata nel container, oppure non di proprietà dell'utente di Kept (uid 10001).

**Soluzione:** segui [i backup](/it/admin/backups/#come-attivarlo), poi eseguine uno a mano e leggi quello che dice:

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup
```

Esce con 1 su un avviso, per nome:

| Avviso | Significato e cosa fare |
|---|---|
| `backup_suspicious_size` | molto più piccolo dell'ultimo valido; se la riduzione è reale, `kept admin backup --accept-size` |
| `files_unreadable` | restic non ha potuto leggere alcuni file; controlla i permessi del volume dati |
| `blob_checksum_mismatch` | un file memorizzato non corrisponde più al suo SHA-256; controlla il disco |
| `readable_incomplete` | la copia leggibile di un luogo è fallita; il log la nomina |

Dopo un crash, un lock restic obsoleto può bloccare ogni esecuzione: `kept admin backup unlock` lo rimuove (rifiuta mentre un backup è in esecuzione).

## Un ripristino rifiuta di avviarsi

**Causa:** Kept ripristina solo in un database **vuoto**, e verifica che `pg_restore` corrisponda alla versione major di Postgres del server e che le estensioni esistano.

**Soluzione:** crea un nuovo database vuoto con le estensioni, come in [ripristino](/it/admin/restore/#ripristino); non puntare mai il ripristino su quello live.

## Dopo un ripristino, i valori segreti e le chiavi AI non possono essere letti

**Causa:** sono sigillati con `KEPT_SECRET_KEY`, che non è nel backup.

**Soluzione:** metti le chiavi del kit di ripristino in `.env` (con `KEPT_SECRET_KEY_VERSION` e `KEPT_SECRET_KEYS_RETIRED` se le elenca) e riavvia. Se il kit elenca chiavi ritirate, esegui `kept admin rotate-key --resume` una volta che Kept è avviato. Senza la chiave quei valori sono persi per sempre.

## `kept admin` dice che `KEPT_OWNER_DATABASE_URL … is required`

**Causa:** la maggior parte dei comandi admin ha bisogno del login del proprietario del database, che solo il servizio `migrate` detiene.

**Soluzione:** eseguili come `docker compose run --rm migrate admin <command>`, oppure, per `rotate-key`, `backup`, `restore` ed `export`, dai al servizio `kept` il login del proprietario in `compose.override.yaml` ([la CLI](/it/admin/cli/#eseguirlo-sotto-compose)).

## Un container solo worker non è in salute

**Causa:** con `KEPT_ROLE=worker`, il controllo di salute legge il file che il loop dei job tocca (`/tmp/kept-worker-alive`); fallisce quando il loop non ha interrogato il database per due minuti.

**Soluzione:** controlla il log del worker e la sua connessione al database; valgono gli stessi controlli sul database che per `/readyz`.

## Ancora bloccato

Apri una issue con la versione da `/version`, come Kept viene eseguito e le righe di log rilevanti con qualsiasi dato privato rimosso. Un problema di sicurezza passa invece dalla segnalazione privata delle vulnerabilità ([modello di sicurezza](/it/admin/security-model/#segnalare-una-vulnerabilità)).
