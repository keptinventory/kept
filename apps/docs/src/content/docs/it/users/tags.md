---
title: Tag
description: Tags dicono cos'altro è un oggetto, oltre dove si trova. Aggiungi i tag ovunque, filtra per diversi, apri la pagina di un tag, e aggiungi tag su un telefono senza segnale.
---

**Posti** dicono dove si trova un oggetto. **Tag** dicono cos'altro è: *camping*, *winter*, *kids*,
*fragile*. Un oggetto può avere fino a 50 tag; un account fino a 1.000.

I tag appartengono all'account, quindi ogni suo luogo li condivide. Solo gli oggetti hanno tag (le scatole sono oggetti); posti, documenti e persone no.

## Aggiunta dei tag

- **La pagina dell'oggetto:** **Tag → Aggiungi tag**. Scegline uno, o digita un nuovo nome e **Crea**. Un nome vicino a un tag esistente è elencato per primo sotto **Forse cercavi**, così *Campng* non diventa un secondo *Camping*.
- **Aggiungere un oggetto:** il campo **Tag** in **Aggiungi un oggetto**.
- **Acquisizione:** **Aggiungi tag** sotto il nome. I tag rimangono per le prossime foto, così come avviene per il posto.
- **Molti contemporaneamente:** **Seleziona** nei contenuti di un posto, nella pagina di un tag o nell'Inbox, poi
  **Aggiungi tag…** o **Rimuovi tag…**. Altri tag rimangono come sono.
- **Visualizzazione foglio di calcolo:** la colonna **Tag** e **Tag…** per una selezione.

Ogni modifica ha **Annulla**.

## Chi può fare cosa

| | Proprietario | Amministratore | Membro | Visualizzatore |
|---|---|---|---|---|
| Vedi i tag, filtrali per loro | ✓ | ✓ | ✓ | ✓ |
| Etichettare gli oggetti, crea un nuovo tag | ✓ | ✓ | ✓ | |
| Rinomina, ricolora, unisci, elimina un tag | ✓ | ✓ | | |

## Colori

Ogni tag ha un colore da un insieme fisso di dodici, scelto per essere leggibile in chiaro e scuro. Un nuovo tag prende il colore usato meno spesso. Cambialo in **Impostazioni → Account → Tag → Modifica**. I colori da un'importazione di Homebox diventano il più vicino tra i dodici.

## La pagina di un tag

Fai clic su un tag nella pagina di un oggetto, o su una riga in **Impostazioni → Account → Tag**. Elenca tutto ciò che ha quel tag nei tuoi luoghi, con quanti in ciascuno, e la solita ricerca, filtri e raggruppamento della lista. Proprietari e amministratori rinominano, riccolorano, uniscono ed eliminano qui.

- **Unisci** incorpora un tag in un altro: i suoi oggetti ricevono l'altro tag.
- **Elimina** funziona solo per un tag che nessun oggetto ha, compresi gli oggetti nel Cestino. Usa invece l'unione.
- **Rinomina**, **Ricolora**, **Unisci** e **Elimina** possono essere annullati per 7 giorni.

## Ricerca per tag

- **Filtro → Tag:** **è uno tra**, **ha tutti tra** (oggetti con ogni tag scelto) o **non è nessuno tra**.
- **Aspetto → Raggruppa: Tag** elenca ogni oggetto sotto il suo primo tag, dalla A alla Z; gli oggetti senza tag vengono ultimi.
- La ricerca trova i nomi dei tag, e la ricerca per significato li conosce anche.

## Offline

Il telefono conserva i tuoi tag: i chip vengono mostrati, e il filtro tag funziona nella ricerca offline. I tag che aggiungi o rimuovi, e quelli che crei, vengono salvati sul telefono e si sincronizzano quando sei di nuovo online.

## AI e MCP

- **Acquisisci:** con l'AI attivata, una foto suggerisce tag dalla tua lista, mai nuovi. Conferma o
  rifiutali nella Inbox.
- **MCP e l'assistente:** `get_thing` restituisce tag; `list_tags` li elenca; `tag_things` li aggiunge
  o li rimuove; `search_things` accetta diversi tag, qualsiasi o tutti; `add_thing` e
  `update_thing` accettano nomi di tag.

## Importazioni

- **Homebox:** i tag vengono importati con i loro colori; i tag annidati vengono appiattiti. I tag dei
  luoghi di Homebox non vengono mantenuti, e il rapporto di importazione lo indica.
- **CSV:** una colonna `tags` crea i tag che denomina.
