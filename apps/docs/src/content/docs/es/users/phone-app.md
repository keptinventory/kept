---
title: Kept en tu teléfono
description: Instala Kept en la pantalla de inicio, qué funciona sin conexión, cómo se ven la sincronización y los conflictos, la cámara, el bloqueo de la aplicación y las notificaciones.
---

Kept no tiene aplicación en ninguna tienda. Es una aplicación web que instalas desde el navegador (una PWA): se abre desde su propio icono, a pantalla completa, guarda una copia de tu inventario en el teléfono y funciona sin conexión. Todo en esta página necesita Kept en **HTTPS**: con HTTP sin cifrar, los teléfonos bloquean la cámara, la instalación, las notificaciones push y la ubicación ([HTTPS](/es/install/https/)).

## Instálalo

**Instalar en tu teléfono** en la lista de verificación de Inicio, y **Ayuda → Instalar en tu teléfono**, muestran los pasos para tu dispositivo:

| Dispositivo | Pasos |
|---|---|
| iPhone, iPad | En Safari, toca **Compartir**, luego **Añadir a la pantalla de inicio**, luego **Añadir**. Abre Kept desde su nuevo icono. |
| Android | Abre el menú del navegador (los tres puntos), toca **Instalar aplicación** o **Añadir a la pantalla de inicio**, y abre Kept desde su nuevo icono. |
| Ordenador | En Chrome o Edge, el icono de instalación al final de la barra de direcciones, o **Instalar Kept** en el menú. En Safari en un Mac, **Archivo › Añadir al Dock**. |

La casilla de la lista de verificación se marca sola la primera vez que abres Kept desde su icono. Cuando una nueva versión está lista, Kept muestra **Una nueva versión está lista** con **Recargar**; nunca se recarga sola mientras algo se está subiendo o una captura está abierta.

## Qué funciona sin conexión

El teléfono conserva una copia de cada ubicación a la que perteneces, actualizada cada vez que sincroniza. Las respuestas sin conexión dicen **según la última sincronización** y la hora.

| Funciona sin conexión | Necesita conexión |
|---|---|
| Explorar ubicaciones, habitaciones, cajas y objetos | Editar los detalles de un objeto, ajustes, administración |
| Buscar, etiquetado **En este teléfono** | El asistente y el nombrado con IA |
| Capturar, mover, marcar como visto o ausente | Importaciones, exportaciones e informes |
| Registrar una lectura, añadir una habitación o un lugar | Registrar un servicio (implica dinero) |
| Comprobación de caja, para una caja abierta una vez con conexión | Cualquier cosa con dinero o valores secretos |
| Escanear una etiqueta, reclamar una etiqueta en blanco | |

La copia nunca contiene valores secretos ni datos de contacto de personas. El dinero y los documentos permanecen fuera del teléfono salvo que mantengas una ubicación disponible sin conexión detrás del bloqueo de la aplicación (abajo). Cerrar sesión elimina la copia de esta persona del teléfono.

## La sincronización, tal como la ves

Lo que haces sin conexión entra en una cola y se envía cuando el teléfono vuelve a estar en línea. Una línea bajo el encabezado aparece solo cuando hay algo que decir:

- **Sin conexión, 12 esperando para sincronizar**, o **Sin conexión, según la última sincronización, 14:02**.
- Los objetos nuevos muestran **ID pendiente** hasta que el servidor les da su ID corto; las etiquetas para ellos se pueden imprimir cuando llegue (Etiquetas ofrece **Imprimir etiquetas pendientes**).
- **En iPhone, la cola avanza solo mientras Kept está abierto**: la línea dice **Abrir para terminar de sincronizar (12)**. Deja Kept abierto en pantalla un momento cuando vuelvas a estar en línea.
- **Actualizar Kept para terminar de sincronizar** significa que el servidor es más nuevo que la aplicación: recarga. La cola se conserva.
- **Este navegador puede borrar la copia sin conexión de Kept tras semanas sin usarse**: el teléfono rechazó el almacenamiento permanente de Kept. Abre Kept de vez en cuando para que sincronice.

**Cuando un cambio no puede aplicarse.** Si otra persona eliminó, movió o quitó un objeto mientras estabas sin conexión, tu cambio sobre él se descarta y la línea lo indica, por ejemplo "No se pudo aplicar un cambio: el taladro fue enviado a la papelera por Alfred", con **Restaurar** para intentarlo de nuevo. Otros cambios que requieren una decisión van a la **Bandeja de entrada** ("2 cambios necesitan revisión").

**Cuando ambos editan la misma cosa en línea**, Kept combina los campos que solo uno de los dos cambió y pregunta por el resto: **Mantener el mío**, **Mantener el suyo** o **Editar**.

