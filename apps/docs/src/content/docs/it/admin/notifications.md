---
title: Posta, push e il feed del calendario
description: Configura la posta in uscita e il push web per un server Kept, e ciò che gli operatori devono sapere sui link privati del calendario creati dagli utenti.
---

Kept raggiunge le persone fuori dall'app tramite **email**, **push web** verso un browser o l'app installata,
**ntfy**, **Telegram** e **Apprise**, e un **feed del calendario** a cui si iscrive l'app calendario. Tutto arriva anche nel
centro notifiche in-app, che non richiede configurazione. Le persone scelgono cosa ricevere in
**Impostazioni → Notifiche** (Promemoria e avvisi → **Apri**). Questa pagina è il lato degli operatori.
Ogni variabile è elencata nel [riferimento della configurazione](/it/reference/configuration/).

## Posta

| Variabile | Cosa fa |
|---|---|
| `KEPT_SMTP_URL` | Il server SMTP, come `smtp://` o `smtps://`, con credenziali se servono: `smtps://user:password@mail.example.org:465`. |
| `KEPT_SMTP_FROM` | Il mittente di ogni email. Predefinito: `Kept <no-reply@<your KEPT_PUBLIC_URL host>>`. La maggior parte dei provider invia solo da un indirizzo verificato, quindi impostalo. |

Con Compose, metti entrambe in `.env`; `compose.yaml` le passa a `kept` e `migrate`. Con il
chart Helm, `smtp.existingSecret` nomina un Secret che contiene `KEPT_SMTP_URL`, e `smtp.from` imposta il
mittente. Kept apre una connessione per email; le opzioni URL proprie di nodemailer (come `?pool=true`)
passano attraverso l'URL.

### Quando `KEPT_SMTP_URL` non è impostato

La posta è solo registrata come dovuta: un avviso per email, `mail not sent: no mail transport is
configured`, che indica il tipo di email e mai l'indirizzo, il link o il token. **Amministrazione → Stato**
mostra **Posta: non configurata** e il messaggio **La posta non è configurata**. Senza posta non ci sono
link di accesso, recupero password, inviti via email, avvisi inviati per email o report inviati per email. I
link di invito e le password funzionano senza, e i promemoria arrivano comunque alle persone via push e nell'app.
**Inviamelo per email** e **Invialo di nuovo** in Stampa inventario sono bloccati, e proprietari e amministratori
ricevono un link **Configura l'email** a questa pagina; l'API rifiuta `email: true` e le pianificazioni dei report con
409 `mail_not_configured`.

Quando la posta è configurata, un account il cui indirizzo non è verificato non può aggiungere un passkey né un'app di autenticazione finché non lo è.

### Cosa invia Kept

Ogni email viene inviata come testo e HTML nella lingua del destinatario (inglese quando Kept non la conosce). I link portano il token dopo `#`, così uno scanner di posta
o un log del server non contiene mai uno utilizzabile.

- **Accesso e account**: link di accesso, recupero password, conferma e verifica di un nuovo
  indirizzo email e una nota al vecchio, una nota quando qualcuno prova a registrarsi con un indirizzo
  che ha già un account, e un avviso quando cambia una credenziale: la password, un passkey
  aggiunto o rimosso, un accesso esterno scollegato, l'autenticazione a due fattori attivata, riconfigurata o disattivata,
  e nuovi codici di backup.
- **Persone e luoghi**: inviti via email; al proprietario di un luogo, ogni nuovo membro o account gestito
  e ogni iscrizione che raggiunge la data di scadenza.
- **Trasparenza**: quando un amministratore dell'istanza (o `kept admin`) agisce sull'account di qualcuno; e a
  ogni utente attivo quando cambia l'accesso OIDC dell'istanza, la sua posta in uscita o il suo provider IA predefinito.
- **Promemoria**: un elemento scaduto subito, il riepilogo giornaliero, un test del canale e una nota quando il
  webhook personale di un utente continua a fallire.
