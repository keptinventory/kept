---
title: Ubicaciones, salas y cajas
description: "El árbol en el que todo está: ubicaciones, salas y lugares, cajas y contenedores, Sin ubicar, los diseños de una ubicación (Lista, Cuadrícula, Grafo, Tabla, Mapa), y Seleccionar para muchas cosas a la vez."
---

Todo está en un árbol: una ubicación (Home, Garaje, una unidad de almacenamiento) contiene **salas y
lugares** ("sala o lugar" es la palabra de Kept para cualquier sitio), que contienen **objetos**. Un objeto puede ser una
**caja / contenedor** que contiene otros objetos, tan profundo como quieras. Cada ubicación también tiene
**Sin ubicar**, para objetos que aún no tienen un lugar.

- En una ubicación, sala o caja, **Añadir aquí** agrega un **Objeto**, una **Caja / contenedor** o una **Sala o
  lugar**, o [mueble con compartimentos](#muebles-con-compartimentos).
- Las listas tienen un cuadro de búsqueda, **+ Filter**, vistas guardadas **Vistas**, y un botón **Visualización** para el
  orden y el agrupamiento. Los filtros están en la dirección, así que una lista filtrada se puede marcar o compartir.
- **Seleccionar** (junto al cuadro de búsqueda, para quien pueda editar objetos) marca objetos en la lista de una
  ubicación, lugar o caja, en Lista o Cuadrícula. **Shift-click** en la casilla de una fila (o **Shift+Space** en
  ella) para marcar todas las filas desde la última que marcaste. Luego: **Mover**, **Agregar etiquetas…** o **Quitar
  etiquetas…**, **Establecer un campo…**, **Recoger** (en la bandeja), **Imprimir etiquetas**, **Añadir a incidente** y
  **Paquete de reclamación** (dueños y administradores, cuando recibos y garantías están activados), o **Mover a la
  papelera**. La barra es la [Tabla](/es/users/spreadsheet/).
- **Establecer un campo…** da a cada objeto marcado un valor: tipo, marca, modelo, estado y el
  resto. Los cambios esperan, marcados **Aún no guardado**, hasta **Guardar N cambios**; un **Deshacer** deshace
  todo lo guardado. Necesita una conexión. Si alguien cambió uno de ellos mientras tanto, ese
  espera: **Mantener el mío** o **Mantener el suyo**.
- **Mover a la papelera** acepta hasta 200 a la vez y necesita una conexión. Pregunta primero qué pasa
  con lo que hay dentro de una caja (sacarlo, o ponerlo también en la papelera) y sobre cualquier cosa prestada, luego un
  **Deshacer** los trae a todos de vuelta.
- **Orden:** los lugares y objetos se leen **De la A a la Z** con los números en orden (Caja 2 antes que Caja 10), igual
  en la app, sin conexión, en las exportaciones y para las apps de IA. Los pisos conservan el orden en que se crearon: el
  primero es la planta baja en el mapa. En un lugar, **Visualización → Objetos: ordenar por** ordena sus
  objetos; sus lugares se quedan **De la A a la Z**.
- **Tu propio orden:** en un lugar, **Gestionar → Orden de los lugares aquí → Orden personalizado** pone los
  lugares de dentro en el orden que elijas, con **Subir** y **Bajar** en cada uno (también con el teclado). **De la A a la Z**
  vuelve en cualquier momento, y cambiar a **Orden personalizado** otra vez trae tu orden de vuelta. El árbol, el mapa, las exportaciones y las apps de IA lo siguen. El nivel superior de una ubicación se queda **De la A a la Z**.
- **Convierte lugares en cajas…** en el **Gestionar** de un lugar lista los lugares de dentro: marca algunos, o
  **Seleccionar todo**, y se convierten en cajas en un paso, cada uno conservando su ID, etiqueta y contenido. Un
  lugar con lugares dentro no se puede marcar: una caja solo contiene objetos. El **Deshacer** del aviso los convierte
  de nuevo en lugares, como estaban; se queda en el historial durante 7 días.
- **El asistente y las apps de IA** pueden hacer lo mismo: renombrar un lugar, cambiar su tipo, moverlo,
  establecer sus campos y el orden de los lugares en él, y convertir lugares en cajas (`update_place` y
  `turn_into_boxes`, [clientes MCP](/es/users/mcp-clients/)). El asistente muestra una tarjeta para confirmar
  primero; Deshacer funciona como en la app.
- **El árbol de lugares** (al lado de la página en una computadora, **Todos los lugares** en un teléfono) muestra las cajas bajo
  su lugar con cuántos objetos hay en cada una, hasta 50 por lugar, luego **+N cajas**. La flecha
  junto a un lugar pliega lo que está debajo; **Contraer todo** y **Abrir todo** hacen cada lugar a la vez.
  Kept recuerda tus pliegues para tu cuenta, en cada dispositivo. Los lugares por encima de la página en la que
  estás se quedan abiertos, incluso después de **Contraer todo**.
- **Su ancho** (en una computadora, desde 1280 px de ancho): arrastra la línea en el borde del árbol, o enfócala
  y usa las teclas de flecha, Inicio y Fin. **Contraer lugares**, el botón en la parte superior del árbol,
  lo pliega para dejar toda la página libre; **Expandir lugares** lo trae de vuelta. Este dispositivo recuerda
  ambos.
- En una ubicación, **Ordénalos** recorre Sin ubicar un objeto a la vez con un seleccionador de lugares.
- Una caja abierta desde su etiqueta muestra una cuadrícula de fotos de lo que hay dentro.
- **Diseños:** la página de una ubicación cambia entre **Lista**, **Cuadrícula**, **Grafo**, **Tabla** y
  **Mapa**, cada uno con su icono. **Grafo** dibuja la ubicación como un grafo de sus pisos, salas, cajas
  y objetos, en 2D o 3D ([El grafo](/es/users/graph/)). **Tabla** muestra sus objetos como una hoja de cálculo,
  en una pantalla de 1024 px de ancho o más ([La hoja de cálculo](/es/users/spreadsheet/)), así que un teléfono muestra
  Lista · Cuadrícula · Grafo · Mapa. **Mapa** muestra la ubicación en 3D, piso por piso, con sus salas,
  estantes y cajas ([El mapa de la ubicación](/es/users/location-map/)). El menú **Visualización** de la lista ofrece
  la misma opción. La página de un lugar (no Sin ubicar) también tiene el interruptor, sin Tabla. Kept
  recuerda el diseño para cada ubicación y cada lugar en ese dispositivo.
- **Cuadrícula** muestra los lugares y objetos de una ubicación o sala como fichas, bajo los mismos encabezados **Lugares** y
  **Objetos** que Lista; cada encabezado se pliega. **Visualización → Tamaño** elige **Pequeño**, **Medio** o **Grande** (3, 2 o 1 por fila en un teléfono), y Kept recuerda tu tamaño en ese
  dispositivo.
- En una computadora o tableta, la barra lateral marca la ubicación en la que estás: en su página, y en sus
  salas, objetos, cajas y configuración.

![Una ubicación en Cuadrícula con fichas Pequeñas: el encabezado Lugares · 9 sobre las salas, luego el encabezado Objetos · 20+ sobre los objetos, seis fichas por fila, cada una solo con su nombre](../../../../assets/screens/grid-desktop-light.webp)

![La misma cuadrícula en el tema oscuro](../../../../assets/screens/grid-desktop-dark.webp)

Los enlaces usan IDs, nunca la ruta, así que mover un objeto nunca rompe un enlace a él.

## Muebles con compartimentos

Un estante de cubos, una estantería o una cómoda es un lugar, y cada cubo, estante o cajón es un
lugar dentro de él, con su propio nombre, etiqueta y, si quieres, su propio código.

- **Añadir aquí → Sala o lugar → Mueble con compartimentos…** crea el mueble y todos sus
  compartimentos en un solo paso. Elige una plantilla: un estante de cubos 1 × 4, 2 × 2, 2 × 4, 4 × 4 o 2 × 8,
  una estantería (6 estantes), una cómoda (9 cajones) o un estante modular (4). Cambia el número de
  estantes o cajones antes de agregarlo. El tipo del mueble es **Muebles**; sus compartimentos
  son **Cubo**, **Estante** o **Gaveta**.
- **Cómo se coloca:** un estante de cubos que no es cuadrado puede estar **De pie** o tumbado **De lado**.
  Un 2 × 4 de pie son 4 filas de 2; de lado, 2 filas de 4. Los compartimentos se construyen según cómo se coloca.
- **Conteo:** desde la esquina superior izquierda, fila por fila, como lo ves frente a ti. Un 4 × 4 es Cubo 1
  hasta Cubo 16; un 2 × 4 de lado tiene del 1 al 4 en la fila superior y del 5 al 8 debajo. La hoja muestra los
  números antes de que lo agregues. **Nombres de compartimento** usan `{n}` para el número, `{row}` y
  `{col}` para dónde está.
- **Códigos:** **Su propio código** le da al mueble un código (`KX01`), y **Códigos de compartimento** un
  patrón para los compartimentos, como `{parent}-F{col:02}{row:02}`: `{parent}` es el
  código del mueble, `{col:02}` la columna con dos dígitos. Un 4 × 4 obtiene entonces `KX01-F0101` hasta `KX01-F0404`. Cada código se verifica contra la regla de formato de la ubicación (**Configuración → la ubicación → General → Tus propios códigos**) y
  contra los códigos que ya están; si uno no encaja, no se crea nada y Kept nombra el código.
  Escanear o buscar un código encuentra su compartimento.
- **Deshacer:** el **Deshacer** del aviso pone el mueble y sus compartimentos en la papelera y libera
  sus códigos, siempre que no se haya agregado nada en ellos ni se haya cambiado nada desde entonces.
- **Etiquetas:** en el mueble nuevo, **Etiqueta todo aquí** imprime una etiqueta para él y para cada
  compartimento, en orden de conteo.
- **Su página** muestra los compartimentos como se coloca, numerados como están sus etiquetas. Toca uno para abrirlo.
  **Imprimir sus etiquetas** imprime todos de nuevo, en orden de conteo, con los nombres que tienen ahora.

### Girar el mueble

**Gíralo…** en la página del mueble, para un estante de cubos que no es cuadrado.

- **Su parte superior se fue:** **A la derecha** o **A la izquierda**, según lo mires de frente. Cada compartimento se mueve
  con la unidad, con sus objetos y su etiqueta impresa.
- Cada vez se pregunta sobre sus compartimentos, porque las etiquetas ya están puestas:
  - **Renumerar:** cada compartimento obtiene el número, nombre y código del lugar donde ahora está, contado
    de nuevo desde la esquina superior izquierda. Un código antiguo aún funciona: abre el compartimento que ahora está en el lugar que nombró. Vuelve a imprimir las etiquetas para los nuevos nombres.
  - **Mantén los códigos:** solo cambia cómo se coloca. Cada compartimento conserva su número, nombre y
    códigos.
- La hoja muestra la nueva cuadrícula antes de girarlo. Un nombre o un código que escribiste tú se queda con
  su compartimento en cualquier caso.
- **Deshacer** lo devuelve atrás, números, nombres y códigos incluidos, siempre que nada en él haya cambiado
  desde entonces.

### Combinar y dividir compartimentos

Un inserto de cubo o un estante retirado une dos o más compartimentos en uno.

- **Fusionar o dividir…**, luego toca compartimentos uno al lado del otro que formen un rectángulo, y **Combinar**.
  El de la esquina superior izquierda se queda, con su número, nombre y código. Los demás van a la papelera; sus códigos
  y etiquetas impresas abren el compartimento combinado, y lo que había en ellos se mueve a él.
- Para dividir un compartimento combinado, tócalo y **Dividir**. Cada celda regresa con su código y su
  etiqueta; los objetos se quedan en el de la esquina superior izquierda.
- **Deshacer** revierte cualquiera de las dos acciones.
- **Tus propias plantillas:** **Configuración → Cuenta → Plantillas → Muebles** tiene las plantillas de lugar propias
  de la cuenta: cubos a lo ancho y hacia arriba (de pie), estantes o cajones, los tipos, los nombres y
  el patrón de código, compartidos con las ubicaciones que elijas. Los dueños y administradores las crean; cualquiera que
  pueda agregar lugares las usa.
- **Las apps de IA** pueden hacer lo mismo: `create_place` toma una `template`, y `update_place` un `turn`
  ([clientes MCP](/es/users/mcp-clients/#las-herramientas)). Combinar y dividir se quedan en la app.

## Ocultar Personal

Todos obtienen una ubicación **Personal**. Si no te sirve, activa **Ocultar Personal** en
**Configuración → Yo → Tus ubicaciones**, y desactívalo para volver a mostrarlo en cualquier momento. Es tu propia
preferencia: nadie más ve un cambio.

- **Desaparece de:** las ubicaciones del menú, Home, listas, búsqueda y sus filtros. Un módulo que solo
  rastrea Personal (Vehículos, por ejemplo) sale del menú con él.
- **Sin cambios:** todo lo que hay en ella. Un enlace a Personal o a un objeto en ella todavía lo abre. Ocultar
  es ordenar, no protección: no bloquea nada.
- **Los recordatorios aún te llegan**, como notificaciones, en el resumen y en la fuente del calendario. Désactívalos
  en **Configuración → Yo → Notificaciones**, donde Personal sigue apareciendo.
- **Capturar** comienza en tu otra ubicación, o en Personal si no puedes agregar objetos en ningún otro lado.
- **Importar** ofrece las otras ubicaciones que posees o administras, o Personal si no hay ninguna. Una
  importación pasada aún se abre desde Actividad, sin importar adónde fue.
- **Mantener disponible sin conexión** en **Configuración → Este dispositivo** conserva la fila de Personal mientras su copia está en el dispositivo, así que puedes desactivarlo.
- **Exportar mis datos** lleva la primera otra ubicación que posees, y Personal permanece en **Exportar una
  ubicación**. Si no posees ninguna otra ubicación, lleva Personal.
- **Tu clave personal de IA** también paga por una ubicación que posees y usas solo, cuando la cuenta de esa
  ubicación no tiene una clave propia. Nunca paga por una ubicación compartida.
- **El asistente** deja fuera Personal, a menos que lo abras desde Personal. **Conexiones** (tokens
  personales y apps conectadas) conservan las ubicaciones que les diste, ocultas o no.

No puedes ocultarla mientras sea tu única ubicación. Si se convierte en tu única ubicación después (te
vas, te eliminan, se elimina la otra ubicación), vuelve a mostrarse sola, y se oculta de nuevo cuando tengas otra.

## Relacionado

- [Uso diario](/es/users/everyday-use/) para ver el panorama general.
- [Etiquetas](/es/users/tags/) para qué es un objeto además de dónde está.
- [Compartir una ubicación](/es/users/everyday-use/#compartir-una-ubicación) para dejar entrar a la gente a una.
