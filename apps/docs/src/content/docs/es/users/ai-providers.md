---
title: Proveedores de IA
description: Qué proveedores de IA admite Kept, dónde van las claves, qué envía y cuesta cada función, límites de gasto, modelos locales y cómo apagar la IA.
---

Kept funciona sin IA. Conectar un proveedor añade tres cosas: nombrar objetos a partir de fotos y
leer recibos, etiquetas y lecturas de contadores; el asistente, que responde preguntas sobre tu
inventario; y, con un modelo de incrustaciones, buscar por significado. Traes tu propia clave; Kept no
tiene un servicio de IA propio.

## Proveedores

| Proveedor | Fotos y recibos | Asistente | Búsqueda por significado |
|---|---|---|---|
| **Groq** (recomendado) | sí | sí | sin modelo de incrustaciones |
| **OpenAI** | sí | sí | sí |
| **Anthropic** | sí | sí | sin modelo de incrustaciones |
| **Google** (Gemini) | sí | sí | sí |
| **OpenRouter** | sí | sí | sí (sus modelos de incrustaciones) |
| **Compatible con OpenAI** (Ollama, LM Studio, …) | los modelos que indiques | los modelos que indiques | si el servidor ofrece uno |

**Groq con `qwen/qwen3.8-27b`** es la recomendación: el resultado fiable más barato que midió Kept,
unos USD 0.004 por recibo (en imágenes de prueba sintéticas, 2026-09-26). Al pegar una clave de Groq
se selecciona, y **¿Por qué?** en la página muestra las cifras. Kept sugiere un modelo para cada
proveedor y tarea; puedes elegir cualquier otro de la lista del proveedor en **Avanzado**, o escribir
cualquier id de modelo.

## Dónde va la clave

Hay tres lugares para una clave, y no hay clave por ubicación:

