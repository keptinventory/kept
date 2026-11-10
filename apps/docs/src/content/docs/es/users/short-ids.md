---
title: IDs cortos y etiquetas
description: IDs de seis caracteres, impresión de etiquetas en hojas, rollos y cinta de etiquetadora, qué hace el escáner con cada código que lee, escanear un código sin código QR y qué código conserva Kept en cada caso.
---

Cuando un objeto nuevo llega al servidor, recibe un ID corto: seis letras y dígitos, como `7KQ-4MZ`, que nunca se reutiliza. Hasta entonces muestra **ID pendiente**. Una etiqueta lleva el ID como texto y, en todas las variantes salvo la cinta estrecha de etiquetadora, en un código QR que abre el objeto. Una etiqueta conserva su código para siempre, así que una perdida se reimprime igual.

Las listas, los resultados de búsqueda y la paleta ⌘K muestran un objeto por su nombre. Su código aparece ahí como cinta de etiqueta ámbar solo cuando tiene una etiqueta impresa: una etiqueta confirmada con **¿Impreso OK?**, o una etiqueta en blanco reclamada para él. También cuenta la hoja de contenido de una caja de mudanza, una vez confirmada del mismo modo ([Mudanza](/es/users/moving/)). Ámbar significa "este está etiquetado". En su propia página, un objeto o lugar sin etiqueta impresa muestra su código pequeño y gris, después del resto; uno con etiqueta muestra la cinta. Un objeto con más de una etiqueta (por ejemplo, una etiqueta en blanco reclamada para él) muestra el código de la última que se imprimió. Búsqueda y escáner encuentran un objeto por cualquiera de sus códigos.

## Impresión

**Impresión** (Etiquetas en el menú, o **Etiqueta** en un objeto): elige qué imprimir (una selección, **Etiqueta todo lo sin imprimir** en una ubicación o lugar, o una **Hoja en blanco**), elige el **Stock de etiquetas**, elige por dónde empezar en una hoja parcialmente usada e imprime desde el navegador. La **Vista previa de hoja** es la impresión misma, más pequeña: los mismos códigos QR, nombres y lugares, partidos en las mismas líneas. Un nombre nunca se corta: uno largo se envuelve y su tipo de letra se reduce, y uno que aún no quepa se lista antes de imprimir, con un enlace para renombrarlo. La página está configurada al papel de la hoja sin márgenes, así que los valores por defecto del diálogo de impresión (escala 100 %) ponen cada etiqueta en su celda.

Los stocks de etiqueta (con **Unidades** en **Imperial** en Configuración → Yo → Visualización, el selector muestra estos tamaños en pulgadas, con dos decimales: las etiquetas de la hoja Letter miden 2,63 × 1 in; la impresión es la misma en ambos casos):

| Stock | Tamaño | Cada etiqueta |
|---|---|---|
| Hoja A4, 24 etiquetas | 70 × 37 mm, 3 × 8 | Código QR, ID corto, nombre y lugar |
| Hoja A4, 65 etiquetas | 38 × 21 mm, 5 × 13 | Código QR e ID corto |
| Hoja Letter, 30 etiquetas (diseño Avery 5160) | 67 × 25 mm, 3 × 10 | Código QR, ID corto, nombre y lugar |
| Rollos de impresora de etiquetas | 50 × 30, 40 × 30 y 62 × 29 mm | Código QR, ID corto, nombre y lugar |
| Cinta de etiquetadora, 9 y 12 mm (Brother TZe y similares) | 40 y 50 mm de largo | ID corto en tipo grande, y el nombre. Sin código QR |
| Cinta de etiquetadora, 18 y 24 mm | 50 y 60 mm de largo | Código QR, ID corto en tipo grande y el nombre |

