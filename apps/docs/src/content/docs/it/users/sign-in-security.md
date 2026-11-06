---
title: Accesso e sicurezza
description: Passkey e l'app di autenticazione in Impostazioni, i codici di backup, configurare l'app di nuovo, disattivarla, ciò che Kept rifiuta e perché, e perché il blocco app non è una passkey.
---

**Impostazioni → Accesso e sicurezza** raccoglie i modi con cui il tuo account accede oltre la password:
passkey e accesso a due fattori con un'app di autenticazione.

## Conferma che sei tu

Ogni modifica in questa pagina chiede prima:

- un account con password: **la tua password**;
- un account senza (solo passkey, link email o Google): **un accesso negli ultimi dieci
  minuti**. Più vecchio di così, il foglio offre **Accedi di nuovo**.

Aggiungere una passkey chiede anche la password su un account che ne ha una, e richiede sempre un accesso negli
ultimi dieci minuti, qualunque sia l'account: il browser esegue poi la propria finestra di dialogo per la passkey.
Attivare o disattivare l'accesso a due fattori non conta come un nuovo accesso.

Scollegare Google o il tuo accesso OIDC in **Metodi di accesso** chiede allo stesso modo.

Ogni modifica disconnette tutti gli altri dispositivi, tranne la rinomina di una passkey. Kept ti invia email quando aggiungi o rimuovi una passkey, quando un accesso esterno viene scollegato, quando l'accesso a due fattori viene attivato, riconfigurato o disattivato, e quando vengono creati nuovi codici di backup. Gli account gestiti (un nome utente, nessuna email) non ricevono email.

## Passkey

Una passkey ti fa accedere con Face ID, un'impronta o il blocco schermo del telefono, senza digitare password.
Kept non la vede mai: resta sul dispositivo o nel tuo gestore di password. Appartiene a un solo
indirizzo: su un Kept con [più di uno](/it/install/home-network/#più-di-un-indirizzo), aggiungila e usala a quello principale.

| | |
|---|---|
| **Aggiungi una passkey** | Dagli un nome (Kept suggerisce il dispositivo: "Mac", "iPhone"), poi rispondi alla finestra del browser. Chiudere quella finestra non cambia nulla. |
| **Sincronizzato** | Il tuo gestore di password o la piattaforma la mantengono anche sugli altri tuoi dispositivi. |
| **Solo questo dispositivo** | Vive solo su questo dispositivo o chiave di sicurezza. |
| **Rinomina** | Il nome è tuo, fino a 64 caratteri. |
| **Rimuovi** | Non ti fa più accedere. Cancella anche quella sul dispositivo se non la vuoi più lì. |

Ogni passkey aggiunta da Kept verifica che sia tu (Face ID, un'impronta o un PIN), quindi un accesso con passkey conta come accesso a due fattori da solo, anche nei luoghi che lo chiedono.

## L'app di autenticazione

Accesso a due fattori con un'app come 1Password, Google Authenticator o Aegis: dopo la tua password,
il link email o Google, l'accesso chiede il suo codice a 6 cifre.

- **Attiva**: conferma che sei tu, scansiona il codice QR (o digita la chiave), inserisci un codice, poi salva i
  dieci codici di backup. Si attiva solo quando quel codice corrisponde.
- **8 codici di backup rimasti su 10**: ogni codice di backup ti fa accedere una sola volta, per quando il telefono non c'è.
- **Nuovi codici di backup**: dieci nuovi codici, mostrati una volta. I vecchi smettono di funzionare.
- **Configura di nuovo**: per un telefono nuovo o un'altra app. Scansiona il nuovo codice QR e inserisci un codice dalla
  nuova app. Fino a che non lo fai, l'app attuale continua a funzionare; chiudi il foglio a metà e nulla
  cambia. Quando è fatto, i codici della vecchia app e i vecchi codici di backup smettono di funzionare.
- **Disattiva**: l'accesso smette di chiedere un codice.

## Cosa Kept rifiuta

Questi vengono rifiutati dal server, qualunque cosa mostri lo schermo:

- **Rimuovere l'ultimo modo per entrare.** Una passkey non può essere rimossa, e Google o il tuo accesso OIDC
  non possono essere scollegati, quando nient'altro ti farebbe accedere: una password, un'altra passkey, Google o
  l'accesso OIDC (finché questo Kept lo offre ancora), o un link email (quando questo Kept invia email
  e il tuo indirizzo è confermato).
- **Disattivare l'accesso a due fattori dove lo chiede un luogo.** Finché un luogo a cui appartieni chiede
  l'accesso a due fattori e non hai passkey, l'app di autenticazione resta attiva. Aggiungi prima una passkey. Allo
  stesso modo, la tua ultima passkey resta finché quel luogo ne dipende e l'app è disattivata.
- **Aggiungere una passkey o l'app prima che il tuo indirizzo sia confermato**, quando questo Kept invia email.
  Accedi una volta con un link inviato all'indirizzo, poi riprova.

## Il blocco app non è una passkey

**Impostazioni → Questo dispositivo → Sblocca con Face ID o impronta** sblocca Kept su quel singolo dispositivo,
dopo che hai già effettuato l'accesso ([il blocco app](/it/users/phone-app/#blocco-dellapp)). Non può farti accedere.
Se il browser lo offre al momento dell'accesso e Kept risponde *Questa passkey non serve per accedere a questo account*, accedi in un altro modo, poi aggiungi qui una passkey vera.
