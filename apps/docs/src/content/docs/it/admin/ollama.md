---
title: IA locale con Ollama
description: Esegui il modello IA sul tuo computer con il profilo Ollama in compose.full.yaml, e quanto costa in memoria.
sidebar:
  order: 10
---

Le funzionalità IA di Kept (compilazione automatica da foto e ricevute, l'assistente, ricerca semantica)
funzionano con qualsiasi provider che il proprietario del luogo collega in **Impostazioni → IA**. Ollama esegue il modello sul tuo hardware, quindi nulla lascia il dispositivo; Kept lo comunica come provider Compatibile con OpenAI.

:::caution[Non testato]
Ollama non è stato testato con Kept. Un modello condivide la memoria del dispositivo con Kept, quindi prevedi di aver bisogno di più di [1 GB su cui Kept è stato testato](/it/install/hardware/), e aspetta che un modello piccolo sia più lento e meno preciso nella lettura delle ricevute rispetto a uno ospitato.
:::

## Impostazione

1. Ollama viene fornito con `compose.full.yaml`, non con `compose.yaml`: scaricalo e imposta
   `COMPOSE_FILE=compose.full.yaml` in `.env` ([Caddy e Ollama](/it/install/compose/#caddy-e-ollama)).
   Avvia Kept con il profilo `ollama`, quindi esegui il pull di un modello al suo interno con il comando proprio di Ollama:

   ```sh
   docker compose --profile ollama up -d
   docker compose exec ollama ollama pull <model>
   ```

   I modelli si trovano nel volume `ollama`. Nulla viene pubblicato sull'host: solo Kept, sulla rete di Compose, raggiunge Ollama. L'immagine è di circa 3,8 GB (amd64) o 2,8 GB (arm64) prima di qualsiasi modello.

2. **Consenti gli indirizzi privati.** `http://ollama:11434` è sulla rete propria di Compose, un indirizzo privato, e Kept rifiuta tali indirizzi per impostazione predefinita ([richieste in uscita](/it/admin/security-model/#richieste-in-uscita-ssrf)).
   L'amministratore dell'istanza attiva prima **Admin → Impostazioni → Consenti gli indirizzi privati**; senza questo, l'aggiunta del provider dice "Quell'indirizzo si trova su una rete privata".
   Lo stesso vale per un'istanza di Ollama (o LM Studio) altrove nella tua rete domestica.

3. In **Impostazioni → IA**, aggiungi un provider **Compatibile con OpenAI** con l'URL di base
   `http://ollama:11434/v1` e il modello che hai estratto. Ollama ignora la chiave API, quindi qualsiasi valore va bene.
