---
title: Importar y exportar
description: Trae objetos desde una hoja de cálculo (CSV), Homebox o otro Kept, y llévate una ubicación como una exportación completa con una copia que puedes leer sin Kept.
---

Las importaciones y las exportaciones están en **Configuración → Importar** y **Configuración → Exportar**. Ambas son para los **dueños y administradores** de una ubicación, se ejecutan en segundo plano en el servidor y necesitan conexión.
Para mover un servidor entero, o un hogar entre servidores, consulta también
[mover a un servidor nuevo](/es/admin/move-server/).

## Importar

**Configuración → Importar** pregunta de dónde viene:

| Origen | Qué es |
|---|---|
| **Una hoja de cálculo (CSV)** | Un objeto por fila, con una fila de encabezado que nombra las columnas; también la exportación de hoja de cálculo de Homebox |
| **Una exportación de Homebox** | El ZIP de Homebox v0.26.1 o posterior, se recomienda v0.27.0 (Colección → Herramientas → Copia de seguridad y restauración → Crear copia de seguridad → Descargar) |
| **Una exportación de Kept** | Una ubicación exportada de este Kept o de otro |

Cada importación se revisa antes de escribir nada: **Revisar la importación** muestra **lo que hará la importación**, fila por fila, con el motivo de cualquier cosa que salte. Luego se ejecuta con una barra de progreso. Puedes salir de la página; la importación continúa, y Configuración → Importar muestra el avance. Si se detiene, **Reanudar** continúa desde la última fila. **Cancelar la importación** conserva lo que ya importó.

Ejecutar la misma importación de nuevo omite lo que ya trajo, así que una repetición nunca crea duplicados. Un archivo (un ZIP) puede tener hasta 5 GB. Los objetos importados llegan confirmados, no en la Bandeja de entrada.

### Una hoja de cálculo (CSV)

1. **Elige el archivo**, y la ubicación a la que va: una que poseas o administres. Un archivo tiene a lo sumo 10,000 filas (8 MB); divide uno más grande. Debajo del archivo, **Las columnas que Kept lee** enumera cada columna que entiende, y **Descargar un CSV de muestra** da un archivo pequeño para empezar.
2. **Emparejar las columnas.** Para cada columna, elige el campo al que va, incluido **un campo de un tipo…** para tus propios campos de tipo. Una columna debe ser el nombre: todo objeto necesita uno.
3. **Algunas opciones:**
   - Una columna de lugar como `Garage > Shelf A` crea las habitaciones y los puntos: elige el separador y si **Crear los lugares con los nombres de los archivos que aún no existen**.
   - Adónde van las filas sin lugar (Sin lugar por defecto).
   - Cómo se escriben las fechas (se calculan a partir del archivo cuando sea posible), y la moneda para las filas que no tienen ninguna.
   - **Emparejar la columna de tipo con tus tipos por nombre**, en cualquiera de los idiomas de Kept; desactivado, el tipo se guarda en las notas.
4. **Revisar la importación**, lee el informe e importa.

Las columnas que Kept lee: nombre, cantidad, lugar, tipo, marca, modelo, número de serie, código de barras, color, condición, notas, etiquetas, otros nombres, fecha de compra, precio, moneda, tienda, enlace al manual, el código de una etiqueta antigua, tu propio código, un ID de fila (para que una reimportación omita la fila) y los campos propios de tus tipos. Los encabezados en cualquiera de los idiomas de Kept se emparejan solos. Las etiquetas y los otros nombres se separan con comas, un precio es un número sin el signo de moneda, y las fechas se escriben de una sola manera en todo el archivo.

#### Hoja de cálculo de Homebox

Todos los Homebox pueden exportar una hoja de cálculo (hasta v0.25: **Herramientas → Importar/Exportar → Exportar inventario**). Homebox v0.10.3 y v0.11.0 la escriben separada por tabuladores (`homebox-items.tsv`); Kept lee ambos. Cuando las columnas son las de Homebox (`HB.name`, `HB.location`, …), Kept lo indica, empareja las columnas por sí mismo y lee lo que una importación de hoja de cálculo normal descartaría:

