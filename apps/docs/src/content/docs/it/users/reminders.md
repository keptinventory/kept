---
title: Promemoria e notifiche
description: "Cosa Kept ti ricorda, come funziona il centro notifiche, la configurazione dei canali per ntfy, Telegram e Apprise, e le impostazioni per posizione."
---

Kept ti ricorda delle scadenze, delle garanzie in scadenza e delle scadenze di registrazione, dei documenti e degli oggetti che scadono, dei prestiti in ritardo, dei contatori non letti da poco, delle scorte basse, dei membri che si uniscono e lasciano, e dei limiti di spesa IA. **Tocca a te** nella Home mostra cosa è in scadenza o in ritardo; il campanello apre il centro notifiche, dove **Completa**, **Rimanda**, **Rinnova** e **Segna come restituito** agiscono sul posto.

Questa pagina copre cosa ti arriva, come impostare i canali e le impostazioni per posizione. Per le notifiche push su telefono, guarda [Kept sul tuo telefono](/it/users/phone-app/#notifiche).

## Cosa ti arriva

**Tocca a te** nella Home mostra sei conteggi, sempre nello stesso posto: **In ritardo**, **Da fare**, **In scadenza**, **Prestati**, **Incerto** e **Scorte basse**. Uno zero è grigio, non nascosto. **In prestito da altri** e **Non visti da tempo** appaiono quando hanno qualcosa. Su un computer ciascuno indica l'elemento più urgente. Tocca uno per aprire quell'elenco, già filtrato.

Il centro notifiche (il campanello) elenca tutto ciò che è in scadenza o in ritardo, raggruppato per tipo. Da lì puoi **Completa**, **Rimanda**, **Rinnova** o **Segna come restituito** senza lasciare la pagina.

## Impostazioni

**Impostazioni → Profilo → Notifiche** sceglie cosa ti arriva e come:

- **Riepilogo giornaliero**: un singolo riepilogo giornaliero invece di notifiche individuali.
- **Ore di silenzio**: nessuna notifica durante le ore che hai impostato. Niente viene pushato o inviato via email in esse; ciò che scade attende finché non terminano e viene inviato allora.
- **Feed del calendario**: un collegamento privato per la tua app del calendario, che mostra le scadenze.

Le notifiche push su telefono sono trattate in [Kept sul tuo telefono](/it/users/phone-app/#notifiche).

## La tabella delle notifiche

**Cosa ti arriva** è una tabella. Le righe sono i tipi, raggruppati:

- **Scadenze**: scadenze, garanzie, scadenze di registrazione, documenti, oggetti che scadono, contatori non letti da poco.
- **Prestiti**: prestiti in ritardo.
- **Scorte**: scorte basse.
- **Persone**: membri che si uniscono e lasciano.
- **IA**: limiti di spesa e riepilogo mensile.

Le colonne sono i tuoi canali:

- **In Kept**: il centro notifiche e il Tocca a te di Home.
- **Email**: all'indirizzo email del tuo account.
- **Push**: al tuo telefono (dove è configurato il push).
- **Webhook / ntfy / Telegram / Apprise**: dopo averne aggiunto uno, appare una colonna per ogni tipo.

Le notifiche relative ai membri e all'IA vanno solo a Kept e via email. Disattivando **In Kept** per un tipo, viene disattivato ovunque: nessun altro viene inviato per esso. Su un telefono, ogni tipo mostra i suoi canali come interruttori sotto.

## Impostazioni per posizione

- **Tutti i luoghi** imposta ciò che ricevi ovunque, inclusi i luoghi che aggiungi successivamente.
- **Scegli un luogo** per modificarlo solo lì. Un punto indica ciò che è impostato solo per quel luogo.
- **Riporta questo luogo come tutti i luoghi** cancella tali sovrascritture.
- Un tipo il cui modulo è disattivato lì viene mostrato in pausa (i suoi promemoria aspettano finché il modulo non viene ripristinato).
- Dove sei uno spettatore ricevi solo i membri che si uniscono e lasciano.
- Dove sei un membro, Kept parte con solo i prestiti che hai registrato: attiva ciò che vuoi lì.

## Impostazione dei canali

### ntfy

Aggiungi il tuo server (`https://ntfy.sh` o il tuo) e un argomento difficile da indovinare, più un token di accesso se l'argomento ne richiede uno. Kept conserva tutti questi dati cifrati e non li mostra mai più.
**Prova** invia uno ora.

### Telegram

Crea un bot con @BotFather, inviale un messaggio, poi aggiungi il suo token e il tuo ID chat. Kept conserva tutti questi dati cifrati e non li mostra mai più.
**Prova** invia uno ora.

### Apprise

Quando il tuo server ha Apprise, incolla uno o più URL Apprise, come `discord://…`, per raggiungere Discord, Slack, Matrix, Signal e altro. Kept conserva tutti questi dati cifrati e non li mostra mai più.
**Prova** invia uno ora.

## Promemoria sui prestiti

**Presta** un oggetto (o parte di una quantità) a un membro o a un contatto, con una data di scadenza e foto delle condizioni. Kept non invia mai messaggi al prendere in prestito; **Copia un promemoria** ti dà il testo da inviare tu stesso.
Un box accompagna tutto ciò che contiene, ogni oggetto su una propria linea. Vedi
[Kits e consegne](/it/users/kits/).

## Correlati

- [Kept sul tuo telefono](/it/users/phone-app/) per le notifiche push e l'uso offline.
- [Uso quotidiano](/it/users/everyday-use/) per il quadro più ampio.
- Veicoli e macchine per le letture dei contatori e gli orari di manutenzione.
