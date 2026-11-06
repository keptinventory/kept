---
title: Preguntas y respuestas
description: Respuestas cortas a las preguntas que la gente hace antes y después de instalar Kept, cada una con un enlace a la página que tiene el detalle.
---

## ¿Kept envía algo sobre mí o mi servidor a algún lugar?

No. No hay telemetría de ningún tipo, ni siquiera un conteo opcional de instalaciones. La
verificación de actualizaciones está desactivada hasta que un administrador la active, y entonces
envía solo la solicitud de la última versión. La búsqueda de códigos de barras y la IA también
están desactivadas hasta que alguien las conecte. Ver [observabilidad](/es/admin/observability/) y
[actualizaciones](/es/admin/upgrades/).

## ¿Dónde se almacenan mis datos?

En tu servidor: la base de datos en Postgres, y los archivos (fotos, recibos, documentos) en el
volumen de datos de Kept o en un bucket de S3 que elijas. Tu teléfono guarda una copia para uso
sin conexión, sin valores secretos. Ver [almacenamiento de archivos](/es/admin/storage/) y
[la aplicación del teléfono](/es/users/phone-app/).

## ¿Cómo borro mi cuenta?

Configuración → Yo → Eliminar mi cuenta, con tu contraseña. Primero entrega cada ubicación que
poseas (distinta de Personal) a otra persona, o bórrala; el único administrador de la instancia
debe nombrar a otro administrador primero. Luego la cuenta espera 30 días: al iniciar sesión se
muestra la fecha y una forma de conservarla, y nada más se abre. Después se borra junto con tu
ubicación Personal. Lo que añadiste a las ubicaciones de otras personas permanece ahí. [Exporta
tus datos](/es/users/import-export/#exportar) primero si quieres una copia.

## ¿Puedo usarlo sin IA?

Sí. Todo funciona excepto nombrar cosas a partir de fotos, leer recibos, el asistente y la
búsqueda por significado. Sin un proveedor, las cosas capturadas esperan en la Bandeja de entrada
un nombre, y la búsqueda usa palabras clave. Ver [proveedores de IA](/es/users/ai-providers/).

## ¿Qué proveedores de IA funcionan y quién paga?

Groq (recomendado), OpenAI, Anthropic, Google, OpenRouter, o cualquier servidor compatible con
OpenAI como Ollama. Usas tu propia clave; el trabajo en una ubicación lo paga la clave del dueño
de esa ubicación, y puedes limitar el gasto. Ver [proveedores de IA](/es/users/ai-providers/).

## ¿Funciona sin conexión?

En un teléfono con Kept instalado, sí para buscar y capturar: navegación, búsqueda, captura,
mover cosas, lecturas, comprobaciones de cajas y escaneo de etiquetas. Las ediciones de detalles,
informes, importaciones y exportaciones necesitan conexión. Lo que hagas sin conexión se sincroniza
al volver. Ver [Kept en tu teléfono](/es/users/phone-app/#qué-funciona-sin-conexión).

## ¿Hay una aplicación en la App Store o en Google Play?

No. Kept es una aplicación web que añades a la pantalla de inicio desde el navegador. Necesita que
Kept esté en HTTPS. Ver [Kept en tu teléfono](/es/users/phone-app/#instálalo) y [HTTPS](/es/install/https/).

## ¿Funciona en arm64 o en una Raspberry Pi?

Las imágenes se construyen para amd64 y arm64, así que los servidores ARM y Docker en Apple
Silicon las ejecutan. Una Raspberry Pi con 1 GB o más puede servir, más lenta; ninguna versión ha
sido probada en una. Kept se prueba con 1 GB de RAM y uno o dos núcleos de CPU (arm64). Ver
[lo que se probó](/es/install/hardware/).

## ¿Cuántas personas pueden usar un Kept?

Kept se dimensiona por objetos, no por personas: sus objetivos son 10.000 objetos en una ubicación y
50.000 en una instancia; la prueba de 1 GB usó 3.000 en una ubicación. Las personas se unen a una
ubicación por invitación, y cada ubicación también puede tener hasta 20 cuentas gestionadas para
personas sin correo electrónico. Ver [lo que necesita](/es/install/hardware/) y
[invitar personas](/es/users/first-run/#5-invita-a-personas).

## ¿Puedo tener más de un hogar, o compartir solo parte de mis objetos?

Sí. Cada ubicación (una casa, un garaje, un trastero, la casa de un padre) se comparte por
separado, con sus propios miembros y roles; compartir el garaje no comparte nada más. Una persona
puede pertenecer a muchas ubicaciones, y todos tienen una ubicación Personal privada. Ver
[tus primeros minutos](/es/users/first-run/#5-invita-a-personas).

## ¿En qué se diferencia Kept de Homebox?

Ambos llevan la cuenta de lo que tienes y dónde está. Kept además tiene:

- **Un mapa 3D** de tus pisos, habitaciones, estanterías y cajas.
- **Vehículos**: lecturas, servicios, combustible y sus costos.
- **Recordatorios** para garantías, servicios, préstamos y stock bajo.
- **Uso sin conexión** en tu teléfono, con etiquetas que imprimes y escaneas.
- **IA, si quieres**: captura desde una foto, y un servidor MCP para asistentes.

Importa un respaldo de Homebox, así que puedes probarlo con tus propios objetos.

## ¿Puedo migrar desde Homebox?

Sí. Desde Homebox v0.26.1 o más reciente (se recomienda v0.27.0), haz un respaldo en Homebox (**Colección →
Herramientas → Copia de seguridad y restauración → Crear copia de seguridad**, luego **Descargar**), importa ese ZIP en Kept, revisa lo que va a pasar, luego
importa. Fotos, recibos, garantías, mantenimiento y etiquetas pasan, y las etiquetas antiguas de Homebox
siguen escaneando. Un artículo entra como vendido solo cuando Homebox tiene un comprador o un precio para él (una fecha de venta
sola permanece en sus notas), y los artículos archivados entran como **Archivado** a menos que elijas **En
uso** o **Dejar fuera**. Conecta [Paperless-ngx](/es/users/paperless/) primero y los enlaces de Homebox a
sus documentos entran como enlaces de Paperless. Ver
[importación y exportación](/es/users/import-export/#una-exportación-de-homebox); una importación hecha antes de 1.14.1 puede
[repararse](/es/users/import-export/#reparar-una-importación-anterior). Un Homebox más antiguo
no tiene un respaldo que Kept pueda leer: actualiza primero una copia de él, o importa su hoja de cálculo. Ver
[venir desde un Homebox más antiguo](/es/users/import-export/#viniendo-de-un-homebox-más-antiguo).

## ¿Cómo lo respaldo?

El servidor toma una instantánea cifrada con restic cada noche de la base de datos, los archivos y una copia legible
de cada ubicación, a otro disco, un bucket de S3 o un servidor SFTP. Guarda el kit de recuperación en otro
lugar. Para llevarse una ubicación, expórtala. Ver [respaldos](/es/admin/backups/),
[el kit de recuperación](/es/admin/recovery-kit/) y [importación y exportación](/es/users/import-export/#exportar).

## ¿Y si el servidor se pierde con la casa?

La copia legible del respaldo se abre en cualquier navegador con restic, la contraseña del respaldo y una laptop,
sin necesidad de Kept. Para traer de vuelta a Kept en una máquina nueva también necesitas el kit de recuperación. Ver
[leer tu inventario solo con restic](/es/admin/read-with-restic/) y [restaurar](/es/admin/restore/).

## ¿En qué idiomas habla?

Alemán, árabe (diseñado de derecha a izquierda), español, francés, inglés, italiano, ucraniano y
vietnamita, elegidos por dispositivo. Ver [idioma y tema](/es/users/first-run/#6-idioma-y-tema).

## ¿Bajo qué licencia está?

La Licencia Pública General Affero de GNU, versión 3 (AGPL-3.0). Puedes ejecutarla, cambiarla y compartirla; si
ejecutas una versión modificada para otras personas a través de una red, debes ofrecerles su código fuente. El
texto está en el
[LICENSE](https://github.com/keptinventory/kept/blob/main/LICENSE) del repositorio.

## ¿Kept es gratis? ¿Será de pago?

Kept autoalojado es gratis y de código abierto. Las aplicaciones móviles y de escritorio y una versión en la nube están en desarrollo.

## ¿Hay una versión publicada?

Sí: `1.0.0` fue la primera versión firmada, en GHCR como `ghcr.io/keptinventory/kept`, y cada
versión desde entonces está listada en la [página de versiones](https://github.com/keptinventory/kept/releases).
Las actualizaciones ejecutan sus migraciones una vez, toman una instantánea de la base de datos primero, y pueden
volver una versión atrás. Ver [instalar con Docker Compose](/es/install/compose/) y
[actualizaciones](/es/admin/upgrades/).