| Columna de Homebox | Kept |
|---|---|
| `HB.asset_id`, y el enlace del objeto en `HB.url` (v0.13 y posteriores) | Etiquetas antiguas: una etiqueta impresa de Homebox abre el objeto |
| `HB.sold_*` | Con un comprador o un precio: el objeto terminó como vendido, con su fecha, comprador, notas y precio. Una fecha de venta sola se queda en las notas |
| `HB.archived` | Tu elección: **Archivado** (por defecto), **En uso**, o **Omitir**. Uno con una venta termina vendido |
| `HB.warranty_expires`, `HB.lifetime_warranty` | Una garantía desde la fecha de compra, donde Garantías está activado |
| `HB.warranty_details`, `HB.insured` | Líneas en las notas |

Un precio de 0 se lee como sin precio (Homebox escribe 0 cuando no se fijó ninguno). Las filas de ubicación que lista una hoja de cálculo de v0.26 o posterior se dejan fuera; los lugares vienen de la ruta de ubicación de cada objeto. Una hoja de cálculo no puede llevar fotos, archivos, mantenimiento u objetos dentro de objetos, y los campos personalizados solo se importan si los emparejas con un campo de un tipo. Para todo eso, usa el ZIP de exportación.

### Una exportación de Homebox

Kept lee el archivo ZIP de exportación de Homebox, que lo contiene todo, incluidos los archivos. En Homebox, abre **Colección → Herramientas → Copia de seguridad y restauración**, elige **Crear copia de seguridad** y **Descarga** la copia de seguridad una vez que aparezca. Existe desde Homebox v0.26: usa v0.26.1 o posterior (la imagen de Docker de v0.26.0 pierde los archivos adjuntos), y v0.27.0 si puedes. Un Homebox anterior a v0.26 no tiene exportación: consulta
[viniendo de un Homebox más antiguo](#viniendo-de-un-homebox-más-antiguo). Un ZIP sin el `manifest.json` de Homebox se rechaza con ese consejo.

:::tip[If Homebox says "Topic has been Shutdown"]
Homebox v0.26 hace una exportación cada vez que se inicia. Reinicia Homebox y exporta de nuevo, o actualiza a v0.27.0, que no tiene este límite.
:::

Después de subirlo, Kept muestra la colección y su fecha de exportación. Va a **Una nueva ubicación** o **Una ubicación que ejecutas**, donde los objetos que ya están se quedan y una repetición agrega solo lo nuevo. Una ubicación nueva se crea cuando presionas **Importar**, no antes: una importación que dejas en su revisión no deja nada atrás. **Conectar a Homebox (opcional)** lee la moneda de la colección, que el ZIP no lleva: da la dirección de Homebox y una clave API, o un correo electrónico y una contraseña. Se usan una vez y nunca se almacenan.

Para una ubicación nueva, **Qué seguir** viene después: **Esenciales** (habitaciones, cajas, etiquetas y búsqueda), y encima de eso, marcados, lo que usa la copia de seguridad: **Precios en 10 objetos** activa Dinero, **5 garantías** activa Garantías, **2 entradas de mantenimiento** activa Horarios. Desmarca uno y esos datos se quedan en las notas de los objetos como texto, que no pueden convertirse en registros después. Una copia de seguridad sin nada de eso comienza solo con Esenciales. **También para Personal** le da a tu ubicación Personal lo mismo, así que el menú solo muestra lo que sigues. Cambia cualquiera en cualquier momento en **Configuración de la ubicación → Qué seguir**; desactivar algo nunca borra nada.

Luego elige:

- **Los precios están en**: la moneda, que se pregunta solo cuando la copia de seguridad tiene precios. Elegir una vuelve a etiquetar los importes; no los convierte.
- **Artículos archivados**: **Archivado** (por defecto: archivado en Kept también, todavía tuyo, guardado), **En uso**, o **Omitir**. Un artículo archivado con un comprador o un precio termina vendido.
- **Objetos con cantidad 0**: **Mantener 0 o archivar** (por defecto: un tipo del que te quedas sin existencias mantiene 0, cualquier otro llega archivado), **Establecer en 1**, o **Omitir**. Cada uno que llega tiene "Quantity in Homebox: 0" en sus notas. Un objeto que contiene otros objetos nunca se archiva ni se deja fuera por su 0, y una ubicación que se convierte en caja no tiene cantidad que revisar.
- **Añadir un campo "Asegurado" de sí/no**, y **Omitir los lugares y etiquetas iniciales de Homebox** (las ocho habitaciones y seis etiquetas con las que empieza cada colección nueva de Homebox, cuando no se usan).
- **Estas parecen cajas**: ubicaciones con nombre de caja o contenedor (Box 01, Bin 2, Kiste 3…) que no contienen otra ubicación. Márcalas, o **Seleccionar todo**, y llegan como cajas: objetos que contienen objetos, con sus etiquetas y lo que llevan dentro. El resto llegan como lugares.
- **Campos personalizados**: para cada uno, **Añadir al tipo** o **Conservar en las notas**.
- **Tipos**: para cada tipo de Homebox, un tipo de Kept, **Nuevo tipo...** con un nombre que escribas, o **Sin tipo**. Los propios tipos de Homebox 0.27, `global.item` y `global.location`, se leen como Objeto y Ubicación, como en Homebox; el Objeto general comienza como **Sin tipo**.

La revisión enumera cada entrada que necesita una mirada, cada una con lo que le sucedió en palabras, y la página de la importación conserva esa lista después de la importación: ábrela desde **Actividad** (Se ejecutó una importación).

Qué se trae:

| Homebox | Kept |
|---|---|
| Colección | Una ubicación |
| Ubicaciones (anidadas) | Habitaciones y puntos, manteniendo el árbol |
| Objetos | Objetos; un objeto que contiene otros objetos se convierte en una caja, nunca en todo un tipo |
| Fabricante, modelo, número de serie | Marca, modelo, número de serie |
| Fecha de compra, tienda y precio | Una compra con su tienda |
| Garantía, garantía de por vida | Una garantía |
| Detalles de venta | Con un comprador o un precio (más de 0): el objeto terminó como vendido, con su fecha, precio, comprador y notas. Una fecha de venta sola no es una venta: el objeto se queda en uso, la fecha en sus notas |
| Etiquetas | Etiquetas con sus colores (etiquetas anidadas aplanadas) |
| Fotos, manuales, recibos, archivos de garantía | Fotos, manuales, el recibo de la compra, el documento de la garantía |
| Enlaces | Enlaces. Un enlace a un documento del [Paperless-ngx](/es/users/paperless/) al que está conectada la ubicación (la misma dirección) llega como un enlace de Paperless, como hace **Vincular desde Paperless**, con su título de Paperless (el de Homebox si Paperless no puede dar uno; el informe dice cuántos); conecta Paperless antes de importar |
| Mantenimiento completado | Registros de servicio |
| Mantenimiento programado | Horarios únicos |
| Plantillas | Plantillas de la cuenta, en la medida en que se asignen |

No se importan notificadores, miembros ni roles. Cuando un módulo está desactivado en la ubicación, el texto de ese registro se guarda en las notas del objeto. La descripción de una ubicación no se conserva (los lugares no tienen notas); la revisión nombra cada una.

Homebox escribe fechas que nadie escribió: algunas actualizaciones llenan campos de fecha vacíos, y una copia de seguridad puede llevar una fecha vacía como el último día del año 0. Kept lee una fecha anterior al año 1000 como sin fecha, y una venta necesita un comprador o un precio.

#### Reparar una importación anterior

Las importaciones anteriores a Kept 1.13.0 convertían una cantidad de 0 en 1, convertían todo un tipo en tipo de caja cuando uno de sus objetos contenía otro (para que cada objeto de él se abriera en una pestaña Contenido vacía), y podían crear un tipo llamado `global.item`. Las importaciones anteriores a 1.14.1 daban por vendido un objeto cuando Homebox solo tenía una fecha de venta. Abre la importación desde **Actividad** (Se ejecutó una importación): **Reparar esta importación** enumera lo que puede corregir, por nombre:

- **Archivar los objetos que tenían cantidad 0 en Homebox** (todavía en uso, con cantidad 1);
- **Hacer que el tipo sea un tipo común de nuevo** (un objeto que contiene objetos se queda como caja);
- **Renombrar `global.item` a Objeto**;
- **Poner los objetos marcados como vendidos solo por una fecha de nuevo en uso**: vendidos sin comprador y sin precio, y sin cambios desde entonces. Un objeto archivado en Homebox también vuelve al uso: archívalo de nuevo a mano.

Marca lo que quieras y presiona **Reparar**. Un **Deshacer** lo deshace todo.

**Las etiquetas antiguas siguen funcionando.** Cada ID de activo de Homebox (`000-001`) se recuerda y se enumera bajo **Tus códigos** en el objeto. El escáner de Kept reconoce una etiqueta de Homebox y abre el objeto importado; si apuntas el nombre de host del Homebox anterior a Kept, escanear con la cámara del teléfono también funciona. Los IDs largos de objetos y ubicaciones de Homebox (los de sus enlaces de etiqueta) se recuerdan para escanear pero no se enumeran. Los objetos importados obtienen códigos de Kept propios, que se mantienen fuera de las listas hasta que imprimas sus etiquetas.

### Viniendo de un Homebox más antiguo

Un Homebox anterior a v0.26 no puede crear el archivo ZIP de exportación. Dos formas de entrar:

- **Todo, incluidas fotos y mantenimiento:** actualiza una copia de Homebox a v0.27.0 y exporta el ZIP desde la copia. Probado desde Homebox v0.10.3 (la última versión del original `hay-kot/homebox`) directamente a v0.27.0.
- **Más rápido, con menos:** importa su [hoja de cálculo](#hoja-de-cálculo-de-homebox).

La actualización no se puede deshacer (desde v0.23, las propias notas de Homebox lo dicen), así que se ejecuta en una copia y tu Homebox se queda como está:

1. **Detener Homebox y copiar su carpeta de datos**, la que está montada en `/data` (`homebox.db` con sus archivos `-wal` y `-shm`, y los archivos adjuntos). Mantén el original como tu copia de seguridad.
2. **Iniciar Homebox v0.27.0 en la copia.** Homebox ahora vive en `ghcr.io/sysadminsmedia/homebox`; v0.26 y posterior necesitan `HBOX_AUTH_API_KEY_PEPPER`, 32 o más caracteres aleatorios:

   ```sh
   docker run --rm -p 7745:7745      -e HBOX_AUTH_API_KEY_PEPPER="$(openssl rand -hex 24)"      -v /path/to/homebox-copy:/data      ghcr.io/sysadminsmedia/homebox:0.27.0
   ```

   El primer inicio actualiza la base de datos de una vez. También agrega las ocho habitaciones iniciales de Homebox, que Kept deja fuera por defecto cuando están vacías.
3. **Iniciar sesión** con tu cuenta habitual y abre **Colección → Herramientas → Copia de seguridad y restauración**. Elige **Crear copia de seguridad**, luego **Descarga** la copia de seguridad una vez que aparezca.
4. **Importarlo en Kept** como [una exportación de Homebox](#una-exportación-de-homebox).
5. Detén la copia y bórrala una vez que la importación termine.

Las fotos agregadas antes de que Homebox registrara tipos de archivo también llegan: Kept revisa cada archivo por sí mismo.

### Una exportación de Kept

Una exportación de Kept siempre entra como **Una nueva ubicación**, con sus objetos, lugares, archivos, informes de condición, movimientos e historial, y la posición de la ubicación si tiene una (para [Sugerir dónde estoy](/es/users/phone-app/#cámara-galería-y-escaneo)). Si contiene valores secretos, **Abre los secretos** con la frase de contraseña elegida cuando se exportó; sin ella, se importa todo lo demás. Abrirlos necesita HTTPS: sobre HTTP sin cifrar, la pantalla de importación lo dice e importa el resto. **Personas para invitar** enumera quién compartió la ubicación; la importación no invita a nadie, así que invita a cada persona tú mismo.

Los informes de condición regresan con sus días, notas, habitaciones y fotos, y cada foto conserva la hora en que Kept la recibió primero. Un informe terminado regresa terminado a la misma hora, y se mantiene bloqueado. En el servidor nuevo, las fotos y la finalización quedan a nombre de la persona que las importó; el historial sigue mostrando quién hizo cada cosa antes de la importación.

Los movimientos regresan con sus cajas: el número, el estado y la habitación a la que va cada caja, y un movimiento que se hizo se hace de nuevo. Un movimiento a otra ubicación entra como un movimiento dentro de la nueva, con sus habitaciones para elegir de nuevo.

Una exportación hecha por un Kept más nuevo que el servidor al que importas puede ser rechazada: actualiza ese servidor primero.

### El historial de LubeLogger de un vehículo

En la Descripción general de un vehículo, **Importar desde LubeLogger** toma el CSV que LubeLogger exporta para un vehículo: su combustible, sus registros de servicio (reparaciones y mejoras también) o sus lecturas del odómetro, un archivo a la vez. Kept lee el archivo, dice de qué tipo es y adivina cómo se escriben las fechas y los decimales (LubeLogger los escribe en el idioma de su servidor); cambia cualquiera si la suposición está equivocada, y di si el combustible está en litros o galones. **Verificar** muestra qué se agregaría y qué filas no pueden ser, y por qué; **Importar** las agrega, de la más antigua a la más reciente, con sus lecturas del odómetro. Importar el mismo archivo de nuevo no agrega nada. Los dueños y administradores de la ubicación pueden importar.

### Palabras de búsqueda después de una importación

Cuando un proveedor de IA está conectado, al final de una importación puede ofrecerse **¿Añadir palabras de búsqueda con IA?**, con una estimación de los tokens que lleva. Se ejecuta en segundo plano y agrega alias en los idiomas de la ubicación, como reciben los objetos capturados ([Proveedores de IA](/es/users/ai-providers/)).

## Exportar

**Configuración → Exportar** tiene dos tipos:

- **Exportar una ubicación**, una que poseas o administres: siempre lleva cada objeto, lugar, foto, documento, informe de condición y movimiento.
- **Exportar mis datos**: tu ubicación Personal con sus archivos, tu perfil y preferencias, y tus propias llamadas de IA. Con [Personal oculto](/es/users/locations/#ocultar-personal) lleva la primera otra ubicación que poseas, y Personal está en **Exportar una ubicación**.

Además, **Qué se incluye**: objetos archivados y terminados (vendidos, regalados, desechados), la Papelera, el historial, las llamadas de IA y **Una copia que puedes leer sin Kept**: páginas web, hojas de cálculo, miniaturas y recibos que se abren en cualquier navegador, opcionalmente con el PDF del inventario, en un idioma propio.

**Incluir secretos** es para el dueño de la ubicación. Los valores secretos se cifran con una frase de contraseña de al menos 12 caracteres, escrita dos veces. Cualquiera con el archivo y la frase de contraseña puede leer todos los secretos que contiene, y Kept no puede recuperar una frase de contraseña olvidada. La copia legible nunca contiene secretos.

Una exportación sin secretos deja fuera todos los valores secretos y lo dice: cada objeto o lugar que tuvo uno nombra el campo en `secretsWithheld`, el manifiesto los cuenta y la copia legible tiene una línea al respecto. Se importa como cualquier otra exportación; los campos llegan vacíos. Sobre HTTP sin cifrar este es el único tipo (**Incluir secretos** necesita HTTPS, [Kept en una red doméstica](/es/install/home-network/)).

La exportación se crea en segundo plano; se te avisa cuando está lista. Cada exportación se queda en la lista, lista para **Descargar**, durante siete días. Cada archivo del ZIP tiene fecha de cuando se hizo la exportación.

### Exportaciones y copias de seguridad

Una exportación es algo que te llevas: una ubicación, legible en cualquier parte, importable en cualquier Kept. La copia de seguridad nocturna del servidor es aparte y cubre toda la instancia; también guarda una copia legible de cada ubicación ([Copias de seguridad](/es/admin/backups/)). Al borrar una ubicación se ofrece **Exportar primero**.

## Moverse entre instancias

Para mover un hogar a otro servidor de Kept: exporta la ubicación (con secretos si los necesitas) y luego importa el ZIP allí como una exportación de Kept. Las etiquetas impresas siguen funcionando: una etiqueta conserva su código cuando ese código está libre en el servidor nuevo, y cuando no lo está, la etiqueta vieja sigue abriendo el objeto. Para mover un servidor entero con todas las cuentas, usa una copia de seguridad en su lugar. Ambas formas están en [moverse a un servidor nuevo](/es/admin/move-server/).
