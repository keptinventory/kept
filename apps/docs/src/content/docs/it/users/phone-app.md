---
title: Kept sul tuo telefono
description: Installa Kept sulla schermata home, cosa funziona senza connessione, come si vedono sincronizzazione e conflitti, la fotocamera, il blocco dell'app e le notifiche.
---

Kept non ha un’app sugli store. È un’app web che installi dal browser (una PWA): si apre dalla propria icona, a schermo intero, tiene una copia del tuo inventario sul telefono e funziona offline. Tutto in questa pagina richiede Kept su **HTTPS**: su HTTP normale, i telefoni bloccano la fotocamera, l’installazione, le notifiche push e la posizione ([HTTPS](/it/install/https/)).

## Installalo

**Installa sul telefono** nella checklist di Home, e **Aiuto → Installa sul telefono**, mostrano i passaggi per il tuo dispositivo:

| Dispositivo | Passaggi |
|---|---|
| iPhone, iPad | In Safari, tocca **Condividi**, poi **Aggiungi alla schermata Home**, poi **Aggiungi**. Apri Kept dalla nuova icona. |
| Android | Apri il menu del browser (i tre puntini), tocca **Installa app** o **Aggiungi alla schermata Home**, e apri Kept dalla nuova icona. |
| Computer | In Chrome o Edge, l’icona di installazione alla fine della barra degli indirizzi, oppure **Installa Kept** nel menu. In Safari su Mac, **File › Aggiungi al Dock**. |

Il passaggio della checklist si spunta la prima volta che apri Kept dalla sua icona. Quando è pronta una nuova versione, Kept mostra **È pronta una nuova versione** con **Ricarica**; non si ricarica mai da sola mentre qualcosa è in caricamento o un’acquisizione è aperta.

## Cosa funziona offline

Il telefono tiene una copia di ogni luogo a cui appartieni, aggiornata ogni volta che si sincronizza. Le risposte offline dicono **as of last sync** e l’ora.

| Funziona offline | Richiede connessione |
|---|---|
| Navigare tra luoghi, stanze, scatole e oggetti | Modificare i dettagli di un oggetto, impostazioni, amministrazione |
| Ricerca, etichettata **Su questo telefono** | L’assistente e la denominazione IA |
| **Acquisisci**, spostare, segnare visto, non qui | Importazioni, esportazioni e report |
| Registrare una lettura, aggiungere una stanza o un posto | Registrare un servizio (comporta denaro) |
| Controllo scatola, per una scatola aperta una volta mentre online | Tutto ciò che coinvolge denaro o valori segreti |
| Scansionare un’etichetta, reclamare un’etichetta vuota | |

La copia non contiene mai valori segreti né i contatti delle persone. Denaro e documenti restano fuori dal telefono, a meno che tu non tenga un luogo offline dietro il blocco dell’app (sotto). Uscire dall’account rimuove la copia di questa persona dal telefono.

## Sincronizzazione, come la vedi

Ciò che fai offline va in coda e viene inviato quando il telefono torna online. Una riga sotto l’intestazione compare solo quando c’è qualcosa da dire:

- **Offline · 12 in attesa di sincronizzazione**, oppure **Offline · ultimo sync alle 14:02**.
- I nuovi oggetti mostrano **ID in attesa** finché il server non assegna il loro ID breve; le etichette per essi possono essere stampate quando arriva (Le etichette offrono **Stampa etichette in attesa**).
- **Su iPhone, la coda avanza solo mentre Kept è aperto**: la riga dice **Apri per completare la sincronizzazione (12)**. Lascia Kept aperto sullo schermo per un momento quando torni online.
- **Aggiorna Kept per completare la sincronizzazione** significa che il server è più recente dell’app: ricarica. La coda viene conservata.
- **Questo browser può cancellare la copia offline di Kept dopo settimane di inutilizzo**: il telefono ha rifiutato l’archiviazione permanente di Kept. Apri Kept ogni tanto così si sincronizza.

**Quando una modifica non può essere applicata.** Se qualcun altro ha cestinato, spostato o rimosso un oggetto mentre eri offline, la tua modifica su di esso viene scartata e la riga lo dice, per esempio "Una modifica non ha potuto essere applicata: il trapano è stato cestinato da Alfred", con **Ripristina** per riprovarci. Altre modifiche che richiedono una decisione vanno all’**In arrivo** ("2 modifiche richiedono un controllo").

**Quando modificate entrambi lo stesso oggetto online**, Kept unisce i campi che solo uno di voi ha cambiato e chiede sugli altri: **Mantieni la mia**, **Mantieni la loro** o **Modifica**.