Los rollos y la cinta imprimen una etiqueta por página, del tamaño de la etiqueta: en el diálogo de impresión, elige tu impresora de etiquetas y ese tamaño. Para una app de etiquetadora que acepta imágenes, **Compartir como imágenes** genera una PNG por etiqueta. La cinta estrecha no tiene espacio para un código QR escaneable, así que lleva el ID corto en grande: el escáner lo lee del texto ([Escanear un código sin código QR](#escanear-un-código-sin-código-qr)).

Después, **¿Impreso OK?** pregunta sobre el lote que acabas de imprimir y lo registra; a partir de entonces esos objetos y lugares muestran la cinta ámbar. **Lotes recientes** muestra lo que contiene cada uno, cuándo y dónde se hizo y si se imprimió; uno sin confirmar aún puede marcarse **Impreso correctamente** o **No impreso** ahí, y se reimprime con los mismos códigos. Imprimir los mismos objetos de nuevo mientras su hoja no está confirmada ofrece esa hoja en vez de una nueva. Los objetos cuyo ID sigue pendiente aún no pueden imprimirse.

## Escanear

**Escanear** en Inicio y Búsqueda abre la cámara.

| Escaneas | Kept |
|---|---|
| Una etiqueta de Kept para algo que puedes ver | La abre y la marca como vista ahora mismo |
| Un código de Kept impreso sin código QR (cinta estrecha) | La abre, leída del texto, o pregunta primero **¿Es este el código?** cuando la lectura no es clara ([abajo](#escanear-un-código-sin-código-qr)) |
| Una etiqueta en blanco | Ofrece **Nueva caja aquí**, **Adjuntar a un objeto existente** o **Adjunta a un lugar existente** (una habitación, estante o sitio) |
| Un código de barras de producto | Ofrece añadirlo como un objeto nuevo; con la búsqueda de códigos de barras activada por el administrador, se nombra a partir de Open Food Facts, Open Products Facts u Open Beauty Facts |
| Un número de serie o etiqueta de activo que tiene un objeto | Abre ese objeto |
| Un código de barras que tiene un objeto | Abre ese objeto; si son varios, pregunta cuál |
| Un código que aún no tiene nadie | Nombra su tipo y ofrece añadirlo como un objeto nuevo, conservando el código como su código de barras o su número de serie |
| Una etiqueta de Homebox, tras una [importación de Homebox](/es/users/import-export/) | Abre el objeto importado |
| Cualquier otra cosa | Dice que no es una etiqueta de Kept |

Una etiqueta reclamada para un lugar se muestra en él como cinta ámbar, igual que una impresa para él. Reclamar funciona sin conexión: espera en el teléfono hasta sincronizar, y si otro teléfono reclamó la misma etiqueta primero te dicen qué la tiene. Los miembros, administradores y propietarios pueden reclamar; los espectadores, no.

Para etiquetar un lugar donde ya pegaste una etiqueta en blanco, abre el lugar y elige **Añade un código de etiqueta** (en Administrar): se abre el escáner y la etiqueta en blanco que escanees ofrece ese lugar primero.

Una etiqueta se queda con lo que está pegada. Cuando [se fusionan los compartimentos](/es/users/locations/#combinar-y-dividir-compartimentos), las etiquetas de los que se fusionaron abren el compartimento resultante; una división devuelve a cada uno su etiqueta. Cuando se [gira el mobiliario](/es/users/locations/#girar-el-mueble), cada compartimento conserva su etiqueta, se renumere o no.

Los códigos que lee Kept y dónde los guarda un objeto nuevo:

| Código | Suele estar en | Kept lo guarda como |
|---|---|---|
| Código QR | Etiquetas de Kept, etiquetas de Homebox | La etiqueta |
| EAN-13, EAN-8, UPC-A, UPC-E | Productos | Código de barras |
| Code 128, Codabar | Etiquetas de tienda, activos y biblioteca | Código de barras |
| ITF-14 | Cajas de cartón | Código de barras, si su dígito de control es correcto; si no, tú eliges |
| Code 39, Code 93 | Etiquetas de activo, etiquetas de TI | Número de serie, o código de barras si tú lo eliges |
| Data Matrix | Electrónica, cargadores, repuestos | Un código GS1: su GTIN como código de barras y su número de serie como número de serie. Texto plano: tú eliges |
| PDF417, Aztec | Etiquetas de envío, tarjetas de garantía, boletos | Tú eliges; el texto demasiado largo para cualquiera de los campos (64 caracteres para un código de barras, 100 para un número de serie) no se guarda |

En cualquiera de estos, una etiqueta de Kept gana. Un número de serie coincide exactamente como se guardó, y solo en línea: la copia sin conexión del teléfono no contiene números de serie. Los códigos GS1 escritos con paréntesis, como `(01)04006381333931(21)K7Q2X9`, se leen de la misma manera.

Una etiqueta gastada, o sin cámara: **Escribe el código**. La cámara de Capture también reconoce las etiquetas de Kept y ofrece abrir esa caja o capturar en ella.

### Escanear un código sin código QR

Una etiqueta sin código QR (cinta estrecha) se escanea por su ID corto impreso. Apunta **Escanear** al código, de modo que ocupe como un tercio del ancho de la cámara, y mantente quieto un momento: Kept lee los seis caracteres del texto y abre el objeto, igual que desde un código QR, y un mensaje dice qué código leyó.

- **En el teléfono, también sin conexión.** La lectura ocurre en el teléfono; la foto nunca se envía a ningún lado. Funciona sin conexión para todo lo que esté en la copia del teléfono.
- **Nunca un objeto equivocado.** Kept abre un código solo cuando leyó cada carácter con claridad, dos veces seguidas, y el código es uno de los tuyos. Cuando no está seguro, muestra el código que leyó y lo que abre, y pregunta **¿Es este el código?** antes de abrirlo. Un código que no coincide con ninguna de tus etiquetas no abre nada: **Escanear de nuevo**, o **Escribe el código**.
- **Solo la impresión de Kept.** Lee el ID corto tal como lo imprime Kept, en su propio tipo de letra. Un código escrito a mano en una etiquetadora, con la fuente de la etiquetadora, puede no leerse: escríbelo en su lugar.

Solo **Escanear** lee códigos impresos. Las sesiones de escaneo, la verificación de caja y la cámara de Capture leen solo códigos QR y códigos de barras.

## Relacionado

- [Sesiones de escaneo](/es/users/scanning-sessions/) para escanear una caja entera de una vez.
- [Etiquetas](/es/users/tags/) para decir qué más es un objeto.
- [Uso cotidiano](/es/users/everyday-use/) para ver el panorama general.
