---
title: I primi minuti
description: Richiedi un nuovo Kept con il suo codice di configurazione, crea la tua prima casa, aggiungi oggetti, invita persone e scegli lingua e tema.
---

Questa pagina inizia quando Kept è in esecuzione e puoi aprire il suo indirizzo. L'installazione è trattata in [Installa con Docker Compose](/it/install/compose/).

## 1. Richiedi il server con il codice di configurazione

La prima volta che Kept si avvia senza amministratore, stampa un codice di configurazione monouso nei suoi log, come
`KEPT SETUP CODE: K7Q-2M9`. L'apertura dell'indirizzo di Kept ti porta alla schermata **Configura questa istanza di Kept**, in tre passaggi:

1. **Codice di configurazione.** Digita i sei caratteri. Il trattino è facoltativo e non fa distinzione tra maiuscole e minuscole. Il codice smette di funzionare dopo averlo usato. Hai perso i log? `kept admin setup-code` genera un nuovo codice ([come, in Compose](/it/install/compose/#3-completa-il-setup)).
2. **Primo account.** Il tuo nome, email e una password di almeno 8 caratteri. Questo account è l'**amministratore dell'istanza**: esegue il server (utenti, registrazione, backup). Non può vedere dentro la casa di nessuno finché non viene invitato.
3. **Opzioni dell'istanza.** Un interruttore: **Consenti a chiunque abbia l’indirizzo di creare un account**. Lascialo disattivato per un nucleo familiare: le persone si uniranno tramite un invito, oppure puoi aggiungerle. Puoi modificarla successivamente in **Impostazioni → Admin**.

**Completa la configurazione** ti porta alla Home.

:::caution[Fallalo subito]
Finché la configurazione non è completata, chiunque possa aprire l'indirizzo potrebbe provare a prendere possesso del server.
:::

L'IA e la ricerca codici a barre non fanno parte della configurazione. Kept funziona senza di essi, e puoi collegare l'IA più tardi ([Provider di IA](/it/users/ai-providers/)).

## 2. Leggi l'elenco Per iniziare della Home

Home si apre con **Per iniziare**, una riga con i tuoi progressi e il prossimo passo, calcolati in base a ciò che hai realmente fatto, così i passaggi vengono spuntati automaticamente. La freccia apre i passaggi:

| Passaggio | Cosa chiede |
|---|---|
| **Metti Kept su HTTPS** | Mostrato all'amministratore dell'istanza mentre Kept viene servito tramite HTTP semplice. Gli smartphone bloccano la fotocamera, l'installazione di Kept, le notifiche push e la posizione su HTTP. Consulta [HTTPS](/it/install/https/). |
| **Crea la tua prima casa** | Una posizione, qui sotto. |
| **Aggiungi 3 oggetti** | Alcuni oggetti che odio perdere di vista. |
| **Stampa la tua prima etichetta** | Quando le Etichette sono attive in una posizione. |
| **Invita qualcuno** | Un link o un codice QR; nessuna persona necessita di email. |
| **Collega un provider di IA** | Non mostrato ai membri invitati, o in una posizione con il preset Essenziali. |
| **Installa sul telefono** | Si spunta da solo la prima volta che apri Kept dall'icona nella schermata iniziale del telefono. |

**×** lo nasconde definitivamente; **Aiuto → Elenco Per iniziare → Mostralo di nuovo** lo mostra nuovamente. Scompare da solo quando tutti i passaggi sono completati. Maggiori informazioni sulla Home in [Uso quotidiano](/it/users/everyday-use/#home).

## 3. Crea la tua prima casa

Ogni utente ha una posizione **Personale** fin dall'inizio: è tua sola (nessun membro, invito o link di condivisione) ed è dove viene salvata una cattura senza posizione. Rinominala in **Impostazioni del luogo → Generali**, e Kept mostra il nuovo nome ovunque. Una volta che hai un'altra posizione, puoi [nasconderla](/it/users/locations/#nascondi-personale) in **Impostazioni → Profilo → I tuoi luoghi**. Gli oggetti condivisi appartengono a una posizione dedicata. Scegli **Crea la tua prima casa** (o **Nuovo luogo** sulla Home):

1. **Come si chiama questo luogo?** Un nome, ad esempio Casa o Garage, e il suo tipo: Casa, Appartamento, Garage, Unità di deposito, Ufficio, Casa vacanze o Altro.
2. **Stanze.** Il modello del tipo compila stanze e punti; rinomina, rimuovi o **Aggiungi stanza o punto**. Ogni posizione ha anche **Senza posto**, per gli oggetti che non hanno ancora una posizione. **Salta** mantiene solo **Senza posto**.
3. **Cosa monitorare.** Tre preset:
   - **Essenziali**: ricerca di oggetti: stanze, scatole, etichette e ricerca.
   - **Famiglia**: aggiunge ricevute e garanzie, promemori, prestiti, documenti e veicoli.
   - **Completa**: aggiunge carburante, oggetti che esaurisci, password e codici, trasferimento di casa, e "Connetti ChatGPT o Claude".

Il fuso orario e la valuta provengono dal tuo browser. Modificali, e attiva o disattiva i singoli moduli nelle **Impostazioni del luogo** (**Generali** e **Cosa monitorare**). Disattivare un modulo lo nasconde; nulla viene cancellato.

## 4. Aggiungi il tuo primo oggetto

Il modo più veloce è **Acquisisci**, la scheda centrale sul telefono: punta la fotocamera, premi l'otturatore, e l'oggetto viene salvato dove indica il chip della posizione in alto. Un nome è facoltativo durante la cattura: con un provider di IA collegato, Kept lo nomina dalla foto; senza uno, gli oggetti senza nome aspettano nel **In arrivo** per un nome. Su un computer, **Aggiungi qui** su una stanza o una scatola aggiunge un oggetto con un modulo. [Uso quotidiano](/it/users/everyday-use/) tratta la cattura, le etichette e il resto.

## 5. Invita persone

La condivisione avviene per posizione: qualcuno che inviti a Home vede la Home, e nient'altro di tuo. Dopo aver creato una posizione, la Home mostra una scheda **Invita persone a …**; la stessa pagina si trova in **Impostazioni del luogo → Membri → Invita**.

1. Scegli il **Ruolo** e, in **Accesso**, **Nessuna data di fine** o **Fino a una data**. Il loro accesso, e qualsiasi token generano, termina in quella data.
2. **Crea link di invito.** Ottieni il link con **Copia link** e un codice QR da **Eseguire la scansione con il loro telefono**. Il link funziona una sola volta, per 7 giorni, e appare in **Membri** come invito in attesa finché non viene utilizzato, dove puoi revocarlo.
3. **Invia per email** funziona solo quando il server ha impostato la posta elettronica (`KEPT_SMTP_URL`).

La persona apre il link, poi si unisce con il proprio account o ne crea uno; mentre la registrazione è chiusa, l'invito è l'unico modo per creare un account.

### I ruoli

| Proprietario | Tutto, comprese le regole di autenticazione a due fattori, trasferimento e cancellazione. C'è un solo proprietario. |
| Amministratore | Invita e rimuove membri e visualizzatori, impostazioni e moduli, importa ed esporta, link di condivisione e pacchi di richiesta, elimina definitivamente. Solo il proprietario concede o revoca gli amministratori. |
| Membro | Aggiungi, modifica, sposta, presta e sposta nel cestino gli oggetti; registra letture e servizi; stampa etichette; usa l'acquisizione con IA. Il denaro è visibile. |
| Visualizzatore | Guarda e cerca solo. Il denaro è nascosto a meno che la posizione consenta ai visualizzatori di vederlo; l'assistente risponde ma non può modificare nulla. |

La matrice completa è `MATRIX` in
[`packages/shared/src/roles.ts`](https://github.com/keptinventory/kept/blob/main/packages/shared/src/roles.ts).

### Persone senza email

Per un figlio o un genitore senza email, un proprietario o amministratore utilizza **Aggiungi qualcuno senza email** nella pagina Membri. Kept crea un **account gestito** con un nome utente e mostra un codice monouso (funziona una sola volta, per 30 minuti). La persona accede con **Ho un codice monouso**, il proprio nome utente e il codice, e scelie la propria password; tu non la vedrai mai. Chi ha creato l'account (mentre ancora proprietario o amministratore lì), o il proprietario della posizione, può emettere un nuovo codice più tardi, che disconnette l'account ovunque. La persona può aggiungere un'email per prendere il controllo dell'account. Un account gestito non può possedere una posizione, e una posizione può contenere al massimo 20 account gestiti.

## 6. Lingua e tema

**Impostazioni → Profilo → Aspetto** contiene le scelte di visualizzazione del dispositivo, applicate prima che la pagina venga disegnata:

- **Lingua**: inglese, العربية, francese, tedesco, italiano, vietnamita, ucraino o spagnolo.
  Apri l'elenco, oppure digita per trovarne uno: il suo nome stesso, il suo nome in inglese o nella lingua che stai usando, e piccoli errori di battitura sono accettati (`german`, `deutsch` e `francais` funzionano tutti). L'arabo dispone l'intera applicazione da destra a sinistra. Le pagine di accesso hanno lo stesso selettore.
- **Cifre in arabo**: occidentali (0123) o orientali (٠١٢³), mostrati solo quando la lingua è arabo.
  Gli ID brevi e i numeri di serie rimangono sempre in cifre occidentali.
- **Regione**: **Stati Uniti** (29 ott) o **Regno Unito** (29 ott, 29/10/2026), mostrato solo quando la lingua è inglese.
- **Formato data**: **Predefinito** (29 ott, con l'anno soltanto per altri anni), 29 ott 2026,
  29/10/2026 o 2026-10-29 (come li scrive il Regno Unito). Ogni scelta mostra la data odierna scritta in quel modo, nella tua regione. Le date di acquisto e
  di garanzia mostrano sempre l'anno.
- **Tema**: **Sistema** (segue l'impostazione chiara/scura del dispositivo), **Chiaro** o **Scuro**.
- **Larghezza del contenuto**: **Centrato** o **Tutta larghezza**, su schermi di almeno 768 px.

## 7. Fai il tour

**Aiuto → Il tour** ti guida attraverso Kept sulle schermate reali, in brevi capitoli da tre a sei passaggi ciascuno:

| Capitolo | Cosa mostra |
|---|---|
| Nozioni di base | Home, i tuoi luoghi, Scansione, Ricerca, e dove si trova tutto il resto |
| Oggetti e posti | aggiunta a una posizione, cosa vi si trova, e la pagina di un oggetto e le sue schede |
| Grafico e mappa 3D | l'interruttore Lista · Griglia · Grafico · Tabella · Mappa (Tabella su un computer), il grafico in 2D o 3D, 3D o piano, spilli, piani e Disponi, dove una stanza si sposta insieme al suo contenuto |
| Acquisizione e In arrivo | scegli cosa acquisire, l'otturatore, e verificare cosa Kept ha letto |
| Scansione | una sessione di scansione: conta, imballa o spostati, dove, e cosa cambia Finish |
| Ricerca ed etichette | il campo di ricerca, le visualizzazioni salvate, Seleziona (sposta, stampa etichette, sposta nel cestino), stampa etichette e Scansione, che può mettere un'etichetta vuota in una posizione che possiedi |
| Spostamento | avvio di uno spostamento, le sue scatole, e dove si trovano |
| Prestito | ciò che è prestato, Segna come restituito, e Presta su un oggetto |
| Pianificazione e promemori | un nuovo programma, cosa è scaduto, Completa, e come raggiungerti i promemori |
| Documenti e garanzie | la biblioteca dei documenti, ciò che sta scadendo, aggiunta di un file, richieste |
| Veicoli e carburante | l'elenco dei veicoli, registrazione di una lettura o un servizio, i servizi che puoi aprire, e carburante |
| Importazione ed esportazione | da dove proviene un importazione, il file, e l'esportazione |
| Impostazioni e condivisione | notifiche, i tuoi luoghi, invita persone, cosa monitorare |

- In alto: quanti capitoli sono completati, con una barra sottile, e **Fai il tour**. Quando alcuni sono completati, legge **Continua il tour** e riprende dal primo capitolo non ancora finito.
- Sotto, una breve riga per capitolo: il suo numero e i suoi passaggi. Tocca una riga per avviare il tour da quel capitolo. I capitoli completati si riducono sotto **Fatto (N)**; aprilo per riprodurre nuovamente.
- Il tour inizia da **Aiuto**. La barra superiore di una pagina rimane relativa agli strumenti di quella pagina; la sessione di scansione **Avvia una sessione** ha un piccolo **Mostrami** per il suo capitolo.
- Il popup mostra dove ti trovi: "Capitolo 3 di 12 · passaggio 2 di 5".
- **Avanti** procede, **Indietro** torna indietro nel capitolo, le frecce fanno entrambe le cose, e **Esc** o **×** lo chiudono.
- L'ultimo passaggio di un capitolo indica il successivo: **Continua** vi accede direttamente, **Fermati qui** interrompe il tour lì. L'ultimo capitolo si conclude con **Fatto**.
- La pagina continua a funzionare mentre il tour è in corso: tocca qualsiasi cosa fuori dall'evidenziazione. Andare in un posto che il tour non ha aperto lo chiude.
- Un capitolo completato mostra **Fatto** su **Aiuto**, su ogni dispositivo. Un capitolo che chiudi parzialmente inizia dal suo primo passaggio la prossima volta.
- Un capitolo che deve mostrare qualcosa e non trova nulla crea un esempio chiaramente nominato, ad esempio "Esempio: Trapano senza filo". Quando il tour termina, scegli se conservarlo o eliminarlo; non interferisce mai con ciò che già possiedi.
- Il tour non si avvia mai da sé.

Alcuni suggerimenti una tantum appaiono la prima volta che utilizzi Acquisisci, Scansione, i valori suggeriti dell'In arrivo o le Etichette.

Dopo l'aggiornamento di Kept, **Novità di Kept** mostra i punti salienti di quella versione, una volta per versione per ogni persona, su ogni dispositivo: una per diapositiva, con un'immagine o un breve clip, il suo titolo e una riga.
**Avanti** e **Indietro**, i puntini, le frecce o uno scorrimento spostano tra di esse; l'ultima diapositiva **Ho capito** la rimuove, e **Aiuto → Novità** la mostra nuovamente.
I clip vengono riprodotti silenziati e possono essere messi in pausa; con il movimento ridotto attivato, rimangono fermi finché non premi **Riproduci**. Offline, una diapositiva mostra l'icona della sezione al posto dell'immagine. Non viene mai mostrato su un nuovo account, o sopra Acquisisci o Scansione. I punti salienti sono in inglese in ogni lingua, con un link alle note complete della versione su GitHub.

:::tip[Tieni le chiavi]
Prima della prima chiave IA, valore segreto o backup, Kept attende finché l'amministratore dell'istanza non salva il
[kit di ripristino](/it/admin/recovery-kit/) (Amministratore → Stato chiede per esso). Senza il kit, un backup non può ripristinare le chiavi IA o le password memorizzate su un nuovo server.
:::
