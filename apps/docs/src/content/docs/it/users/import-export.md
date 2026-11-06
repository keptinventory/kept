---
title: Importa ed esporta
description: Porta dentro gli oggetti da un foglio di calcolo, Homebox o un altro Kept, e porta fuori un luogo come esportazione completa, con una copia leggibile senza Kept.
---

Gli importi e le esportazioni si trovano in **Impostazioni → Importa** e **Impostazioni → Esporta**. Entrambi sono per i **proprietari e amministratori** di un luogo, vengono eseguiti in background sul server e richiedono una connessione. Per spostare un intero server, o una famiglia tra server, vedi anche [spostarsi su un nuovo server](/it/admin/move-server/).

## Importazione

**Impostazioni → Importa** chiede da dove proviene:

| Origine | Cos'è |
|---|---|
| **Un foglio di calcolo (CSV)** | Un oggetto per riga, con una riga di intestazione che nomina le colonne; anche l'esportazione foglio di calcolo di Homebox |
| **Un'esportazione di Homebox** | Lo ZIP di Homebox v0.26.1 o più recente, v0.27.0 consigliato (Raccolta → Strumenti → Backup e ripristino → Crea backup → Scarica) |
| **Un'esportazione di Kept** | Un luogo esportato da questo Kept o da un altro |

Ogni importazione viene controllata prima che venga scritto qualcosa: **Controlla l'importazione** mostra **Cosa farà l'importazione**, riga per riga, con il motivo di ogni oggetto che salta. Poi viene eseguita con una barra di avanzamento. Puoi lasciare la pagina; l'importazione continua, e Impostazioni → Importa mostra quanto è avanzata. Se si ferma, **Riprendi** prosegue dall'ultima riga. **Annulla l'importazione** conserva ciò che ha già importato.

Eseguire di nuovo la stessa importazione salta ciò che ha già portato dentro, così non si creano mai duplicati. Un archivio (uno ZIP) può essere grande fino a 5 GB. Gli oggetti importati arrivano confermati, non nell'In arrivo.

### Un foglio di calcolo (CSV)

1. **Scegli il file**, e il luogo in cui va: uno che possiedi o amministri. Un file contiene al massimo 10,000 righe (8 MB); dividine uno più grande. Sotto il file, **Le colonne che Kept legge** elenca ogni colonna che capisce, e **Scarica un CSV di esempio** fornisce un file piccolo da cui iniziare.
2. **Associa le colonne.** Per ogni colonna, scegli il campo in cui va, incluso **Il campo di un tipo…** per i tuoi campi di tipo. Una colonna deve essere il nome: ogni oggetto ne ha bisogno di uno.
3. **Qualche scelta:**
   - Una colonna di posti come `Garage > Shelf A` crea le stanze e i posti: scegli il separatore, e se **Crea i posti nominati dal file che non esistono ancora**.
   - Dove vanno le righe senza un posto (Senza posto per impostazione predefinita).
   - Come sono scritte le date (desunte dal file dove possibile), e la valuta per le righe senza.
   - **Associa la colonna tipo ai tuoi tipi per nome**, in qualsiasi lingua di Kept; disattivato, il tipo viene tenuto nelle note.
4. **Controlla l'importazione**, leggi il report e importa.

Le colonne che Kept legge: nome, quantità, posto, tipo, marca, modello, numero di serie, codice a barre, colore, condizioni, note, tag, altri nomi, data di acquisto, prezzo, valuta, negozio, link al manuale, il codice di una vecchia etichetta, il tuo codice, un ID di riga (così una nuova importazione salta la riga) e i campi dei tuoi tipi. Le intestazioni in qualsiasi lingua di Kept vengono associate per te. Tag e altri nomi sono separati da virgole, un prezzo è un numero senza il simbolo di valuta e le date sono scritte in un solo modo per tutto il file.

#### Il foglio di calcolo di Homebox

Ogni Homebox può esportare un foglio di calcolo (fino alla v0.25: **Strumenti → Importazione/Esportazione → Esporta inventario**). Homebox v0.10.3 e v0.11.0 lo scrivono separato da tab (`homebox-items.tsv`); Kept legge entrambi. Quando le colonne sono quelle di Homebox (`HB.name`, `HB.location`, …), Kept lo dice, associa le colonne da solo e legge ciò che un'importazione di foglio di calcolo semplice scarterebbe:

