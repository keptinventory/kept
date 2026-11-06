---
title: Paperless-ngx
description: Collega un oggetto o un luogo alle sue ricevute, manuali e carte di garanzia in Paperless-ngx. Kept memorizza il collegamento e un titolo, non il file, salvo che lo copi dentro.
---

Se tieni i tuoi documenti in [Paperless-ngx](https://docs.paperless-ngx.com/), Kept può collegare un oggetto ai suoi documenti lì invece di caricarli due volte. Il trapano mostra la sua ricevuta e il suo manuale; la cucina mostra la fattura del frigorifero.

Facoltativo: solo se già esegui Paperless-ngx. Kept funziona allo stesso modo senza di esso.

## Prima di iniziare

| Serve | Perché |
|---|---|
| **Paperless-ngx 2.16 o successivo** | Kept chiede la versione API 9 di Paperless, che 2.16 ha aggiunto e 3.x ancora fornisce |
| **Token API** | In Paperless: **Il mio profilo**, poi la freccia circolare accanto al Token API. Kept vede ciò che quell'utente di Paperless vede, quindi basta un utente che possa solo visualizzare i tuoi documenti |
| **Kept può raggiungere Paperless** | dalla macchina su cui Kept è in esecuzione, non dal tuo telefono |
| **`https`**, oppure la tua rete locale | Su semplice `http` il token viaggia non cifrato, quindi Kept accetta `http` solo per un indirizzo nella tua rete locale. Tale indirizzo richiede **Amministratore → Impostazioni → Consenti gli indirizzi privati** ([richieste in uscita](/it/admin/security-model/#richieste-in-uscita-ssrf)) |

## Connetti

Un proprietario o amministratore della posizione:

1. **Impostazioni del luogo → Paperless**.
2. **Indirizzo di Paperless**: l'indirizzo con cui apri Paperless, ad esempio
   `https://paperless.example.com` (un percorso come `/paperless` va bene).
3. **Token API**, poi **Connetti**. Kept effettua l'accesso prima e spiega perché se non riesce: un token rifiutato, un indirizzo che non risponde come Paperless, una versione troppo vecchia.

Una volta connesso, la pagina mostra la versione di Paperless e quanti documenti sono collegati. **Verifica connessione** chiede di nuovo a Paperless. Per cambiare il token, digita uno nuovo e **Salva**; lascialo vuoto per mantenere quello salvato.

## Collegare documenti

Nella pagina di un oggetto, sotto **Documenti**, **Collega da Paperless** si trova accanto a **Aggiungi un file** (in una pagina di luogo, accanto a **Aggiungi documento**). Apre una ricerca nel tuo Paperless: parole dal titolo o dal testo, un corrispondente, un tipo o un tag. L'inizio di una parola basta: `Camel` trova "Camelot". La sintassi di ricerca di Paperless stessa passa mentre la digiti, ad esempio `title:manual` o `*amel*` per il mezzo di una parola. Spunta uno o più e **Collega**.

I documenti collegati appaiono nello stesso elenco Documenti dei file. Ogni documento mostra la sua miniatura, il suo titolo, il tipo e il corrispondente di Paperless, e la data, con:

- **Tipo**: *Manuale*, *Garanzia*, *Ricevuta*, *Fattura* o *Documento*. Cambialo quando il tipo di Paperless non indica cosa sia il documento.
- **Apri in Paperless**: la pagina del documento in Paperless, in una nuova scheda.
- **Scarica**: il documento, tramite Kept. Membri e superiori.
- **Copia in Kept**: vedi sotto.
- **Scollega**: viene rimosso dall'oggetto. Paperless lo conserva.

Il tipo deriva dal tipo del documento in Paperless, poi dai suoi tag: *Ricevuta*, *Fattura*, *Manuale* e *Garanzia* (e le stesse parole in francese, tedesco, italiano e arabo) vengono riconosciuti; qualsiasi altra cosa è un documento. Dopo di ciò il tipo è a tua scelta, e **Copia in Kept** copia il documento in quel tipo. Il filtro **Tipo** in Documenti restringe insieme i file e i documenti collegati.

**Da un [importazione da Homebox](/it/users/import-export/#unesportazione-di-homebox):** un collegamento di Homebox a uno dei tuoi documenti Paperless (`…/documents/123`, oppure l'API `…/api/documents/123/download/`) all'indirizzo a cui questa posizione è connessa viene importato come documento collegato sull'oggetto o sul luogo. Il suo titolo proviene da Paperless, il suo tipo dal tipo di allegato di Homebox. Connetti Paperless prima dell'importazione; qualsiasi altro collegamento rimane un collegamento semplice.

Kept chiede a Paperless i titoli quando l'importazione viene eseguita, non quando controlla l'esportazione. Se Paperless non è raggiungibile, o non ha un documento o non lo mostra al suo utente, l'importazione comunque termina e quel collegamento mantiene il titolo di Homebox, oppure il suo indirizzo se Homebox non ne ha uno. Il rapporto dell'importazione indica quanti. Per ottenere successivamente il titolo da Paperless, **Scollega** il documento e usa **Collega da Paperless**, oppure **Copia in Kept**.

## Documenti collegati o copiati

| | Collegato | Copiato in Kept |
|---|---|---|
| Cosa Kept memorizza | Il numero del documento in Paperless, il suo titolo, tipo, corrispondente e data | Il file stesso, come allegato sull'oggetto |
| Se Paperless è giù | I titoli vengono comunque mostrati, con una nota che Paperless non è raggiungibile | Nulla cambia |
| Nei backup ed esportazioni di Kept | No: un collegamento richiede questo server di Paperless | Sì, come qualsiasi altro file |
| Se il documento cambia in Paperless | Il titolo si aggiorna quando lo copi | La copia rimane com'era |

**Copia in Kept** è per documento ed esplicito: usalo per ciò che deve sopravvivere senza Paperless, come una ricevuta che ti servirà per un reclamo di garanzia. La copia è il file che Paperless mette a disposizione per il download (il suo PDF archiviato quando ne crea uno), controllato e dimensionato come un caricamento.

## Chi può fare cosa

| | Visualizzatore | Membro | Amministratore, proprietario |
|---|---|---|---|
| Vedere documenti collegati e miniature | ✓ | ✓ | ✓ |
| Cercare Paperless, collegare, copiare, scaricare | | ✓ | ✓ |
| Modificare il tipo, scollegare | | Propri propri | Qualsiasi |
| Collegare, modificare, scollegare | | | ✓ |

Le ricevute e le fatture riguardano denaro: dove il denaro è nascosto per te in una posizione, le ricevute e le fatture collegate sono nascoste anch'esse, e non puoi trasformare un documento collegato in uno.

Un [token personale](/it/users/mcp-clients/#crea-un-token-personale) legge i collegamenti di un oggetto o di un luogo (`GET /api/v1/paperless-links?thingId=…`), mai la connessione, una ricerca, una miniatura o un documento. Lo strumento MCP `get_thing` elenca i documenti collegati di un oggetto per titolo.

## Privacy

- Il token è sigillato con la chiave segreta di Kept, come una password della cassetta delle lettere. Kept non lo mostra mai, lo registra, o lo inserisce in una voce di controllo o in un'esportazione.
- Il tuo browser non comunica mai direttamente con Paperless usando il token. Ricerche, miniature e download passano attraverso Kept, che prima verifica che tu possa vedere l'oggetto. Le miniature vengono ricodificate da Kept e conservate per cinque minuti.
- **Apri in Paperless** è un collegamento ordinario: ti autentichi su Paperless come te stesso.
- Spostare un oggetto in un'altra posizione rimuove i suoi collegamenti: essi indicano documenti nella Paperless della posizione precedente, che i membri della nuova posizione potrebbero non vedere.

## Scollega

**Impostazioni del luogo → Paperless → Scollega** elimina la connessione e ogni collegamento ai suoi documenti. I documenti copiati in Kept rimangono.

## Da fare ancora

- Sincronizzazione bidirezionale: Kept non modifica nulla in Paperless.
- Associare automaticamente le ricevute agli oggetti.
- Inviare i propri file di Kept a Paperless.
