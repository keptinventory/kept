---
title: Moduli e preset
description: "Cosa traccia ogni luogo: i preset Essenziali, Famiglia e Completa, i moduli che ci sono dietro e cosa succede spegnendo uno."
---

Ogni luogo funziona con un **preset**: un insieme di **moduli** attivati insieme. Un preset è un punto di partenza: un proprietario o un amministratore può attivare o disattivare singoli moduli in seguito, e disattivarne uno lo nasconde soltanto. Non si cancella nulla.

Scegli il preset quando crei il luogo ([I tuoi primi minuti](/it/users/first-run/)). Il luogo **Personale** di un nuovo account parte da Essenziali. Un'importazione da Homebox in un nuovo luogo parte da Essenziali anche lei, con attivati in più i moduli per cui il backup ha dati ([importare da Homebox](/it/users/import-export/#unesportazione-di-homebox)).

## I tre preset

- **Essenziali**: trovare cose: stanze, scatole, etichette e ricerca.
- **Famiglia**: aggiunge Ricevute e garanzie, Promemoria, Prestiti, Documenti e Veicoli.
- **Completa**: aggiunge Carburante, Oggetti che si esauriscono, Password e codici, Trasloco e "Collega ChatGPT o Claude".

Il fuso orario e la valuta non fanno parte del preset: si trovano in **Impostazioni del luogo → Generali**.

## Cosa aggiunge ogni modulo

I nomi qui sotto sono gli interruttori in **Cosa monitorare**.

| Modulo | Da | Cosa aggiunge |
|---|---|---|
| **Etichette e codici QR** | Essenziali | Etichette stampabili per oggetti e posti; scansionare un'etichetta apre quello su cui è attaccata. |
| **Soldi e spese** | Famiglia | Prezzi, totali e **Statistiche**. Ogni valuta su una riga a parte, mai convertita. |
| **Ricevute e garanzie** | Famiglia | Date di garanzia; una garanzia in scadenza appare come promemoria. |
| **Promemoria** | Famiglia | Pianificazioni: cosa è in scadenza, per data o per lettura. |
| **Prestiti** | Famiglia | Prestare cose e prenderle in prestito. |
| **Documenti** | Famiglia | La raccolta documenti; le date dei documenti alimentano i promemoria. |
| **Veicoli** | Famiglia | Veicoli e macchine. |
| **Carburante** | Completa | Carburante e ricarica. Richiede **Veicoli**. |
| **Oggetti che si esauriscono** | Completa | **Tieni almeno** su un oggetto; scorte basse appaiono come promemoria. |
| **Trasloco** | Completa | Modalità trasloco. Richiede **Etichette e codici QR**. |
| **Password e codici** | Completa | Campi segreti: nascosti finché qualcuno autorizzato non ne rivela uno, e questo viene registrato. |
| **Collega ChatGPT o Claude** | Completa | La connessione MCP, così un'app di IA può lavorare con il luogo. |

## IA in questo luogo

Acquisizione con IA e assistente si attivano in qualsiasi preset una volta collegato un fornitore di IA per il luogo. Condividono un unico interruttore, **Acquisizione con IA e assistente**, sotto **IA in questo luogo** sulla stessa pagina, così un luogo può restare fuori dall'IA mentre un fornitore è collegato. Scegliere un preset non lo cambia. Vedi [fornitori di IA](/it/users/ai-providers/).

## Disattivare un modulo

Un modulo disattivato è nascosto ovunque apparirebbe (le sue schermate, le voci di menu, i filtri) e i suoi promemoria vanno in pausa. Riattivarlo fa tornare tutto, perché non è stato cancellato nulla.

- **I promemoria vanno in pausa con il loro modulo.** Le pianificazioni e le cose che scadono aspettano con **Promemoria**, le date di garanzia e di registrazione con **Ricevute e garanzie**, le date dei documenti con **Documenti** (i documenti di un veicolo continuano a funzionare finché **Veicoli** è attivo), i prestiti con **Prestiti**, le scorte basse con **Oggetti che si esauriscono**. I promemoria sui contatori non letti di recente funzionano sempre.
- **Anche i moduli dipendenti vengono disattivati.** Carburante richiede Veicoli e Trasloco richiede Etichette e codici QR: disattivare ciò di cui un modulo ha bisogno disattiva anche quel modulo. Il suo interruttore poi mostra *Richiede Veicoli, disattivato in questo luogo*.
- **Il menu segue tutti i tuoi luoghi.** Sotto **Monitoraggio**, una voce (Programmazioni, Prestiti, Documenti, Consumabili, Veicoli, Trasloco, Statistiche) appare quando il suo modulo è attivo in almeno uno dei tuoi luoghi. Sotto **Strumenti**, **Etichette** appare finché Etichette è attiva da qualche parte, e **Conteggi** è sempre presente. Anche Attività, Cestino e Notifiche sono sempre presenti.

## Cambiarlo in seguito

Un proprietario o un amministratore apre **Impostazioni del luogo → Cosa monitorare**. Il selettore di preset imposta tutti i moduli insieme; **Regolazione fine** sotto di esso ha un interruttore per modulo. Prima di salvare, **Quando salvi** elenca cosa si attiva e cosa si disattiva.

## Correlati

- [Luoghi, stanze e scatole](/it/users/locations/) per i posti dentro un luogo.
- [Condividere un luogo](/it/users/sharing/) per i ruoli.
