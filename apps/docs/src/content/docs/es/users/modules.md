---
title: Módulos y preajustes
description: "Qué sigue cada ubicación: los preajustes Essentials, Household y Complete, los módulos detrás de ellos y qué ocurre al desactivar uno."
---

Cada ubicación funciona con un **preajuste**: un conjunto de **módulos** activados juntos. Un preajuste es un
punto de partida: un propietario o un administrador puede activar o desactivar módulos individuales después, y desactivar
uno solo lo oculta. No se borra nada.

Eliges el preajuste al crear la ubicación ([Tus primeros minutos](/es/users/first-run/)).
La ubicación **Personal** de una cuenta nueva empieza en Essentials. Una importación de Homebox en una ubicación nueva
también empieza en Essentials, con cada módulo para el que la copia de seguridad tenga datos marcado además
([importar desde Homebox](/es/users/import-export/#una-exportación-de-homebox)).

## Los tres preajustes

- **Esenciales**: encontrar objetos: habitaciones, cajas, etiquetas y búsqueda.
- **Hogar**: añade recibos y garantías, recordatorios, préstamos, documentación y vehículos.
- **Completo**: añade combustible, objetos que se te acaban, contraseñas y códigos, mudanza y
  "Conectar ChatGPT o Claude".

La zona horaria y la moneda no forman parte del preajuste: están en **Configuración de ubicación → General**.

## Qué aporta cada módulo

Los nombres siguientes son los interruptores en **Qué seguir**.

| Módulo | Desde | Lo que aporta |
|---|---|---|
| **Etiquetas y códigos QR** | Essentials | Etiquetas imprimibles para objetos y lugares; escanear una etiqueta abre aquello en lo que está. |
| **Dinero y gastos** | Household | Precios, totales y **Perspectivas**. Cada moneda en su propia línea, sin convertir nunca. |
| **Recibos y garantías** | Household | Fechas de garantía; una garantía próxima a caducar aparece como recordatorio. |
| **Recordatorios** | Household | Programaciones: qué toca, por fecha o por lectura. |
| **Préstamos** | Household | Prestar objetos y pedirlos prestados. |
| **Documentación** | Household | La biblioteca de documentación; las fechas de los documentos alimentan los recordatorios. |
| **Vehículos** | Household | Vehículos y máquinas. |
| **Combustible** | Complete | Combustible y carga. Necesita **Vehículos**. |
| **Objetos que se te acaban** | Complete | **Mantén al menos** en una cosa; un stock bajo aparece como recordatorio. |
| **Mudanza** | Complete | Modo mudanza. Necesita **Etiquetas y códigos QR**. |
| **Contraseñas y códigos** | Complete | Campos secretos: ocultos hasta que alguien autorizado revela uno, lo cual queda registrado. |
| **Conectar ChatGPT o Claude** | Complete | La conexión MCP, para que una app de IA pueda trabajar con la ubicación. |

## IA en esta ubicación

La captura con IA y el asistente se activan en cualquier preajuste una vez que se conecta un proveedor de IA para la
ubicación. Comparten un interruptor, **La captura con IA y el asistente**, bajo **IA en esta ubicación** en
la misma página, para que una ubicación pueda quedar fuera de la IA mientras un proveedor está conectado. Elegir un preajuste
no la cambia. Ver [Proveedores de IA](/es/users/ai-providers/).

## Desactivar un módulo

Un módulo desactivado se oculta dondequiera que aparecería (sus pantallas, sus entradas del menú, sus filtros) y sus
recordatorios se pausan. Volver a activarlo recupera todo, porque no se borró nada.

- **Los recordatorios se pausan con su módulo.** Las programaciones y las cosas que caducan esperan con **Recordatorios**,
  las fechas de garantía y matriculación con **Recibos y garantías**, las fechas de los documentos con
  **Documentación** (los documentos de un vehículo también siguen activos mientras **Vehículos** está activo), los préstamos con
  **Préstamos**, el stock bajo con **Objetos que se te acaban**. Los recordatorios sobre medidores no leídos últimamente
  se ejecutan siempre.
- **Los dependientes también desaparecen.** El combustible necesita Vehículos, y la mudanza necesita Etiquetas y códigos QR: desactivar
  aquello que necesita un módulo desactiva también ese módulo. Su interruptor muestra entonces
  *Necesita Vehículos · desactivado en esta ubicación*.
- **El menú sigue a todas tus ubicaciones.** En **Rastreo**, una entrada (Calendarios, Préstamos,
  Documentación, Consumibles, Vehículos, Mudanza, Perspectivas) aparece una vez que su módulo está activo en cualquiera de tus
  ubicaciones. En **Herramientas**, **Etiquetas** aparece mientras Etiquetas esté activo en algún lugar, y **Conteos** está
  siempre ahí. Actividad, Papelera y Notificaciones también están siempre ahí.

## Cambiarlo después

Un propietario o un administrador abre **Configuración de ubicación → Qué seguir**. El selector de preajustes activa todos los
módulos a la vez; **Ajustar** debajo tiene un interruptor por módulo. Antes de guardar, **Al guardar** lista lo que se activa
y lo que se desactiva.

## Relacionado

- [Ubicaciones, habitaciones y cajas](/es/users/locations/) para los lugares dentro de una ubicación.
- [Compartir una ubicación](/es/users/sharing/) para los roles.
