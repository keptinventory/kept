---
title: Fornitori di IA
description: Quali fornitori di IA funzionano con Kept, dove vanno le chiavi, cosa invia e costa ogni funzione, limiti di spesa, modelli locali e come disattivare l'IA.
---

Kept funziona anche senza IA. Collegare un fornitore aggiunge tre cose: assegnare un nome agli oggetti dalle foto e leggere scontrini, etichette e letture dei contatori; l'assistente, che risponde alle domande sul tuo inventario; e, con un modello di embedding, la ricerca per significato. Porti la tua chiave: Kept non ha un servizio IA proprio.

## Fornitori

| Fornitore | Foto e scontrini | Assistente | Ricerca per significato |
|---|---|---|---|
| **Groq** (consigliato) | sì | sì | nessun modello di embedding |
| **OpenAI** | sì | sì | sì |
| **Anthropic** | sì | sì | nessun modello di embedding |
| **Google** (Gemini) | sì | sì | sì |
| **OpenRouter** | sì | sì | sì (i suoi modelli di embedding) |
| **Compatibile con OpenAI** (Ollama, LM Studio, …) | i modelli che indichi | i modelli che indichi | se il server ne offre uno |

**Groq con `qwen/qwen3.8-27b`** è il consiglio: il risultato affidabile più economico misurato da Kept, circa USD 0,004 a scontrino (su immagini di prova sintetiche, 2026-09-26). Incollare una chiave Groq lo seleziona, e **Perché?** nella pagina dà i numeri. Kept suggerisce un modello per ogni fornitore e attività; puoi sceglierne un altro dall'elenco del fornitore sotto **Avanzate**, o scrivere qualsiasi id di modello.

## Dove va la chiave

Ci sono tre posti per una chiave, e nessuna chiave per singolo luogo:

| Chiave | Impostata in | Paga per |
|---|---|---|
| **La chiave dell'account** | **Impostazioni → IA**, dal proprietario dell'account | Ogni luogo di cui è proprietario quell'account |
| **La tua chiave personale** | **Impostazioni → IA → Chiave IA personale** | Il tuo luogo Personale, i tuoi thread privati dell'assistente e le domande che riguardano più proprietari. Con [Personale nascosto](/it/users/locations/#nascondi-personale), anche un luogo di cui sei proprietario e che usi da solo, quando il suo account non ha chiave |
| **Chiave di questo server** | **Admin → IA**, da un amministratore dell'istanza | Chiunque il cui account sia privo di una chiave propria |

Lavorare in un luogo (assegnare un nome a una foto, una risposta dell’assistente su di esso) è pagato dal **proprietario del luogo**, quindi i membri dell’abitazione di Alfred "Family house" usano la chiave di Alfred, non la propria. Membri e spettatori vedono una riga di sola lettura che indica chi paga.

**Collegamento:** incolla la chiave in **Incolla la tua chiave**. Kept riconosce il fornitore dalla chiave quando può (altrimenti sceglilo sotto **Avanzate**), poi **Salva e prova** verifica che il modello legga le foto e dia risposte strutturate, e indica il costo del test. Le chiavi sono di sola scrittura: Kept non mostra mai di nuovo una chiave salvata, e **Sostituisci la chiave** la sostituisce. Prima della prima chiave su un server, l'amministratore dell'istanza deve salvare il [kit di recupero](/it/admin/recovery-kit/): la chiave è un segreto che Kept deve poter recuperare da un backup.

**Avanzate** contiene il fornitore e l'URL di base, il modello per ogni attività (**Modelli**), **Sforzo di ragionamento** (basso per impostazione predefinita), i limiti e i prezzi.

**Modelli:** l'elenco è quello proprio del fornitore, richiesto ogni volta che si apre il selettore (Kept lo riutilizza per dieci minuti; **Aggiorna l'elenco** lo richiede di nuovo). I modelli `:free` di OpenRouter sono nell'elenco, contrassegnati "free: shared, may be busy": un pool condiviso che spesso risponde "busy". Sotto ogni selettore, **ID del modello personalizzato** accetta qualsiasi id, per ogni fornitore, incluso uno che l'elenco non mostra; poi **Salva e prova** lo verifica. Se il fornitore non risponde all'elenco, resta solo digitare l'id.

## Cosa usa l'IA, e quanto costa

Le impostazioni dell'IA si aprono con **Cosa usa l'IA in Kept**: una riga per azione (una foto acquisita, uno scontrino, un'etichetta, una lettura, una domanda all'assistente, una ricerca, il test), con quante chiamate fa, i token che usa e il costo dalla tabella dei prezzi, a partire dal tuo uso degli ultimi 30 giorni una volta che ce n'è. Sotto **Questo mese**, una barra per limite mostra la spesa finora.

