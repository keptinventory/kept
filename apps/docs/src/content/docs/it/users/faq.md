---
title: Domande e risposte
description: Risposte brevi alle domande che le persone fanno prima e dopo aver installato Kept, ognuna con un collegamento alla pagina con i dettagli.
---

## Kept invia da qualche parte informazioni su di me o sul mio server?

No. Non c'è telemetria di alcun tipo, neanche un conteggio delle installazioni attivabile. Il controllo
degli aggiornamenti è spento finché un amministratore non lo attiva, e poi invia solo la richiesta
per l'ultima release. La ricerca per codice a barre e l'IA sono anch'esse spente finché qualcuno
non le collega. Vedi [osservabilità](/it/admin/observability/) e
[aggiornamenti](/it/admin/upgrades/).

## Dove sono salvati i miei dati?

Sul tuo server: il database in Postgres e i file (foto, ricevute, documenti) sul volume dati di Kept
o in un bucket S3 che scegli tu. Il tuo telefono tiene una copia per l'uso offline, senza valori
segreti. Vedi [archiviazione dei file](/it/admin/storage/) e [l'app per telefono](/it/users/phone-app/).

## Come elimino il mio account?

Impostazioni → Io → Elimina il mio account, con la tua password. Prima cedi a qualcun altro ogni
luogo di cui sei proprietario (eccetto quello Personale), oppure eliminalo; l'unico amministratore
dell'istanza deve prima nominare un altro amministratore. L'account poi attende 30 giorni:
accedendo vedi la data e un modo per tenerlo, e non si apre altro. Dopo viene eliminato insieme al
tuo luogo Personale. Ciò che hai aggiunto ai luoghi di altre persone resta lì.
Prima [esporta i tuoi dati](/it/users/import-export/#esportazione) se vuoi una
copia.

## Posso usarlo senza IA?

Sì. Tutto funziona tranne dare un nome agli oggetti dalle foto, leggere le ricevute, l'assistente e
la ricerca per significato. Senza un fornitore, gli oggetti catturati restano nella Inbox in attesa di
un nome, e la ricerca usa le parole chiave. Vedi [Fornitori di IA](/it/users/ai-providers/).

## Quali fornitori di IA funzionano, e chi paga?

Groq (consigliato), OpenAI, Anthropic, Google, OpenRouter, o qualsiasi server compatibile OpenAI
come Ollama. Usi la tua chiave; il lavoro in un luogo è pagato con la chiave del proprietario di
quel luogo, e puoi fissare un limite di spesa. Vedi [Fornitori di IA](/it/users/ai-providers/).

## Funziona offline?

Su un telefono con Kept installato, sì per trovare e catturare: navigazione, ricerca, cattura,
spostare oggetti, letture, controlli delle scatole e scansione delle etichette. Le modifiche ai
dettagli, i report, le importazioni e le esportazioni richiedono connessione. Ciò che fai offline
si sincronizza quando torni online. Vedi
[Kept sul telefono](/it/users/phone-app/#cosa-funziona-offline).

## C'è un'app nell'App Store o su Google Play?

No. Kept è un'app web che aggiungi alla schermata iniziale dal browser. Serve che Kept sia su HTTPS.
Vedi [Kept sul telefono](/it/users/phone-app/#installalo) e [HTTPS](/it/install/https/).

## Gira su arm64, o su un Raspberry Pi?

Le immagini sono create per amd64 e arm64, quindi server ARM e Docker su Apple Silicon le
eseguono. Un Raspberry Pi con 1 GB o più potrebbe andare, più lentamente; nessuna release è stata
testata su uno. Kept è provato con 1 GB di RAM e uno o due core CPU (arm64). Vedi
[cosa è stato testato](/it/install/hardware/).

## Quante persone possono usare un solo Kept?

Kept è dimensionato per gli oggetti più che per le persone: i suoi obiettivi sono 10.000 oggetti in un
luogo e 50.000 in un'istanza; il test con 1 GB ha usato 3.000 in un solo luogo. Le persone
entrano in un luogo su invito, e ogni luogo può contenere fino a 20 account gestiti per persone
senza email. Vedi [cosa serve](/it/install/hardware/) e
[invitare persone](/it/users/first-run/#5-invita-persone).

## Posso tenere più di una casa, o condividere solo parte dei miei oggetti?

Sì. Ogni luogo (una casa, un garage, un deposito, la casa di un genitore) è condiviso
separatamente, con i suoi membri e ruoli; condividere il garage non condivide nient'altro. Una
persona può appartenere a molti luoghi, e tutti hanno un luogo Personale privato. Vedi
[i tuoi primi minuti](/it/users/first-run/#5-invita-persone).

## In cosa si differenzia Kept da Homebox?

Entrambi tengono traccia di ciò che possiedi e di dove si trova. Kept ha anche:

- **Una mappa 3D** dei tuoi piani, stanze, scaffali e scatole.
- **Veicoli**: letture, manutenzioni, carburante e i loro costi.
- **Promemoria** per garanzie, manutenzioni, prestiti e scorte basse.
- **Uso offline** sul telefono, con etichette che stampi e scansioni.
- **IA, se la vuoi**: cattura da una foto, e un server MCP per gli assistenti.

Importa un backup di Homebox, così puoi provarlo con i tuoi oggetti.

## Posso passare da Homebox?

Sì. Da Homebox v0.26.1 o più recente (consigliato v0.27.0), crea un backup in Homebox (**Collection →
Tools → Backup & Restore → Create Backup**, poi **Download**), importa quel ZIP in Kept, verifica cosa succederà, poi
importa. Foto, ricevute, garanzie, manutenzioni ed etichette passano, e le vecchie etichette
Homebox scansionano ancora. Un elemento entra come venduto solo quando Homebox ha un acquirente o
un prezzo per esso (una data di vendita da sola resta nelle sue note), e gli elementi archiviati
entrano **Archiviato** a meno che tu non scelga **In uso** oppure **Lascia fuori**. Collega prima
[Paperless-ngx](/it/users/paperless/) e i collegamenti di Homebox ai suoi documenti entrano come
collegamenti Paperless. Vedi
[importazione ed esportazione](/it/users/import-export/#unesportazione-di-homebox); un'importazione fatta prima della 1.14.1 può essere
[riparata](/it/users/import-export/#riparazione-di-unimportazione-precedente). Un Homebox più vecchio
non ha un backup leggibile da Kept: aggiorna prima una copia, oppure importa il suo foglio di
calcolo. Vedi [passare da un Homebox più vecchio](/it/users/import-export/#provenire-da-una-homebox-più-vecchia).

## Come faccio il backup?

Il server fa ogni notte uno snapshot restic cifrato del database, dei file e di una copia leggibile
di ogni luogo, su un altro disco, un bucket S3 o un server SFTP. Tieni il kit di recupero da
un'altra parte. Per portare via un luogo, esportalo. Vedi [backup](/it/admin/backups/),
[il kit di recupero](/it/admin/recovery-kit/) e [importazione ed esportazione](/it/users/import-export/#esportazione).

## Che succede se il server si perde insieme alla casa?

La copia leggibile del backup si apre in qualsiasi browser con restic, la password del backup e un
portatile, senza bisogno di Kept. Per riportare Kept su una nuova macchina serve anche il kit di
recupero. Vedi [leggere il tuo inventario solo con restic](/it/admin/read-with-restic/) e
[ripristino](/it/admin/restore/).

## Quali lingue parla?

Arabo (disposto da destra a sinistra), francese, inglese, italiano, spagnolo, tedesco,
ucraino e vietnamita, scelti per dispositivo. Vedi [lingua e tema](/it/users/first-run/#6-lingua-e-tema).

## Sotto quale licenza è?

La GNU Affero General Public License, versione 3 (AGPL-3.0). Puoi eseguirlo, modificarlo e
condividerlo; se esegui una versione modificata per altre persone su una rete, devi offrirne il
sorgente. Il testo è nel [LICENSE](https://github.com/keptinventory/kept/blob/main/LICENSE) del repository.

## Kept è gratuito? Diventerà a pagamento?

Kept self-hosted è gratuito e open source. App mobili e desktop e una versione cloud sono in
lavorazione.

## Esiste una release?

Sì: `1.0.0` è stata la prima release firmata, su GHCR come `ghcr.io/keptinventory/kept`, e ogni
release successiva è elencata sulla [pagina delle release](https://github.com/keptinventory/kept/releases).
Gli aggiornamenti eseguono una sola volta le loro migrazioni, fanno prima uno snapshot del
database e possono tornare indietro di una versione. Vedi [installare con Docker Compose](/it/install/compose/) e
[aggiornamenti](/it/admin/upgrades/).
