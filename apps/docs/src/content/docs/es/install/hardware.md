---
title: Lo que necesita
description: En qué se probó Kept, la memoria que usó y qué hace que necesite más.
sidebar:
  order: 6
---

**Probado: 1 GB de RAM, uno o dos núcleos de CPU**, con un proveedor de IA externo o ninguno. Todo
funcionó, incluida una copia de seguridad durante la subida de fotos. 2 GB dejan margen de sobra.

## Qué se probó

- **Versión:** los cambios de Kept 1.14.3 (una compilación previa al lanzamiento), `compose.yaml` tal como se publicó
  (Kept, Postgres 18 con pgvector). La 1.14.2 necesitó 2 GB para su copia de seguridad.
- **Máquina:** emulada en Docker en un Mac arm64. Docker, Kept y Postgres comparten un mismo
  presupuesto de memoria y CPU, como en una VM pequeña, con 128 MB reservados para el sistema
  operativo. Sin swap.
- **Datos:** un hogar, más una ubicación con 3.000 objetos en 206 lugares y 200 contenedores, y
  300 fotos reales.
- **Trabajo:** 20 fotos de 12 megapíxeles, dos PDF, 120 cargas del mapa y el grafo de esa
  ubicación, 120 lecturas de lista y búsqueda, `kept admin backup` mientras se suben las fotos, la
  copia de seguridad programada, luego 10 minutos en reposo.

| Máquina | Fotos, mapa, búsqueda, PDFs | Copia de seguridad durante las subidas | Copia de seguridad programada | Pico |
|---|---|---|---|---|
| 1 GB, 2 cores (3 runs) | pasó | pasó | pasó | 730–745 MB |
| 1 GB, 1 core | pasó | pasó | pasó | 740 MB |
| 768 MB, 1 core | pasó hasta que la copia de seguridad se quedó sin memoria; 9 subidas y ambos PDF fallaron mientras Kept se reiniciaba | sin memoria | pasó por sí sola (una ejecución) | — |

Los picos son memoria que no se puede devolver (sin contar la caché de páginas), para toda la
máquina, incluido Docker. Sin memoria, el sistema mató el proceso de Kept y Docker lo reinició.

- **En reposo:** tras iniciar, Kept unos 160 MB y Postgres unos 30–70 MB. Una vez redimensionadas
  las fotos, Kept se mantiene en unos 300 MB.
- **Datos reales:** en un servidor doméstico amd64, Kept 206 MB y Postgres 119 MB (una lectura).
- **Velocidad** (medianas): una página de lista 30–40 ms, una búsqueda 50–70 ms, una subida de
  foto 0.3–0.4 s, el mapa de la ubicación de 3.000 objetos 0.4–0.5 s.
- **Aún no probado:** una VM real, amd64 a estos tamaños, 512 MB, IA local. Las pruebas de
  rendimiento continúan: [#379](https://github.com/keptinventory/kept/issues/379).

## Qué significa

- **1 GB, 1 o 2 núcleos:** probado, todas las ejecuciones pasaron, con unos 150 MB de margen en
  el pico.
- **2 GB:** margen de sobra, para otros servicios además de Kept.
- **768 MB:** Kept funcionó, al igual que Ejecutar ahora (el camino de la copia de seguridad programada); `kept admin backup`
  mientras se subían fotos se quedó sin memoria. No recomendado.

## Raspberry Pi

No se probó en uno. La imagen arm64 es la que usaron estas pruebas, así que una Pi con 1 GB o más
puede encajar como las filas de 1 GB; espérala más lenta. Ningún lanzamiento se prueba en una Pi.

## Lo pesado

- **Copias de seguridad.** `kept admin backup` suma unos 300–400 MB mientras se ejecuta, la copia de seguridad programada unos
  150 MB; restic aporta unos 100 MB de eso. No está en la
  [app de Home Assistant](/es/install/home-assistant/): en su lugar se ejecutan las copias de seguridad de Home Assistant.
- **Redimensionado de fotos.** Cada subida se redimensiona al llegar. Con menos de 3 GB de RAM, o un límite de
  contenedor menor de 3 GB, Kept redimensiona de una en una, si no, de dos en dos (`KEPT_IMAGE_CONCURRENCY` lo
  anula). La memoria sube unos 150 MB con las primeras fotos y se mantiene así.
- **El mapa y el grafo de una ubicación muy grande.** El servidor lee toda la ubicación en cada
  carga: unos 670 KB para 3.000 objetos.
- **No está en el servidor:** el mapa, el grafo y la cuadrícula los dibuja tu navegador y no añaden memoria al
  servidor en reposo; el mapa y el grafo se descargan solo al abrirse.
- **IA local con Ollama.** Un modelo en la misma máquina comparte su memoria con Kept y necesita mucho más
  de lo que necesita Kept; consulta [Ollama](/es/admin/ollama/).
- **Disco.** La base de datos es pequeña; los archivos son lo que crece. Deja espacio para copias de seguridad en otro disco, y
  Administración → Estado avisa, y se alerta a los administradores, cuando un disco supera el 85 % de llenado.

## Postgres

Kept necesita PostgreSQL 18 con pgvector. Compose ejecuta la imagen `pgvector/pgvector`, fijada por
digest; para la base de datos de un proveedor consulta [Postgres gestionado](/es/install/managed-postgres/).