- **Acquisisci** (modalità Oggetto, Ricevuta, Etichetta, Lettura): una chiamata per foto. I nomi, i marchi, i modelli e i tipi vengono compilati; prezzi, date, numeri di serie e letture restano nell'Inbox come valori suggeriti da accettare. Ogni bozza compilata dall'IA riporta una riga come "Letto da qwen/qwen3.8-27b (Groq) · 2.502 token", con il costo e chi ha pagato.
- **Più oggetti in una foto** (modalità Thing; Admin → Impostazioni, disattivato per impostazione predefinita): la stessa chiamata dà un nome a fino a 12 oggetti nella foto. Il primo compila la bozza della stessa acquisizione e conserva la foto; ognuno degli altri diventa una bozza accanto, nello stesso posto e batch, con la propria immagine ritagliata dalla foto, da confermare, unire o scartare nell'Inbox. Quanto bene le immagini vengono ritagliate dipende dai riquadri del fornitore, quindi controlla qualche bozza dopo averla attivata.
- **Foto della stanza** (modalità Room): una chiamata per foto che elenca fino a 60 oggetti, e per più foto una breve chiamata solo testo che le unisce. Gli oggetti diventano bozze nella stanza, ciascuno con la propria immagine ([Foto della stanza](/it/users/room-photos/)).
- **Piante** (il **Parti da una pianta** della mappa del luogo): una chiamata per pianta, che legge le stanze, le loro etichette e le dimensioni stampate; Kept calcola le misure e si posiziona da sé, e tu le controlli prima che venga aggiunto qualcosa ([la mappa del luogo](/it/users/location-map/#parti-da-una-pianta)). Il foglio mostra quanto al massimo una lettura può prendere prima di essere inviata: circa 11.000 token su Groq, una stima.
- **L'assistente** risponde dal tuo inventario secondo il tuo ruolo, e ogni strumento che usa aggiunge una chiamata. Le modifiche che propone compaiono come scheda di conferma da approvare; per gli spettatori è di sola lettura.
- **Parole di ricerca dopo un'importazione**: un'importazione può offrire **Aggiungere parole di ricerca con l'IA?**, con la stima dei token prima ([importazione](/it/users/import-export/)).

Le pagine **Utilizzo dell’IA** elencano ogni chiamata: **Il mio uso dell’IA** per tutti, l'uso di un luogo per i suoi amministratori e proprietario, quello dell'account per il suo proprietario e quello dell'istanza sotto Admin → IA. Ognuna mostra totali, token al giorno impilati per attività, dettagli per attività, persona e luogo dove si applicano e l'elenco delle chiamate con **Esporta CSV**. Una chiamata registra modello, token, esito e costo, mai il prompt, la foto, la risposta o la chiave.

I prezzi vengono dalla **tabella dei prezzi**, che gli amministratori dell'istanza modificano in Admin → IA (con **Compila dal listino di …** per i fornitori che pubblicano i prezzi). Il prezzo del modello Groq consigliato viene compilato per te. Una chiamata senza prezzo è contata in token e mostrata come costo sconosciuto.

## Limiti e pausa

Nulla è limitato per denaro a meno che qualcuno non scelga: dopo la prima chiave Kept offre **Impostare un limite mensile?** con un importo suggerito, e **Nessun limite**. Sotto **Avanzate**, **Limiti** contiene:

- **Importo al mese** (in una valuta attivata dal server) e **Token al mese**, per l'account; il tetto proprio di un luogo dentro quello dell'account, impostato dal proprietario; e un limite per persona.
- La lettura di foto e scontrini ha un budget di token di 60.000 token al minuto, 2.000.000 al giorno e 20.000.000 al mese per account pagante, salvo modifica.
- **Metti in pausa l'IA** ferma tutte le chiamate a mano finché non riprendi.

Quando si raggiunge un limite, l'IA si mette in pausa solo per quell'ambito, con un banner come "IA in pausa fino al 1 ott · Limite mensile di Home raggiunto". **Le acquisizioni si salvano comunque; l'assegnazione dei nomi aspetta**, e riprende quando l'IA riprende. Chi ha impostato il tetto ottiene **Riprendi ora**, per aumentarlo, rimuoverlo o mantenerlo in pausa. Il limite di frequenza proprio di un fornitore non è una pausa: le righe di avanzamento dicono "In attesa di Groq · circa 20 s" e continuano.

Una richiesta all'assistente viene tenuta sotto il limite per minuto del fornitore una volta che il fornitore lo ha indicato (livello gratuito di Groq: 8.000 token al minuto). Ogni richiesta porta gli strumenti di cui tratta la domanda: trovare oggetti e le modifiche quotidiane sempre, e prestiti, programmi, garanzie, documenti, veicoli, stock, cronologia o luoghi quando la domanda (o le ultime del thread) li nomina, in una qualunque delle lingue di Kept; uno strumento che il modello chiede e non è stato inviato viene inviato al passo successivo. Una prima domanda con tutti i moduli attivi arriva a circa 3.100 token prima dell'assegnazione della risposta. Se una richiesta è ancora troppo grande, Kept invia meno strumenti, poi chiede una risposta più breve, poi esclude i risultati di strumento più vecchi da ciò che invia; il thread li conserva. Una domanda che ancora non ci sta fallisce con "too large": un modello o un piano con limite più alto la risolve.

## Cosa viene inviato al fornitore

Il riassunto proprio di Kept, mostrato accanto a ogni fornitore:

> Solo una copia della foto con i dati di posizione e della fotocamera rimossi, mai l'originale. Le istruzioni fisse e le lingue del tuo luogo. Per l'assistente, la tua domanda e l'inventario che consulta, entro il tuo ruolo. Mai i campi segreti.

Una pianta invia lo stesso tipo di copia (la prima pagina di un PDF disegnata come immagine, con il testo di quella pagina) e nessuno dei tuoi nomi di luogo, stanza o piano; il testo proprio della pianta viene inviato come dati, e nulla di ciò che Kept conserva dalla risposta è un nome, un indirizzo o un numero della pianta, a parte le etichette e le dimensioni delle sue stanze.

Sotto di esso, Kept riassume cosa il fornitore dice di fare con i dati API (addestramento, conservazione) e collega la sua policy. Un server che gestisci tu stesso conserva ciò che lasci conservare.

## Ricerca e embedding

La ricerca per parole chiave funziona sempre, incluse le parole di ricerca che l'IA aggiunge agli oggetti in ciascuna lingua del luogo. La ricerca per significato richiede un modello di embedding, che proviene da uno di tre posti, impostato dall'amministratore del server con `KEPT_EMBEDDINGS` ([configurazione](/it/reference/configuration/)):

- `provider` (il predefinito): il fornitore del luogo, quando ha un modello di embedding (OpenAI, Google, OpenRouter o un server compatibile con OpenAI). Scegline uno sotto **Avanzate → Modelli → Cerca**; OpenRouter non ha predefinito e ne elenca di gratuiti. Groq e Anthropic non ne hanno, quindi con quelli la ricerca resta solo per parole chiave e lo dice. Una chiave più in alto nella catena con un modello di ricerca (quella di questo server) copre un luogo la cui chiave ne è priva.

  Quando una chiave ha un modello assistente ma nessun modello di ricerca, e nulla più in alto lo fornisce, **Impostazioni → IA** dice **La ricerca trova solo per nome**, con il passo: **Scegli un modello di ricerca**, oppure per Groq e Anthropic **Scegli un altro fornitore**. Admin → Status → Search embeddings conta i luoghi che cercano solo per nome, senza nominarli.

  Kept chiede a OpenAI e Google vettori di 768 numeri. Gli altri modelli rispondono con la loro lunghezza, che deve essere 2.000 o meno: un modello con vettori più lunghi non può essere usato per la ricerca. Una richiesta che torna con vettori di lunghezza diversa da quella richiesta, o di due lunghezze, viene rifiutata e nulla viene salvato.
- `local`: un piccolo modello dentro Kept, senza chiave e senza costo per chiamata. Kept rifiuta questa impostazione a meno che il runtime del modello locale non sia installato.
- `off`: solo ricerca per parole chiave.

## Modelli locali con Ollama

Per tenere tutto sul tuo hardware, esegui un modello con Ollama e aggiungilo come fornitore **Compatibile con OpenAI** con il suo URL di base; Kept non compila nulla per questo tipo, quindi nomini tu i modelli. Un indirizzo sulla tua rete privata deve essere autorizzato da un amministratore dell'istanza in Admin → Impostazioni prima. Installazione, memoria e profilo Compose: [Ollama](/it/admin/ollama/).

## Disattivare l'IA

- **Per un luogo:** **Impostazioni del luogo → Cosa monitorare**, sotto **IA in questo luogo**, disattiva **Acquisizione con IA e assistente**. L'acquisizione funziona comunque; gli oggetti aspettano nell'Inbox per un nome.
- **Per un po':** **Metti in pausa l'IA**, sotto Avanzate.
- **Senza collegare affatto:** senza chiave a nessun livello non viene inviato nulla, e il passo **Collega un provider di IA** della checklist può essere ignorato.

La pagina IA non ha un pulsante per eliminare una chiave salvata; sostituiscila, mettila in pausa o disattiva l'IA per luogo.

:::note[ChatGPT o Claude come client]
"Collega ChatGPT o Claude" (il preset Complete) funziona al contrario: la tua app IA legge e aggiorna Kept via MCP, usando il proprio modello e abbonamento, con un token che crei in **Impostazioni → Connessioni**. Vedi [collegare app IA](/it/users/mcp-clients/) e, per i dettagli, [MCP](/it/developers/mcp/).
:::
