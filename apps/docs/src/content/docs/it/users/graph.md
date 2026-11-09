---
title: Il grafo
description: Guarda un luogo come un grafo dei suoi piani, stanze, scatole e oggetti, in 2D o 3D, con ciò che richiede attenzione e i tuoi tag.
---

La pagina di un luogo ha cinque layout: **Elenco**, **Griglia**, **Grafo**, **Tabella** e **Mappa**. La **Tabella** è disponibile solo su schermi larghi, quindi un telefono mostra Elenco, Griglia, Grafo, Mappa. Il **Grafo** disegna il luogo come nodi e collegamenti: il luogo, i suoi piani, le stanze su di essi, gli scaffali, gli armadi e le scatole nelle stanze, e gli oggetti in quelli. Kept ricorda la tua scelta per ogni luogo su ogni dispositivo. La pagina di un piano o di una stanza ha anche **Grafo**, aperto su quel posto.

## 2D

Il grafo 2D mostra un posto al centro e due livelli attorno: ciò che è direttamente dentro di esso nel primo anello, e ciò che è dentro quelli nel secondo anello, quando c'è spazio per esso.

- **Dimensioni** mostra quanto c'è dentro: un nodo più grande contiene più oggetti.
- Un nodo il cui contenuto non è disegnato mostra il loro **numero**.
- **Scegli** un nodo per vedere la sua scheda. **Sceglilo di nuovo**, oppure **Entra** nella scheda, per metterlo al centro.
- Il **percorso** sopra il grafo (Casa › Piano terra › Garage) torna indietro.
- **Stanze, Scatole, Tutti** sceglie quanto approfondire il disegno: solo posti, posti e scatole, o tutto fino agli oggetti.

Trascina per spostare il grafo, scorri o fai un pinch per fare lo zoom, e il pulsante della casa mostra nuovamente l'intero luogo.

## 3D

**3D** mostra l'intero luogo contemporaneamente: il luogo sopra, ogni piano come uno strato alla propria altezza, le stanze in un anello attorno al loro piano, e ciò che contengono disposto a ventaglio oltre di esse. Un luogo senza piani è uno strato.

Ruota lentamente da solo finché non lo tocchi, e rimane fermo quando il tuo dispositivo richiede meno movimento. Trascina per girarlo, scorri o fai un pinch per fare lo zoom. I pulsanti accanto lo fanno ruotare a sinistra e destra, guardare dall'alto o dal basso, fare lo zoom, avviare o fermare la rotazione, e mostrare tutta la casa. I pulsanti dei piani (come sulla mappa) portano un piano in avanti; **Tutti** mostra tutti i piani.

Selezionare un nodo porta in avanti il suo ramo: tutto ciò che è fuori svanisce, e il nodo indica cosa contiene. Kept ricorda se usi 2D o 3D per te su ogni dispositivo.

## Pin e tag

I punti su un nodo mostrano cosa richiede attenzione al suo interno, nei colori della mappa: **Scorte basse** (rosso), **Prestati** (blu) e **A breve** (arancione). Provengono dagli stessi posti dei pin della mappa: Consumabili, Prestiti, e programmazioni, garanzie e documenti. Anche il nome del nodo per uno screen reader li dice ("Garage, Stanza, 9 oggetti, 1 prestato").

Attiva **Tag** per aggiungere i tuoi tag come chip nei loro colori, ciascuno collegato ai posti e alle scatole che contengono gli oggetti su cui sono. Seleziona un tag per elencare cosa lo trasporta.

## La scheda

La scheda mostra dove si trova un nodo, cosa è, quanti oggetti ci sono dentro, i suoi puntatori e cosa contiene (seleziona qualsiasi elemento). **Apri** va alla sua pagina, **Mostra sulla mappa** apre la mappa su di esso (o sul posto che contiene un oggetto), e **Entra** lo pone al centro del grafo 2D. Su un telefono la scheda è un foglio in basso; **×** o Esc la chiude.

## Con una tastiera o uno screen reader

Ogni nodo è un pulsante. Tab sposta tra essi nell'ordine dell'albero, Invio seleziona uno e Invio di nuovo entra, e Esc chiude la scheda e poi sale di un livello. Sotto il grafo, un elenco di ciò che mostra (per gli screen reader, e visualizzato quando ti ci sposti con Tab) fa lo stesso.

## Luoghi grandi

Kept disegna fino a 2.000 oggetti in un grafo. Oltre quel limite, i rimanenti vengono conteggiati nei loro posti e scatole ma non disegnati. In 3D, un luogo con più di circa 450 posti, scatole e oggetti mostra gli oggetti solo per il ramo che hai selezionato.
