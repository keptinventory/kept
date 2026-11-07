---
title: Tus primeros minutos
description: Reclama un Kept nuevo con su código de configuración, crea tu primer hogar, añade objetos, invita a personas y elige un idioma y un tema.
---

Esta página empieza una vez que Kept está en marcha y puedes abrir su dirección. La instalación se explica en
[Instalar con Docker Compose](/es/install/compose/).

## 1. Reclama el servidor con el código de configuración

La primera vez que Kept arranca sin administrador, imprime un código de configuración de un solo uso en sus registros, como
`KEPT SETUP CODE: K7Q-2M9`. Al abrir la dirección de Kept, vas a **Configurar este Kept**, en tres pasos:

1. **Código de configuración.** Escribe los seis caracteres. El guion es opcional y no importa si usas mayúsculas o minúsculas. El código
   deja de funcionar una vez que se usa. ¿Perdiste los registros? `kept admin setup-code` genera uno nuevo
   ([cómo, en Compose](/es/install/compose/#3-termina-la-configuración)).
2. **Primera cuenta.** Tu nombre, correo electrónico y una contraseña de al menos 8 caracteres. Esta cuenta es el
   **administrador de la instancia**: ejecuta el servidor (usuarios, registro, copias de seguridad). No puede ver dentro del hogar de nadie a menos que lo inviten.
3. **Opciones de instancia.** Un interruptor: **Deja que cualquiera con la dirección cree una cuenta**. Déjalo
   desactivado para un hogar: la gente se une mediante una invitación, o tú las añades. Puedes cambiarlo más tarde en
   Configuración → Administrador.

**Terminar configuración** te lleva a Inicio.

:::caution[Termínalo enseguida]
Hasta que la configuración termine, cualquiera que pueda abrir la dirección podría intentar reclamar el servidor.
:::

La IA y la búsqueda de códigos de barras no forman parte de la configuración. Kept funciona sin ellas, y puedes conectar la IA más tarde
([Proveedores de IA](/es/users/ai-providers/)).

## 2. Lee la lista de inicio de Inicio

Inicio se abre con **Comenzar**, una línea con tu progreso y el siguiente paso, calculada a partir de lo que realmente has hecho, así que los pasos se marcan solos. La flecha abre los pasos:

| Paso | Lo que pide |
|---|---|
| **Pon Kept en HTTPS** | Se muestra al administrador de la instancia mientras Kept se sirve por HTTP sin cifrar. Los teléfonos bloquean la cámara, la instalación de Kept, las notificaciones push y la ubicación por HTTP. Consulta [HTTPS](/es/install/https/). |
| **Crear tu primer hogar** | Una ubicación, más abajo. |
| **Añadir 3 objetos** | Algunos que odiarías perder de vista. |
| **Imprime tu primera etiqueta** | Cuando Etiquetas está activado en una ubicación. |
| **Invitar a alguien** | Un enlace o un código QR; nadie necesita correo electrónico. |
| **Conectar un proveedor de IA** | No se muestra a los miembros invitados, ni en una ubicación con el ajuste predeterminado Esenciales. |
| **Instalar en tu teléfono** | Se marca solo la primera vez que abres Kept desde el icono de la pantalla de inicio. |

**×** lo oculta para siempre; **Ayuda → Lista de inicio → Traerlo de vuelta** lo muestra de nuevo. Desaparece por sí solo cuando todos los pasos están hechos. Más sobre Inicio en [uso diario](/es/users/everyday-use/#hogar).

## 3. Crea tu primer hogar

Todos tienen una ubicación **Personal** desde el inicio: es solo tuya (sin miembros, invitaciones ni
enlaces compartidos) y es donde llega una captura sin ubicación. Cámbiale el nombre en **Configuración de ubicación →
General**, y Kept muestra el nuevo nombre en todas partes. Una vez que tengas otra ubicación, puedes [ocultar
la](/es/users/locations/#ocultar-personal) en **Configuración → Yo → Tus ubicaciones**. Los objetos compartidos pertenecen a
una ubicación propia. Elige **Crear tu primer hogar** (o **Nueva ubicación** en Inicio):

1. **¿Cómo se llama este lugar?** Un nombre, como Hogar o Garaje, y su tipo: Casa, Apartamento,
   Garaje, Trastero, Oficina, Casa de vacaciones u Otro.
2. **Salas.** La plantilla del tipo rellena salas y zonas; cambia el nombre, quita o **Añadir habitación o zona**.
   Todas las ubicaciones también tienen **Sin ubicar**, para objetos que aún no tienen un lugar. **Saltar** conserva solo
   Sin ubicar.
3. **Qué seguir.** Tres ajustes predeterminados:
   - **Esenciales**: encontrar objetos: salas, cajas, etiquetas y búsqueda.
   - **Hogar**: añade recibos y garantías, recordatorios, préstamos, documentación y vehículos.
   - **Completo**: añade combustible, objetos que se agotan, contraseñas y códigos, mudanza y
     «Conectar ChatGPT o Claude».

La zona horaria y la moneda vienen de tu navegador. Cámbialas, y activa o desactiva módulos individuales,
en la **Configuración de ubicación** de la ubicación (**General** y **Qué seguir**). Desactivar un módulo
lo oculta; no se borra nada.

## 4. Añade tu primer objeto

La forma más rápida es **Capturar**, la pestaña del medio en el teléfono: apunta la cámara, pulsa el obturador,
y el objeto se guarda donde diga la ficha de lugar de arriba. Un nombre es opcional mientras capturas:
con un proveedor de IA conectado, Kept le pone nombre a partir de la foto; sin uno, los objetos sin nombre esperan
en la **Bandeja de entrada** un nombre. En una computadora, **Añadir aquí** en una sala o caja añade un objeto con un formulario.
[Uso diario](/es/users/everyday-use/) cubre la captura, las etiquetas y el resto.

## 5. Invita a personas

Compartir se hace por ubicación: alguien a quien invitas a Inicio ve Inicio, y nada más tuyo.
Después de crear una ubicación, Inicio muestra una tarjeta **Invitar a personas a …**; la misma página está en
**Configuración de ubicación → Miembros → Invitar**.

1. Elige el **Rol** y, en **Acceso**, **Sin fecha de fin** o **Hasta una fecha**. Su acceso, y
   cualquier token que creen, se detiene en esa fecha.
2. **Crear enlace de invitación.** Consigues el enlace con **Copiar enlace** y un código QR para **Escanear con su
   teléfono**. El enlace funciona una vez, durante 7 días, y aparece en Miembros como una invitación pendiente hasta que se
   use, donde puedes revocarlo.
3. **Enviar por correo** funciona solo cuando el servidor tiene correo configurado (`KEPT_SMTP_URL`).

La persona abre el enlace, luego se une con su cuenta o crea una; mientras el registro esté cerrado,
la invitación es la única forma de crear una cuenta.

### Los roles

| Rol | Lo que pueden hacer en esa ubicación |
|---|---|
| **Propietario** | Todo, incluidas las reglas de autenticación de dos factores, la transferencia y la eliminación. Hay un solo propietario. |
| **Administrador** | Invitar y eliminar miembros y espectadores, configuración y módulos, importación y exportación, enlaces compartidos y paquetes de reclamación, eliminar permanentemente. Solo el propietario concede o elimina administradores. |
| **Miembro** | Añadir, editar, mover, prestar y desechar objetos; registrar lecturas y servicios; imprimir etiquetas; usar captura con IA. El dinero es visible. |
| **Espectador** | Solo mirar y buscar. El dinero está oculto a menos que la ubicación permita a los espectadores verlo; el asistente responde pero no puede cambiar nada. |

La matriz completa es `MATRIX` en
[`packages/shared/src/roles.ts`](https://github.com/keptinventory/kept/blob/main/packages/shared/src/roles.ts).

### Personas sin correo electrónico

Para un niño o un padre sin correo, un propietario o administrador usa **Añadir a alguien sin correo** en la
página de Miembros. Kept crea una **cuenta administrada** con un nombre de usuario y muestra un código de un solo uso (funciona
una vez, durante 30 minutos). La persona accede con **Tengo un código de un solo uso**, su nombre de usuario y el
código, y elige su propia contraseña; tú nunca la ves. Quien creó la cuenta (mientras sigue siendo
propietario o administrador allí), o el propietario de esa ubicación, puede emitir un código nuevo más tarde, lo que cierra la
sesión de la cuenta en todas partes. La persona puede añadir un correo para hacerse cargo de la cuenta. Una cuenta administrada no puede ser dueña de una ubicación, y una ubicación
tiene como máximo 20 de ellas.

## 6. Idioma y tema

**Configuración → Yo → Visualización** guarda las opciones de visualización del dispositivo, aplicadas antes de que se dibuje la página:

- **Idioma**: العربية, Deutsch, English, Español, Français, Italiano, Українська o Tiếng Việt.
  Abre la lista, o escribe para encontrar uno: su propio nombre, su nombre en inglés o en el idioma que estés
  usando, y los pequeños errores tipográficos están bien (`german`, `deutsch` y `francais` funcionan todos). El árabe diseña toda la aplicación
  de derecha a izquierda. Las páginas de inicio de sesión tienen el mismo selector. Los correos y los recordatorios siguen el idioma que elegiste por última vez.
- **Dígitos en árabe**: Occidentales (0123) u orientales (٠١٢٣), mostrados solo mientras el idioma es árabe.
  Los ID cortos y los números de serie siempre se mantienen en dígitos occidentales.
- **Región**: **Estados Unidos** (29 oct) o **Reino Unido** (29 oct, 29/10/2026), mostrado solo
  mientras el idioma es inglés.
- **Formato de fecha**: **Predeterminado** (29 oct, con el año solo para otros años), 29 oct 2026,
  29/10/2026 o 2026-10-29 (como los escribe el Reino Unido). Cada opción muestra la fecha de hoy
  escrita así, en tu región. Las fechas de compra y
  garantía siempre muestran el año.
- **Tema**: **Sistema** (sigue el ajuste claro u oscuro del dispositivo), **Claro** u **Oscuro**.
- **Ancho del contenido**: **Centrado** o **Ancho completo**, en pantallas de 768 px o más anchas.

## 7. Toma el tour

**Ayuda → El tour** te guía por Kept en las pantallas reales, en capítulos cortos de tres a seis
pasos cada uno:

| Capítulo | Qué muestra |
|---|---|
| Aspectos básicos | Inicio, tus ubicaciones, Escanear, Buscar, y dónde está todo lo demás |
| Objetos y lugares | añadir a una ubicación, qué contiene, y la página de un objeto y sus pestañas |
| Gráfico y mapa 3D | el conmutador Lista · Cuadrícula · Gráfico · Tabla · Mapa (Tabla en una computadora), el gráfico en 2D o 3D, 3D o planta, pines, pisos y Organizar, donde una sala se mueve con lo que contiene |
| Capturar y Bandeja de entrada | elegir qué capturar, el obturador, y revisar lo que Kept leyó |
| Escaneo | una sesión de escaneo: contar, empacar o mover, dónde, y qué cambia Finalizar |
| Búsqueda y etiquetas | el campo de búsqueda, vistas guardadas, Seleccionar (mover, imprimir etiquetas, Mover a la papelera), imprimir etiquetas y Escanear, que puede poner una etiqueta en blanco en un lugar que tengas |
| Mudanza | iniciar una mudanza, sus cajas, y dónde están |
| Préstamos | qué está prestado, Marcar como devuelto, y Prestar un objeto |
| Horarios y recordatorios | un nuevo horario, qué vence, Completo, y cómo te llegan los recordatorios |
| Documentación y garantías | la biblioteca de documentación, qué está por vencer, añadir un archivo, reclamaciones |
| Vehículos y combustible | la lista de vehículos, registrar una lectura o un servicio, los servicios que puedes abrir, y combustible |
| Importación y exportación | de dónde proviene una importación, el archivo, y exportar |
| Configuración y uso compartido | notificaciones, tus ubicaciones, invitar a personas, qué seguir |

Solo se muestran los capítulos que tienes: el capítulo de un módulo se muestra mientras está activado en una de tus
ubicaciones, y un espectador no recibe pasos que cambien nada.

- Arriba: cuántos capítulos están hechos, con una barra delgada, y **Tomar el tour**. Una vez que algunos están
  hechos, dice **Continuar el tour** y comienza desde el primer capítulo que no hayas terminado.
- Debajo, una fila corta por capítulo: su número y sus pasos. Toca una fila para iniciar el tour en
  ese capítulo. Los capítulos terminados se pliegan bajo **Listo (N)**; ábrelo para reproducir uno de nuevo.
- El tour comienza desde Ayuda. La barra superior de una página se mantiene con las herramientas propias de esa página; una sesión
  de escaneo tiene **Iniciar una sesión** con un pequeño **Enséñame** para su capítulo.
- El emergente muestra dónde estás: «Capítulo 3 de 12 · paso 2 de 5».
- **Siguiente** avanza, **Atrás** retrocede dentro del capítulo, las teclas de flecha hacen ambas cosas, y **Esc**
  o **×** lo cierran.
- El último paso de un capítulo nombra al siguiente: **Continuar** entra directamente en él, **Detén aquí**
  termina el tour allí. El último capítulo termina con **Listo**.
- La página sigue funcionando mientras el tour se ejecuta: toca cualquier cosa fuera del resaltado. Ir a algún
  lugar que el tour no abrió lo cierra.
- Un capítulo terminado dice **Listo** en Ayuda, en todos los dispositivos. Un capítulo que cierras a medio camino comienza
  desde su primer paso la próxima vez.
- Un capítulo que necesita mostrar algo y no encuentra nada crea un ejemplo claramente llamado, como
  «Muestra: Taladro inalámbrico». Cuando el tour termina, eliges conservarlo o descartarlo; nunca
  toca lo que ya tienes.
- El tour nunca se inicia solo.

Algunas sugerencias de una sola vez también aparecen la primera vez que usas Capturar, Escanear, los valores
sugeridos de la Bandeja de entrada o las Etiquetas.

Después de que Kept se actualice, **Qué hay de nuevo en Kept** muestra los aspectos destacados de esa versión, una vez por versión
para cada persona, en todos los dispositivos: uno por diapositiva, con una imagen o un clip corto, su título y una
línea. **Siguiente** y **Atrás**, los puntos, las teclas de flecha o un deslizamiento se mueven entre ellos; el
**Entendido** de la última diapositiva la oculta, y **Ayuda → Qué hay de nuevo** la muestra de nuevo. Los clips se reproducen en silencio y
se pueden pausar; con el movimiento reducido activado, se quedan quietos hasta que presiones **Reproduce**. Sin conexión, una
diapositiva muestra el icono de su sección en lugar de su imagen. Nunca se muestra en una cuenta nueva, ni sobre
Capturar o Escanear. Los aspectos destacados están en inglés en todos los idiomas, con un enlace a las notas de
la versión completas en GitHub.

:::tip[Guarda las claves]
Antes de la primera clave de IA, valor secreto o copia de seguridad, Kept espera hasta que el administrador de la instancia haya guardado el
[kit de recuperación](/es/admin/recovery-kit/) (Administrador → Estado lo solicita). Sin el kit, una copia de seguridad no puede
restaurar claves de IA ni contraseñas guardadas en un servidor nuevo.
:::
