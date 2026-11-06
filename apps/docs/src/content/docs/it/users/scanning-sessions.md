---
title: Sessioni di scansione
description: Conta una stanza, riempi le scatole o sposta gli oggetti camminando davanti alle loro etichette con la fotocamera aperta. Ogni etichetta nel campo visivo viene letta, una sola volta, online o offline, e nulla cambia finché non termini.
---

A **sessione di scansione** mantiene la fotocamera aperta mentre cammini. Ogni etichetta Kept nel campo visivo viene letta,
diverse alla volta, e conteggiata una volta. Usala per:

- **Conta** una stanza, uno scaffale, una scatola o un'intera posizione: ciò che scansioni è segnato come visto, e il
  riepilogo mostra cosa manca e cosa è stato trovato altrove.
- **Riempi** le scatole: tutto ciò che scansioni va nella scatola corrente. Scansiona la prossima scatola per passare.
- **Sposta in** un posto o una scatola: tutto ciò che scansioni si sposta lì.

Una sessione può contenere fino a 5.000 etichette e funziona senza segnale una volta che il telefono ha aperto una sessione
online: lo schermo viene recuperato la prima volta che viene usato, poi rimane sul telefono.

Una sessione legge i codici QR e i codici a barre. Un'etichetta senza codice QR (nastro da etichettatrice stretto) si apre
da **Scansiona** una alla volta invece, tramite il suo ID corto stampato ([scansionare un codice senza codice QR](/it/users/short-ids/#scansione-di-un-codice-senza-qr-code)).

## Avvia una sessione

- **Scansiona → Avvia una sessione**, poi scegli cosa fare e dove.
- Dalla pagina di un luogo: **Conta qui**.
- Dal menu di una scatola: **Conta questa scatola** o **Riempi questa scatola**.
- Dall pagina di uno spostamento: **Riempi le scatole**.
- Dalla scheda di una stanza sulla mappa: **Conta questa stanza**.

Se non hai ancora selezionato un luogo, sceglilo dall'elenco oppure tocca **Scansiona la sua etichetta**.

Per un conteggio di un luogo, **Includi i luoghi al suo interno** è attivato per impostazione predefinita. Attiva **Una scatola che scansioni
conta ciò che c'è dentro** quando conti le scatole senza aprirle.

## Mentre scansioni

| Cosa scansioni | Conta | Riempi, Sposta in |
|---|---|---|
| Un oggetto nell'elenco | Trovati, verde, il contatore aumenta | Aggiunto, verde |
| La stessa etichetta nuovamente | Un ticchetto leggero, nessun conteggio | Lo stesso |
| Un oggetto proveniente da un altro luogo qui | Ambra: **Trovati altrove**, con dove dovrebbe essere | Aggiunto |
| Un oggetto proveniente da un'altra posizione | Ambra, con la posizione | Aggiunto se puoi modificare entrambi |
| Un oggetto in una posizione che visualizzi solo | Grigio: **Solo visualizzazione qui** | Grigio, non aggiunto |
| L'etichetta di un luogo | Kept suggerisce di contarla dalla sua pagina | Rifiutato: una stanza non può essere spostata |
| Un'etichetta vuota, o un codice su più oggetti | Kept per il riepilogo | Lo stesso |
| Un codice a barre del prodotto | Corrispondente all'oggetto che lo porta | Lo stesso |
| Un numero di serie o un tag di risorsa (Data Matrix, Code 39…) | Corrispondente all'oggetto che lo possiede, online | Lo stesso |
| Un codice che questo telefono non conosce, offline | **Controlla più tardi** | Lo stesso |

Il contatore legge "312 di 340" per un conteggio. Ogni lettura emette un tono breve e disegna un quadrato sull'
etichetta: verde per una nuova scoperta, ambra per un altro oggetto trovato altrove, grigio per qualsiasi altro oggetto.

- **Annulla l'ultima lettura** prende l'ultimo indietro.
- **Pausa** ferma la fotocamera. Un minuto senza letture la mette in pausa anche.
- **Destinazione** (Riempi, Sposta in): toccalo, poi scansiona la prossima scatola o posto.
- Gli scanner di codici a barre USB o Bluetooth funzionano sullo stesso schermo: ciò che digitano viene letto come un'
etichetta.
- **Torcia** appare sui telefoni che ne sono provvisti (Android).

Chiudi l'app, ricarica o perdi batteria: la sessione rimane sul telefono. **Scansiona → Riprendi la sessione**
la riprende.

## Concludi e salva

**Concludi** mostra il riepilogo. Nulla è cambiato ancora.

- **Trovati**: segnato come visto, al momento in cui ogni etichetta è stata letta.
- **Mancanti**: lasciato così com'è per impostazione predefinita. Scegli **Segna non è qui** per ciascuno, o **Segna tutti non è qui**.
- **Nessuna etichetta**: elementi dell'elenco senza etichetta. Seleziona quelli che hai visto.
- **Trovati altrove** e **In un'altra posizione**: lasciati così com'è, o **Sposta qui**.
- **Non corrispondenti**: etichette vuote e codici che corrispondono a più elementi. Ogni etichetta vuota ha
  **Assegna**: una nuova scatola, un oggetto esistente o un luogo esistente. Attacca le etichette vuote su scaffali e porte,
  scansionale tutte in una passeggiata, poi assegnale qui.

Un conteggio elenca anche ciò che è prestato o in riparazione (mai mancante), e ciò che si trova in un luogo interno che
nessuno ha contato (**Non contato**, finché non tocchi **Ho controllato**). Un oggetto conteggiato per numero
ha **−** e **+** sulla sua riga. Ogni risultato viene conservato: vedi [Conteggi e inventari](/it/users/counts/).

**Salva** invia la sessione. Offline, rimane in attesa sul telefono e si salva quando sei di nuovo online.
La sessione è una voce in **Attività**, "Garage conteggiato: 312 di 340", con **Annulla** per 7 giorni.
**Annulla** riporta indietro ogni data di vista, ogni "non è qui" e ogni spostamento, a meno che qualcosa non sia cambiato nel frattempo.

Un oggetto distrutto mentre camminavi viene escluso dal salvataggio, e il riepilogo dopo il salvataggio dice quanti erano.

## Chi può fare cosa

| | Proprietario, admin, membro | Visualizzatore |
|---|---|---|
| Conta | Salvato | Un controllo: lo stesso schermo e totali, nulla salvato |
| Riempi, Sposta in | Dove puoi modificare sia l'oggetto che dove va | Non offerto |

Se il tuo ruolo cambia mentre cammini e non puoi più modificare lì, il salvataggio viene rifiutato e la sessione rimane sul telefono con il suo riepilogo.

## Limiti iPhone

- Nessuna vibrazione: le app web non possono vibrare su iPhone. Il tono e la casella colorata trasportano ogni lettura.
- Lo schermo potrebbe ancora oscurarsi nell'app installata: tienilo sveglio in **Impostazioni → Schermo &  Luminosità → Blocco automatico** mentre fai un conteggio grande.
- La lettura può essere più lenta su iPhone più vecchi. Tieni il telefono un po' più lontano dalle etichette ravvicinate  così diverse rientrano nel campo visivo.
- Nessun controllo della torcia dal web.
