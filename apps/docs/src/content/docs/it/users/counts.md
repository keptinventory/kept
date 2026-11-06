---
title: Conteggi e inventari
description: Ogni conteggio e controllo della scatola viene mantenuto, con ciò che è stato trovato, ciò che mancava e dove si trova ora ogni cosa. Conta un posto insieme, pianifica un conteggio ogni pochi mesi, confronta con l'ultimo ed esporta un CSV.
---

Un conteggio conserva ogni risultato. **Conteggi** elenca ogni conteggio e controllo della scatola di un luogo, dal più recente, e la pagina del conteggio mostra ciò che ha trovato, ciò che ha lasciato mancante e dove si trova ora ogni cosa.

Aprilo da **Altro → Conteggi**, dalla pagina di un luogo (**Conteggi**), o dalla pagina di un posto (**Conteggi passati**). Dopo aver salvato un conteggio, **Vedi questo conteggio** lo apre.

## L'elenco dei conteggi

Cerca per ciò che è stato conteggiato, e filtra per tipo (conteggi, controlli della scatola), posto, chi ha contato, **Aveva mancante** e data. Raggruppa per posto, persona o mese. L'elenco è paginato, e ogni filtro è nell'indirizzo, quindi un elenco filtrato può essere aggiunto ai segnalibri o salvato come vista.

## La pagina del conteggio

- **Trovati X su Y**, quando, quanto tempo è durato, chi ha contato (tutti, in un conteggio condiviso) e chi lo ha completato.
- **Dal conteggio precedente** dello stesso posto o scatola: "1 nuovo mancante · 0 ritrovato nuovamente · 2 nuovi oggetti", con un collegamento al precedente.
- I suoi elenchi, ogni riga collega l'oggetto con dove si trova ora:

| Elenco | Cosa significa |
|---|---|
| Trovati | Letto durante il conteggio: segnato come visto |
| Mancanti | Nell'elenco, non letto, e non segnato come non qui |
| Trovato altrove | Letto qui, ma Kept lo aveva da qualche altra parte, e tu lo hai lasciato lì |
| Spostato qui | Trovato altrove, e spostato qui |
| Marcato non qui | Scelto nel riepilogo |
| In prestito, In riparazione, Nel cestino | Mai mancante: lontano per un motivo noto a Kept |
| Non conteggiato: Retro scaffale | In un'area che nessuno ha conteggiato (vedi sotto) |

Un oggetto cestinato dopo il conteggio viene comunque mostrato, marcado **Cestinato**.

**Esporta CSV** salva il conteggio come foglio di calcolo: oggetto, ID breve, dove era previsto, il risultato, quanti sono stati trovati su quanti, e dove si trova ora.

Conteggi salvati prima di Kept 1.14 mostrano i loro totali; non registravano ciò che mancava o era altrove.

## Mai "mancante" per un motivo

Un oggetto che è in prestito, in riparazione o nel cestino non è mai elencato come mancante. Il riepilogo assegna a ciascuno il proprio gruppo, "Con Murdock (3)", "In riparazione (1)", e il conteggio li mantiene così.

## Non conteggiato, e "Ho controllato"

Un conteggio di un posto con posti al suo interno (o di un intero luogo) ha **aree**: il posto e ogni posto al suo interno. Un'area dove nulla è stato letto è **Non conteggiato**: i suoi oggetti sono elencati sotto "Non conteggiato: Retro scaffale", non sotto Mancanti. Se hai guardato e l'area era davvero vuota di quegli oggetti, tocca **Ho controllato**: diventano Mancanti.

## Conteggio per quantità

Un oggetto con una quantità (6 lattine) conta tutte quando la sua etichetta viene letta. Usa **−** e **+** sulla sua riga per dire quanti ne hai trovati. Se trovi meno, scegli **Segna il resto non è qui** per esso: il resto viene separato come una riga a sé, segnato come non qui, come fa un controllo della scatola. Annulla lo riporta insieme.

## Conteggio insieme

Un conteggio avviato online è condiviso. Chiunque altro apre un conteggio dello stesso posto vede **Conteggio in corso da Sam: Unisciti**. Partecipare aggiunge ciò che hai letto allo stesso conteggio, ogni lettura con chi l'ha letto; il riepilogo mostra ciò che gli altri hanno trovato, e le loro aree contano come conteggiate. Chiunque sta contando lì può finirlo, e terminare richiede una connessione. Un conteggio partecipato per diversi giorni rimane aperto finché qualcuno non lo completa.

## Copertura delle etichette

La configurazione del conteggio indica quanti degli oggetti presenti hanno etichette ("62% degli oggetti qui hanno etichette"), con **Stampa le etichette per il resto**. Un oggetto senza etichetta non è mai mancante: segnalo nel riepilogo se lo hai visto.

## Conteggi pianificati

Nella pagina di un posto, **Conta regolarmente** pianifica un conteggio ogni 1-24 mesi. È un programma del posto, con il promemoria abituale (una settimana prima), la scadenza e il ritardo, e il riquadro Tocca a te. Contare quel posto (con o senza i posti al suo interno) lo segna come fatto; annullare il conteggio annulla anche quello. Per contare regolarmente un intero luogo, pianificalo sul suo posto principale.

## Chi può fare cosa

| | Proprietario, amministratore, membro | Visualizzatore |
|---|---|---|
| Visualizza Conteggi, pagina del conteggio, confronta, esporta CSV | ✓ | ✓ |
| Conta, partecipa a un conteggio | ✓ | Un controllo: niente salvato, non elencato |
| Pianifica un conteggio | ✓, con Pianificazioni attive | — |