| Clave | Se configura en | Paga por |
|---|---|---|
| **La clave de la cuenta** | **Configuración → IA**, por el titular de la cuenta | Todas las ubicaciones que posee esa cuenta |
| **Tu clave personal** | **Configuración → IA → Clave de IA personal** | Tu ubicación Personal, tus hilos privados del asistente y las preguntas que abarcan a varios titulares. Con [Personal oculto](/es/users/locations/#ocultar-personal), también una ubicación que posees y usas solo, cuando su cuenta no tiene clave |
| **La clave de este servidor** | **Administrador → IA**, por un administrador de la instancia | Cualquier persona cuya cuenta no tenga su propia clave |

El trabajo en una ubicación (nombrar una foto, una respuesta del asistente sobre ella) lo paga el
**titular de la ubicación**, por lo que los miembros de la "Family house" de Alfred usan la clave
de Alfred, no la suya. Los miembros y los espectadores ven una línea de solo lectura que indica quién
paga.

**Conectar:** pega la clave en **Pega tu clave**. Kept reconoce el proveedor a partir de la clave
cuando puede (si no, elígelo en **Avanzado**), luego **Guardar y probar** comprueba que el modelo
lee fotos y da respuestas estructuradas, y dice cuánto costó la prueba. Las claves son de solo
escritura: Kept nunca vuelve a mostrar una clave guardada, y **Reemplazar clave** la cambia. Antes
de la primera clave en un servidor, el administrador de la instancia debe guardar el
[kit de recuperación](/es/admin/recovery-kit/): la clave es un secreto del que Kept debe poder
recuperarse desde una copia de seguridad.

**Avanzado** contiene el proveedor y la URL base, el modelo para cada tarea (**Modelos**), el **esfuerzo
de razonamiento** (bajo por defecto), los límites y los precios.

**Modelos:** la lista es la del proveedor, y se pide cada vez que se abre el selector (Kept la
reutiliza durante diez minutos; **Actualizar lista** la vuelve a pedir). Los modelos `:free` de
OpenRouter están en ella, marcados como "free: shared, may be busy": un grupo compartido que a menudo
responde "busy". Debajo de cada selector, **Id de modelo personalizado** acepta cualquier id, para
todos los proveedores, incluso uno que no aparezca en la lista; luego **Guardar y probar** lo
comprueba. Cuando el proveedor no responde a la lista, lo único que queda es escribir el id.

## Qué usa IA y cuánto cuesta

Los ajustes de IA empiezan con **Qué usa IA en Kept**: una fila por acción (una foto capturada, un
recibo, una etiqueta, una lectura, una pregunta al asistente, una búsqueda, la prueba), con cuántas
llamadas hace, los tokens que consume y el coste según la tabla de precios, a partir del uso de los
últimos 30 días cuando hay algo. En **Este mes**, una barra por límite muestra el gasto hasta ahora.

- **Capturar** (modos Objeto, Recibo, Etiqueta, Lectura): una llamada por foto. Se rellenan nombres,
  marcas, modelos y tipos; precios, fechas, series y lecturas esperan en la bandeja de entrada como
  valores sugeridos para que los aceptes. Cada borrador rellenado con IA lleva una línea como
  "Leído por qwen/qwen3.8-27b (Groq) · 2,502 tokens", con su coste y quién lo pagó.
- **Varios objetos en una foto** (modo Objeto; Administrador → Configuración, desactivado por
  defecto): la misma llamada nombra hasta 12 objetos en la foto. La primera rellena el borrador de la
  propia captura y conserva la foto; cada una de las demás se convierte en un borrador a su lado, en
  el mismo lugar y lote, con su propia imagen recortada de la foto, para confirmar, fusionar o
  descartar en la bandeja de entrada. Qué tal se recortan las imágenes depende de las cajas del
  proveedor, así que revisa algunos borradores después de activarlo.
- **Fotos de la habitación** (modo Habitación): una llamada por foto que lista hasta 60 objetos, y
  para varias fotos una llamada corta solo de texto que las fusiona. Los objetos se convierten en
  borradores en la habitación, cada uno con su propia imagen ([Fotos de la habitación](/es/users/room-photos/)).
- **Planos de planta** (el **Empezar desde un plano de planta** del mapa de ubicación): una llamada
  por plano, que lee sus habitaciones, sus etiquetas y tamaños impresos; Kept calcula los tamaños y
  se coloca, y tú los revisas antes de que se añada nada ([el mapa de ubicación](/es/users/location-map/#empezar-desde-un-plano-de-planta)).
  La hoja muestra lo máximo que puede consumir una lectura antes de enviarse: unas 11,000 tokens en
  Groq, un cálculo.
- **El asistente** responde a partir de tu inventario según tu rol, y cada herramienta que usa suma
  una llamada. Los cambios que propone aparecen como una tarjeta de confirmación que apruebas; para
  los espectadores es de solo lectura.
- **¿Añadir palabras de búsqueda con IA?** tras una importación: una importación puede ofrecer
  **¿Añadir palabras de búsqueda con IA?**, con primero la estimación de tokens
  ([importación](/es/users/import-export/)).

Las páginas de **Uso de IA** listan cada llamada: **Mi uso de IA** para todos, el uso de una
ubicación para sus administradores y titular, el de la cuenta para su titular, y el de la instancia
en Administrador → IA. Cada una muestra totales, tokens por día apilados por tarea, desgloses por
tarea, persona y ubicación donde corresponda, y la lista de llamadas con **Exportar CSV**. Una
llamada registra su modelo, tokens, resultado y coste, nunca el prompt, la foto, la respuesta ni la
clave.

Los precios vienen de la tabla de precios, que los administradores de la instancia editan en
Administrador → IA (con **Rellenar desde … listado** para los proveedores que publican precios). El
precio del modelo recomendado de Groq viene rellenado para ti. Una llamada sin precio se cuenta en
tokens y se muestra como coste desconocido.

## Límites y pausas

Nada está limitado por dinero salvo que alguien lo elija: tras la primera clave, Kept ofrece
**¿Establecer un límite mensual?** con una cantidad sugerida, y **Sin límite**. En **Avanzado**,
**Límites** contiene:

- **Dinero al mes** (en una moneda que el servidor haya activado) y **Tokens al mes**, para la
  cuenta; el límite propio de una ubicación dentro del de la cuenta, fijado por el titular; y un
  límite por persona.
- La lectura de fotos y recibos tiene un presupuesto de tokens de 60,000 por minuto, 2,000,000 por
  día y 20,000,000 por mes por cuenta de pago, salvo que se cambie.
- **Pausar IA** detiene todas las llamadas a mano hasta que reanudes.

Cuando se alcanza un límite, la IA se pausa solo para ese ámbito, con un aviso como "IA pausada
hasta el 1 de oct · límite mensual de Home alcanzado". **Las capturas se siguen guardando; el
nombrado espera**, y se reanuda cuando la IA lo haga. Quien fijó el límite obtiene **Reanudar
ahora**, para subirlo, quitarlo o mantener la pausa. El propio límite de tasa de un proveedor no
es una pausa: las líneas de progreso dicen "Esperando a Groq · unos 20 s" y siguen.

**Una petición al asistente se mantiene por debajo del límite por minuto del proveedor** una vez que
el proveedor lo ha indicado (nivel gratuito de Groq: 8,000 tokens por minuto). Cada petición incluye
las herramientas de las que trata la pregunta: buscar objetos y los cambios cotidianos siempre, y
préstamo, horarios, garantías, documentos, vehículos, stock, historia o lugares cuando la pregunta (o
las últimas del hilo) los menciona, en cualquiera de los idiomas de Kept; una herramienta que el
modelo pide y no se envió se envía en su siguiente paso. Una primera pregunta con todos los módulos
activos ronda los 3,100 tokens antes del margen de la respuesta. Si una petición sigue siendo
demasiado grande, Kept envía menos herramientas, luego pide una respuesta más corta, luego omite los
resultados de herramientas más antiguos de lo que envía; el hilo los conserva. Una pregunta que aun
así no cabe falla con "too large": un modelo o plan con un límite mayor la responde.

## Qué se envía al proveedor

El resumen propio de Kept, mostrado junto a cada proveedor:

> Solo una copia de la foto con los datos de ubicación y cámara eliminados, nunca el original. Las
> instrucciones fijas y los idiomas de tu ubicación. Para el asistente, tu pregunta y el inventario
> que consulta, según tu rol. Nunca campos secretos.

Un plano de planta envía el mismo tipo de copia (la primera página de un PDF dibujada como imagen,
con el texto de esa página) y ninguno de los nombres de tu ubicación, habitación o piso; el texto
propio del plano se envía como datos, y nada de lo que Kept conserva de la respuesta es un nombre,
una dirección o un número del plano, salvo las etiquetas y los tamaños de las habitaciones del plano.

Debajo, Kept resume lo que el proveedor dice que hace con los datos de la API (entrenamiento,
retención) y enlaza su política. Un servidor que ejecutas tú mismo conserva lo que dejes que
conserve.

## Búsqueda e incrustaciones

La búsqueda por palabras clave siempre funciona, incluidas las palabras de búsqueda que la IA añade a
los objetos en cada uno de los idiomas de la ubicación. La búsqueda por significado necesita un modelo
de incrustaciones, que proviene de uno de tres lugares, fijado por el administrador del servidor con
`KEPT_EMBEDDINGS` ([configuración](/es/reference/configuration/)):

- `provider` (el valor por defecto): el proveedor de la ubicación, cuando tiene un modelo de
  incrustaciones (OpenAI, Google, OpenRouter o un servidor compatible con OpenAI). Elige uno en
  **Avanzado → Modelos → Búsqueda**; OpenRouter no tiene valor por defecto y lista los gratuitos.
  Groq y Anthropic no tienen ninguno, así que con ellos la búsqueda se queda solo por palabras clave
  y lo dice. Una clave más arriba en la cadena con un modelo de búsqueda (la de este servidor) cubre
  a una ubicación cuya propia clave no tiene ninguno.
- Cuando una clave tiene un modelo de asistente pero no de búsqueda, y nada más arriba da uno,
  **Configuración → IA** dice **La búsqueda coincide solo por nombres**, con el paso: **Elige un
  modelo de búsqueda**, o para Groq y Anthropic **Elige otro proveedor**. Administrador → Estado →
  Incrustaciones de búsqueda cuenta las ubicaciones que buscan solo por nombre, sin nombrarlas.
- Kept pide a OpenAI y Google vectores de 768 números. Otros modelos responden con su propia
  longitud, que debe ser de 2000 o menos: un modelo con vectores más largos no se puede usar para
  la búsqueda. Una petición que vuelve con vectores de otra longitud de la pedida, o de dos
  longitudes, se rechaza y no se guarda nada.
- `local`: un modelo pequeño dentro de Kept, sin clave y sin coste por llamada. Kept rechaza este
  ajuste a menos que el entorno de ejecución del modelo local esté instalado.
- `off`: solo búsqueda por palabras clave.

## Modelos locales con Ollama

Para mantenerlo todo en tu propio hardware, ejecuta un modelo con Ollama y añádelo como proveedor
**Compatible con OpenAI** con su URL base; Kept no rellena nada para este tipo, así que nombras los
modelos. Una dirección en tu red privada debe estar permitida por un administrador de la instancia en
Administrador → Configuración primero. Configuración, memoria y el perfil de Compose:
[Ollama](/es/admin/ollama/).

## Apagar la IA

- **Para una ubicación:** **Configuración de ubicación → Qué seguir**, dentro de **IA en esta
  ubicación**, desactiva **La captura con IA y el asistente**. Capturar sigue funcionando; los objetos,
  esperan en la bandeja de entrada a tener un nombre.
- **Por un tiempo:** **Pausar IA**, en Avanzado.
- **Sin conectar en absoluto:** sin clave en ningún nivel no se envía nada, y el paso **Conectar un
  proveedor de IA** de la lista de comprobación se puede ignorar.

La página de IA no tiene botón para borrar una clave guardada; reemplázala, pausa o apaga la IA por
ubicación.

:::note[ChatGPT o Claude como cliente]
"Conectar ChatGPT o Claude" (el ajuste preestablecido Complete) funciona al revés: tu aplicación de
IA lee y actualiza Kept mediante MCP, usando su propio modelo y suscripción, con un token que creas
en **Configuración → Conexiones**. Consulta [conectar aplicaciones de IA](/es/users/mcp-clients/) y, para
los detalles, [MCP](/es/developers/mcp/).
:::