| Colonna Homebox | Kept |
|---|---|
| `HB.asset_id`, e il link dell'oggetto in `HB.url` (dalla v0.13 in poi) | Vecchie etichette: un'etichetta Homebox stampata apre l'oggetto |
| `HB.sold_*` | Con un acquirente o un prezzo: l'oggetto è finito come venduto, con la sua data, acquirente, note e prezzo. Solo una data di vendita resta nelle note |
| `HB.archived` | Tua scelta: **Archiviato** (il predefinito), **In uso** o **Escludi**. Uno con una vendita finisce venduto |
| `HB.warranty_expires`, `HB.lifetime_warranty` | Una garanzia dalla data di acquisto, dove Garanzie è attivo |
| `HB.warranty_details`, `HB.insured` | Righe nelle note |

Un prezzo di 0 viene letto come nessun prezzo (Homebox scrive 0 quando nessuno era impostato). Le righe di luogo che un foglio di calcolo dalla v0.26 in poi elenca vengono lasciate fuori; i posti vengono dal percorso di luogo di ogni oggetto. Un foglio di calcolo non può trasportare foto, file, manutenzione o oggetti dentro oggetti, e i campi personalizzati vengono importati solo se li associ a un campo di un tipo. Per tutto il resto, usa lo ZIP di esportazione.

### Un'esportazione di Homebox

