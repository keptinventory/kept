---
title: Collega un client AI (MCP)
description: Collega Claude Desktop o un altro agente AI al server MCP (Model Context Protocol) di Kept, con un token personale o OAuth.
---

Kept esegue un server [MCP](https://modelcontextprotocol.io/) all'indirizzo di Kept seguito da
`/mcp`, per esempio `https://kept.example.org/mcp`. Un'app AI che parla MCP può poi rispondere a
"dov'è il trapano?" usando il tuo inventario e, se lo consenti, aggiungere, spostare e modificare oggetti.

![Claude Code collegato a Kept: "Aggiungi la mia TV al Soggiorno: Samsung QE55Q80C, numero di serie 0B7H3CJT500123", e la risposta di Claude che la TV è in Kept sotto Casa › Soggiorno](../../../../assets/screens/claude-mcp-light.webp)

Questa pagina parla di app esterne a Kept. L'assistente di Kept usa gli stessi strumenti ed è trattato in
[Fornitori AI](/it/users/ai-providers/). Come funziona il server all'interno è in
[Server MCP](/it/developers/mcp/).

Ci sono due modi per collegare un'app:

- **Un token personale**: qualsiasi client MCP che ti permette di impostare un indirizzo del server e un
  header `Authorization`.
- **Un connettore (OAuth)**: l'app ti manda su Kept per accedere e scegliere cosa può fare. Serve
  Kept a un indirizzo `https` raggiungibile dall'app.

:::note[Non ancora verificato sulle app]
I test di Kept collegano un client MCP in entrambi i modi. I test su claude.ai, ChatGPT e Claude Desktop
stessi sono ancora in attesa, quindi non è ancora confermato quali di loro si colleghino come connettori.
:::

## Prima di iniziare

- **Attiva "Collega ChatGPT o Claude" in ogni luogo che l'app deve raggiungere.** Si trova sotto
  **Impostazioni del luogo → Cosa monitorare**, ed è attivo solo nel preset **Completa**. Il proprietario e
  gli amministratori lo cambiano. In un luogo dove è disattivato, un token o un connettore non raggiunge nulla.
- **L'app crea token solo su `https`.** Impostazioni → Connessioni si rifiuta di creare un token quando
  `KEPT_PUBLIC_URL` è `http` semplice. Non c'è un'impostazione per disattivarlo. Vedi
  [HTTPS](/it/install/https/). In una rete domestica su `http`, chi gestisce il server può
  crearne uno lì: [`kept admin token create`](/it/admin/cli/#un-token-dal-server).

## Crea un token personale

Apri **Impostazioni → Connessioni** e scegli **Nuovo token**.

| Campo | Cosa inserire |
|---|---|
| **Nome** | Dove lo userai: "Claude Desktop, il mio laptop". |
| **Luoghi** | Uno è già spuntato per te. Aggiungine un altro solo se l'app ha bisogno di entrambi. |
| **Cosa può fare** | **Sola lettura**: trova oggetti e legge ciò che è registrato. **Leggere e modificare**: anche aggiungere, spostare o modificarli. Nessuno dei due può cancellare o vedere campi segreti. |
| **Scade** | Una data, o vuoto per tenerlo fino alla revoca. Termina alla fine di quel giorno. |

Poi **Crea token**. Un token non fa mai più di quanto puoi fare tu: dove sei spettatore, può solo
leggere. Un token che può modificare oggetti in più luoghi i cui membri differiscono dà un avviso,
**Questi luoghi li usano persone diverse**, perché un'app potrebbe poi spostare oggetti da uno all'altro.
**Crealo per tutti** va avanti; un token per luogo è la scelta più sicura.

Il token, `kpt_` seguito da due parti, appare **una volta sola**, con **Copia**. Kept conserva solo un'impronta di esso, così un token perso non può essere mostrato di nuovo: revocalo e creane un altro.

In un luogo che richiede l'autenticazione a due fattori, un token funziona solo se lo hai creato mentre eri connesso con il tuo secondo fattore.

## Collega un client con il token

Sotto il nuovo token, **Collega un’app** mostra due valori, ciascuno con un pulsante Copia:

```text
Server address   https://kept.example.org/mcp
Authorization    Bearer kpt_…
```

Nell'app, aggiungi un server MCP (potrebbe chiamarsi connettore o integrazione) con quell'indirizzo,
e invia il token in quell'header. Kept non fornisce un file di impostazioni per nessuna app particolare;
dove vanno l'indirizzo e l'header è nella documentazione dell'app.

L'endpoint risponde solo a `POST`, non conserva sessione tra le richieste, e rifiuta una richiesta il cui
`Host` non è l'indirizzo di Kept (o uno usato prima) o che proviene dalla pagina di un altro sito web.

## Collega come connettore (OAuth)

Le app che lo supportano possono connettersi senza un token da copiare. È attivo da solo quando
`KEPT_PUBLIC_URL` è `https`. **Admin → Stato → Connessioni da altre app** mostra l'endpoint MCP
e **Disponibile** oppure **Serve un URL pubblico https**.

1. Nell'app, aggiungi `https://kept.example.org/mcp` come connettore.
2. L'app trova l'accesso di Kept dall'indirizzo e ti manda su Kept. Accedi.
3. Kept mostra **_App_ vuole usare il tuo Kept**. Il nome è quello che l'app si dà; Kept
   non può confermare chi l'ha creata. Scegli **Cosa può fare** e **Dove** (scegli solo i luoghi di cui
   ha bisogno), poi **Consenti** oppure **Rifiuta**. La pagina dice anche che l'app resta connessa dopo che esci
   da questo browser, e che qualsiasi cosa disconnetta tutti i tuoi altri dispositivi le fa accedere di nuovo.
4. L'app compare sotto **App collegate** in **Impostazioni → Connessioni**.

L'app resta connessa finché premi **Revoca** su di essa e confermi (Kept chiede **Disconnettere
_App_?**), oppure finché passano 30 giorni senza essere usata; poi deve accedere di nuovo. Ogni token di accesso che ottiene dura
un'ora e l'app lo rinnova senza chiedertelo di nuovo; Kept verifica il tuo permesso a ogni chiamata, quindi
**Revoca** in **Impostazioni → Connessioni** funziona subito.

