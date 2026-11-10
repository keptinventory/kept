---
title: "Conecta un cliente de IA (MCP)"
description: "Conecta Claude Desktop u otro agente de IA al servidor MCP (Model Context Protocol) de Kept, con un token personal u OAuth."
---

Kept ejecuta un servidor [MCP](https://modelcontextprotocol.io/) en la dirección de tu Kept seguida de
`/mcp`, por ejemplo `https://kept.example.org/mcp`. Una app de IA que hable MCP puede entonces responder
"¿dónde está el taladro?" desde tu inventario y, si se lo permites, añadir, mover y cambiar objetos.

![Claude Code conectado a Kept: "Añade mi TV al Salón: Samsung QE55Q80C, número de serie 0B7H3CJT500123", y la respuesta de Claude de que la TV está en Kept bajo Inicio › Salón](../../../../assets/screens/claude-mcp-light.webp)

Esta página trata de apps fuera de Kept. El propio asistente de Kept usa las mismas herramientas y se cubre en
[Proveedores de IA](/es/users/ai-providers/). Cómo funciona el servidor por dentro está en
[Servidor MCP](/es/developers/mcp/).

Hay dos formas de conectar una app:

- **Un token personal**: cualquier cliente MCP que te deje poner una dirección de servidor y una
  cabecera `Authorization`.
- **Un conector (OAuth)**: la app te manda a Kept a iniciar sesión y elegir qué puede hacer. Esto
  necesita Kept en una dirección `https` que la app pueda alcanzar.

:::note[Aún no comprobado contra las apps]
Las pruebas de Kept conectan un cliente MCP de las dos formas. Las comprobaciones contra claude.ai, ChatGPT y Claude Desktop
siguen pendientes, así que aún no está confirmado cuáles de ellos conectan como conectores.
:::

## Antes de empezar

- **Activa "Conecta ChatGPT o Claude" en cada ubicación que la app deba alcanzar.** Está en
  **Configuración de ubicación → Qué seguir**, y está activo solo en el preset **Completo**. El propietario y
  los administradores lo cambian. En una ubicación donde esté desactivado, un token o conector no alcanza nada.
- **La app crea tokens solo sobre `https`.** Configuración → Conexiones se niega a crear un token cuando
  `KEPT_PUBLIC_URL` es `http` simple. No hay ajuste para desactivar esto. Ver
  [HTTPS](/es/install/https/). En una red local sobre `http`, la persona que ejecuta el servidor puede
  crear uno allí en su lugar: [`kept admin token create`](/es/admin/cli/#un-token-desde-el-servidor).

## Crea un token personal

Abre **Configuración → Conexiones** y elige **Nuevo token**.

| Campo | Qué poner |
|---|---|
| **Nombre** | Dónde lo vas a usar: "Claude Desktop, mi portátil". |
| **Ubicaciones** | Una viene marcada. Añade otra solo si la app necesita ambas. |
| **Qué puede hacer** | **Solo lectura**: busca objetos y lee lo que hay registrado. **Leer y cambiar**: también añade, mueve o cambia ellos. Ninguno puede borrar ni ver campos secretos. |
| **Vence** | Una fecha, o vacío para mantenerlo hasta que lo revoces. Termina al final de ese día. |

Luego **Crear token**. Un token nunca hace más de lo que tú puedes: donde eres espectador, solo puede
leer. Un token que pueda cambiar cosas en varias ubicaciones cuyos miembros difieren avisa,
**Diferentes personas usan estas ubicaciones**, porque una app podría entonces mover objetos de una a
otra. **Hazlo para todos ellos** sigue adelante; un token por ubicación es la opción más segura.

El token, `kpt_` seguido de dos partes, aparece **una vez**, con **Copiar**. Kept guarda solo una
huella de él, así que un token perdido no se puede mostrar de nuevo: revócalo y crea otro.

En una ubicación que requiere dos factores, un token funciona solo si lo creaste estando conectado
con tu segundo factor.

## Conecta un cliente con el token

Bajo el nuevo token, **Conecta una app** muestra dos valores, cada uno con un botón de copiar:

```text
Server address   https://kept.example.org/mcp
Authorization    Bearer kpt_…
```

En la app, añade un servidor MCP (puede llamarse conector o integración) con esa dirección,
y envía el token en esa cabecera. Kept no da un archivo de ajustes para ninguna app en particular;
dónde van la dirección y la cabecera está en la propia documentación de la app.

El endpoint responde solo a `POST`, no mantiene sesión entre peticiones, y rechaza una petición cuyo
`Host` no sea la dirección de Kept (o una que usara antes) o que venga de la página de otro sitio web.

## Conecta como conector (OAuth)

Las apps que lo soportan pueden conectar sin un token que copies. Esto está activo por sí solo cuando
`KEPT_PUBLIC_URL` es `https`. **Administrador → Estado → Conexiones desde otras aplicaciones** muestra el
endpoint MCP y **Disponible** o **Necesita una URL pública https**.

1. En la app, añade `https://kept.example.org/mcp` como conector.
2. La app encuentra el inicio de sesión de Kept desde la dirección y te manda a Kept. Inicia sesión.
3. Kept muestra **_App_ quiere usar tu Kept**. El nombre es el que la app se da a sí misma; Kept
   no puede confirmar quién la hizo. Elige **Qué puede hacer** y **Dónde** (elige solo las ubicaciones que
   necesite), luego **Permitir** o **Denegar**. La página también dice que la app se queda conectada después de que cierres sesión en este navegador, y que cualquier cosa que cierre sesión en todos tus otros dispositivos hace que vuelva a iniciar sesión.
4. La app aparece bajo **Aplicaciones conectadas** en **Configuración → Conexiones**.

La app se queda conectada hasta que pulses **Revocar** en ella y confirmes (Kept pregunta **¿Desconectar
_App_?**), o hasta que pasen 30 días sin usarse; entonces tiene que iniciar sesión de nuevo. Cada token de acceso que obtiene dura
una hora y la app lo renueva sin preguntarte de nuevo; Kept comprueba tu permiso en cada llamada, así que
**Revocar** en **Configuración → Conexiones** funciona al instante.

La app tiene que iniciar sesión de nuevo tras cualquier cosa que cierre sesión en tus otros dispositivos: **Cerrar sesión en todos
los otros dispositivos**, una contraseña nueva o un restablecimiento de contraseña, un cambio en los dos factores, códigos de respaldo o
llaves de acceso, desvincular un inicio de sesión externo, una dirección de correo nueva, o un administrador cerrando tu sesión en todas partes
o desactivando tu cuenta. Cerrar sesión en un dispositivo elegido deja la app conectada.

Una excepción: pedir borrar tu cuenta cierra sesión en tus otros dispositivos pero mantiene el inicio de sesión
de la app. La app deja de funcionar mientras la cuenta espera, y si la conservas, vuelve a funcionar
sin iniciar sesión.

Cosas que paran un conector:

- **La app no puede alcanzar Kept.** Una app web como claude.ai conecta desde sus propios servidores, así que
  Kept debe ser accesible desde internet, no solo en tu red local o tailnet.
- **Kept no puede alcanzar la app.** Una app se identifica con una dirección `https` para un
  documento que la describe, y Kept obtiene ese documento. Direcciones privadas y locales se rechazan.
- **La app se registra a sí misma.** Kept acepta apps que se describen con tal documento
  (Documentos de Metadatos de ID de Cliente) y tiene el registro dinámico de clientes desactivado. Una app que
  solo pueda registrarse dinámicamente no puede conectar como conector; usa un token personal si acepta uno.

## Qué puede y qué no puede hacer una app

- **Ve solo las ubicaciones que elegiste**, y en cada una solo las herramientas para las partes de Kept
  que esa ubicación tenga activadas. Donde tu rol oculta valores, también se ocultan de la app.
- **Los cambios aplican al momento y se listan bajo Cambios recientes por conexiones** en la página
  Conexiones, con **Deshacer durante 7 días**. Deshacer se niega cuando el campo ha cambiado desde entonces.
- **No hay nada destructivo que llamar.** Ninguna herramienta borra, manda a la papelera, fusiona, transfiere propiedad,
  revela un campo secreto, sube un archivo o ejecuta una consulta propia.
- **Los archivos pasan por ti.** `attach_link` da a la app un enlace que abre la hoja de captura de Kept;
  añades la foto o el recibo ahí, con sesión iniciada.
- **Límites por token**: 120 lecturas y 30 cambios por minuto. Las respuestas son cortas y paginadas, 20 objetos
  salvo que la app pida más, hasta 200.
- **El texto que escribió gente se marca como no confiable.** Nombres y notas llegan a la app bajo una clave
  `untrusted`, y Kept le dice que nunca siga instrucciones encontradas en ellos.

## Las herramientas

Una app ve solo las herramientas que puede llamar en cada ubicación; `capabilities` las lista. [Ocultar
Personal](/es/users/locations/#ocultar-personal) no cambia lo que se dio a una app. Las herramientas de **lectura**
funcionan con cualquiera de los dos accesos; las de **cambio** necesitan **Leer y cambiar** y un rol de miembro o
superior. La parte de Kept que necesita una herramienta es el nombre bajo **Qué seguir**.

| Herramienta | Tipo | Necesita | Qué responde |
|---|---|---|---|
| `capabilities` | lectura | | Qué puedo hacer en cada ubicación: sus partes y las herramientas que puedo llamar ahí. |
| `list_locations` | lectura | | Qué ubicaciones puedo ver, con mi rol y su zona horaria. |
| `search_things` | lectura | | Qué objetos coinciden con estas palabras: nombres, alias, tipos, marcas y notas, con filtros. |
| `where_is` | lectura | | Dónde está un objeto: las mejores coincidencias con su ruta completa de lugar. |
| `get_thing` | lectura | | Qué sabemos de este objeto (por id o ID corto), quién lo tiene, y las partes de un kit. |
| `list_contents` | lectura | | Qué hay en este lugar o contenedor, de 1 a 3 niveles de profundidad. |
| `thing_history` | lectura | | Qué pasó con este objeto, lo más nuevo primero: quién hizo qué y cuándo. |
| `find_documents` | lectura | | Dónde está el recibo, manual o garantía de algo. |
| `upcoming` | lectura | Recordatorios | Qué vence, está vencido o expira pronto: horarios, garantías, préstamos y stock bajo. |
| `add_thing` | cambio | | Añade uno o más objetos, con un lugar nuevo si no existe aún, y todos los campos que fija la hoja de creación de la app (ver abajo). |
| `update_thing` | cambio | | Cambia cualquiera de los campos de un objeto que cambia el formulario de edición de la app (ver abajo); `null` borra uno. |
| `move_thing` | cambio | | Mueve un objeto, o parte de una cantidad, a otro lugar o contenedor. |
| `mark_seen` | cambio | | Acabo de ver este objeto donde Kept dice que está. |
| `create_place` | cambio | | Añade un lugar bajo otro lugar, o en la cima de la ubicación. Con `template`, añade muebles y un lugar para cada uno de sus compartimentos en un paso, como hace [Muebles con compartimentos](/es/users/locations/#muebles-con-compartimentos); un Deshacer lo quita todo. Una habitación toma su tamaño real, `width_cm` y `length_cm` (50 cm a 100 m), y va en el [mapa](/es/users/location-map/) con él. Una plantilla de bastidor acepta `units` y `numbering` ([Bastidores](/es/users/locations/#bastidores)). |
| `update_place` | cambio | | Cambia un lugar como hace su página: cámbiale el nombre, cambia su tipo, muévelo a otro lugar o a la cima, fija sus campos, y el orden de los lugares en él (A a Z u Orden personalizado, luego Subir o Bajar). `turn` (`right` o `left`, a dónde fue su parte de arriba) gira [muebles con compartimentos](/es/users/locations/#girar-el-mueble) de lado o boca arriba, con `renumber` true o false. Deshacer durante 7 días, salvo subir o bajar: el movimiento opuesto lo deshace. |
| `turn_into_boxes` | cambio | | Convierte hasta 50 lugares en cajas, como hace **Convierte lugares en cajas**. Cada una conserva su ID, etiqueta y lo que tiene dentro; una con lugares dentro se queda lugar, y también la que está en la cima de la ubicación (conviértela en Kept). Un Deshacer las vuelve a todas. |
| `attach_link` | cambio | | Un enlace que abre la hoja de captura de Kept para añadir una foto, recibo o documento. |
| `log_reading` | cambio | | Registra una lectura de contador: odómetro, horas, electricidad. |
| `lend_thing` | cambio | Préstamos | Presta un objeto a alguien, con fecha de vencimiento opcional. Una caja o un kit va con todo lo que tiene dentro, cada uno en su línea. |
| `return_thing` | cambio | Préstamos | Un objeto prestado o tomado prestado volvió, todo o una cantidad. Una caja o kit trae de vuelta lo que sigue fuera con él. |
| `borrow_thing` | cambio | Préstamos | Registra un objeto tomado prestado de alguien, con fecha de vencimiento opcional. |
| `complete_schedule` | cambio | Recordatorios | Una tarea programada se hizo, en una fecha o en un valor de contador. |
| `snooze_schedule` | cambio | Recordatorios | Aplaza una tarea programada hasta una fecha o un valor de contador. |
| `add_warranty` | cambio | Recibos y garantías | Registra una garantía: su tipo, y cuándo termina o cuántos meses. |
| `open_claim` | cambio | Recibos y garantías | Abre una reclamación de garantía para un objeto. |
| `update_claim` | cambio | Recibos y garantías | Cambia el estado o la referencia de una reclamación. |
| `log_service` | cambio | | Registra un servicio: fecha, quién lo hizo, total, líneas (cada una puede usar stock de un consumible), los horarios que completa, y notas. |
| `log_fuel` | cambio | Combustible | Registra un repostaje: cantidad, unidad, coste, si fue lleno, y el odómetro. |
| `adjust_stock` | cambio | Objetos que se te acaban | Añade o quita del stock de un consumible. |
| `list_tags` | lectura | | Qué etiquetas hay, con cuántos objetos tienen cada una. |
| `tag_things` | cambio | | Añade etiquetas a objetos, o quítalas; un nombre nuevo crea la etiqueta. |
| `list_moves` | lectura | Mudanza | Qué mudanzas hay, con cuántas cajas están embaladas, en tránsito y desempaquetadas. |
| `get_move` | lectura | Mudanza | Dónde está cada caja de una mudanza, y qué números faltan todavía. |
| `start_move` | cambio | Mudanza | Inicia una mudanza, a otra ubicación o entre habitaciones de esta. |
| `add_box` | cambio | Mudanza | Añade la siguiente caja numerada: una nueva, o un contenedor que ya tienes. |
| `pack_into_box` | cambio | Mudanza | Embalajea objetos en una caja. |
| `set_box_status` | cambio | Mudanza | Marca una caja como embalada o en tránsito, o elige su habitación. |
| `unpack_box` | cambio | Mudanza | Desembala una caja en una habitación; todo lo que tiene va con ella. |

**Campos de un objeto.** `add_thing` y `update_thing` toman todos los campos que puedes fijar en un objeto en la
app, cada uno en su campo en vez de en las notas: nombre, cuántos, tipo (por nombre, en inglés o
árabe, o por id), marca (se crea si es nueva), modelo, número de serie, código de barras, color, estado, notas,
otros nombres, etiquetas (un nombre nuevo crea la etiqueta, para miembros y superiores), de quién es (una persona, se crea si es nueva), el enlace del manual,
vencimiento y cuántos días antes avisar, el mínimo de un consumible, y los campos propios del tipo por
clave. `add_thing` también toma a dónde va y la compra (fecha, precio de uno con su moneda,
y la tienda); `update_thing` también toma de dónde vino, y su compra: la fecha, la tienda,
su línea en el recibo, el precio de uno con su moneda y las notas, cambiando la compra que tiene
o registrando una, como hace la página del objeto. Un precio necesita Dinero activado y un rol que
vea dinero, como en la app; un mínimo necesita **Objetos que se te acaban**. Un tipo que Kept no conoce
se omite y la respuesta `not_set` lo dice; la tarjeta del asistente
lo muestra como "no fijado" con un selector. Un equipo en un bastidor acepta `rack_units` (su altura, 0 junto a los rieles) y `rack_at` (el número de unidad más bajo que ocupa, según la numeración del bastidor, como lo da `get_thing`, su cara y si es de fondo completo), rechazado como en la app si la unidad está ocupada.

Las herramientas de mudanza son solo para apps conectadas; el asistente en Kept no las usa.

Toda herramienta que tome un id también toma un ID corto de 6 caracteres como `K7D2QX`. Los
contratos completos están en
[`packages/mcp/src/tools.ts`](https://github.com/keptinventory/kept/blob/main/packages/mcp/src/tools.ts).

## Revoca el acceso

En **Configuración → Conexiones**, busca el token o app (filtra por **Tipo**, **Ubicación** o
**Estado**) y elige **Revocar**.

- **Un token**: las apps que lo usen dejan de funcionar al momento. Los cambios que hizo se quedan, y aún
  se pueden deshacer durante 7 días.
- **Una app conectada**: deja de alcanzar tu Kept al momento, y Kept olvida tu consentimiento, así que
  para usarla de nuevo la conectas de nuevo desde la app.

Kept también termina el acceso por sí solo, y la lista dice por qué: **Vencido**, **Terminado: saliste de la
ubicación**, **Terminado: cambió tu rol**, **Revocado por un administrador**, o **Desconectado por la app**.
