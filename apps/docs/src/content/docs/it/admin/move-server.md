---
title: Spostarsi su un nuovo server
description: "Due modi per spostare Kept: l'intera istanza tramite backup, oppure una sede alla volta tramite esportazione."
sidebar:
  order: 8
---

## L'intera istanza: tramite backup

Questo sposta tutto (ogni account, sede, file e impostazione) ed è la stessa procedura del recupero da un server perso:

1. Sul vecchio server, fai un backup e lascia che finisca, poi stampa il
   [kit di recupero](/it/admin/recovery-kit/).
2. Sul nuovo server, [installa Kept](/it/install/compose/) con le chiavi del kit in `.env` e la stessa
   destinazione di backup, ma **non avviare ancora Kept**.
3. [Ripristina](/it/admin/restore/#dopo-aver-perso-il-server) l'ultimo backup nel nuovo, vuoto database.
4. Punta il vecchio indirizzo al nuovo server (DNS, oppure il tuo proxy), mantieni `KEPT_PUBLIC_URL` uguale,
   e avvia Kept. Le etichette e i codici QR continuano a funzionare perché l'indirizzo non è cambiato.
5. Spegni il vecchio server una volta verificato il nuovo, e tieni il suo disco finché il nuovo non ha fatto un
   buon backup e un [test di ripristino](/it/admin/restore/#la-prova-mensile).

Se l'indirizzo cambia, le etichette già stampate portano ancora quello vecchio: punta anche il vecchio hostname
al nuovo server e inseriscilo tra i vecchi hostname dell'istanza; Kept reindirizza quindi una visita sotto il vecchio
nome alla stessa pagina al nuovo indirizzo.

## Una sede alla volta: tramite esportazione

Un proprietario esporta una sede, con i relativi file e, se lo desidera, i suoi valori segreti protetti da una
passphrase; sul nuovo server li importa in una nuova sede. Questo sposta una sola abitazione senza il resto
dell'istanza e funziona tra due istanze che eseguono versioni diverse, purché la nuova non sia più vecchia della
vecchia (un Kept più vecchio potrebbe rifiutare un'esportazione da uno più recente).

1. Sul vecchio server, in **Impostazioni → Esporta**, esporta la sede. Scegli se includere i valori segreti; se lo
   fai, imposta una passphrase. Le esportazioni avvengono solo su HTTPS e restano disponibili per il download per 7
   giorni.
2. Sul nuovo server, accedi, apri **Impostazioni → Importa** e scegli l'esportazione Kept (il file ZIP). Kept la
   verifica prima e mostra cosa aggiungerà prima che venga scritto alcunché; fornisci la passphrase per recuperare
   i valori segreti.
3. L'importazione crea una **nuova sede** con gli oggetti, i luoghi, i file, i rapporti sulle condizioni, gli
   spostamenti e la loro storia. Le etichette stampate continuano a funzionare: il codice breve di un'etichetta viene
   mantenuto se è libero sul nuovo server e riassegnato se non lo è, nel qual caso scansionare la vecchia etichetta
   apre comunque l'oggetto.
4. Invita le persone che condividevano la sede; l'importazione le elenca, ma non invita nessuno di per sé.
