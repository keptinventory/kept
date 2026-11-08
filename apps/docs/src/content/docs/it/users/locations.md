---
title: Luoghi, stanze e scatole
description: "L'albero in cui sta tutto: luoghi, stanze e punti, scatole e contenitori, Senza posto, i layout di un luogo (Elenco, Griglia, Grafo, Tabella, Mappa), e Seleziona per molte cose alla volta."
---

Tutto sta in un albero: un **luogo** (Home, Garage, un deposito) contiene **stanze e punti** ("stanza o punto" è la parola di Kept per qualsiasi posto), che contengono **oggetti**. Un oggetto può essere una **scatola o contenitore** che contiene altri oggetti, quanto in profondità vuoi. Ogni luogo ha anche **Senza posto**, per gli oggetti che non hanno ancora un posto.

- Su un luogo, una stanza o una scatola, **Aggiungi qui** aggiunge un **Oggetto**, una **Scatola / contenitore** o una **Stanza o punto**, oppure [mobili con vani](#mobili-con-vani).
- Gli elenchi hanno una casella di ricerca, **+ Filtro**, **Viste** salvate e un pulsante **Aspetto** per ordinamento e raggruppamento. I filtri stanno nell'indirizzo, quindi un elenco filtrato si può segnare o condividere.
- **Seleziona** (accanto alla casella di ricerca, per chi può modificare gli oggetti) segna gli oggetti nell'elenco di un luogo, posto o scatola, in Elenco o Griglia. Fai **Shift-click** sulla casella di una riga (o premi **Shift+Space** su di essa) per segnare ogni riga a partire dall'ultima che hai segnato. Poi: **Sposta**, **Aggiungi tag…** o **Rimuovi tag…**, **Imposta un campo…**, **Preleva** (nel vassoio), **Stampa etichette**, **Aggiungi a un incidente** e **Pacchetto per il risarcimento** (proprietari e amministratori, se Ricevute e garanzie è attivo), oppure **Sposta nel Cestino**. La barra è quella della [Tabella](/it/users/spreadsheet/).
- **Imposta un campo…** dà a ogni oggetto segnato un valore: tipo, marca, modello, condizioni e il resto. Le modifiche aspettano, segnate **Non ancora salvato**, finché non premi **Salva N modifiche**; un solo **Annulla** ripristina l'intero salvataggio. Serve una connessione. Se nel frattempo qualcuno ne ha modificato uno, quello aspetta: **Mantieni la mia** o **Mantieni la loro**.
- **Sposta nel Cestino** ne sposta fino a 200 alla volta e serve una connessione. Chiede prima cosa succede a ciò che c'è dentro una scatola (spostarlo fuori, o cestinarlo anche quello) e di ciò che è stato prestato, poi un solo **Annulla** li riporta tutti indietro.
- **Ordine:** posti e oggetti si leggono Dalla A alla Z con i numeri in ordine (Scatola 2 prima di Scatola 10), uguale nell'app, offline, nelle esportazioni e per le app AI. I piani mantengono l'ordine in cui sono stati creati: il primo è il piano terra sulla mappa. Su un posto, **Aspetto → Oggetti: ordina per** ordina i suoi oggetti; i suoi posti restano Dalla A alla Z.
- **Il tuo ordine:** su un posto, **Gestisci → Ordine dei posti qui → Ordine personalizzato** mette i posti al suo interno nell'ordine che scegli, con **Sposta su** e **Sposta giù** su ciascuno (anche da tastiera). **Dalla A alla Z** torna in qualsiasi momento, e passando di nuovo a **Ordine personalizzato** ripristina il tuo ordine. L'albero, la mappa, le esportazioni e le app AI lo seguono. Il livello superiore di un luogo resta Dalla A alla Z.
- **Trasforma posti in scatole…** nel **Gestisci** di un posto elenca i posti al suo interno: segnane alcuni, oppure **Seleziona tutto**, e diventano scatole in un solo passaggio, ciascuna che conserva il suo ID, etichetta e contenuto. Un posto che contiene posti non si può segnare: una scatola contiene solo oggetti. L'**Annulla** della notifica li riporta tutti posti, come erano; resta nella cronologia per 7 giorni.
- L'assistente e le app AI possono fare lo stesso: rinominare un posto, cambiarne il tipo, spostarlo, impostare i suoi campi e l'ordine dei posti al suo interno, e trasformare posti in scatole (`update_place` e `turn_into_boxes`, [client MCP](/it/users/mcp-clients/)). L'assistente mostra una scheda per confermare prima; Annulla funziona come nell'app.
- L'albero dei posti (accanto alla pagina su computer, **Tutti i posti** su un telefono) mostra le scatole sotto il loro posto con quanti oggetti ci sono in ciascuna, fino a 50 per posto, poi **+N scatole**. La freccia accanto a un posto comprime ciò che sta sotto; **Comprimi tutto** e **Espandi tutto** lo fanno per ogni posto in una volta. Kept ricorda le tue compressioni per il tuo account, su ogni dispositivo. I posti sopra la pagina in cui sei restano aperti, anche dopo **Comprimi tutto**.
- **La sua larghezza** (su computer, da 1280 px di larghezza): trascina la linea lungo il bordo dell'albero, o focalizzala e usa i tasti freccia, Home e End. **Comprimi posti**, il pulsante in cima all'albero, lo comprime per lasciare tutto lo spazio alla pagina; **Espandi posti** lo riporta. Questo dispositivo ricorda entrambi.
- Su un luogo, **Sistemali** passa in rassegna Senza posto un oggetto alla volta con un selettore di posto.
- Una scatola aperta dalla sua etichetta mostra una griglia di foto di ciò che contiene.
- **Layout:** la pagina di un luogo passa da **Elenco**, **Griglia**, **Grafo**, **Tabella** e **Mappa**, ciascuna con la sua icona. **Grafo** disegna il luogo come un grafo dei suoi piani, stanze, scatole e oggetti, in 2D o 3D ([Il grafo](/it/users/graph/)). **Tabella** mostra i suoi oggetti come un foglio di calcolo, su uno schermo largo almeno 1024 px ([La vista foglio di calcolo](/it/users/spreadsheet/)), quindi un telefono mostra Elenco · Griglia · Grafo · Mappa. **Mappa** mostra il luogo in 3D, piano per piano, con le sue stanze, scaffali e scatole ([La mappa del luogo](/it/users/location-map/)). Il menu **Aspetto** dell'elenco offre la stessa scelta. La pagina di un posto (non Senza posto) ha l'interruttore anche lei, senza Tabella. Kept ricorda il layout per ogni luogo e ogni posto su quel dispositivo.
- **Griglia** mostra i posti e gli oggetti di un luogo o stanza come riquadri, sotto le stesse intestazioni **Posti** e **Oggetti** di Elenco; ogni intestazione si comprime. **Aspetto → Dimensioni** sceglie riquadri **Piccolo**, **Medio** o **Grande** (3, 2 o 1 per fila su un telefono), e Kept ricorda la tua dimensione su quel dispositivo.
- Su computer o tablet, la barra laterale segna il luogo in cui ti trovi: nella sua pagina, e nelle sue stanze, oggetti, scatole e impostazioni.

![Un luogo in Griglia con riquadri Piccoli: l'intestazione Posti · 9 sopra le stanze, poi l'intestazione Oggetti · 20+ sopra gli oggetti, sei riquadri a fila, ciascuno con solo il nome](../../../../assets/screens/grid-desktop-light.webp)

![La stessa griglia nel tema scuro](../../../../assets/screens/grid-desktop-dark.webp)

I link usano gli ID, mai il percorso, quindi spostare un oggetto non rompe mai un link verso di esso.

## Mobili con vani

Uno scaffale a cubi, una libreria o una cassettiera è un posto, e ogni cubo, ripiano o cassetto è un posto al suo interno, con il suo nome, la sua etichetta e, se vuoi, il suo codice.

- **Aggiungi qui → Stanza o punto → Mobile con vani…** crea il mobile e tutti i suoi vani in un solo passo. Scegli un modello: scaffale a cubi 1 × 4, 2 × 2, 2 × 4, 4 × 4 o 2 × 8, libreria (6 ripiani), cassettiera (9) o scaffalatura (4). Cambia il numero di ripiani o cassetti prima di aggiungerlo. Il tipo del mobile è **Mobili**; i suoi vani sono **Vano**, **Ripiano** o **Cassetto**.
- **Come sta:** uno scaffale a cubi non quadrato può stare **In piedi** o giacere **Sdraiato**. Un 2 × 4 in piedi è 4 file di 2; sdraiato, 2 file di 4. I vani sono costruiti come sta.
- **Conteggio:** dall'alto a sinistra, riga dopo riga, come lo vedi davanti a te. Un 4 × 4 è Vano 1 fino a Vano 16; un 2 × 4 sdraiato ha da 1 a 4 sulla prima riga e da 5 a 8 sotto. Il foglio mostra i numeri prima di aggiungerlo. **Nomi dei vani** usano `{n}` per il numero, `{row}` e `{col}` per dove si trova.
- **Codici:** **Il suo codice** dà al mobile un codice (`KX01`), e **Codici dei vani** un modello per i vani, ad esempio `{parent}-F{col:02}{row:02}`: `{parent}` è il codice del mobile, `{col:02}` la colonna con due cifre. Un 4 × 4 ottiene quindi `KX01-F0101` fino a `KX01-F0404`. Ogni codice viene controllato rispetto alla regola di formato del luogo (**Impostazioni → il luogo → Generali → I tuoi codici personali**) e rispetto ai codici già presenti; se uno non va bene, non viene creato nulla e Kept segnala il codice. Scansionare o cercare un codice trova il suo vano.
- **Annulla:** l'**Annulla** della notifica mette il mobile e i suoi vani nel Cestino e libera i loro codici, a patto che non ci sia stato messo nulla dentro o modificato da allora.
- **Etichette:** sul nuovo mobile, **Etichetta tutto qui** stampa un'etichetta per esso e per ogni vano, in ordine di conteggio.
- **La sua pagina** mostra i vani come sta, numerati come le loro etichette. Tocca uno per aprirlo. **Stampa le loro etichette** li stampa tutti di nuovo, in ordine di conteggio, con i nomi che hanno ora.
- **Sposta nel cestino:** i suoi vani vanno nel Cestino con esso e tornano con esso con **Ripristina**. Se c'è qualcosa nel mobile o in un vano, Kept chiede solo di quello: **Spostali in** la stanza in cui si trova (oppure **Scegli un altro posto**), oppure **Cestina anche quelli**. Una scatola si sposta così com'è, con ciò che contiene. Un posto che hai aggiunto tu al mobile conta come qualcosa al suo interno. L'**Annulla** della notifica rimette ogni cosa nel suo vano.

### Ruotare il mobile

**Ruotalo…** nella pagina del mobile, per uno scaffale a cubi non quadrato.

- **La parte alta ora è:** **A destra** o **A sinistra**, come lo guardi. Ogni vano si sposta con l'unità, con i suoi oggetti e la sua etichetta stampata.
- **I suoi vani** viene chiesto ogni volta, perché le etichette sono già applicate:
  - **Rinumera:** ogni vano ottiene il numero, nome e codice di dove si trova ora, contato di nuovo dall'alto a sinistra. Un vecchio codice funziona ancora: apre il vano ora nel posto che ha nominato. Stampa di nuovo le etichette per i nuovi nomi.
  - **Mantieni i codici:** cambia solo come sta. Ogni vano mantiene il suo numero, nome e codici.
- Il foglio mostra la nuova griglia prima di girarlo. Un nome o un codice che hai digitato tu resta con il suo vano in ogni caso.
- **Annulla** riporta indietro, numeri, nomi e codici inclusi, a patto che niente al suo interno sia cambiato da allora.

### Unire e dividere i vani

Un inserto a cubi o un ripiano rimosso rende un unico vano da due o più vani.

- **Unisci o dividi…**, poi tocca vani affiancati che formano un rettangolo e **Unisci**. Quello in alto a sinistra resta, con il suo numero, nome e codice. Gli altri vanno nel Cestino; i loro codici e le etichette stampate aprono il vano unito, e ciò che conteneva si sposta dentro.
- Per dividere un vano unito, toccalo e **Dividi**. Ogni cella torna con il suo codice e la sua etichetta; gli oggetti restano in quello in alto a sinistra.
- **Annulla** inverte entrambe le operazioni.
- **I tuoi modelli:** **Impostazioni → Account → Modelli → Mobili** ha i modelli di posto dell'account: cubi in orizzontale e in verticale (in piedi), ripiani o cassetti, i tipi, i nomi e il modello di codice, condivisi con i luoghi che scegli. Proprietari e amministratori li creano; chiunque possa aggiungere posti li usa.
- Le app AI possono fare lo stesso: `create_place` prende un `template`, e `update_place` un `turn` ([client MCP](/it/users/mcp-clients/#gli-strumenti)). Unire e dividere restano nell'app.

## Nascondi Personale

Ognuno ha un luogo **Personale**. Se non ti serve, attiva **Nascondi Personale** in **Impostazioni → Profilo → I tuoi luoghi**, e disattivalo per mostrarlo di nuovo in qualsiasi momento. È una tua preferenza: nessun altro vede un cambiamento.

- **Sparisce da:** i luoghi nel menu, Home, elenchi, ricerca e i loro filtri. Un modulo che solo Personale tiene traccia (Veicoli, per esempio) esce dal menu con esso.
- **Invariato:** tutto ciò che contiene. Un link a Personale o a un oggetto al suo interno lo apre ancora. Nascondere è fare ordine, non protezione: non blocca nulla.
- **I promemoria ti raggiungono comunque**, come notifiche, nel digesto e nel feed del calendario. Disattivali in **Impostazioni → Profilo → Notifiche**, dove Personale è ancora elencato.
- **Acquisisci** inizia nel tuo altro luogo, o in Personale se non puoi aggiungere oggetti da nessun'altra parte.
- **Importa** offre gli altri luoghi che possiedi o amministri, o Personale se non ce ne sono. Un'importazione passata si apre ancora da Attività, dovunque sia finita.
- **Tieni disponibile offline** in **Impostazioni → Questo dispositivo** mantiene la riga di Personale finché la sua copia è sul dispositivo, così puoi disattivarla.
- **Esporta i miei dati** porta il primo altro luogo che possiedi, e Personale resta su **Esporta un luogo**. Se non possiedi altri luoghi, porta Personale.
- **La tua chiave AI personale** paga anche per un luogo che possiedi e usi da solo, quando l'account di quel luogo non ha una chiave propria. Non paga mai per un luogo condiviso.
- L'assistente esclude Personale, a meno che non lo apra da Personale. **Connessioni** (token personali e app connesse) mantengono i luoghi che hai dato loro, nascosti o meno.

Non puoi nasconderlo mentre è il tuo unico luogo. Se diventa il tuo unico luogo più tardi (te ne vai, vieni rimosso, l'altro luogo viene cancellato), ricompare da solo, e si nasconde di nuovo quando ne hai un altro.

## Correlati

- [Uso quotidiano](/it/users/everyday-use/) per il quadro d'insieme.
- [Tag](/it/users/tags/) per ciò che un oggetto è oltre a dove si trova.
- [Condividere un luogo](/it/users/everyday-use/#condividere-un-luogo) per far entrare le persone in uno.
