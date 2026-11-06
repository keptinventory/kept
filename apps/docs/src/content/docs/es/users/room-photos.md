---
title: Fotos de habitación
description: Fotografía una habitación, un armario o un estante, y Kept lista lo que contiene como borradores en la Bandeja de entrada, cada uno con su propia imagen, omitiendo lo que Kept ya tiene.
---

**Sala** es un modo de captura para llenar Kept rápidamente: tomar hasta cinco fotos de una habitación, un armario o un estante, y la IA enumera cada objeto que ve. Kept combina el mismo objeto visto en dos fotos, deja fuera lo que ya está en Kept, y coloca el resto en la Bandeja de entrada como borradores ya existentes en esa habitación, cada uno con su propia imagen recortada de la foto.

## Antes de comenzar

El modo Sala lee fotos con IA, así que necesita lo que otras capturas con IA necesitan:

- **Captura con IA** activada en la ubicación (un propietario o administrador la activa, en **Configuración de ubicación → Qué rastrear**), y un proveedor de IA que lea fotos ([Proveedores de IA](/es/users/ai-providers/)).
- Puedes editar elementos en la ubicación: miembros, administradores y propietarios. Los espectadores no ven el modo.

Cuando el modo Sala no puede ejecutarse, indica el motivo en lugar de ocultarse: la captura con IA está desactivada en la ubicación, no hay ningún proveedor configurado para leer fotos, o el presupuesto de IA se ha agotado por ahora.

## Tomar las fotos

1. Abrir **Capturar**, luego **Sala** en la barra de modos. Desde la página de un lugar, **Llenar desde fotos** lo abre en ese lugar; en el [mapa de ubicación](/es/users/location-map/), una tarjeta de sala tiene **Fotografía esta habitación**.
2. Comprueba adónde van las fotos: la ficha de lugar en la parte superior. Una captura de sala va a una sala, un punto o una caja, nunca al área sin colocar.
3. Tomar de 1 a 5 fotos, o seleccionarlas con **Galería**. Ponte en la puerta y toma una foto por pared. Cada foto espera en la bandeja, donde puedes eliminarla.
4. **Enviar**. Sin conexión, las fotos esperan en el teléfono y se envían cuando vuelve a estar en línea, como cualquier captura.

Kept lee las etiquetas en las fotos en el teléfono antes de enviarlas. Un objeto cuya etiqueta se muestra es conocido con certeza, dondequiera que esté en la ubicación.

## Revisar la sala

La Bandeja de entrada muestra una tarjeta **Sala** al inicio del lote de captura, con los borradores que creó debajo:

- **Nuevos objetos**: cada uno es un borrador en la sala, con su propia imagen, nombre, marca, modelo, color y tipo completados donde la foto los mostró. Acepta, edita o descarta estos borradores como cualquier otro, o usa **Aceptar nombres** para todo el lote. Un borrador que parece un objeto que ya tienes se marca como posible duplicado.
- **Muebles que contienen objetos** (estanterías, libreros, armarios, roperos, cómodas): **Añadir como lugar** convierte cada uno en un lugar dentro de la sala, así los objetos pueden ir dentro de él. Otros muebles (un sofá, una cama, una mesa) son borradores como cualquier objeto.
- **Ya en Kept**: los objetos que las fotos mostraron que la sala ya tiene, por la misma etiqueta, la misma marca y modelo, o el mismo nombre. Márquelos y usar **Marcar como visto**. Un objeto cuya etiqueta se leyó comienza marcado.
- Cada foto indica qué proporcionó. "No se pudo leer la foto 3" significa que esa foto falló y las demás aún cuentan; "Esta foto tenía más; acércate más" significa que mostró más de lo que una foto puede enumerar (60 objetos).

Las personas, mascotas y la sala misma (paredes, pisos, ventanas, puertas, accesorios) nunca se listan, y nunca se corta una imagen de una persona.

**Listo** cierra la tarjeta. **Descartar** elimina las fotos. Cuando ninguna foto pudo leerse, **Reintentar** las vuelve a leer.

### En el mapa

Cuando la sala se dibuja en el [mapa de ubicación](/es/users/location-map/), cada objeto aceptado se coloca en el piso de la sala con una forma adivinada a partir de su tipo y nombre, en un espacio libre. La próxima vez que uses **Organizar**, el mapa muestra qué colocó Kept, así puedes mover cada objeto a dónde realmente está. La colocación de objetos por parte de Kept nunca interrumpe a alguien que está organizando el mapa al mismo tiempo.

## Cuánto cuesta

Cada foto es una lectura de IA, y una captura de más de una foto agrega una llamada breve solo de texto que fusiona lo que las fotos tienen en común. Antes de enviar, la bandeja muestra un límite superior, como "Aproximadamente 3 fotos · hasta ~31,000 tokens · Groq": la foto, las instrucciones y la respuesta más larga que Kept permite, para cada foto; una respuesta más corta cuesta menos. Un modelo que piensa antes de responder factura su proceso de pensamiento adicionalmente.

La lectura de sala cuenta con los mismos presupuestos y límites que otras lecturas de fotos. Cuando se alcanza un límite, la tarjeta muestra "Esperando el presupuesto de IA", y las fotos se leen cuando la IA se reanuda. Cada llamada aparece en **Uso de IA** como **Foto de habitación** o **Fotos de habitación combinadas**.

## Privacidad

- Lo que recibe el proveedor es lo mismo que para cualquier captura: una copia de cada foto con los datos de ubicación y de la cámara eliminados, y las instrucciones fijas.
- **Las fotos completas de la sala se eliminan cuando cierras la tarjeta de la sala** (Listo o Descartar). Cada borrador mantiene solo su propia imagen recortada.
- **Mientras la tarjeta de la sala está abierta, sus fotos son privadas para las personas que la revisan**: propietarios, administradores y miembros. Los espectadores no las ven en la página de la sala o de la caja, en búsquedas o en su teléfono, y tampoco lo hace un token de API de solo lectura, una conexión MCP de solo lectura o un enlace compartido. Mientras está bajo revisión, una foto de la sala nunca es la foto de portada de la caja.
- Para mantener las fotos completas en su lugar, un propietario o administrador activa **Mantener fotos de la habitación después de la revisión** en **Configuración de ubicación → General**. Después de **Listo**, permanecen en la página de la sala como fotos ordinarias, visibles para todos los que ven la ubicación.

## En Prueba Kept

[Prueba Kept](/es/try/kept/) no tiene cámara y no ejecuta IA: el modo Sala ofrece **Usar una foto de habitación de ejemplo**, una habitación ilustrada, y cada foto de sala da los mismos resultados de muestra, así puedes ver la tarjeta Sala, los borradores y los muebles sin necesidad de un proveedor. La bandeja dice "No se ejecuta IA en esta demostración" donde una instalación real muestra el costo.
