---
title: Veicoli e macchine
description: "Registra le letture, i servizi e il carburante per qualsiasi cosa misurata: auto, generatori, caldaie. Pianificazioni per data o per lettura, pianificazioni iniziali, consumabili da scorta e rapporto storico."
---

Kept tiene traccia di qualsiasi cosa con un contatore: un'auto, un generatore, una caldaia, un tosaerba. Un oggetto il cui tipo è misurato ottiene **Contatori**: letture, servizi e pianificazioni. **Veicoli** (predefiniti Domestico e Completo) riunisce tutti i veicoli in un unico posto, ciascuno con schede per panoramica, letture, servizi, documenti, costi e, su Completo, carburante.

Questa pagina riguarda la registrazione delle letture e dei servizi, le pianificazioni, il carburante e il rapporto storico. Per le forme sulla mappa che un veicolo può trasportare, vedere [forme sulla mappa](/it/users/map-shapes/).

## Registrazione di una lettura

Una lettura funziona da Home, dal veicolo e anche offline. Una lettura che non si adatta tra i suoi vicini viene rifiutata, e Kept spiega perché. Una foto del cruscotto si aggiunge alle foto di prova del veicolo.

## Registrazione di un servizio

Un registro di servizio contiene la visita all'officina:

- **Dati** e la **lettura** al momento.
- **L'officina** e **la fattura**. L'IA può compilare le voci dalla fattura.
- **Voci** con i loro costi.
- **Pianificazioni completate**: il conteggio ricomincia da capo.
- **Righe da scorta** (qui sotto).
- **Nota**.

Nella scheda **Servizi** di un veicolo, toccando un servizio si apre tutto ciò che contiene, note incluse.

- **Modifica** apre lo stesso modulo, già compilato. Il salvataggio cambia solo ciò che hai modificato.
- **Elimina** chiede conferma, poi offre **Annulla**. Le sue righe e la fattura lo accompagnano; le pianificazioni che ha completato ricominciano dal servizio precedente.
- Chi può: chi l'ha registrato, e il proprietario e gli amministratori del luogo. Un visualizzatore può aprirlo, ma non modificarlo.
- Una fattura ancora in fase di lettura è una **bozza**: **Completa la registrazione** o **Scarta la bozza**.

## Da scorta

Quando Consumabili è attivato per il luogo, una riga di servizio può scegliere un consumabile dallo stesso luogo: il filtro dell'olio sullo scaffale.

- Il salvataggio sottrae dalla quantità del consumabile la quantità della riga (1 quando la quantità è vuota).
- Kept rifiuta di prendere più di ciò che rimane.
- La modifica della riga, la sua rimozione, l'eliminazione del servizio o l'annullamento di queste azioni riportano il conto al valore corretto.
- Una fattura ancora in fase di lettura non prende nulla finché non la salvi.

La **Storia** del consumabile mostra l'uso, con un link al servizio.

L'assistente e i clienti MCP possono registrare un servizio allo stesso modo (ad esempio «ho usato 4,5 litri di olio motore»). La carta di conferma dell'assistente mostra ogni riga **Da scorta** prima che qualcosa venga spostato.

## Pianificazioni

Una pianificazione è un promemoria per ripetere qualcosa, per data o per lettura.

- **Aggiungi le scadenze di base** aggiunge le solite: cambio olio, rotazione pneumatici, liquido freni, filtro aria.
- **Una tantum** (una data, senza ripetizione) viene eseguita una volta completata. Lascia **Da fare** e **In ritardo**, e **Pianificazioni** la elenca come **Fatta** con il giorno. Annulla il completamento, o elimina quel servizio, e diventa nuovamente in scadenza.
- Le pianificazioni in scadenza e in ritardo compaiono nella sezione **Tocca a te** di Home, e nel feed del calendario e nel centro delle notifiche. Vedere promemoria e notifiche.

## Carburante (preset Completo)

Nel preset Completo, la scheda **Carburante** registra ogni rifornimento. Il modulo chiede la **quantità** (nell'unità che usi: litri, galloni, o una carica in kWh per un VE) e il **costo**; il prezzo per unità viene calcolato da questi valori, non inserito. Include inoltre la data e l'ora, **Pieno completo** o **Parziale**, il contachilometri (opzionale, verificato rispetto alle letture prima e dopo di esso), una foto del contachilometri, la ricevuta del distributore, una nota e la stazione — una nuova stazione viene aggiunta ai tuoi fornitori quando salvi. **Ho saltato un rifornimento prima di questo** segnala un intervallo, così il consumo rimane corretto: il consumo viene misurato da un pieno completo all'altro, e riappare dopo due pieni completi con le letture del contachilometri.

## Unità

- **Contachilometri**: il contachilometri di un nuovo veicolo conta in **km**; il contatore di un generatore conta ore. L'unità di un contatore non può ancora essere modificata dopo la sua creazione.
- **Letture e quantità di carburante** vengono mantenute esattamente come inserite e mai convertite.
- **Consumo di carburante** viene mostrato come L/100 km, oppure kWh/100 km per una carica; all'ora su un contatore di ore.

## Costi

La scheda **Costi** di un veicolo mostra i costi di carburante, servizio e commissione. **Intuizioni** mostra gli stessi valori per tutti i tuoi veicoli sotto **Costi dei veicoli**.

## Lettura di una scheda di registrazione

In modalità Etichetta, **Leggi la carta** legge una scheda di registrazione: VIN, targa e scadenza della licenza.

## Rapporto storico

**Rapporto storico** genera un PDF per un periodo: cronologia del contachilometri con foto di prova, servizi con le loro fatture, carburante e documenti, e costi solo dove è visibile denaro.

## Correlati

- [Uso quotidiano](/it/users/everyday-use/) per il quadro più ampio.
- [Conteggi e inventari](/it/users/counts/) per i consumabili tracciati in scorta.
- [Provider AI](/it/users/ai-providers/) per la lettura di fatture e schede.
