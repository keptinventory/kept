---
title: Webhook
description: "POST firmati al tuo server quando cambiano le cose: gli eventi, il payload, il controllo della firma, le consegne e i nuovi tentativi, e il segreto."
---

Un **webhook** è Kept che invia un POST a un indirizzo che scegli tu quando succede qualcosa in un luogo: un
oggetto viene aggiunto, spostato o cestinato, viene registrata una lettura, scade un promemoria. Ogni POST è firmato,
così il tuo server può sapere che viene da Kept. Porta gli id e i nomi dei campi che
sono cambiati, mai i loro valori: per vedere l'oggetto stesso, il tuo server lo recupera dall'
[API](/api/) con il suo token.

Proprietari e amministratori gestiscono i webhook di un luogo in **Impostazioni del luogo → Webhook**: **Aggiungi
webhook**, l'indirizzo, e gli eventi che riceve. **Impostazioni → Connessioni** elenca i webhook che
gestisci in tutti i tuoi luoghi.

## Gli eventi

| Evento | Inviato quando |
|---|---|
| `thing.created` | Un oggetto viene aggiunto |
| `thing.updated` | Un oggetto viene modificato |
| `thing.moved` | Un oggetto viene spostato |
| `thing.trashed` | Un oggetto va nel Cestino |
| `thing.restored` | Un oggetto torna dal Cestino |
| `thing.lifecycle_changed` | Lo stato di un oggetto cambia, ad esempio perso o venduto |
| `reading.logged` | Viene registrata una lettura del contatore |
| `reminder.due` | Scade un promemoria |

Ogni payload ha gli stessi campi:

```json
{
  "id": "evt_…",
  "event": "thing.updated",
  "occurred_at": "2026-10-03T09:12:44.000Z",
  "location_id": "…",
  "entity": { "type": "thing", "id": "…" },
  "changed_fields": ["…"],
  "actor": { "type": "user", "id": "…" }
}
```

`entity.type` è `thing`, `reading` o `reminder` (`webhook` per un test); `changed_fields` indica
i campi che una scrittura ha cambiato, ed è vuoto per un promemoria; `actor.type` è `user`, `token` o
`system`.

**Invia un test** invia un evento `ping`, inviato una sola volta e non ritentato, e mostra lo stato con cui ha risposto il tuo server:
il modo più rapido per verificare un nuovo indirizzo.

## Verifica della firma

Ogni consegna porta un'intestazione `Kept-Signature`:

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`t` è il momento della firma (secondi Unix). `v1` è un HMAC-SHA256, con il segreto del webhook, di
`<t>.<body>`: il timestamp, un punto, poi il corpo esatto della richiesta. Il tuo server calcola lo stesso
HMAC, lo confronta con `v1` in tempo costante, e rifiuta un `t` vecchio (più di cinque minuti,
ad esempio). Il dialogo del segreto contiene uno snippet pronto all'uso **Verifica una consegna (Node.js)**.

## Il segreto

Il segreto di firma viene mostrato una sola volta, quando viene creato il webhook: copialo allora. Kept lo custodisce sigillato per
firmare, e non lo mostra mai più. L'hai perso? **Nuovo segreto** ne crea un altro; quello attuale smette
subito di funzionare, quindi le consegne non si verificano finché il tuo server non ha il nuovo.

## Consegne

Le **Consegne** di ogni webhook elencano gli ultimi 30 giorni, dal più recente: una riga per consegna, con il suo
stato, lo stato con cui ha risposto il tuo server (o nessuno) e quanti tentativi ha fatto.

- **In attesa di invio**: in coda.
- **Consegnata**: il tuo server ha risposto con uno stato 2xx.
- **Non riuscita, nuovo tentativo**: qualsiasi altra risposta, nessuna risposta entro 10 secondi, o un redirect (Kept
  non segue i redirect). Kept riprova.
- **Abbandonata**: 10 tentativi in circa 24 ore sono tutti falliti.

Al massimo 10 consegne al secondo partono per luogo, così una raffica di modifiche non inonda il tuo
server.

Quando una consegna viene abbandonata, il webhook viene contrassegnato come **In errore dal** quella data e gli amministratori dell'istanza ricevono
un avviso. Continua a inviare; la prossima consegna che arriva a buon fine cancella il contrassegno.

Un webhook viene **Disattivato** quando un proprietario o un amministratore lo disattiva, oppure quando chi l'ha creato
non è più amministratore del luogo. Cancellarne uno è definitivo: Kept smette di inviargli e le sue
consegne vengono dimenticate.

## Il tuo webhook, per i promemoria

Separatamente dai webhook di un luogo, in **Impostazioni → Profilo → Notifiche** puoi aggiungere un webhook come uno dei
tuoi canali, accanto a email, push, ntfy, Telegram e Apprise ([promemoria](/it/users/reminders/)).
Riceve un POST per promemoria (`reminder.due`) con gli id, il tipo di promemoria, il tipo di origine e
la data di scadenza, l'oggetto, il posto o il luogo di cui tratta, e un link di ritorno a Kept: niente nomi né valori.
È firmato allo stesso modo, con un segreto mostrato una sola volta.

Un invio fallito viene ritentato fino a 10 volte in circa 24 ore; se nessuno va a buon fine, il canale viene
contrassegnato come **In errore dal** e Kept ti invia un'email una volta. **Prova** ne invia uno subito. Puoi averne fino a cinque.

## Indirizzi sulla tua rete

Kept rifiuta di inviare a indirizzi privati (come `192.168.x.x`), quindi un webhook non può essere diretto a un
router o a un altro servizio sulla rete del server. Un amministratore dell'istanza può consentirli in
**Amministrazione → Registrazione** (**Consenti gli indirizzi privati**), per un ricevitore che ospiti tu, come Home
Assistant. Lo stesso interruttore permette a un provider di IA, a un'importazione da Homebox e a un accesso OIDC di raggiungere quella
rete, quindi attivalo sapendo chi può aggiungerli. Vedi il
[modello di sicurezza](/it/admin/security-model/#richieste-in-uscita-ssrf).