L'app deve accedere di nuovo dopo qualsiasi cosa disconnetta i tuoi altri dispositivi: **Disconnetti da tutti gli
altri dispositivi**, una nuova password o un reimpostazione della password, una modifica all'autenticazione a due fattori, i codici di backup o
le passkey, la scollegamento di un accesso esterno, un nuovo indirizzo email, o un amministratore che ti disconnette ovunque
o disabilita il tuo account. Disconnettere un solo dispositivo scelto lascia l'app connessa.

Un'eccezione: chiedere di cancellare il tuo account disconnette i tuoi altri dispositivi ma mantiene l'accesso
dell'app. L'app smette di funzionare mentre l'account è in attesa, e se mantieni l'account, torna a funzionare
senza accedere.

Cose che bloccano un connettore:

- **L'app non raggiunge Kept.** Un'app web come claude.ai si connette dai propri server, quindi
  Kept deve essere raggiungibile da internet, non solo dalla tua rete domestica o dalla tailnet.
- **Kept non raggiunge l'app.** Un'app si identifica con un indirizzo `https` per un documento
  che la descrive, e Kept recupera quel documento. Indirizzi privati e locali sono rifiutati.
- **L'app si registra da sola.** Kept accetta app che si descrivono con tale documento
  (Client ID Metadata Documents) e ha la registrazione dinamica dei client disattivata. Un'app che può
  registrarsi solo dinamicamente non può connettersi come connettore; usa un token personale se lo accetta.

## Cosa un'app può e non può fare

- **Vede solo i luoghi che hai scelto**, e in ciascuno solo gli strumenti per le parti di Kept
  che il luogo ha attive. Dove il tuo ruolo nasconde valori, sono nascosti anche all'app.
- **Le modifiche si applicano subito e sono elencate sotto Modifiche recenti delle connessioni** sulla pagina Connessioni,
  con **Annullabile per 7 giorni**. Annulla rifiuta quando il campo è cambiato nel frattempo.
- **Non c'è nulla di distruttivo da chiamare.** Nessuno strumento cancella, sposta nel cestino, unisce, trasferisce la proprietà,
  rivela un campo segreto, carica un file o esegue una query propria.
- **I file passano da te.** `attach_link` dà all'app un link che apre il foglio di acquisizione di Kept;
  aggiungi lì la foto o la ricevuta, autenticato.
- **Limiti per token**: 120 letture e 30 modifiche al minuto. Le risposte sono brevi e paginate, 20 elementi
  a meno che l'app non ne chieda di più, fino a 200.
- **Il testo scritto dalle persone è segnato come non attendibile.** Nomi e note arrivano all'app sotto una chiave `untrusted`,
  e Kept le dice di non seguire mai le istruzioni trovate in esse.

## Gli strumenti