**Cerrar sesión con capturas sin enviar** te avisa primero: cerrar sesión elimina las capturas que no se han sincronizado. Si tu sesión caduca, el teléfono descarta su copia de tu inventario pero conserva tus capturas sin enviar, bloqueadas, hasta que vuelvas a iniciar sesión. Si otra persona inicia sesión en ese teléfono, Kept indica cuántas capturas esperan de otra cuenta y las elimina solo cuando esa persona acepta.

## Cámara, galería y escaneo

- **Capturar** mantiene la cámara abierta para una toma tras otra. **Galería** selecciona varias fotos a la vez; cada una se convierte en borrador. Si la cámara está bloqueada, Kept explica cómo permitirla, y con HTTP sin cifrar Capturar recurre a elegir archivos.
- Las fotos de iPhone en HEIC se conservan como originales; si alguna no se puede previsualizar, dice **Vista previa no disponible** y nunca se rechaza.
- **Compartir en Kept**: en Android y en Chrome de escritorio, la aplicación instalada aparece en la hoja de compartir, por lo que un recibo o PDF de otra aplicación llega a Capturar. iPhone no permite que las aplicaciones web aparezcan en la hoja Compartir: guarda el archivo y luego usa **Galería** en Capturar.
- **Escanear** lee las etiquetas de Kept y los códigos de barras de productos, también sin conexión, desde la copia del teléfono, y los códigos Data Matrix, Code 39, Code 93, ITF, Codabar, PDF417 y Aztec; un número de serie o una etiqueta de activo abre su objeto cuando estás en línea. La lista completa:
  [IDs cortos y etiquetas](/es/users/everyday-use/#ids-cortos-y-etiquetas).
- **Sugerir dónde estoy**, un interruptor en el selector de lugar de Capturar, compara tu posición con las posiciones de tus ubicaciones en el propio teléfono y sugiere la cercana. Tu posición nunca se envía ni se conserva. Una ubicación tiene posición solo si vino con una en una
  [exportación de Kept](/es/users/import-export/#una-exportación-de-kept): configurarla en la aplicación está por llegar, y hasta entonces una ubicación sin posición nunca se sugiere.
- **Dictar** rellena el nombre por voz donde el navegador lo admite.
- **Configuración → Diagnóstico** comprueba la cámara, el soporte sin conexión y el almacenamiento, y copia un informe de lo que encontró.

## El bloqueo de la aplicación

**Configuración → Este dispositivo → Bloqueo de la aplicación** bloquea Kept en este teléfono con un PIN de 6 a 12 dígitos, y con **Desbloquear con Face ID o huella digital** cuando el teléfono puede verificarte. Con el bloqueo activado, Kept pide el PIN al arrancar en frío y tras 5 minutos oculto o inactivo, en línea o sin conexión.

Face ID o la huella digital aquí desbloquean Kept solo en este dispositivo; nunca te inician sesión. Para iniciar sesión con Face ID o una huella digital, añade una llave de acceso en
[Inicio de sesión y seguridad](/es/users/sign-in-security/).

- Diez PINs incorrectos seguidos eliminan la copia de Kept de este teléfono y cierran tu sesión, conservando tus propias capturas sin enviar. **¿Lo olvidaste? Cierra sesión e inicia sesión de nuevo** hace lo mismo.
- El bloqueo mantiene fuera a alguien que sostiene el teléfono. No detiene a quien haya copiado el almacenamiento del navegador para probar PINs; la página de ajustes lo indica.

**Mantener disponible sin conexión**, en la misma página, añade los precios y documentos de una ubicación a la copia del teléfono, cifrados detrás del bloqueo. Necesita el bloqueo de la aplicación activado, muestra primero el tamaño de la descarga y avisa de que quien desbloquee Kept en el teléfono los verá. Un dispositivo conserva así como máximo 250 MB, con archivos de hasta 25 MB cada uno.

## Notificaciones

En **Configuración → Yo → Notificaciones**, bajo **Este dispositivo**, **Activar** activa las notificaciones push: los recordatorios aparecen aunque Kept esté cerrado. **Prueba** envía una para comprobarlo.

- **iPhone y iPad** envían notificaciones push solo a la aplicación instalada: añade Kept a la pantalla de inicio, ábrela desde ahí y actívalas. Hasta entonces, los recordatorios pueden llegar por correo electrónico.
- Las notificaciones push necesitan HTTPS. Si el servidor no puede enviarlas o el navegador no puede recibirlas, la página lo indica; el correo electrónico y el centro de notificaciones siguen funcionando.
- Las horas de silencio retienen las notificaciones push y el correo electrónico hasta que terminan. Lo que envía cada ubicación, y cómo, se explica en
  [uso cotidiano](/es/users/everyday-use/#recordatorios-y-notificaciones).