Kept legge lo ZIP di esportazione di Homebox, che contiene tutto, inclusi i file. In Homebox, apri **Raccolta → Strumenti → Backup e ripristino**, scegli **Crea backup** e **Scarica** il backup una volta elencato. Esiste dalla Homebox v0.26: usa v0.26.1 o più recente (l'immagine Docker di v0.26.0 perde gli allegati), e v0.27.0 se puoi. Una Homebox più vecchia della v0.26 non ha esportazione: vedi [provenire da una Homebox più vecchia](#provenire-da-una-homebox-più-vecchia). Uno ZIP senza il `manifest.json` di Homebox viene rifiutato con quel consiglio.

:::tip[If Homebox says "Topic has been Shutdown"]
Homebox v0.26 crea un'esportazione ogni volta che si avvia. Riavvia Homebox ed esporta di nuovo, o aggiorna a v0.27.0, che non ha questo limite.
:::

Dopo l'upload, Kept mostra la raccolta e la sua data di esportazione. Va in **Un nuovo luogo** o **Un luogo che gestisci**, dove gli oggetti già presenti restano e una riesecuzione aggiunge solo ciò che è nuovo. Un nuovo luogo viene creato quando premi **Importa**, non prima: un'importazione che lasci al suo controllo non lascia nulla dietro. **Connettiti a Homebox (opzionale)** legge la valuta della raccolta, che lo ZIP non trasporta: dammi l'indirizzo di Homebox e una chiave API, o un'email e una password. Vengono usati una volta e mai memorizzati.

Per un nuovo luogo, viene **Cosa monitorare**: **Essenziali** (stanze, scatole, etichette e ricerca), e sopra di esso, selezionate, ciò che il backup usa: **Prezzi su 10 oggetti** attiva Denaro, **5 garanzie** attiva Garanzie, **2 voci di manutenzione** attiva Pianificazioni. Deselezionane una e i dati restano negli oggetti come testo, che non può diventare record in seguito. Un backup senza nulla di ciò parte con soli Essenziali. **Anche per Personale** dà al tuo luogo Personale lo stesso, così il menu mostra solo ciò che tracci. Cambia entrambi in qualsiasi momento in **Impostazioni luogo → Cosa monitorare**; disattivare qualcosa non cancella mai nulla.

Poi scegli:

- **I prezzi sono in**: la valuta, richiesta solo quando il backup ha prezzi. Sceglierne una rietichetta gli importi; non li converte.
- **Articoli archiviati**: **Archiviato** (il predefinito: archiviato anche in Kept, ancora tuo, messo via), **In uso**, o **Escludi**. Un oggetto archiviato con un acquirente o un prezzo finisce venduto.
- **Oggetti con quantità 0**: **Mantieni 0 o archivia** (il predefinito: un tipo che esaurisce tiene 0, qualunque altro oggetto arriva archiviato), **Imposta a 1**, o **Escludi**. Ognuno che arriva ha "Quantity in Homebox: 0" nelle sue note. Un oggetto che contiene altri oggetti non viene mai archiviato o lasciato fuori per il suo 0, e un luogo che diventa una scatola non ha quantità da controllare.
- **Aggiungi un campo sì/no "Assicurato"**, e **Escludi i posti e i tag iniziali di Homebox** (le otto stanze e i sei tag con cui inizia ogni nuova raccolta Homebox, quando inutilizzati).
- **Questi sembrano scatole**: luoghi chiamati come una scatola o un contenitore (Box 01, Bin 2, Kiste 3…) che non contengono altri luoghi. Selezionali, o **Scegli tutti**, e arrivano come scatole: oggetti che contengono oggetti, con i loro tag e ciò che contengono. Il resto arriva come posti.
- **Campi personalizzati**: per ognuno, **Aggiungi al tipo** o **Tieni nelle note**.
- **Tipi**: per ogni tipo Homebox, un tipo Kept, **Nuovo tipo…** con un nome che digiti, o **Nessun tipo**. I tipi propri di Homebox 0.27, `global.item` e `global.location`, vengono letti come **Articolo** e Luogo, come in Homebox; l'**Articolo** jolly inizia come **Nessun tipo**.

Il controllo elenca ogni voce che richiede un'attenzione, ciascuna con ciò che le è successo in parole, e la pagina dell'importazione tiene quell'elenco dopo l'importazione: aprilo da **Attività** (Ha eseguito un'importazione).

Cosa passa:

| Homebox | Kept |
|---|---|
| Raccolta | Un luogo |
| Luoghi (annidati) | Stanze e posti, mantenendo l'albero |
| Articoli | Oggetti; un oggetto che contiene altri diventa una scatola, mai tutto il suo tipo |
| Produttore, modello, numero di serie | Marca, modello, numero di serie |
| Data di acquisto, negozio e prezzo | Un acquisto con il suo negozio |
| Garanzia, garanzia a vita | Una garanzia |
| Dettagli venduti | Con un acquirente o un prezzo (più di 0): l'oggetto è finito come venduto, con la sua data, prezzo, acquirente e note. Solo una data di vendita non è una vendita: l'oggetto resta in uso, la data nelle sue note |
| Tag | Tag con i loro colori (tag annidati appiattiti) |
| Foto, manuali, ricevute, file di garanzia | Foto, manuali, la ricevuta dell'acquisto, il documento della garanzia |
| Link | Link. Un link a un documento del [Paperless-ngx](/it/users/paperless/) a cui il luogo è connesso (lo stesso indirizzo) arriva come un link Paperless, come fa **Collega da Paperless**, con il suo titolo da Paperless (di Homebox se Paperless non può fornirlo; il report dice quanti); connetti Paperless prima di importare |
| Manutenzione completata | Registri di assistenza |
| Manutenzione programmata | Pianificazioni una tantum |
| Modelli | Modelli di account, per quanto mappabili |

Notificatori, membri e ruoli non vengono importati. Dove un modulo è disattivato nel luogo, il testo del record viene tenuto nelle note dell'oggetto. La descrizione di un luogo non viene tenuta (i posti non hanno note); il controllo nomina ciascuna.

Homebox scrive date che nessuno ha digitato: alcuni aggiornamenti riempiono i campi data vuoti, e un backup può portare una data vuota come ultimo giorno dell'anno 0. Kept legge una data prima dell'anno 1000 come nessuna data, e una vendita ha bisogno di un acquirente o un prezzo.

#### Riparazione di un'importazione precedente

Le importazioni prima di Kept 1.13.0 trasformavano una quantità di 0 in 1, rendevano un intero tipo un tipo scatola quando uno dei suoi oggetti ne conteneva un altro (così ogni oggetto di esso si apriva su una scheda Contenuti vuota), e potevano creare un tipo chiamato `global.item`. Le importazioni prima della 1.14.1 concludevano un oggetto venduto quando Homebox aveva solo una data di vendita. Apri l'importazione da **Attività** (Ha eseguito un'importazione): **Ripara questa importazione** elenca ciò che può ripristinare, per nome:

- **Archivia gli oggetti che avevano quantità 0 in Homebox** (ancora in uso, con quantità 1);
- **Rendi il tipo un tipo normale di nuovo** (un oggetto che contiene oggetti resta una scatola);
- **Rinomina `global.item` in Articolo**;
- **Rimetti in uso gli oggetti segnati venduti con solo una data**: venduti senza acquirente e senza prezzo, e non modificati da allora. Un oggetto archiviato in Homebox torna in uso anche lui: archivialo di nuovo a mano.

Seleziona ciò che vuoi e premi **Ripara**. Un solo **Annulla** torna indietro su tutto.

**Le vecchie etichette continuano a funzionare.** Ogni ID risorsa di Homebox (`000-001`) viene ricordato ed elencato sotto **I tuoi codici** sull'oggetto. Lo scanner di Kept riconosce un'etichetta Homebox e apre l'oggetto importato; se punti il vecchio hostname di Homebox su Kept, la scansione con la fotocamera del telefono funziona anche. Gli ID lunghi di Homebox per oggetti e luoghi (quelli nei suoi link di etichetta) vengono ricordati per la scansione ma non elencati. Gli oggetti importati ricevono codici Kept propri, che restano fuori dagli elenchi finché non ne stampi le etichette.

### Provenire da una Homebox più vecchia

Una Homebox più vecchia della v0.26 non può creare lo ZIP di esportazione. Due modi per entrare:

- **Tutto, foto e manutenzione incluse:** aggiorna una copia di Homebox a v0.27.0 ed esporta lo ZIP dalla copia. Testato da Homebox v0.10.3 (l'ultima versione dell'originale `hay-kot/homebox`) direttamente a v0.27.0.
- **Più veloce, con meno:** importa il suo [foglio di calcolo](#il-foglio-di-calcolo-di-homebox).

L'aggiornamento non può essere annullato (dalla v0.23, le note di Homebox stessa lo dicono), quindi gira su una copia e il tuo Homebox resta com'è:

1. **Ferma Homebox e copia la sua cartella dati**, quella montata su `/data` (`homebox.db` con i suoi file `-wal` e `-shm`, e gli allegati). Tieni l'originale come backup.
2. **Avvia Homebox v0.27.0 sulla copia.** Homebox ora vive su `ghcr.io/sysadminsmedia/homebox`; v0.26 e versioni successive richiedono `HBOX_AUTH_API_KEY_PEPPER`, 32 o più caratteri casuali:

   ```sh
   docker run --rm -p 7745:7745      -e HBOX_AUTH_API_KEY_PEPPER="$(openssl rand -hex 24)"      -v /path/to/homebox-copy:/data      ghcr.io/sysadminsmedia/homebox:0.27.0
   ```

   Il primo avvio aggiorna il database in un colpo solo. Aggiunge anche le otto stanze iniziali di Homebox, che Kept esclude per impostazione predefinita quando sono vuote.
3. **Accedi** con il tuo account abituale e apri **Raccolta → Strumenti → Backup e ripristino**. Scegli **Crea backup**, poi **Scarica** il backup una volta elencato.
4. **Importalo in Kept** come [un'esportazione di Homebox](#unesportazione-di-homebox).
5. Ferma la copia ed eliminala una volta completata l'importazione.

Le foto aggiunte prima che Homebox registrasse i tipi di file arrivano anche: Kept controlla ogni file da solo.

### Un'esportazione di Kept

Un'esportazione di Kept arriva sempre come **un nuovo luogo**, con i suoi oggetti, posti, file, verbali di stato, traslochi e storia, e la posizione del luogo se ne ha una (per [Suggerisci dove sono](/it/users/phone-app/#fotocamera-galleria-e-scansione)). Se contiene valori segreti, **Apri i segreti** con la frase segreta scelta quando è stata esportata; senza di essa, tutto il resto viene importato. Aprirli richiede HTTPS: su HTTP semplice la schermata di importazione lo dice e importa il resto. **Persone da invitare** elenca chi ha condiviso il luogo; nessuno viene invitato dall'importazione, quindi invita ogni persona tu stesso.

**Verbali di stato** tornano con i loro giorni, note, stanze e foto, e ogni foto conserva il momento in cui Kept l'ha ricevuta per la prima volta. Un report finito torna finito nello stesso momento, e rimane bloccato. Sul nuovo server, le foto e la conclusione sono a nome di chi le ha importate; la storia mostra ancora chi ha fatto ogni oggetto prima dell'importazione.

**Traslochi** tornano con le loro scatole: numero di ogni scatola, stato e stanza in cui va, e un trasloco fatto viene rifatto. Un trasloco verso un altro luogo arriva come un trasloco dentro il nuovo, con le sue stanze da scegliere di nuovo.

Un'esportazione fatta da un Kept più recente del server in cui importi potrebbe essere rifiutata: aggiorna prima quel server.

### La cronologia LubeLogger di un veicolo

Nella Panoramica di un veicolo, **Importa da LubeLogger** prende il CSV che LubeLogger esporta per un veicolo: il suo carburante, i suoi record di assistenza (riparazioni e upgrade inclusi) o le sue letture del contagiri, un file alla volta. Kept legge il file, dice di che tipo è e indovina come date e decimali sono scritti (LubeLogger li scrive nella lingua del suo server); cambia entrambi se l'indovinello è sbagliato, e di' se il carburante è in litri o galloni. **Verifica** mostra cosa verrebbe aggiunto e quali righe non possono esserlo, e perché; **Importa** le aggiunge, dal più vecchio al più recente, con le loro letture del contagiri. Importando lo stesso file di nuovo non aggiunge nulla. Proprietari e amministratori del luogo possono importare.

### Parole di ricerca dopo un'importazione

Quando un provider di intelligenza artificiale è connesso, la fine di un'importazione può offrire **Aggiungere parole di ricerca con l'IA?**, con una stima dei token che richiede. Gira in background e aggiunge alias nelle lingue del luogo, come gli oggetti catturati li ricevono ([Provider di intelligenza artificiale](/it/users/ai-providers/)).

## Esportazione

**Impostazioni → Esporta** ha due tipi:

- **Esporta un luogo**, uno che possiedi o amministri: ogni oggetto, posto, foto, documento, verbale di stato e trasloco è sempre incluso.
- **Esporta i miei dati**: il tuo luogo Personale con i suoi file, il tuo profilo e le tue preferenze, e le tue chiamate di intelligenza artificiale. Con [Personale nascosto](/it/users/locations/#nascondi-personale) porta il primo altro luogo che possiedi, e Personale è su **Esporta un luogo**.

**Cosa contiene** inoltre: oggetti archiviati e conclusi (venduti, regalati, buttati via), il Cestino, la storia, le chiamate di intelligenza artificiale, e **Una copia leggibile senza Kept**: pagine web, fogli di calcolo, miniature e ricevute che si aprono in qualsiasi browser, opzionalmente con il PDF dell'inventario, in una lingua propria.

**Includi i segreti** è per il proprietario del luogo. I valori segreti sono crittografati con una frase segreta di almeno 12 caratteri, digitata due volte. Chiunque abbia il file e la frase segreta può leggere ogni segreto in esso, e Kept non può recuperare una frase segreta dimenticata. La copia leggibile non contiene mai segreti.

Un'esportazione senza segreti lascia fuori ogni valore segreto e lo dice: ogni oggetto o posto che ne aveva uno nomina il campo in `secretsWithheld`, il manifest li conta e la copia leggibile ha una riga a riguardo. Importa come qualsiasi altra esportazione; i campi arrivano vuoti. Su HTTP semplice è l'unico tipo (**Includi i segreti** richiede HTTPS, [Kept in una rete domestica](/it/install/home-network/)).

L'esportazione viene costruita in background; vieni avvisato quando è pronta. Ogni esportazione resta nella lista, pronta per **Scarica**, per sette giorni. Ogni file nello ZIP è datato quando l'esportazione è stata creata.

### Esportazioni e backup

Un'esportazione è qualcosa che porti via: un luogo, leggibile ovunque, importabile in qualsiasi Kept. Il backup notturno del server è separato e copre l'intera istanza; contiene anche una copia leggibile di ogni luogo ([backup](/it/admin/backups/)). L'eliminazione di un luogo offre **Esporta prima**.

## Spostamento tra istanze

Per spostare una famiglia su un altro server Kept: esporta il luogo (con i segreti se ti servono), poi importa lo ZIP lì come esportazione di Kept. Le etichette stampate continuano a funzionare: un'etichetta tiene il suo codice quando quel codice è libero sul nuovo server, e quando non lo è, l'etichetta vecchia apre ancora l'oggetto. Per spostare un intero server con ogni account, usa un backup invece. Entrambi i modi sono in [spostarsi su un nuovo server](/it/admin/move-server/).