- **IA**: un tetto mensile che raggiunge l'80% o il 100%, e il riepilogo IA mensile opzionale.
- **Agli amministratori dell'istanza**: avvisi amministrativi, al massimo uno al giorno per avviso
  ([la pagina di stato e gli avvisi](/it/admin/observability/#la-pagina-di-stato-e-gli-avvisi)).

### Cambiare il server di posta

Kept confronta l'host SMTP e il mittente con ciò che ha visto l'ultima volta a ogni avvio, mai la
password. Se uno dei due cambia, il cambiamento viene registrato in audit e ogni utente attivo viene avvisato, tramite la nuova
route. Il primo avvio con la posta configurata si limita a registrarla.

## Push web

Il push non richiede **chiavi da parte tua**. Al primo avvio Kept genera una coppia di chiavi VAPID e la conserva nel
database, la chiave privata sigillata con `KEPT_SECRET_KEY`. Per usare la tua coppia, imposta entrambe:

| Variabile | Cosa fa |
|---|---|
| `KEPT_VAPID_PUBLIC_KEY` | La chiave pubblica: base64url senza padding di 65 byte, come la scrive `generateVAPIDKeys()` di web-push. |
| `KEPT_VAPID_PRIVATE_KEY` | La sua metà privata (32 byte, stessa codifica). Mai registrata nei log. Impostarne una senza l'altra blocca Kept all'avvio. |
| `KEPT_VAPID_SUBJECT` | Chi i servizi push possono contattare: un URL `https:` o un indirizzo `mailto:`. Predefinito: `KEPT_PUBLIC_URL` quando è `https`, altrimenti `mailto:` dell'indirizzo `KEPT_SMTP_FROM`. |

Il push è **indisponibile** quando:

- `KEPT_PUBLIC_URL` è `http` semplice su qualsiasi cosa diversa da localhost: i browser si iscrivono solo su una pagina
  sicura. Le persone vedono "Il push richiede HTTPS." ([HTTPS](/it/install/https/))
- non c'è un subject: nessun `KEPT_VAPID_SUBJECT`, nessun URL pubblico `https` e nessun `KEPT_SMTP_FROM`.
  Le persone vedono "Il push non è configurato su questo server."

L'email e il centro notifiche funzionano comunque.

Le persone attivano il push per dispositivo con **Attiva** sotto **Come Kept ti raggiunge**, dopo che il browser
lo chiede. **Su iPhone e iPad, le notifiche funzionano solo dall'app installata**: Kept lo dice e
offre **Come installare** ([l'app del telefono](/it/users/phone-app/)).

Cosa esce dal server: Kept invia ogni push tramite HTTPS al servizio push a cui il browser si è
iscritto, quindi serve accesso a internet in uscita; gli indirizzi privati e locali sono rifiutati.
Un push contiene un titolo, una riga di testo e un link, sotto i 3 KB, mai denaro né dettagli di contatto.
Il servizio push lo conserva fino a un giorno mentre un dispositivo è offline. Un'iscrizione che il servizio
segnala come rimossa viene eliminata.

:::caution[Perdere la chiave]
Se la chiave privata memorizzata non si può aprire, perché la chiave segreta con cui era sigillata è sparita,
Kept ne crea una nuova e annulla ogni iscrizione push. Non si perde altro: le persone riattivano il push
su ogni dispositivo. Conserva [il kit di ripristino](/it/admin/recovery-kit/) e questo non succede mai su un
ripristino o uno [spostamento](/it/admin/move-server/).
:::

## ntfy e Telegram

Le persone aggiungono questi da sole in Impostazioni → Profilo → Notifiche; non c'è nulla da configurare sul
server. Kept pubblica sull'endpoint JSON di un server ntfy e sulla Bot API di Telegram
(`api.telegram.org`), entrambi insieme e attraverso la stessa protezione dei webhook: un server ntfy su un
indirizzo privato funziona solo quando **Consenti gli indirizzi privati** è attivo (Amministrazione → Impostazioni), e
i redirect sono rifiutati. Le loro impostazioni (un topic e un token ntfy, un token bot Telegram) sono
cifrate come il segreto di un webhook e coperte dalla [rotazione delle chiavi](/it/admin/recovery-kit/). Un invio
fallito viene riprovato con il promemoria e segna il canale "In errore da"; il prossimo invio che passa
lo cancella. Gli avvisi amministrativi non vanno a loro.

## Apprise

[Apprise](https://github.com/caronc/apprise) raggiunge Discord, Slack, Matrix, Signal, Pushover e
oltre 100 altri servizi. Kept comunica con un server **Apprise API** che gestisci accanto ad esso, e offre
**Aggiungi Apprise** alle persone solo quando `KEPT_APPRISE_URL` punta a uno:

```yaml
# compose.yaml, beside the kept service
  apprise:
    image: caronc/apprise:2.0.0
    restart: unless-stopped

# and in the kept service's environment
KEPT_APPRISE_URL: http://apprise:8000
```

- Ogni persona aggiunge i propri **URL Apprise** (uno o più, come `discord://…` or `mailto://…`).
  Sono cifrati come il segreto di un webhook, non mostrati di nuovo e coperti dalla
  [rotazione delle chiavi](/it/admin/recovery-kit/).
- Kept usa il `POST /notify/` stateless dell'Apprise API e invia gli URL con ogni messaggio, così il
  server Apprise non conserva nulla. Viene raggiunto sulla tua rete privata di proposito, con i redirect
  rifiutati.
- Gli URL generici di Apprise `json://`, `xml://` e `form://` (e le loro forme `s`) possono puntare a qualsiasi
  host, comprese le macchine della tua rete, quindi Kept li rifiuta a meno che **Consenti gli indirizzi privati**
  sia attivo (Amministrazione → Impostazioni).
- Un invio fallito (Apprise risponde 424 quando un servizio rifiuta) viene riprovato con il promemoria e segna
  il canale "In errore da". Gli avvisi amministrativi non vanno ad Apprise.

## Il feed del calendario

Ogni persona può creare un link iCal privato di ciò che è in scadenza e di ciò che finisce, in **Impostazioni →
Notifiche → Feed del calendario → Crea un link**. Non c'è nulla da configurare sul server.

- **Cosa contiene**: eventi per tutto il giorno da un mese prima a 13 mesi dopo, tra i luoghi della
  persona: titoli, percorsi dei luoghi, nomi dei luoghi e un link a Kept. Mai denaro, segreti,
  note o dettagli di contatto di chicchessia. Solo i tipi che la persona riceve su qualche canale, e nulla
  da una parte di Kept che un luogo ha disattivato. I luoghi che richiedono l'autenticazione a due fattori sono esclusi.
- **Il link**: `https://kept.example.org/cal/<token>.ics`, mostrato una sola volta. Kept memorizza solo lo
  SHA-256 del token e lo redige dai log delle richieste. È creato a partire da `KEPT_PUBLIC_URL` quando viene
  generato, quindi un link creato prima di un cambio di indirizzo punta ancora al vecchio indirizzo.
- **Chi può leggerlo**: chiunque abbia il link, senza accesso. Un link sconosciuto o revocato, o uno
  appartenente a un account disabilitato, risponde 404 senza dire quale. Ogni link può essere recuperato 60
  volte al minuto.
- **Revoca**: **Revoca** sul link lo termina per sempre; i calendari iscritti a esso smettono di aggiornarsi.
  L'elenco conserva la riga revocata e mostra quando ogni link attivo è stato recuperato l'ultima volta. Una persona può
  avere al massimo 3 link attivi.

Google Calendar recupera il link dai server di Google, quindi lì funziona solo quando Kept può essere
raggiunto da internet.
