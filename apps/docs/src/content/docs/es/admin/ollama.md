---
title: IA local con Ollama
description: Ejecuta el modelo de IA en tu propia máquina con el perfil de Ollama en compose.full.yaml, y cuánto consume de memoria.
sidebar:
  order: 10
---

Las funciones de IA de Kept (rellenar campos a partir de fotos y recibos, el asistente, la búsqueda semántica) funcionan con el proveedor que conecta el dueño de una ubicación en **Configuración → IA**. Ollama ejecuta el modelo en tu propio hardware, así que nada sale de él; Kept se comunica con él como un proveedor **compatible con OpenAI**.

:::caution[Not tested]
Ollama no se ha probado con Kept. Un modelo comparte la memoria de la máquina con Kept, así que considera más de [1 GB en el que se prueba Kept](/es/install/hardware/), y espera que un modelo pequeño sea más lento y menos preciso que uno alojado al leer recibos.
:::

## Configurarlo

1. Ollama incluye `compose.full.yaml`, no `compose.yaml`: descárgalo y configura
   `COMPOSE_FILE=compose.full.yaml` en `.env` ([Caddy y Ollama](/es/install/compose/#caddy-y-ollama)).
   Inicia Kept con el perfil `ollama`, luego descarga un modelo en él con el comando de Ollama:

   ```sh
   docker compose --profile ollama up -d
   docker compose exec ollama ollama pull <model>
   ```

   Los modelos viven en el volumen `ollama`. No se publica nada en el host: solo Kept, en
   la red de Compose, llega a Ollama. La imagen pesa unos 3,8 GB (amd64) o 2,8 GB (arm64) antes
   de cualquier modelo.

2. **Permitir direcciones privadas.** `http://ollama:11434` está en la red propia de Compose, una
   dirección privada, y Kept las rechaza por defecto ([solicitudes salientes](/es/admin/security-model/#solicitudes-salientes-ssrf)).
   Un administrador de la instancia activa primero **Administrador → Configuración → Permitir direcciones privadas**; sin ello,
   al agregar el proveedor dice "Esa dirección está en una red privada". Lo mismo ocurre con un Ollama
   (o LM Studio) en otra parte de tu red local.

3. En **Configuración → IA**, agrega un proveedor **compatible con OpenAI** con la URL base
   `http://ollama:11434/v1` y el modelo que descargaste. Ollama ignora la clave de API, así que cualquier valor
   sirve.
