---
title: Modello di sicurezza
description: Cosa un operatore deve sapere su come Kept mantiene separate le famiglie, sigilla i segreti, fa accedere le persone e cosa lascia il server.
---

Questa pagina è il riassunto, per l'operatore, del modello di minaccia di Kept e dei meccanismi che ci stanno dietro. Le
pagine per sviluppatori approfondiscono: [sicurezza a livello di riga](/it/developers/rls/), [accesso](/it/developers/auth/)
e [l'architettura](/it/developers/architecture/).

## Il database tiene separate le famiglie

Kept si connette a Postgres con quattro account, ognuno autorizzato solo a ciò che serve al suo compito:

| Account | Usato da | Cosa può fare |
|---|---|---|
| `kept_owner` | `kept migrate`, `kept admin`, il backup notturno | possiede lo schema; mai usato per servire una richiesta |
| `kept_app` | ogni richiesta web, incluse le route di amministrazione dell'istanza | legge e scrive le tabelle dell'app, sempre sotto sicurezza a livello di riga (`NOBYPASSRLS`, `FORCE` RLS su ogni tabella) |
| `kept_auth` | accesso (Better Auth) | solo il suo schema `auth` |
| `kept_system` | job in background che coinvolgono più famiglie (scansione dei promemoria, conservazione), il codice di setup | solo policy di sistema esplicite |

Ogni richiesta viene eseguita in una transazione che indica la persona autenticata, e ogni policy chiede a una sola
funzione a quali luoghi quella persona appartiene. Quando nessuna persona è impostata, le policy non restituiscono
nulla, quindi un percorso di codice che dimentica il contesto fallisce in modo sicuro. Un test anti-perdita a livello di schema verifica i
percorsi di richiesta, autenticazione e worker. I dettagli sono in [sicurezza a livello di riga](/it/developers/rls/).

Cosa significa per te: il container di servizio non conserva mai l'account del proprietario, a meno che non gliene dia uno
per i backup ([Backup](/it/admin/backups/#come-attivarlo)). Un amministratore dell'istanza non ha **nessun accesso dall'app**
ai luoghi di altre persone; un operatore con accesso al database può aggirarlo, ed è per questo che il database stesso
deve restare privato al server.

## Chiavi e cifratura

- **`KEPT_SECRET_KEY`** sigilla ogni valore segreto: i campi segreti degli oggetti, le chiavi IA, le impostazioni dei
  canali di notifica, i segreti dei webhook, le password delle caselle email-in, i token API di Paperless-ngx, la
  chiave privata del push web, la password dei backup. AES-256-GCM
  con una chiave dati per riga, ogni testo cifrato legato alla propria tabella, riga e campo, così non si possono scambiare tra loro.
- **`KEPT_AUTH_SECRET`** firma sessioni e token. È separata così ognuna può essere ruotata da sola.
- **Generate al primo avvio** quando entrambe non sono impostate, nel volume di configurazione (mai nel volume dati),
  con una riga di log che ne indica il percorso. Impostale con `kept admin gen-key`; l'avvio rifiuta una chiave più
  corta di 32 byte e rifiuta una chiave impostata senza l'altra.
- **Nessuna delle due è nel database o nel backup.** Tieni [il kit di ripristino](/it/admin/recovery-kit/).
  Senza la chiave segreta, un ripristino riporta tutto tranne i valori segreti e le chiavi IA.
- **Rotazione:** `kept admin rotate-key` fa diventare attuale una nuova chiave e ri-avvolge ogni valore sigillato;
  la vecchia chiave viene conservata come versione ritirata, così i backup più vecchi restano apribili. `--resume` completa
  un'esecuzione interrotta, `--drop <version>` rimuove una chiave ritirata che nessuno usa
  ([la CLI](/it/admin/cli/#comandi)).
- **Le password delle caselle di posta sono di sola scrittura:** il server, il nome utente e la password di una casella
  email-in sono sigillati insieme; la pagina mostra il server e il nome utente, mai la password.
- **Le chiavi IA sono di sola scrittura:** una volta salvate, Kept mostra solo gli ultimi quattro caratteri.
- **I token di Paperless-ngx sono di sola scrittura:** l'indirizzo Paperless e il token di un luogo sono sigillati
  insieme; la pagina mostra l'indirizzo, mai il token, e il browser non comunica mai con Paperless
  usando il token. Le miniature e i download passano attraverso Kept, dopo il controllo di accesso di Kept.

## Accesso

Kept usa Better Auth con un proprio account del database e un proprio schema. Con cosa può accedere un account:

- **Email e password.** Una reimpostazione della password disconnette l'account ovunque, e il proprietario viene
  avvisato per email quando cambia una credenziale.
- **Passkey**, registrate per il nome host di `KEPT_PUBLIC_URL`. Ognuna deve verificare l'utente
  (Face ID, impronta digitale, PIN) ed essere rilevabile.
- **Verifica in due passaggi** con un'app authenticator (TOTP) o una passkey che abbia verificato l'utente. Un codice
  monouso inviato per email non è mai un secondo fattore. Il proprietario di un luogo può richiedere la verifica in
  due passaggi per tutti i membri. Anche gli account senza password possono usare l'app authenticator.
- **Impostazioni → Accesso e sicurezza** aggiunge, rinomina e rimuove le passkey, accende l'app authenticator, genera
  nuovi codici di backup, la reimposta e la spegne
  ([Accesso e sicurezza](/it/users/sign-in-security/)). Ogni modifica chiede la password, o un
  accesso negli ultimi dieci minuti su un account senza password, e disconnette tutti gli altri dispositivi
  (a parte la rinomina). Il server rifiuta di rimuovere l'ultimo modo di entrare e di disattivare la verifica in due
  passaggi mentre un luogo la richiede e l'account non ha passkey. Reimpostare l'app mantiene attivo il vecchio
  segreto finché non viene provato un codice della nuova.
- **Link magici** solo per gli account esistenti (nessuna iscrizione aperta), validi 15 minuti. I token inviati per email
  viaggiano nel `#fragment` del link e vengono consumati da una POST dalla pagina, così uno scanner di posta che
  apre i link non può esaurirli; viene memorizzato solo un hash.
- **Nomi utente** per gli account gestiti (persone senza indirizzo email).
- **OIDC**, quando `KEPT_OIDC_ISSUER` e `KEPT_OIDC_CLIENT_ID` sono impostati
  ([configurazione](/it/reference/configuration/)). Un'identità esterna non viene mai collegata a un account solo perché
  l'email corrisponde; una nuova persona entra su invito, o tramite un dominio o gruppo consentito.
  I token del provider di identità non vengono mai memorizzati.
- **Google**, quando `KEPT_GOOGLE_CLIENT_ID` e `KEPT_GOOGLE_CLIENT_SECRET` sono impostati, con l'URI di reindirizzamento
  che mostra Admin → Stato. Le stesse regole dell'OIDC, tranne che nessuno entra tramite dominio: solo un account
  esistente che ha collegato Google, o una persona invitata.
- **Collegamento e scollegamento** di un accesso esterno avvengono in Impostazioni → Profilo → Metodi di accesso.
  Il collegamento richiede un accesso negli ultimi dieci minuti; lo scollegamento chiede la password (o quell'accesso
  recente su un account senza password). Un account mantiene sempre almeno un modo per entrare.

**Le sessioni** durano 30 giorni su HTTPS, estese una volta al giorno di uso, con cookie `Secure` con prefisso `__Secure-`.
Su HTTP in chiaro durano 12 ore e non vengono mai estese, e Kept rifiuta le azioni che rivelano o modificano un segreto
([HTTPS](/it/install/https/)). Le azioni sensibili chiedono di nuovo la password, o un accesso negli ultimi dieci
minuti; rinnovare un accesso non azzera quei dieci minuti.

`KEPT_HTTP_SIGN_IN_DAYS` (da 1 a 30, non impostato per default) permette a chi gestisce il server di far durare un
accesso su HTTP in chiaro quel numero di giorni, rinnovato con l'uso. È l'unica impostazione che allenta questa regola,
non può essere cambiata dall'app e non ha effetto su HTTPS. I segreti restano rifiutati su HTTP, i dieci minuti
restano e disconnettersi ovunque termina comunque ogni accesso. Il costo: su HTTP in chiaro un cookie di accesso può
essere copiato da chiunque veda il traffico, e con l'impostazione attiva una copia continua a funzionare finché viene
usata, finché quel dispositivo non si disconnette o non vengono disconnessi i tuoi altri dispositivi
([Restare sulla tua rete](/it/install/home-network/#restare-sulla-tua-rete)).

**Le richieste da altri siti** sono rifiutate: una scrittura che porta il cookie di Kept deve provenire dall'origine di
`KEPT_PUBLIC_URL`, altrimenti riceve 403 prima ancora che la sessione venga letta. Lo stesso vale per la
configurazione iniziale, che non ha ancora un cookie, prima che il codice di setup venga provato.

`KEPT_EXTRA_ADDRESSES` (non impostato per default) permette a chi gestisce il server di elencare altre origini esatte che
contano come Kept. Vengono lette una volta all'avvio e confrontate interamente con l'`Origin` del browser; `Host` e
`X-Forwarded-*` non contano. Un carattere jolly, o un mix di `http` e `https`, blocca l'avvio.
Il rifiuto cita `KEPT_PUBLIC_URL` e mai l'elenco. Passkey, accessi esterni, OAuth e ogni
link restano su `KEPT_PUBLIC_URL`: una passkey viene verificata contro quell'indirizzo qualunque cosa dica la richiesta.
Il costo: una pagina servita a un indirizzo elencato può agire per conto di chiunque sia autenticato lì
([Più di un indirizzo](/it/install/home-network/#più-di-un-indirizzo)).

Le pagine vengono servite con una content security policy `default-src 'self'`, non possono essere inserite in frame e
ricevono HSTS quando l'URL pubblico è HTTPS, a meno che `KEPT_HSTS=off` ([HSTS](/it/install/reverse-proxy/#hsts)).

## Limiti di frequenza

Così come sono implementati:

| Cosa | Limite |
|---|---|
| Tentativi di accesso | 5 al minuto per indirizzo; per account e indirizzo, 20 all'ora, con ritardi che crescono dopo il quarto fallimento (fino a 5 minuti) invece di un blocco |
| Altre route di autenticazione | 100 al minuto per indirizzo e route |
| API e MCP, per token | 120 letture e 30 scritture al minuto |
| Reimpostazione della password e link magico | 3 all'ora per account |
| Pagina di un link condiviso | 60 visualizzazioni al minuto per link |

I limiti sono conservati nel database, così le repliche li condividono. L'indirizzo del client viene dal socket, o da
`X-Forwarded-For` solo quando la connessione proviene da un indirizzo in
`KEPT_TRUSTED_PROXIES` ([proxy inversi](/it/install/reverse-proxy/#fidati-del-proxy-e-solo-del-proxy)).

## Richieste in uscita (SSRF)

Kept recupera solo gli indirizzi configurati da qualcuno: l'URL base di un provider IA, i webhook, il push,
un emittente OIDC, i metadati di un client OAuth, un server Homebox da cui importare, le ricerche di codici a barre,
il controllo aggiornamenti, la casella email-in (IMAP) di un luogo e il Paperless-ngx di un luogo. Ognuno passa per la stessa protezione
([`apps/server/src/net/ssrf.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/net/ssrf.ts)):

- l'indirizzo viene verificato **quando la connessione viene stabilita**, dopo la risoluzione del nome, così un nome che
  cambia tra il controllo e la richiesta non può passare;
- gli intervalli privati, di loopback, link-local (incluso l'indirizzo dei metadati cloud), NAT di tipo carrier-grade,
  multicast e riservati vengono rifiutati, su IPv4 e IPv6;
- i reindirizzamenti vengono rifiutati, così un host pubblico non può rimandare la richiesta all'interno.

Un indirizzo rifiutato è `400 private_address`. Su un server self-hosted un amministratore dell'istanza può consentire
gli indirizzi privati (**Admin → Impostazioni → Consenti gli indirizzi privati**), di cui ha bisogno un provider sulla tua
rete, come [Ollama](/it/admin/ollama/). È disattivato per default.

## Input ostile

Importazioni e upload sono trattati come ostili. I valori predefiniti:

| Limite | Predefinito |
|---|---|
| Import ZIP | 5 GB non compressi, compressione 100:1 per voce, 200.000 voci, nessun symlink |
| Immagini | decodificate fino a 100 megapixel, una alla volta sotto 3 GB di RAM o un limite container sotto 3 GB |
| PDF | analizzati in un processo figlio, 20 s e 256 MB |
| Upload | `KEPT_MAX_FILE_MB` (25 MB per default), rifiutati prima di leggere il corpo |

I file memorizzati vengono recuperati tramite un link firmato di cinque minuti su un percorso che non legge nessuna sessione, con
policy `nosniff` e `default-src 'none'; sandbox`, e come download a meno che il file non sia uno dei JPEG ricodificati da Kept. Le celle CSV esportate che iniziano come una formula vengono neutralizzate.

## Cosa lascia il server

- **Nulla su Kept stesso.** Non c'è alcuna telemetria di alcun tipo; la telemetria propria della libreria di accesso è
  disattivata. Tracciamento e segnalazione degli errori vanno solo a un collector che imposti
  ([monitoraggio](/it/admin/observability/#tracciamento-e-segnalazione-degli-errori)).
- **Il controllo aggiornamenti è disattivato per default.** Se attivo, chiede a GitHub l'ultima release una volta al
  giorno, inviando solo la richiesta ([aggiornamenti](/it/admin/upgrades/#sapere-se-cè-una-nuova-versione)).
- **Cosa vede un provider IA**, quando un luogo ne usa uno: le foto come copia ricodificata con EXIF e XMP rimossi
  (Kept rifiuta di inviare un'immagine che li ha ancora), il prompt fisso e le lingue del luogo per l'estrazione, la
  domanda e i risultati degli strumenti che il ruolo di chi chiede consente all'assistente, e i campi descrittivi per la
  ricerca semantica. **Mai valori segreti**, e mai denaro per la ricerca. Il registro di Kept di ogni chiamata memorizza
  token e costo, mai il prompt, l'immagine, la risposta o la chiave. Vedi [Provider IA](/it/users/ai-providers/).
- **I link condivisi** (`/s/<token>`) sono l'unica pagina che chiunque può aprire senza accedere. Il token è di 32 byte
  casuali, mostrato una sola volta e memorizzato come suo SHA-256; non compare mai in una riga di log. La pagina viene
  letta tramite una sola funzione di database che prende l'hash del token e restituisce solo nomi, tipi, dove sono gli
  oggetti, quantità, condizione, note e foto, per la scatola, il posto o la ricerca condivisi in quel luogo. Le foto
  sono anteprime con GPS rimosso, come URL firmati di cinque minuti, e solo per quegli oggetti. Un link si ferma quando
  viene revocato o scade, o quando chi lo ha creato non amministra più il luogo; viene verificato a ogni
  visualizzazione.
- **I backup** sono snapshot restic cifrati con una password di almeno 12 caratteri prima di uscire; senza password non
  c'è alcun backup ([Backup](/it/admin/backups/)).

## Segnalare una vulnerabilità

Usa la **segnalazione privata delle vulnerabilità** di GitHub sul repository (la scheda **Security** →
**Report a vulnerability**); è l'unico canale e non c'è un indirizzo email di sicurezza. Non aprire un issue pubblico.
[SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md) ha i dettagli e le versioni supportate, che
valgono dalla 1.0. Per verificare che un'immagine sia quella costruita dal manutentore, vedi
[verificare una release](/it/admin/verify-release/).
