---
title: Sesiones de escaneo
description: Cuenta una habitación, empaca cajas o mueve objetos pasando con la cámara abierta por sus etiquetas. Cada etiqueta a la vista se lee, varias a la vez, en línea o sin conexión, y nada cambia hasta que terminas.
---

Una **sesión de escaneo** mantiene la cámara abierta mientras caminas. Cada etiqueta de Kept a la vista se lee, varias a la vez, y se cuenta una vez. Úsala para:

- **Contar** una habitación, un estante, una caja o una ubicación completa: lo que escaneas se marca como visto, y el resumen muestra lo faltante y lo que apareció en otro lugar.
- **Empacar en** cajas: todo lo que escaneas va a la caja actual. Escanea la siguiente caja para cambiar.
- **Mover a** un lugar o una caja: todo lo que escaneas se mueve ahí.

Una sesión admite hasta 5.000 etiquetas y funciona sin señal una vez que el teléfono ha abierto una sesión en línea: la pantalla se carga la primera vez que se usa y luego queda guardada en el teléfono.

Una sesión lee códigos QR y códigos de barras. Una etiqueta sin código QR (cinta angosta de rotuladora) se abre desde **Escanear** de una en una, por su ID corto impreso ([escanear un código sin código QR](/es/users/short-ids/#escanear-un-código-sin-código-qr)).

## Iniciar una sesión

- **Escanear → Iniciar una sesión**, luego elige qué hacer y dónde.
- Desde la página de un lugar: **Contar aquí**.
- Desde el menú de una caja: **Contar esta caja** o **Empacar en esta caja**.
- Desde la página de un traslado: **Empacar cajas**.
- Desde la tarjeta de una habitación en el mapa: **Contar esta habitación**.

Si el lugar todavía no está elegido, elígelo en la lista o toca **Escanear su etiqueta**.

En un conteo de un lugar, **Incluir los lugares dentro** está activado por defecto. Activa **Una caja que escaneas cuenta lo que hay dentro** cuando cuentes cajas sin abrirlas.

## Mientras escaneas

| Escaneas | Contar | Empacar en, Mover a |
|---|---|---|
| Un objeto de la lista | Encontrado, verde, el contador sube | Agregado, verde |
| La misma etiqueta otra vez | Un pitido suave, sin conteo | Lo mismo |
| Un objeto de otro lugar aquí | Ámbar: **Encontrado en otro lugar**, con dónde debería estar | Agregado |
| Un objeto de otra ubicación | Ámbar, con la ubicación | Agregado si puedes editar ambas |
| Un objeto en una ubicación que solo ves | Gris: **Ver solo aquí** | Gris, no agregado |
| La etiqueta de un lugar | Kept sugiere contarla desde su propia página | Rechazado: una habitación no se puede mover |
| Una etiqueta en blanco, o un código en varios objetos | Kept la reserva para el resumen | Lo mismo |
| Un código de barras de producto | Coincide con el objeto que lo lleva | Lo mismo |
| Un número de serie o etiqueta de activo (Data Matrix, Code 39…) | Coincide con el objeto que lo tiene, en línea | Lo mismo |
| Un código que este teléfono no conoce, sin conexión | **Revisar después** | Lo mismo |

El contador muestra "312 de 340" para un conteo. Cada lectura emite un tono corto y dibuja un cuadro en la etiqueta: verde para un hallazgo nuevo, ámbar para algo de otro lugar, gris para cualquier otra cosa.

- **Deshacer última lectura** deshace la última.
- **Pausa** detiene la cámara. Un minuto sin lecturas también la pausa.
- **Objetivo** (Empacar en, Mover a): tócalo y luego escanea la siguiente caja o lugar.
- Los **escáneres de códigos de barras USB o Bluetooth** funcionan en la misma pantalla: lo que escriben se lee como una etiqueta.
- **Linterna** aparece en los teléfonos que tienen una (Android).

Cerrar la app, recargar o perder batería: la sesión queda en el teléfono. **Escanear → Reanudar sesión** la retoma.

## Terminar y guardar

**Terminar** muestra el resumen. Nada ha cambiado todavía.

- **Encontrado**: marcado como visto, en el momento en que se lee cada etiqueta.
- **Faltante**: se deja solo por defecto. Elige **Marcar no aquí** para cada uno, o **Marcar todos no aquí**.
- **Sin etiqueta**: objetos de la lista sin etiqueta. Marca los que viste.
- **Encontrado en otro lugar** y **En otra ubicación**: se dejan solas, o **Mover aquí**.
- **Sin coincidencia**: etiquetas en blanco y códigos que coinciden con varios objetos. Cada etiqueta en blanco tiene **Reclamar**: una caja nueva, un objeto existente o un lugar existente. Pega las etiquetas en blanco en estantes y puertas, escanéalas todas en un recorrido y luego reclámalas aquí.

Un conteo también lista lo que está prestado o en reparación (nunca faltante), y lo que está en un lugar dentro de él que nadie contó (**No contado**, hasta que toques **Lo revisé**). Un objeto contado por número tiene **−** y **+** en su fila. Todo resultado se guarda: ver [Conteos y arqueos](/es/users/counts/).

**Guardar** envía la sesión. Sin conexión, espera en el teléfono y se guarda cuando vuelves a estar en línea.
La sesión es una entrada en **Actividad**, "Garaje contado: 312 de 340", con **Deshacer** por 7 días.
Deshacer devuelve todas las fechas de visto, todos los "no aquí" y todos los movimientos, a menos que algo haya cambiado desde entonces.

Un objeto eliminado a la papelera mientras caminabas se deja fuera del guardado, y el resumen después de guardar dice cuántos fueron.

## Quién puede hacer qué

| | Propietario, administrador, miembro | Observador |
|---|---|---|
| Contar | Guardado | Una verificación: la misma pantalla y totales, nada guardado |
| Empacar en, Mover a | Donde puedas editar tanto el objeto como su destino | No se ofrece |

Si tu rol cambia mientras caminas y ya no puedes editar ahí, se rechaza el guardado y la sesión queda en el teléfono con su resumen.

## Limitaciones en iPhone

- Sin vibración: las apps web no pueden vibrar en iPhone. El tono y el cuadro coloreado indican cada lectura.
- La pantalla puede seguir atenuándose en la app instalada: manténla despierta en **Ajustes → Pantalla y brillo → Bloqueo automático** mientras haces un conteo grande.
- La lectura puede ser más lenta en iPhones antiguos. Sujeta el teléfono un poco más lejos de las etiquetas juntas para que varias quepan a la vista.
- Sin control de la linterna desde la web.
