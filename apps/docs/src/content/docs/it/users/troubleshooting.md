---
title: Problemi comuni
description: "Accesso, sincronizzazione, fotocamera, etichette, IA e uso offline: quello che vedi, e cosa fare."
---

Problemi che potresti incontrare mentre usi Kept. Per i problemi nell'esecuzione del server, vedi
[Risoluzione dei problemi](/it/admin/troubleshooting/).

## Accesso

### Ho dimenticato la password

Nella pagina di accesso, inserisci il tuo indirizzo email e scegli **Password dimenticata?**. Kept ti invia un
link per impostare una nuova password; funziona una sola volta, per un'ora. Non è arrivato nulla: controlla lo spam, oppure chiedi a
chi gestisce il tuo Kept se l'email è configurata. Senza email, un amministratore dell'istanza può generare un
link di reset monouso sul server con `kept admin reset-password` ([la CLI](/it/admin/cli/)).

Un account gestito (un nome utente, senza email) riceve invece un nuovo codice monouso, da chi ha creato l'account
o dal proprietario del luogo ([persone senza email](/it/users/first-run/#persone-senza-email)).

### Un link di accesso non funziona

Un link inviato con **Inviami un link di accesso** funziona una sola volta, per 15 minuti: chiedine uno nuovo. Un link
inviato prima che il tuo Kept fosse aggiornato a 1.14.0 non funziona più del tutto, e nemmeno un accesso Google o OIDC
avviato prima ([aggiornamenti](/it/admin/upgrades/#link-di-accesso-1140)).

### La mia passkey non funziona

- **Le passkey richiedono HTTPS.** Su un indirizzo `http://` normale, il browser non ne offre nessuna
  ([Kept su una rete domestica](/it/install/home-network/)).
- **Una passkey resta sul dispositivo che l'ha creata**, oppure nel tuo gestore di password quando è sincronizzato. Su
  un altro dispositivo, accedi in un altro modo (la tua password o **Inviami un link di accesso**), poi aggiungi una
  passkey lì in **Impostazioni → Accesso e sicurezza**.
- **"Quella passkey non è una di quelle con cui questo account accede"**: il browser ha offerto qualcos'altro, come il
  blocco app del dispositivo, che non può farti accedere. Accedi in un altro modo.

Approfondisci in [Accesso e sicurezza](/it/users/sign-in-security/).

### Ho perso il telefono, o i codici di backup

Un codice di backup è il secondo passo dopo la password, al posto del codice a 6 cifre dell'app di autenticazione.
Ciascuno funziona una sola volta.

- **Sei ancora connesso da qualche parte:** **Impostazioni → Accesso e sicurezza**. **Nuovi codici di backup** ne crea
  dieci nuovi (i vecchi smettono di funzionare); **Configura di nuovo** sposta la verifica in due passaggi su un telefono
  nuovo.
- **Bloccato fuori, senza codici di backup:** chiedi a un amministratore dell'istanza. **Reimposta verifica in due passaggi**
  in **Amministratore dell’istanza → Utenti** ferma l'app di autenticazione e i codici di backup, e configuri di nuovo
  la verifica in due passaggi al prossimo accesso.

### "Il tuo account verrà eliminato il …"

Hai chiesto di eliminare l'account, e attende 30 giorni; fino ad allora non si apre nient'altro in Kept. **Tieni il mio
account** ferma l'eliminazione e riporta l'account com'era. Vedi
[le FAQ](/it/users/faq/#come-elimino-il-mio-account).

## Sincronizzazione

### Le acquisizioni dal mio telefono non compaiono

Un'acquisizione viene prima salvata sul telefono e inviata quando il telefono si sincronizza.

- **Su iPhone la coda avanza solo mentre Kept è aperto.** La riga sotto l'intestazione dice **Apri per completare la
  sincronizzazione** con un conteggio: lascia Kept sullo schermo per un momento mentre sei online.
- **Senza nome**, un'acquisizione aspetta in **In arrivo**. **Foto da controllare** nella Home le mostra.

### La ricerca dice "Su questo telefono · all'ultima sincronizzazione"

La risposta è arrivata dalla copia del telefono, perché sei offline. Riconnettiti, poi trascina verso il basso per
aggiornare.

### Una modifica fatta offline non si è applicata

Se qualcun altro ha cestinato, spostato o rimosso un oggetto mentre eri offline, la tua modifica su di esso viene scartata
e la riga lo indica, con **Ripristina** per riprovare. Altre modifiche che richiedono una decisione vanno in **In arrivo**.
Vedi [la sincronizzazione, come la vedi](/it/users/phone-app/#sincronizzazione-come-la-vedi).

### La sincronizzazione sembra bloccata

- Trascina verso il basso per aggiornare, oppure chiudi Kept e aprilo di nuovo.
- **Aggiorna Kept per completare la sincronizzazione**: il server è più recente dell'app. Ricarica; la coda viene
  conservata.
- Ancora bloccato: **Impostazioni → Diagnostica** controlla il supporto offline e lo spazio di archiviazione e copia un
  report. Invialo a chi gestisce il tuo Kept.

## Fotocamera e acquisizione

### La fotocamera non si apre

I telefoni consentono la fotocamera solo su un indirizzo HTTPS. Su un semplice `http://`, Acquisisci ripiega sulla scelta
dei file. Anche installare Kept, lavorare offline e le notifiche push richiedono HTTPS. Cosa funziona su HTTP semplice, e
due modi per aggiungere HTTPS a casa: [Kept su una rete domestica](/it/install/home-network/).

Su HTTPS e ancora bloccato, Kept spiega come consentire la fotocamera nel browser.

### L'IA non ha dato un nome al mio oggetto

Senza IA, le acquisizioni aspettano in **In arrivo** un nome: dai loro un nome lì, oppure vedi [IA](#ia) sotto.

### L'IA ha sbagliato nome

Ciò che l'IA inserisce è un suggerimento. Apri l'oggetto e correggi nome, marca, modello o tipo.

## Etichette

### Un'etichetta non viene scansionata

Assicurati che l'etichetta sia piatta e ben illuminata, e pulisci la lente della fotocamera. **Digita il codice** accetta
i sei caratteri stampati sotto il codice QR, con o senza il trattino. Un'etichetta usurata si ristampa con lo stesso codice
([ID brevi ed etichette](/it/users/short-ids/)). Un'etichetta su nastro stretto per etichettatrici non ha codice QR: tieni premuto
**Scansiona** sul suo ID breve stampato, oppure digitalo
([scansione di un codice senza codice QR](/it/users/short-ids/#scansione-di-un-codice-senza-qr-code)).

## IA

### "In attesa di un fornitore di IA"

Per questo luogo non è collegato alcun fornitore. Il lavoro in un luogo è pagato dalla chiave del suo proprietario, quindi
il proprietario ne collega uno in **Impostazioni → IA**, oppure un amministratore dell'istanza ne imposta uno per il server
in **Admin → IA**. Membri e visualizzatori non possono collegarne uno per il luogo di qualcun altro: la riga dice di chiedere
a un amministratore. Vedi [Fornitori di IA](/it/users/ai-providers/#dove-va-la-chiave).

### L'IA è disattivata in un luogo

Un proprietario o un amministratore l'ha disattivata: **Impostazioni del luogo → Cosa monitorare**, sotto **IA in questo
luogo**, l'interruttore **Acquisizione con IA e l'assistente**. Riaccenderla riporta l'IA lì.

### "IA in pausa"

È stato raggiunto un limite mensile, oppure qualcuno ha scelto **Metti in pausa l'IA**. Le acquisizioni si salvano comunque;
la denominazione attende e riprende con l'IA. Chi ha impostato il limite riceve **Riprendi ora**. I limiti sono in
**Impostazioni → IA → Avanzate → Limiti** ([limiti e pausa](/it/users/ai-providers/#limiti-e-pausa)).

### L'IA costa troppo

Imposta un limite mensile in **Impostazioni → IA → Avanzate → Limiti**, scegli un modello più economico in
**Avanzate → Modelli**, oppure esegui un modello locale con [Ollama](/it/admin/ollama/).

## Offline

### Qualcosa non funziona offline

Lavorare offline richiede Kept installato da un indirizzo HTTPS. Navigazione, ricerca e acquisizione funzionano senza
connessione; la modifica dei dettagli, l'assistente, i report, la mappa, il grafico e qualsiasi cosa coinvolga denaro ne
richiedono una.

L'elenco completo: [cosa funziona offline](/it/users/phone-app/#cosa-funziona-offline).

## Ottenere aiuto

- **Domande e idee:** [Discussioni](https://github.com/keptinventory/kept/discussions)
- **Un bug:** [un issue](https://github.com/keptinventory/kept/issues/new/choose), con quello che hai fatto e quello che hai visto
- **Aiuto su Discord:** [il server Kept](https://discord.gg/g4WCXPfuNv), in #help: un problema per messaggio, la tua versione di Kept e come la
  esegui (Docker Compose, Kubernetes), cosa è successo, e log con segreti e dati personali sfocati
- **Un problema di sicurezza:** privatamente, mai in un issue pubblico
  ([SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md))