Un'app vede solo gli strumenti che può chiamare in ogni luogo; `capabilities` li elenca. [Nascondere il
personale](/it/users/locations/#nascondi-personale) non cambia ciò che è stato dato a un'app. Gli strumenti **Read** (lettura)
funzionano con entrambi i tipi di accesso; gli strumenti **change** (modifica) richiedono **Leggere e modificare** e un ruolo di membro o
superiore. La parte di Kept di cui uno strumento ha bisogno è il nome sotto **Cosa monitorare**.

| Strumento | Tipo | Necessita | Cosa risponde |
|---|---|---|---|
| `capabilities` | lettura | | Che cosa posso fare in ogni luogo: le sue parti e gli strumenti che posso chiamare lì. |
| `list_locations` | lettura | | Quali luoghi posso vedere, con il mio ruolo e il loro fuso orario. |
| `search_things` | lettura | | Quali oggetti corrispondono a queste parole: nomi, alias, tipi, marche e note, con filtri. |
| `where_is` | lettura | | Dove si trova un oggetto: le migliori corrispondenze con il percorso completo del posto. |
| `get_thing` | lettura | | Cosa sappiamo di questo oggetto (per id o ID breve), chi lo ha e le parti di un kit. |
| `list_contents` | lettura | | Cosa c'è in questo posto o contenitore, da 1 a 3 livelli di profondità. |
| `thing_history` | lettura | | Cosa è successo a questo oggetto, dai più recenti: chi ha fatto cosa e quando. |
| `find_documents` | lettura | | Dove sono la ricevuta, il manuale o la garanzia di qualcosa. |
| `upcoming` | lettura | Promemoria | Cosa è in scadenza, scaduto o in scadenza a breve: programmi, garanzie, prestiti e scorte basse. |
| `add_thing` | modifica | | Aggiungi uno o più oggetti, con un nuovo posto se non esiste ancora, e ogni campo che il foglio di creazione dell'app imposta (vedi sotto). |
| `update_thing` | modifica | | Modifica qualsiasi campo di un oggetto che il modulo di modifica dell'app modifica (vedi sotto); `null` cancella uno. |
| `move_thing` | modifica | | Sposta un oggetto, o una parte di una quantità, in un altro posto o contenitore. |
| `mark_seen` | modifica | | Ho appena visto questo oggetto dove Kept dice che sia. |
| `create_place` | modifica | | Aggiungi un posto sotto un altro posto, o in cima al luogo. Con `template`, aggiungi mobili e un posto per ciascun comparto in un solo passo, come fa [Mobili con scomparti](/it/users/locations/#mobili-con-vani); un'unica operazione Annulla riporta tutto indietro. Una stanza prende le sue dimensioni reali, `width_cm` e `length_cm` (da 50 cm a 100 m), e va sulla [mappa](/it/users/location-map/) con esse. |
| `update_place` | modifica | | Modifica un posto come nella sua pagina: rinominalo, cambia il suo tipo, spostalo in un altro posto o in cima, imposta i suoi campi e l'ordine dei posti in esso (A-Z o Ordine personalizzato, poi Sposta su o Sposta giù). `turn` (`right` o `left`, dove è finito il suo lato superiore) ruota [mobili con comparti](/it/users/locations/#ruotare-il-mobile) sul fianco o sul retro, con `renumber` vero o falso. Annullabile per 7 giorni, tranne uno spostamento su o giù: il movimento opposto lo annulla. |
| `turn_into_boxes` | modifica | | Trasforma fino a 50 posti in scatole, come fa **Trasforma posti in scatole**. Ciascuno mantiene il suo ID, l'etichetta e ciò che contiene; uno con posti dentro resta un posto, e così uno in cima al luogo (trasforma quello in Kept). Un'unica operazione Annulla li riporta tutti indietro. |
| `attach_link` | modifica | | Un link che apre il foglio di acquisizione di Kept per aggiungere una foto, una ricevuta o un documento. |
| `log_reading` | modifica | | Registra una lettura del contatore: odometro, ore, elettricità. |
| `lend_thing` | modifica | Prestiti | Presta un oggetto a qualcuno, con una data di scadenza facoltativa. Una scatola o un kit vanno con tutto ciò che contiene, ciascuno su una riga propria. |
| `return_thing` | modifica | Prestiti | Un oggetto prestato o preso in prestito è tornato, tutto o una quantità. Una scatola o un kit riportano ciò che è ancora fuori con essi. |
| `borrow_thing` | modifica | Prestiti | Registra un oggetto preso in prestito da qualcuno, con una data di scadenza facoltativa. |
| `complete_schedule` | modifica | Promemoria | Un'attività programmata è stata fatta, in una data o a un valore del contatore. |
| `snooze_schedule` | modifica | Promemoria | Rimanda un'attività programmata a una data o a un valore del contatore. |
| `add_warranty` | modifica | Ricevute e garanzie | Registra una garanzia: il suo tipo, e quando finisce o per quanti mesi. |
| `open_claim` | modifica | Ricevute e garanzie | Apri una richiesta di garanzia per un oggetto. |
| `update_claim` | modifica | Ricevute e garanzie | Modifica lo stato o il riferimento di una richiesta. |
| `log_service` | modifica | | Registra un intervento: data, chi l'ha fatto, totale, righe (ciascuna può usare scorte da un consumabile), gli programmi che completa e note. |
| `log_fuel` | modifica | Carburante | Registra un rifornimento: quantità, unità, costo, se pieno e l'odometro. |
| `adjust_stock` | modifica | Oggetti che si esauriscono | Aggiungi o togli dalle scorte di un consumabile. |
| `list_tags` | lettura | | Quali etichette ci sono, con quanti oggetti hanno ciascuno. |
| `tag_things` | modifica | | Aggiungi etichette a oggetti, o toglieli; un nome nuovo crea l'etichetta. |
| `list_moves` | lettura | Trasloco | Quali traslochi ci sono, con quante scatole sono imballate, in transito e disimballate. |
| `get_move` | lettura | Trasloco | Dove si trova ogni scatola di un trasloco e quali numeri mancano ancora. |
| `start_move` | modifica | Trasloco | Avvia un trasloco, verso un altro luogo o tra stanze di questo. |
| `add_box` | modifica | Trasloco | Aggiungi la prossima scatola numerata: nuova, o un contenitore che hai. |
| `pack_into_box` | modifica | Trasloco | Metti oggetti in una scatola. |
| `set_box_status` | modifica | Trasloco | Segna una scatola come imballata o in transito, o scegli la sua stanza. |
| `unpack_box` | modifica | Trasloco | Disimballa una scatola in una stanza; tutto ciò che contiene va con essa. |

**I campi di un oggetto.** `add_thing` e `update_thing` accettano ogni campo impostabile su un oggetto nell'app,
ciascuno nel proprio campo anziché nelle note: nome, quantità, tipo (per nome, in inglese o
arabo, o per id), marca (creata se nuova), modello, numero di serie, codice a barre, colore, condizione, note,
altri nomi, etichette (un nome nuovo crea l'etichetta, per i membri e oltre), di chi è (una persona, creata se nuova), il link del manuale,
scadenza e quanti giorni prima ricordare, il minimo di un consumabile e i campi propri del tipo per
chiave. `add_thing` accetta anche dove va e l'acquisto (data, prezzo di uno con la sua valuta,
e il negozio); `update_thing` accetta anche da dove viene, e il suo acquisto: la data, il negozio,
la riga sulla ricevuta, il prezzo di uno con la sua valuta e le note, modificando l'acquisto
che ha o registrandone uno, come fa la pagina dell'oggetto. Un prezzo richiede che Money sia attivo e un ruolo che
veda il denaro, come nell'app; un minimo richiede **Oggetti che si esauriscono**. Un tipo che Kept non conosce viene
lasciato fuori e l'`not_set` della risposta lo dice; la scheda dell'assistente
lo mostra come "not set" con un selettore.

Gli strumenti per il trasloco sono solo per le app collegate; l'assistente in Kept non li usa.

Ogni strumento che prende un id accetta anche un ID breve di 6 caratteri come `K7D2QX`. I contratti
completi sono in
[`packages/mcp/src/tools.ts`](https://github.com/keptinventory/kept/blob/main/packages/mcp/src/tools.ts).

## Revoca l'accesso

In **Impostazioni → Connessioni**, trova il token o l'app (filtra per **Tipo**, **Luogo** o
**Stato**) e scegli **Revoca**.

- **Un token**: le app che lo usano smettono di funzionare subito. Le modifiche che ha fatto restano e possono essere annullate
  ancora per 7 giorni.
- **Un'app connessa**: smette subito di raggiungere il tuo Kept, e Kept dimentica il tuo consenso, quindi per
  usarla di nuovo la ricolleghi dall'app.

Kept termina anche l'accesso da solo, e l'elenco dice perché: **Scaduto**, **Terminato: hai lasciato il
luogo**, **Terminato: il tuo ruolo è cambiato**, **Revocato da un amministratore**, oppure **Disconnesso dall'app**.