**Disconnettersi con acquisizioni non sincronizzate** ti avvisa prima: disconnettersi cancella le acquisizioni che non si sono sincronizzate. Se la sessione scade, il telefono cancella la sua copia dell’inventario ma tiene le acquisizioni non inviate, bloccate, finché non accedi di nuovo. Se un’altra persona entra su quel telefono, Kept dice quante acquisizioni sono in attesa da un altro account e le cancella solo quando quella persona accetta.

## Fotocamera, galleria e scansione

- **Acquisisci** tiene la fotocamera aperta per uno scatto dopo l’altro. **Galleria** sceglie più foto alla volta; ciascuna diventa una bozza. Se la fotocamera è bloccata, Kept dice come consentirla, e su HTTP normale **Acquisisci** ripiega sulla scelta di file.
- Le foto iPhone in HEIC restano originali; se una non può essere anteprata, dice **Anteprima non disponibile** e non viene mai rifiutata.
- **Condividere in Kept**: su Android e Chrome desktop, l’app installata compare nel foglio di condivisione, così una ricevuta o un PDF da un’altra app arrivano in **Acquisisci**. iPhone non permette alle app web di comparire nel foglio Condividi: salva il file, poi usa **Galleria** in **Acquisisci**.
- **Scansiona** legge le etichette di Kept e i codici a barre dei prodotti, anche offline, dalla copia del telefono, e i codici Data Matrix, Code 39, Code 93, ITF, Codabar, PDF417 e Aztec; un numero di serie o un asset tag apre il suo oggetto quando sei online. L’elenco completo: [ID brevi ed etichette](/it/users/everyday-use/#id-brevi-ed-etichette).
- **Suggerisci dove sono**, un interruttore nel selettore del posto di **Acquisisci**, confronta la tua posizione con le posizioni dei tuoi luoghi sul telefono stesso e suggerisce quello in cui sei: entro 150 m dalla sua posizione, il più vicino se sono due. La tua posizione non viene mai inviata né conservata. Un proprietario o un amministratore imposta la posizione di un luogo in **Impostazioni del luogo → Generali → Posizione** ([La sua posizione](/it/users/locations/#la-sua-posizione)); un luogo senza posizione non viene mai suggerito.
- **Detta** riempie il nome con la voce dove il browser lo supporta.

**Impostazioni → Diagnostica** controlla la fotocamera, il supporto offline e l’archiviazione, e copia un report di ciò che ha trovato.

## Blocco dell’app

**Impostazioni → Questo dispositivo → Blocco dell’app** blocca Kept su questo telefono con un PIN da 6 a 12 cifre, e con **Sblocca con Face ID o impronta** dove il telefono può verificarti. Con il blocco attivo, Kept chiede all’avvio a freddo e dopo 5 minuti nascosto o inattivo, online o offline.

Face ID o impronta qui sblocca Kept solo su questo dispositivo; non ti fa mai accedere. Per accedere con Face ID o impronta, aggiungi una passkey in [Accesso e sicurezza](/it/users/sign-in-security/).

- Dieci PIN sbagliati di fila rimuovono la copia di Kept da questo telefono e ti disconnettono, conservando le tue acquisizioni non inviate. **Dimenticato? Esci e accedi di nuovo** fa lo stesso.
- Il blocco tiene fuori chi tiene il telefono. Non ferma chi ha copiato l’archiviazione del browser nel tentativo di PIN; la pagina delle impostazioni lo dice.

**Tieni disponibile offline**, nella stessa pagina, aggiunge i prezzi e i documenti di un luogo alla copia del telefono, cifrati dietro il blocco. Richiede il blocco dell’app attivo, mostra prima la dimensione del download e avvisa che chiunque sblocchi Kept sul telefono li vede. Un dispositivo tiene al massimo 250 MB così, con file fino a 25 MB ciascuno.

## Notifiche

In **Impostazioni → Profilo → Notifiche**, sotto **Questo dispositivo**, **Attiva** attiva le notifiche push: i promemoria compaiono anche quando Kept è chiuso. **Prova** ne invia una per verificare.

- **iPhone e iPad** consegnano le notifiche push solo all’app installata: aggiungi Kept alla schermata Home, aprila da lì e attivale. Fino ad allora, i promemoria possono arrivare via email.
- Le notifiche push richiedono HTTPS. Se il server non ha modo di inviare notifiche push, o il browser non può riceverle, la pagina lo dice; email e centro notifiche funzionano comunque.
- Le ore di silenzio tengono ferme le notifiche push e l’email finché non terminano. Ciò che ogni luogo invia, e come, è trattato in [uso quotidiano](/it/users/everyday-use/#promemoria-e-notifiche).
