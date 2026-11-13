---
title: Glossario
description: "Le parole che Kept usa a modo suo, in linguaggio semplice."
---

Kept usa alcune parole a modo suo. Questa pagina spiega cosa significa ciascuna e dove leggere di più.

## A

**Amministratore**: un ruolo in un luogo. Può invitare e rimuovere membri e visualizzatori, cambiare impostazioni e
moduli, importare ed esportare, creare link di condivisione e pacchetti per il risarcimento, ed eliminare definitivamente. Solo il
proprietario concede o revoca gli amministratori. [I ruoli](/it/users/first-run/#i-ruoli)

**Fornitore di IA**: il servizio che Kept chiama per dare un nome agli oggetti dalle foto, leggere gli scontrini, eseguire l’
assistente e, con un modello di embedding, cercare per significato: Groq, OpenAI, Anthropic, Google,
OpenRouter o un server compatibile con OpenAI come Ollama. Porti la tua chiave.
[Fornitori di IA](/it/users/ai-providers/)

## B

**Backup**: uno snapshot restic notturno del database, dei file e di una copia leggibile, cifrato
con una password che scegli tu e inviato su un altro disco, un bucket S3 o un server SFTP.
[Backup](/it/admin/backups/)

**Scatola**: vedi Contenitore.

## C

**Acquisisci**: aggiungere un oggetto facendone una foto. Con un fornitore di IA, Kept gli dà un nome dalla foto;
senza, attende in In arrivo un nome.

**Pacchetto per il risarcimento**: un file ZIP del report per l’assicurazione con ogni ricevuta, fattura, foto e numero di serie per un
sinistro, condiviso con l’assicuratore tramite un link di download. [Report](/it/users/reports/)

**Comparto**: un posto dentro un mobile fatto da un modello di posto: un cubo, un ripiano o un
cassetto, con il proprio nome, etichetta e, se vuoi, il proprio codice. I comparti affiancati possono
essere uniti in uno e divisi di nuovo.
[Mobili con comparti](/it/users/locations/#mobili-con-vani)

**Verbale di stato**: una registrazione di come era una casa affittata quando sei entrato e quando te ne sei andato,
per una disputa sul deposito cauzionale. [Verbali di stato](/it/users/condition-reports/)

**Consumabile**: un oggetto contato a quantità, come viti, olio o pile, con una soglia minima che
attiva un promemoria di scorte basse. Un servizio può prenderne uno **Dalla scorta**.

**Contenitore**: un oggetto che contiene altri oggetti, come una scatola o una borsa. I contenitori si annidano, una scatola in una
scatola su un ripiano. Un contenitore è un oggetto, non un posto.

**Conta**: contare un posto, o controllare una scatola, confrontandoli con ciò che Kept si aspetta che ci sia. Ogni conta
è conservata, con ciò che è stato trovato e ciò che mancava. Chiamata anche inventario.
[Conte e inventari](/it/users/counts/)

## D

**Bozza**: un oggetto salvato senza nome da Acquisisci, non ancora accettato. Attende in In arrivo finché non viene accettato o scartato. [Acquisire e In arrivo](/it/users/everyday-use/#acquisire-e-in-arrivo)

## F

**Mobili**: un tipo di posto per mobili contenitori aggiunti con i loro comparti in un passaggio: una scaffalatura a cubi,
una libreria, una cassettiera. I mobili disegnati sulla mappa, come una scrivania, sono un oggetto con
una forma invece. [Mobili con comparti](/it/users/locations/#mobili-con-vani)

## G

**Grafo**: uno dei layout di un luogo: i suoi piani, stanze, scatole e oggetti come nodi e collegamenti, in
2D o 3D, con indicatori per ciò che richiede attenzione. [Il grafo](/it/users/graph/)

## H

**Consegna**: prestare una scatola con tutto ciò che contiene: un solo record, con una riga per la scatola e
una per ogni oggetto al suo interno, ognuno che torna separatamente. [Kit e consegne](/it/users/kits/)

## I

**In arrivo**: dove gli oggetti ti aspettano: acquisizioni senza nome, ciò che l’IA ha letto e su cui dare un’occhiata,
ricevute dall’email-in, letture che sembrano sbagliate e modifiche del telefono che richiedono una decisione.

**Sinistro**: un furto, un incendio, un allagamento o una perdita, con gli oggetti che ha colpito.
[Report](/it/users/reports/#sinistri-e-pacchetti-sinistro)

**Istanza**: un server Kept in esecuzione, con i suoi account e luoghi.

**Amministratore dell’istanza**: una persona che gestisce il server: utenti, registrazione, backup. Un amministratore dell’istanza non può
vedere dentro un luogo a meno che non sia invitato. 

**Report per l’assicurazione**: un PDF e un CSV di ogni oggetto con la sua foto, marca, modello, numero di serie, data di
acquisto, prezzo, valore attuale e ricevute, con totali per posto e per valuta.
[Report](/it/users/reports/#report-per-lassicurazione)

## K

**Kit**: un contenitore con una lista delle parti che dovrebbe contenere. Sposta una parte fuori, prestala o perdila,
e il kit lo sa ancora. [Kit e consegne](/it/users/kits/#kit)

## L

**Supporto per etichette**: su cosa si stampano le etichette: un foglio A4 o Letter, un rotolo per stampante di etichette o
nastro per etichettatrice. Un nastro stretto (9 e 12 mm) non ha spazio per un codice QR; **Scansiona** legge invece il suo
ID breve stampato. [Stampa](/it/users/short-ids/#stampa)

**Layout**: come la pagina di un luogo mostra ciò che contiene: **Elenco**, **Griglia**, **Grafo**, **Tabella** (su un
computer) o **Mappa**. Kept ricorda la scelta per luogo su ogni dispositivo.
[Luoghi, stanze e scatole](/it/users/locations/)

**Prestiti**: registrare che un oggetto, o parte di una quantità, è con qualcuno, con una data di scadenza, la sua
condizione e foto.

**Luogo**: una casa, un garage, un magazzino, un ufficio o qualsiasi altro posto in cui tieni oggetti. Ognuno ha i propri
membri, ruoli, moduli, fuso orario e valuta.

## M

**Account gestito**: un account con un nome utente e senza email, per un figlio o un genitore, creato dal
proprietario di un luogo o da un amministratore. Un luogo ne contiene al massimo 20.
[Persone senza email](/it/users/first-run/#persone-senza-email)

**Mappa**: uno dei layout di un luogo: il luogo in 3D, piano per piano, con le sue stanze, scaffali
e scatole, che i membri e superiori organizzano. [La mappa del luogo](/it/users/location-map/)

**MCP** (Model Context Protocol): come un’app di IA come Claude si collega a Kept per trovare e modificare
oggetti, entro il tuo ruolo. [Collegare un client di IA](/it/users/mcp-clients/)

**Contatori**: letture, servizi e programmi, per un oggetto il cui tipo ha un contatore: un’auto, un
generatore, una caldaia. [Veicoli e macchine](/it/users/vehicles/)

**Membro**: un ruolo in un luogo. Può aggiungere, modificare, spostare, prestare e cestinare oggetti, registrare letture e
servizi, stampare etichette e usare l’acquisizione con IA. I soldi sono visibili.

**Modulo**: una parte di Kept attivata o disattivata per luogo, come Prestiti o Veicoli.
[Moduli e preimpostazioni](/it/users/modules/)

## N

**Tocca a te**: i conteggi della Home di ciò che richiede attenzione: In ritardo, In scadenza, In scadenza a breve, Prestati,
Incerti e Scorte basse. [Home](/it/users/home/)

## O

**Proprietario**: il ruolo che detiene un luogo. Tutto ciò che un amministratore può fare, più regole per l’autenticazione a due fattori,
trasferimento ed eliminazione. C’è un solo proprietario.

## P

**Luogo personale**: il tuo luogo personale, creato con il tuo account. Non è mai condiviso: niente membri,
inviti o link di condivisione. Puoi [nasconderlo](/it/users/locations/#nascondi-personale) una volta che ne hai un altro.

**Posto**: una stanza o un punto dentro un luogo: un piano, una stanza, un ripiano, un cassetto. Una scatola è un
contenitore, non un posto.

**Modello di posto**: mobili e i loro comparti come una sola ricetta: il layout (cubi in larghezza e
in altezza, ripiani o cassetti), le tipologie, i nomi e uno schema di codice. Kept ha scaffalature a cubi, una
libreria, una cassettiera e un’unità di ripiani; un account aggiunge il proprio sotto **Impostazioni →
Account → Modelli → Mobili**.
[Mobili con comparti](/it/users/locations/#mobili-con-vani)

**Preset**: l’insieme dei moduli con cui parte un luogo: Essentials, Household o Complete.
[Moduli e preimpostazioni](/it/users/modules/)

## R

**Lettura**: il valore di un contatore in un momento, come un contachilometri o un contatore di ore.

**Kit di ripristino**: le chiavi del server, il repository del backup e le credenziali, e i passaggi di
ripristino, da stampare o salvare da qualche altra parte rispetto al server. Senza di esso, un backup non può recuperare le
chiavi di IA o le password salvate. [Il kit di ripristino](/it/admin/recovery-kit/)

**RLS** (sicurezza a livello di riga): le regole del database che tengono separati i luoghi: ogni richiesta vede
solo ciò che la persona autenticata può vedere. [Sicurezza a livello di riga](/it/developers/rls/)

## S

**Programma**: qualcosa da rifare, per data o per lettura, come un cambio olio.
[Promemoria](/it/users/reminders/)

**Campo segreto**: un campo su un oggetto, come una password Wi-Fi o un codice della porta, memorizzato cifrato e
nascosto finché qualcuno autorizzato non lo rivela. Ogni rivelazione è registrata.

**Link di condivisione**: un link in sola lettura a ciò che è in una scatola, in un posto o in una ricerca, per chi non ha un
account. [Link di condivisione](/it/users/sharing/#link-condivisi)

**ID breve**: il codice di sei caratteri che ogni oggetto e posto ha, come `7KQ-4MZ`, stampato sulla sua
etichetta. [ID brevi ed etichette](/it/users/short-ids/)

**Inventario**: vedi Conta.

## T

**Nastro**: il nastro ambrato che un codice mostra una volta che ha un’etichetta stampata. Il nastro per etichettatrice è un
supporto per etichette. [ID brevi ed etichette](/it/users/short-ids/)

**Oggetto**: qualsiasi cosa di cui tieni traccia: un trapano, un'auto, una scatola di cavi.

**Cestino**: dove gli oggetti cestinati aspettano per 30 giorni. I membri e superiori li ripristinano; gli amministratori li eliminano
per sempre.

## U

**Senza posto**: il posto che ogni luogo ha per gli oggetti che non hanno ancora un posto.

## V

**Veicolo**: un oggetto il cui tipo è Veicolo o un tipo sotto di esso: un’auto, una moto, una bicicletta, un
generatore. I veicoli hanno letture, servizi e pianificazioni, e carburante su Complete. Una caldaia ha
Contatori ma non è un veicolo. [Veicoli e macchine](/it/users/vehicles/)

**Visualizzatore**: un ruolo in un luogo. Può solo guardare e cercare. I soldi sono nascosti a meno che il luogo non
permetta ai visualizzatori di vederli; l’assistente risponde ma non può modificare nulla.

## W

**Novità**: la scheda che appare dopo l’aggiornamento di Kept, con i punti salienti di quel rilascio, una volta per persona;
**Aiuto** la mostra di nuovo. [Fai un tour](/it/users/first-run/#7-fai-il-tour)

## Correlati

- [I tuoi primi minuti](/it/users/first-run/) per iniziare.
- [Domande frequenti](/it/users/faq/) per domande comuni.
