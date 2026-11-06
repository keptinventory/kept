---
title: Installa su Kubernetes con Helm
description: Il grafico Helm di Kept per k3s e altri cluster Kubernetes.
sidebar:
  order: 4
---

:::caution[Non ancora testato su un cluster reale]
Il grafico (`charts/kept/` nel repository) esegue il rendering e la validazione (`helm lint`, `helm template`
e `kubeconform` vengono eseguiti ad ogni controllo), e ogni rilascio lo spinge con l'immagine, ma non è stato
ancora installato su un cluster reale. Tratta un primo'installazione come un test. Il suo README contiene i
valori, i segreti da creare e i comandi; questa pagina spiega cosa fa.
:::

Il grafico esegue la stessa immagine di Compose, con le stesse [variabili d'ambiente](/it/reference/configuration/).

- **Segreti prima.** Il grafico non scrive mai un segreto: crei il segreto delle credenziali del database (e,
  con il Postgres incluso, quello dell'utente superiore) prima dell'installazione, e riferisci quelli opzionali
  (le chiavi, S3, le credenziali del backup, SMTP, il token delle metriche) per nome nei valori.
- **Postgres:** un StatefulSet incluso sull'immagine pgvector con pin uguale a quella di Compose, per un avvio
  rapido, o il tuo PostgreSQL 18 personale. Con il segreto dell'utente superiore del database (o di un amministratore del provider),
  un Job crea i ruoli e le estensioni di Kept; senza di esso, esegui tu
  l'[SQL di Postgres gestito](/it/install/managed-postgres/#il-sql).
- **Migrazioni** eseguite in un Job hook con il login del proprietario, così la nuova versione non viene servita prima
  che le migrazioni siano applicate. Con un target di backup configurato, quel Job prima esegue uno
  [snapshot pre-aggiornamento](/it/admin/upgrades/). Con il Postgres incluso, il Job della prima installazione esegue
  dopo l'installazione, quindi non passare `--wait` al primo `helm install`.
- **File memorizzati localmente** si trovano su un volume ReadWriteOnce, quindi il Deployment usa la
  strategia `Recreate`: un aggiornamento arresta il vecchio pod prima che inizi quello nuovo. Gli aggiornamenti rolling avvengono solo
  con lo storage file S3 e le chiavi in un segreto.
- **I backup vengono eseguiti nel worker**, mai in un CronJob: lo stesso lavoro notturno di Compose, configurato
  in Amministrazione → Backup o bloccato dai valori del grafico.
- **Suddividi web e worker** nelle Deployment è un'opzione; il worker è una singola replica.
- **I volumi vengono mantenuti** con `helm uninstall`; elimina manualmente le richieste per rimuovere i dati.
- `helm test` chiede a Kept in esecuzione `/readyz` e `/version`.

La versione del grafico è la versione di Kept: il rilascio 1.0.1 pubblica il grafico 1.0.1. È pubblicato come artefatto OCI firmato accanto all'immagine ad ogni rilascio; consulta
[verifica di un rilascio](/it/admin/verify-release/).
