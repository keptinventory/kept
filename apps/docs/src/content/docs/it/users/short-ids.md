---
title: ID brevi ed etichette
description: "ID a sei caratteri, stampa di etichette su fogli, rotoli e nastro da etichettatrice, cosa fa lo scanner con ogni codice che legge, scansione di un codice senza QR code e quale codice Kept conserva dove."
---

Quando un nuovo oggetto raggiunge il server ottiene un ID breve: sei lettere e cifre, ad esempio `7KQ-4MZ`,
mai riutilizzato. Fino a quel momento mostra **ID in attesa**. Un'etichetta porta l'ID come testo e, su ogni
tipo di supporto tranne il nastro da etichettatrice stretto, in un codice QR che apre l'oggetto. Un'etichetta conserva il suo codice per sempre, così uno smarrito ristampa lo stesso.

Liste, risultati della ricerca e la tavolozza ⌘K mostrano un oggetto per nome. Il suo codice compare lì come nastro etichetta ambra solo quando ha un'etichetta stampata: un'etichetta confermata con **Stampate bene?**, oppure un'etichetta bianca assegnata a esso. Anche il foglio dei contenuti di una scatola in trasloco conta, una volta confermato nello stesso modo ([Trasloco casa](/it/users/moving/)). Ambra significa «questa è etichettata». Nella pagina propria un oggetto o un posto senza etichetta stampata mostra il codice piccolo e grigio, dopo il resto; uno con etichetta mostra il nastro. Un oggetto con più di un'etichetta (ad esempio un'etichetta bianca assegnata) mostra il codice dell'ultima stampata. Ricerca e scanner trovano un oggetto tramite qualsiasi dei suoi codici.

## Stampa

**Stampa** (Etichette nel menu, oppure **Etichetta** su un oggetto): scegli cosa stampare (una selezione,
**Etichetta tutto ciò che non ha un'etichetta stampata** in un luogo o posto, oppure un **Foglio bianco**), scegli il **Tipo di etichetta**, indica da dove iniziare su un foglio già parcialmente usato, e stampa dal browser. L'**Anteprima foglio** è la stampa stessa, ridotta: gli stessi
codici QR, nomi e posti, interrotti sulle stesse righe. Un nome non viene mai troncato: uno lungo va a capo e il suo tipo diventa più piccolo, e uno che comunque non entra viene elencato prima della stampa, con un link per rinominarlo. La pagina è impostata sul formato del foglio senza margini, quindi le impostazioni predefinite della finestra di stampa (scala 100 %) mettono ogni etichetta nella sua cella.

I tipi di etichetta:

| Tipo | Dimensione | Ogni etichetta |
|---|---|---|
| Foglio A4, 24 etichette | 70 × 37 mm, 3 × 8 | Codice QR, ID breve, nome e posto |
| Foglio A4, 65 etichette | 38 × 21 mm, 5 × 13 | Codice QR e ID breve |
| Foglio Letter, 30 etichette (layout Avery 5160) | 67 × 25 mm, 3 × 10 | Codice QR, ID breve, nome e posto |
| Rotoli per stampante di etichette | 50 × 30, 40 × 30 e 62 × 29 mm | Codice QR, ID breve, nome e posto |
| Nastro da etichettatrice, 9 e 12 mm (Brother TZe e simili) | 40 e 50 mm di lunghezza | ID breve in carattere grande, e il nome. Nessun codice QR |
| Nastro da etichettatrice, 18 e 24 mm | 50 e 60 mm di lunghezza | Codice QR, ID breve in carattere grande, e il nome |

Rotoli e nastro stampano un'etichetta per pagina, alla dimensione dell'etichetta: nella finestra di stampa, scegli la tua stampante di etichette e quella dimensione. Per un'app da etichettatrice che accetta immagini, **Condividi come immagini** genera un PNG per etichetta. Il nastro stretto non ha spazio per un codice QR scansionabile, quindi trasporta l'ID breve ingrandito: lo scanner lo legge dal testo ([Scansione di un codice senza QR
code](#scansione-di-un-codice-senza-qr-code)).

Dopo la stampa, **Stampate bene?** chiede conferma sul lotto appena stampato e lo registra; da allora quegli oggetti e posti mostrano il nastro ambra. **Lotti recenti** indica cosa contiene ciascuno, quando e dove è stato realizzato e se ha stampato correttamente; quello non ancora confermato può essere segnato **Stampato bene** o **Non stampato** lì, e ristampato con gli stessi codici. Stampar di nuovo gli stessi oggetti mentre il foglio non è ancora confermato propone quel foglio invece di uno nuovo. Gli oggetti il cui ID è ancora in attesa non possono essere stampate.

## Scansione

**Scansione** su Home e Ricerca apre la fotocamera.

| Scanni | Kept |
|---|---|
| Un'etichetta Kept per qualcosa che vedi | La apre e la marca come vista appena ora |
| Un codice Kept stampato senza codice QR (nastro stretto) | Lo apre, letto dal testo, oppure chiede **È questo il codice?** prima quando la lettura non è chiara ([qui sotto](#scansione-di-un-codice-senza-qr-code)) |
| Un'etichetta bianca | Offre **Nuova scatola qui**, **Collegala a un oggetto esistente** o **Collegala a un luogo esistente** (una stanza, scaffale o punto) |
| Un codice a barre di prodotto | Offre di aggiungerlo come nuovo oggetto; con la ricerca del codice a barre attivata dall'amministratore, prende il nome da Open Food Facts, Open Products Facts o Open Beauty Facts |
| Un numero di serie o un tag di beni che un oggetto possiede | Apre quell'oggetto |
| Un codice a barre che un oggetto possiede | Apre quell'oggetto; alcuni oggetti chiedono quale |
| Un codice che niente possiede ancora | Indica il suo tipo e offre di aggiungerlo come nuovo oggetto, mantenendo il codice come suo codice a barre o numero di serie |
| Un'etichetta Homebox, dopo un'[importazione Homebox](/it/users/import-export/) | Apre l'oggetto importato |
| Qualcos'altro | Dice che non è un'etichetta Kept |

Un'etichetta assegnata a un posto vi appare come nastro ambra, simile a una stampata per esso. L'assegnamento funziona offline: rimane in attesa sul telefono finché non si sincronizza, e se un altro telefono ha già richiesto la stessa etichetta vieni informato di chi ce l'ha. Membri, amministrati e proprietari possono assegnare; i visualizzatori no.

Per etichettare un posto su cui hai già attaccato un'etichetta bianca, apri il posto e scegli **Aggiungi un codice etichetta** (in Gestisci): lo scanner si apre, e l'etichetta bianca che scannerizzi offre prima quel posto.

Un'etichetta rimane attaccata a ciò cui è applicata. Quando [si uniscono i compartimenti](/it/users/locations/#unire-e-dividere-i-vani),
le etichette dei compartimenti uniti aprono il compartimento unito; una divisione restituisce ciascuna etichetta al relativo compartimento. Quando [si ribalta l'arredamento](/it/users/locations/#ruotare-il-mobile), ogni compartimento mantiene la sua etichetta, indipendentemente dalla ridenumerazione.

I codici che Kept legge, e dove un nuovo oggetto li conserva:

| Codice | Di solito su | Kept lo conserva come |
|---|---|---|
| Codice QR | Etichette Kept, etichette Homebox | L'etichetta |
| EAN-13, EAN-8, UPC-A, UPC-E | Prodotti | Codice a barre |
| Code 128, Codabar | Etichette di negozio, beni e biblioteca | Codice a barre |
| ITF-14 | Cartoni | Codice a barre, se il cifra di controllo è corretta; altrimenti scegli |
| Code 39, Code 93 | Tag di beni, adesivi IT | Numero di serie, oppure codice a barre se lo scegli |
| Data Matrix | Elettronica, caricabatterie, parti | Un codice GS1: il suo GTIN come codice a barre e il suo seriale come numero di serie. Testo semplice: scegli |
| PDF417, Aztec | Etichette di spedizione, carte di garanzia, biglietti | Scegli; anche testo troppo lungo per entrambi i campi (64 caratteri per un codice a barre, 100 per un numero di serie) non viene conservato |

Un'etichetta Kept prevale in qualsiasi di questi casi. Un numero di serie corrisponde esattamente com'era memorizzato, e solo online: la copia offline del telefono non contiene numeri di serie. I codici GS1 digitati tra parentesi, come `(01)04006381333931(21)K7Q2X9`, vengono letti allo stesso modo.

Un'etichetta consumata, o nessuna fotocamera: **Digita il codice**. La fotocamera di cattura riconosce anche le etichette Kept e offre di aprire quella scatola o di acquisire dentro di essa.

### Scansione di un codice senza QR code

Un'etichetta senza codice QR (nastro stretto) si legge tramite l'ID breve stampato. Punta **Scansione** sul codice, così occupa circa un terzo della larghezza della fotocamera, e resta fermo un attimo: Kept legge i sei caratteri dal testo e apre l'oggetto, come farebbe da un codice QR, e un messaggio indica quale codice ha letto.

- **Sul telefono, anche offline.** La lettura avviene sul telefono; l'immagine non viene inviata da nessuna parte. Funziona senza connessione per qualsiasi cosa presente nella copia del telefono.
- **Mai un oggetto sbagliato.** Kept apre un codice solo quando legge chiaramente ogni carattere, due volte di seguito, e il codice è uno dei tuoi. Se non è sicuro, mostra il codice letto e ciò che apre, e chiede **È questo il codice?** prima di aprirlo. Un codice che non corrisponde a nessuna delle tue etichette apre nulla: **Scansiona di nuovo**, oppure **Digita il codice**.
- **Solo stampe Kept.** Legge l'ID breve così come lo stampa Kept, con il suo carattere. Un codice digitato a mano su un'etichetta da un'etichetatrice, nel carattere dell'etichetatrice, potrebbe non essere letto: digitandolo invece.

Solo **Scansione** legge i codici stampati. Le sessioni di scansione, il controllo della scatola e la fotocamera di cattura leggono solo codici QR e codici a barre.

## Correlati

- [Sessioni di scansione](/it/users/scanning-sessions/) per la scansione di un'intera scatola in una volta.
- [Tag](/it/users/tags/) per indicare cos'altro è una cosa.
- [Uso quotidiano](/it/users/everyday-use/) per il quadro più ampio.
