---
title: Il kit di ripristino
description: Le chiavi e le credenziali di backup che trasformano un backup in un Kept funzionante. Conservale ovunque tranne che sul server.
sidebar:
  order: 4
---

Kept sigilla ogni valore segreto che conserva (le chiavi AI e i segreti che custodisci su oggetti, come la password Wi-Fi del router) con `KEPT_SECRET_KEY`, e firma le sessioni con `KEPT_AUTH_SECRET`. Né l'una né l'altra è nel database o nel backup, di proposito: chi ottiene il tuo backup non dovrebbe ottenere con esso anche i tuoi segreti. L'altra faccia della medaglia: **senza la chiave, un ripristino riporta tutto tranne i valori segreti e le chiavi AI, che rimangono illeggibili per sempre.**

Il kit di ripristino è tutto ciò che ti serve per ricostruire Kept dal suo backup. Tienilo in un password manager o su carta, in un posto che non si perderebbe insieme al server.

## Cosa contiene

- `KEPT_SECRET_KEY` e `KEPT_AUTH_SECRET`;
- dopo una rotazione della chiave, la versione della chiave (`KEPT_SECRET_KEY_VERSION`) e ogni chiave ritirata
  (`KEPT_SECRET_KEYS_RETIRED`), di cui i backup più vecchi hanno ancora bisogno;
- il repository restic del backup, **la sua password e le sue credenziali di archiviazione** (le chiavi S3 e
  la regione, oppure la chiave SFTP e la host key bloccata del server come riga `known_hosts`), oppure "Nessun backup
  configurato";
- l'indirizzo dell'istanza, la versione e la revisione di Kept, quando il kit è stato creato;
- i passi di ripristino in parole semplici, e i comandi per
  [leggere il tuo inventario usando solo restic](/it/admin/read-with-restic/), con il repository compilato.

È testo semplice, oppure una pagina stampabile composta dalle stesse righe (nessuno script, nulla caricato da
alcuna parte).

## Come ottenerlo

Dal server, in qualsiasi momento:

```sh
docker compose exec kept kept admin recovery-kit
```

Stampa sul terminale; non viene scritto nulla da nessuna parte. `--format html` dà la pagina stampabile,
e `--out <file>` la scrive in un file leggibile solo da te. Le chiavi vengono stampate anche quando il database
è spento; la parte del backup richiede il login del proprietario del database (`KEPT_OWNER_DATABASE_URL`, il
`compose.override.yaml` che [backup](/it/admin/backups/#come-attivarlo) usa lo fornisce), e senza di esso
il kit dice che manca. Con quel login, la stampa conta come download (qui sotto) ed è auditata.

Dal web: **Admin → Stato → Kit di ripristino → Scarica il kit di ripristino**, come amministratore dell'istanza, solo su
HTTPS, dopo aver inserito di nuovo la password (oppure, per un account senza password, entro dieci minuti
dal login: un login con passkey conta; altrimenti "Accedi di nuovo"). Scegli un file di testo o una
pagina stampabile. Ogni download è auditato, e nulla del kit viene conservato dove un visitatore successivo
possa aprirlo.

## Quando Kept te lo chiede

La configurazione non aspetta il kit, ma Kept ti chiede di riconoscerlo prima del primo tra: conservare un valore segreto, aggiungere una chiave AI o configurare i backup. Fino ad allora Admin → Stato lo richiede; un download conta come quella conferma. La pagina Stato lo richiede di nuovo quando il kit che hai scaricato non è più aggiornato: dopo la modifica delle impostazioni di backup o la rotazione della chiave (`kept admin rotate-key`).

## Se imposti tu le chiavi

Con `KEPT_SECRET_KEY` e `KEPT_AUTH_SECRET` nel tuo ambiente (genera ciascuna con
`kept admin gen-key`), Kept le usa così come sono e il volume `kept-config` resta vuoto. Il kit
le stampa comunque; tenere una copia resta un tuo compito.

## Ruotare la chiave

```sh
docker compose exec kept kept admin rotate-key
```

Rende attuale una nuova chiave e riavvolge ogni segreto memorizzato sotto di essa. Ha bisogno del login del proprietario
del database, quindi il servizio `kept` deve avere `KEPT_OWNER_DATABASE_URL` (il `compose.override.yaml` che
[backup](/it/admin/backups/#come-attivarlo) usa lo fornisce). Indica cosa impostare se gestisci tu le chiavi.
La vecchia chiave passa nell'elenco delle ritirate, così i backup fatti prima della
rotazione si aprono ancora: scarica un nuovo kit dopo.
