---
title: Problemas comunes
description: "Iniciar sesión, sincronización, la cámara, etiquetas, IA y uso sin conexión: lo que ves y qué hacer."
---

Problemas que puedes tener al usar Kept. Para problemas al ejecutar el servidor, consulta [Solución de problemas](/es/admin/troubleshooting/).

## Iniciar sesión

### Olvidé mi contraseña

En la página de inicio de sesión, escribe tu dirección de correo electrónico y elige **¿Olvidaste tu contraseña?**. Kept te envía un enlace para establecer una contraseña nueva; funciona una vez, durante una hora. Si no te llegó nada: revisa el correo no deseado, o pregúntale a la persona que administra tu Kept si el correo electrónico está configurado. Sin correo electrónico, un administrador de instancia puede crear un enlace de restablecimiento de un solo uso en el servidor con `kept admin reset-password` ([la CLI](/es/admin/cli/)).

Una cuenta administrada (un nombre de usuario, sin correo electrónico) recibe en su lugar un nuevo código de un solo uso, de quien creó la cuenta o del propietario de la ubicación ([personas sin correo electrónico](/es/users/first-run/#personas-sin-correo-electrónico)).

### Un enlace de inicio de sesión no funciona

Un enlace de **Envíame un enlace para iniciar sesión** funciona una vez, durante 15 minutos: pide uno nuevo. Un enlace enviado antes de que actualizaras Kept a la versión 1.14.0 ya no funciona en absoluto, ni tampoco un inicio de sesión de Google o OIDC iniciado antes de eso ([actualizaciones](/es/admin/upgrades/#enlaces-de-inicio-de-sesión-1140)).

### Mi llave de acceso no funciona

- **Las llaves de acceso necesitan HTTPS.** En una dirección `http://` sencilla, el navegador no te ofrece ninguna ([Kept en una red doméstica](/es/install/home-network/)).
- **Una llave de acceso está en el dispositivo que la creó**, o en tu gestor de contraseñas cuando está sincronizada. En otro dispositivo, inicia sesión de otra manera (tu contraseña o **Envíame un enlace para iniciar sesión**), luego añade una llave de acceso allí en **Configuración → Iniciar sesión y seguridad**.
- **"Esa llave de acceso no es una con la que esta cuenta inicie sesión"**: el navegador te ofreció algo más, como el bloqueo de aplicaciones de un dispositivo, que no puede iniciar tu sesión. Inicia sesión de otra manera.

Más información en [Iniciar sesión y seguridad](/es/users/sign-in-security/).

### Perdí mi teléfono, o mis códigos de respaldo

Un código de respaldo es el segundo paso después de tu contraseña, en lugar del código de 6 dígitos de la aplicación de autenticación. Cada uno funciona una vez.

- **Si aún has iniciado sesión en algún lado:** **Configuración → Iniciar sesión y seguridad**. **Nuevos códigos de respaldo** crea diez nuevos (los antiguos dejan de funcionar); **Configurar nuevamente** mueve la autenticación de dos factores a un teléfono nuevo.
- **Si estás bloqueado, sin códigos de respaldo:** pídele a un administrador de instancia. **Restablecer autenticación de dos factores** en **Administrador de instancia → Usuarios** detiene tu aplicación de autenticación y tus códigos de respaldo, y vuelves a configurar la autenticación de dos factores en tu próximo inicio de sesión.

### "Tu cuenta se eliminará el …"

Pidiste eliminar la cuenta, y espera 30 días; hasta entonces no se abre nada más en Kept. **Mantener mi cuenta** detiene la eliminación y devuelve la cuenta a como estaba. Consulta [las preguntas frecuentes](/es/users/faq/#cómo-borro-mi-cuenta).

## Sincronización

### Las capturas de mi teléfono no se muestran

Una captura se guarda primero en el teléfono y se envía cuando el teléfono se sincroniza.

- **En iPhone, la cola solo avanza mientras Kept está abierta.** La línea debajo del encabezado dice **Abrir para terminar de sincronizar** con un recuento: deja Kept en pantalla un momento mientras estás en línea.
- **Sin nombre**, una captura espera en la **Bandeja de entrada**. **Fotos por revisar** en Inicio las muestra.

### La búsqueda dice "En este teléfono, según la última sincronización"

La respuesta provino de la copia del propio teléfono, porque estás sin conexión. Vuelve a conectarte, luego desliza hacia abajo para actualizar.

### Un cambio que hice sin conexión no se aplicó

Si otra persona eliminó, movió o retiró un elemento mientras estabas sin conexión, tu cambio se descarta y la línea lo indica, con **Restaurar** para intentarlo de nuevo. Otros cambios que requieren una decisión van a la **Bandeja de entrada**. Consulta [Sincronización, tal como la ves](/es/users/phone-app/#la-sincronización-tal-como-la-ves).

### La sincronización parece atascada

- Desliza hacia abajo para actualizar, o cierra Kept y ábrelo de nuevo.
- **Actualiza Kept para terminar de sincronizar**: el servidor es más reciente que la aplicación. Vuelve a cargar; la cola se conserva.
- ¿Sigue atascada?: **Configuración → Diagnóstico** comprueba el soporte sin conexión y el almacenamiento y copia un informe. Envíalo a la persona que administra tu Kept.

## Cámara y captura

### La cámara no se abre

Los teléfonos permiten usar la cámara solo en una dirección HTTPS. Sobre `http://` sencillo, Captura recurre a elegir archivos. Instalar Kept, trabajar sin conexión y las notificaciones push también requieren HTTPS. Lo que funciona sobre HTTP sencillo, y dos formas de agregar HTTPS en casa: [Kept en una red doméstica](/es/install/home-network/).

En HTTPS y aún bloqueada, Kept indica cómo permitir la cámara en el navegador.

### La IA no nombró mi elemento

Sin IA, las capturas esperan en la Bandeja de entrada un nombre: nómbralas allí, o consulta [IA](#ia) más abajo.

### La IA lo nombró mal

Lo que la IA completa es una sugerencia. Abre el elemento y corrige el nombre, la marca, el modelo o el tipo.

## Etiquetas

### Una etiqueta no se escanea

Asegúrate de que la etiqueta esté plana y bien iluminada, y limpia la lente de la cámara. **Escribe el código** toma los seis caracteres impresos debajo del código QR, con o sin el guion. Una etiqueta desgastada se vuelve a imprimir con el mismo código ([Identificadores cortos y etiquetas](/es/users/short-ids/)). Una etiqueta en cinta de etiquetadora estrecha no tiene código QR: mantén presionado **Escanear** en su identificador corto impreso, o escríbelo ([escanear un código sin código QR](/es/users/short-ids/#escanear-un-código-sin-código-qr)).

## IA

### "Esperando un proveedor de IA"

Ningún proveedor está conectado para esta ubicación. El trabajo en una ubicación lo paga la clave del propietario, así que el propietario conecta uno en **Configuración → IA**, o un administrador de instancia configura uno para el servidor en **Administrador → IA**. Los miembros y los espectadores no pueden conectar uno para la ubicación de otra persona: la línea indica que pidas ayuda a un administrador. Consulta [Proveedores de IA](/es/users/ai-providers/#dónde-va-la-clave).

### La IA está desactivada en una ubicación

Un propietario o un administrador lo desactivó: **Configuración de ubicación → Qué seguir**, en **IA en esta ubicación**, el interruptor **Captura de IA y el asistente**. Al volverlo a activar, la IA regresa allí.

### "IA en pausa"

Se alcanzó un límite mensual, o alguien eligió **Pausar IA**. Las capturas aún se guardan; el nombre espera y se reanuda con la IA. Quien fijó el límite obtiene **Reanudar ahora**. Los límites están en **Configuración → IA → Avanzado → Límites** ([límites y pausa](/es/users/ai-providers/#límites-y-pausas)).

### La IA cuesta demasiado

Establece un límite mensual en **Configuración → IA → Avanzado → Límites**, elige un modelo más económico en **Avanzado → Modelos**, o ejecuta un modelo local con [Ollama](/es/admin/ollama/).

## Sin conexión

### Algo no funciona sin conexión

Trabajar sin conexión requiere que Kept esté instalado desde una dirección HTTPS. Navegar, buscar y capturar funcionan sin conexión; editar detalles, el asistente, los informes, el mapa, el gráfico y cualquier cosa relacionada con dinero requieren una conexión. La lista completa: [lo que funciona sin conexión](/es/users/phone-app/#qué-funciona-sin-conexión).

## Obtener ayuda

- **Preguntas e ideas:** [Discusiones](https://github.com/keptinventory/kept/discussions)
- **Un error:** [un problema](https://github.com/keptinventory/kept/issues/new/choose), con lo que hiciste y lo que viste
- **Ayuda en Discord:** [el servidor de Kept](https://discord.gg/g4WCXPfuNv), en #help: un problema por publicación, tu versión de Kept y cómo lo ejecutas (Docker Compose, Kubernetes), qué sucedió, y registros con secretos y datos personales difuminados
- **Un problema de seguridad:** en privado, nunca en un problema público ([SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md))
