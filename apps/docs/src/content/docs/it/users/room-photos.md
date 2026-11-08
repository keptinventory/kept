---
title: Foto delle stanze
description: Fotografia una stanza, un armadio o uno scaffale, e Kept elenca ciò che contiene come bozze nella Posta in arrivo, ciascuna con la propria immagine, saltando ciò che Kept già ha.
---

**Stanza** è una modalità di acquisizione per riempire Kept rapidamente: acquisisci fino a cinque foto di una stanza, un armadio o uno scaffale, e l'AI elenca ogni oggetto che vede. Kept unisce lo stesso oggetto visto in due foto, elimina ciò che è già in Kept, e mette il resto nella Posta in arrivo come bozze già presenti in quella stanza, ciascuna con la propria immagine ritagliata dalla foto.

## Prima di iniziare

La modalità Stanza legge le foto con l'AI, quindi richiede ciò che altre acquisizioni con AI richiedono:

- **Acquisizione con IA** attivata nel luogo (un proprietario o amministratore la attiva, in **Impostazioni del luogo → Cosa monitorare**), e un provider AI che legge le foto ([Provider AI](/it/users/ai-providers/)).
- Puoi modificare gli elementi nel luogo: membri, amministratori e proprietari. Gli spettatori non vedono la modalità.

Quando la modalità Stanza non può essere eseguita, essa indica il motivo invece di nascondersi: l'acquisizione con IA è disattivata nel luogo, nessun provider che legge le foto è configurato, oppure il budget AI è esaurito per ora.

## Scatta le foto

1. Apri **Acquisisci**, poi **Stanza** sulla barra delle modalità. Dalla pagina di un posto, **Riempi dalle foto**
   lo apre in quel posto; sulla [mappa del luogo](/it/users/location-map/), la scheda della stanza ha
   **Fotografa questa stanza**.
2. Controlla dove vanno le foto: il chip del posto in alto. Un'acquisizione di stanza va in una stanza, un punto
   o un contenitore, mai nell'area Senza posto.
3. Acquisisci da 1 a 5 foto, oppure selezionale con **Galleria**. Posizionati sulla porta e scatta una foto
   per parete. Ogni foto rimane nella vaschetta, dove puoi rimuoverla.
4. **Invia**. Offline, le foto rimangono sul telefono e vengono inviate quando torna online, proprio come qualsiasi acquisizione.

Le etichette di Kept nelle foto vengono lette sul telefono prima di essere inviate. Un oggetto la cui etichetta è visibile è noto con certezza, ovunque si trovi nel luogo.

## Controlla la stanza

La Posta in arrivo mostra una scheda **Stanza** all'inizio del lotto di acquisizione, con le bozze che ha creato sotto di essa:

- **Nuovi oggetti**: ogni bozza nella stanza, con la propria immagine, nome, marca, modello, colore e tipo compilati dove la foto li mostrava. Accetta, modifica o scarta queste bozze come qualsiasi altra bozza, oppure **Accetta i nomi** per l'intero lotto. Una bozza che sembra un oggetto che già possiedi è segnalata come probabile duplicato.
- **Mobili contenitori** (scaffali, librerie, armadi, guardaroba, cassettiere):
  **Aggiungi come luogo** ne fa un posto all'interno della stanza, così gli oggetti possono entrarvi. Altri mobili (un divano, un letto, un tavolo) sono bozze come qualsiasi altro oggetto.
- **Già in Kept**: oggetti che le foto hanno mostrato che la stanza già possiede, per la stessa etichetta, stessa marca e modello, o stesso nome. Seleziona questi oggetti e **Segna come visto**. Un oggetto la cui etichetta è stata letta inizia selezionato.
- Ogni foto indica cosa ha fornito. «Impossibile leggere la foto 3» significa che quella foto ha fallito e le altre vengono comunque conteggiate; «Questa foto ne mostra di più; scatta una più ravvicinata» indica che mostra più oggetti di quanto una singola foto possa elencare (60 oggetti).

Persone, animali domestici e la stanza stessa (pareti, pavimenti, finestre, porte, dispositivi) non vengono mai elencati, e nessuna immagine viene mai ritagliata di una persona.

**Fatto** chiude la scheda. **Scarta** elimina le foto. Quando nessuna foto può essere letta, **Riprova**
le legge nuovamente.

### Sulla mappa

Quando la stanza viene disegnata sulla [mappa del luogo](/it/users/location-map/), ogni oggetto accettato viene posto sul pavimento della stanza con una forma ipotetica basata sul suo tipo e nome, in uno spazio libero. La prossima volta che utilizzi **Sistema**, la mappa elenca ciò che Kept ha posizionato, così puoi spostare ciascun oggetto dove si trova realmente. Il posizionamento automatico di Kept non interrompe mai qualcuno che sta organizzando la mappa nello stesso momento.

## Quanto costa

Ogni foto corrisponde a una lettura AI, e un'acquisizione di più di una foto aggiunge una breve chiamata solo testo che unisce ciò che le foto hanno in comune. Prima di inviare, la vaschetta mostra un limite superiore, ad esempio «Circa 3 foto, fino a ~31.000 token, Groq»: la foto, le istruzioni e la risposta più lunga consentita da Kept per ogni foto; una risposta più breve costa meno. Un modello che pensa prima di rispondere addebita anche il tempo di pensiero.

La lettura della stanza conta dagli stessi budget e limiti delle altre letture di foto. Quando viene raggiunto un limite, la scheda mostra «In attesa del budget AI», e le foto vengono lette quando l'AI riprende. Ogni chiamata viene visualizzata in **Utilizzo dell’IA** come **Foto di stanza** o **Unione delle foto della stanza**.

## Privacy

- Ciò che il provider riceve è identico a qualsiasi acquisizione: una copia di ogni foto con dati di posizione e della fotocamera rimossi, e le istruzioni fisse.
- **Le foto complete della stanza vengono eliminate quando chiudi la scheda della stanza** (Fatto o Scarta). Ogni bozza conserva solo la propria immagine ritagliata.
- **Mentre la scheda della stanza è aperta, le sue foto sono private alle persone che la esaminano**: proprietari, amministratori e membri del luogo. Gli spettatori non le vedono né nella pagina della stanza né in quella del contenitore, né nei risultati di ricerca né sul loro telefono, e nemmeno un token API di sola lettura, una connessione MCP di sola lettura o un link di condivisione. Mentre è sotto revisione, una foto della stanza non è mai l'immagine di copertina di un contenitore.
- Per conservare invece le foto complete, un proprietario o amministratore attiva **Conserva le foto delle stanze dopo la revisione** in **Impostazioni del luogo → Generali**. Dopo **Fatto** rimangono nella pagina della stanza come foto ordinarie, visibili a chiunque visualizzi il luogo.

## Nella Try Kept

[Try Kept](/it/try/kept/) non dispone di fotocamera e non esegue AI: la modalità Stanza offre **Usa una foto di stanza di esempio**,
una stanza illustrata, e ogni foto della stanza restituisce gli stessi risultati di esempio, così puoi visualizzare la scheda Stanza, le bozze e i mobili senza bisogno di un provider. La vaschetta dice «Nessuna AI viene eseguita in questa dimostrazione»
dove un'installazione reale mostra il costo.
