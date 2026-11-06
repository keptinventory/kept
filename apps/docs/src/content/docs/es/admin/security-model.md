---
title: Modelo de seguridad
description: Qué debe saber un operador sobre cómo Kept mantiene los hogares separados, sella secretos, da acceso a las personas y qué sale del servidor.
---

Esta página es el resumen del modelo de amenazas de Kept y los mecanismos que hay detrás para el operador. Las páginas para desarrolladores profundizan: [seguridad a nivel de fila](/es/developers/rls/), [inicio de sesión](/es/developers/auth/) y [la arquitectura](/es/developers/architecture/).

## Las casas se mantienen separadas por la base de datos

Kept se conecta a Postgres con cuatro cuentas de acceso, cada una con solo el permiso que necesita su trabajo:

| Cuenta | Usada por | Lo que puede hacer |
|---|---|---|
| `kept_owner` | `kept migrate`, `kept admin`, la copia de seguridad nocturna | es dueño del esquema; no se usa nunca para responder a una solicitud |
| `kept_app` | todas las solicitudes web, incluidas las rutas de administrador de instancia | lee y escribe las tablas de la app, siempre bajo seguridad por filas (`NOBYPASSRLS`, `FORCE` RLS en todas las tablas) |
| `kept_auth` | inicio de sesión (Better Auth) | solo su propio esquema `auth` |
| `kept_system` | trabajos en segundo plano que abarcan hogares (escaneo de recordatorios, retención), el código de configuración | solo políticas explícitas del sistema |

Cada solicitud se ejecuta en una transacción que nombra a la persona que ha iniciado sesión, y cada política pregunta a una función a qué ubicaciones pertenece esa persona. Si no se define ninguna persona, las políticas no devuelven nada, así que una ruta de código que olvida el alcance falla de forma segura. Una prueba de filtración a nivel de esquema revisa las rutas de solicitud, autenticación y worker. La profundidad está en [seguridad a nivel de fila](/es/developers/rls/).

Qué significa para ti: el contenedor que sirve la app nunca tiene la cuenta del propietario, a menos que se la des para las copias de seguridad ([copias de seguridad](/es/admin/backups/#activarlo)). Un administrador de instancia no tiene **acceso dentro de la app** a las ubicaciones de otras personas; un operador con acceso a la base de datos puede saltarse eso, por eso la base de datos misma debe mantenerse privada para el servidor.

## Claves y cifrado

- **`KEPT_SECRET_KEY`** sella cada valor secreto: los campos secretos de los objetos, las claves de IA, la configuración de canales de notificación, los secretos de webhook, las contraseñas de los buzones de entrada de correo, los tokens de la API de Paperless-ngx, la clave privada de push web, la contraseña de la copia de seguridad. AES-256-GCM con una clave de datos por fila; cada texto cifrado está vinculado a su tabla, fila y campo, por lo que no se puede intercambiar por otro.
- **`KEPT_AUTH_SECRET`** firma las sesiones y los tokens. Es independiente para que cualquiera de los dos se pueda rotar por separado.
- **Se generan en el primer arranque** cuando ambas no están definidas, en el volumen de configuración (nunca en el volumen de datos), con una línea de registro que indica dónde. Defínelas tú mismo con `kept admin gen-key`; el arranque rechaza una clave de menos de 32 bytes y rechaza definir una sin la otra.
- **Ninguna de las dos está en la base de datos ni en la copia de seguridad.** Guarda [el kit de recuperación](/es/admin/recovery-kit/). Sin la clave secreta, una restauración recupera todo excepto los valores secretos y las claves de IA.
- **Rotación:** `kept admin rotate-key` convierte en actual una clave nueva y vuelve a envolver cada valor sellado; la clave anterior se conserva como versión retirada para que las copias de seguridad anteriores sigan abriéndose. `--resume` completa una ejecución interrumpida, `--drop <version>` elimina una clave retirada que nada usa ([la CLI](/es/admin/cli/#comandos)).
- **Las contraseñas de los buzones son de solo escritura:** el servidor, el nombre de usuario y la contraseña de un buzón de correo entrante se sellan juntos; la página muestra el servidor y el nombre de usuario, nunca la contraseña.
- **Las claves de IA son de solo escritura:** una vez guardadas, Kept muestra solo sus últimos cuatro caracteres.
- **Los tokens de Paperless-ngx son de solo escritura:** la dirección y el token de Paperless de una ubicación se sellan juntos; la página muestra la dirección, nunca el token, y el navegador nunca se comunica con Paperless usando ese token. Las miniaturas y las descargas pasan por Kept, después de la comprobación de acceso propia de Kept.

## Iniciar sesión

Kept usa Better Auth en su propio inicio de sesión y esquema. Con qué puede iniciar sesión una cuenta:

- **Correo electrónico y contraseña.** Un restablecimiento de contraseña cierra la sesión de la cuenta en todas partes, y se avisa al propietario por correo cuando cambia una credencial.
- **Llaves de acceso**, registradas para el nombre de host de `KEPT_PUBLIC_URL`. Cada una debe verificar a su usuario (Face ID, una huella dactilar, un PIN) y ser descubrible.
- **Autenticación de dos factores** con una app autenticadora (TOTP) o una llave de acceso que haya verificado al usuario. Un código de un solo uso enviado por correo electrónico nunca es un segundo factor. El propietario de una ubicación puede exigir autenticación de dos factores para todos los que están en ella. Las cuentas sin contraseña también pueden usar la app autenticadora.
- **Configuración → Iniciar sesión y seguridad** añade, renombra y elimina llaves de acceso, y enciende la app autenticadora, genera nuevos códigos de respaldo, la configura de nuevo y la apaga ([Iniciar sesión y seguridad](/es/users/sign-in-security/)). Cada cambio pide la contraseña, o un inicio de sesión en los últimos diez minutos en una cuenta sin contraseña, y cierra la sesión en todos los demás dispositivos (salvo al renombrar). El servidor rechaza eliminar la última forma de entrar, y apagar la autenticación de dos factores mientras una ubicación la exige y la cuenta no tiene llave de acceso. Volver a configurar la app mantiene funcionando el secreto anterior hasta que se demuestre un código de la nueva.
- **Enlaces mágicos** solo para cuentas existentes (sin registro abierto), válidos 15 minutos. Los tokens enviados por correo viajan en el `#fragment` del enlace y se gastan con una petición POST desde la página, por lo que un escáner de correo que abre enlaces no puede consumirlos; solo se almacena un hash.
- **Nombres de usuario** para cuentas administradas (personas sin dirección de correo electrónico).
- **OIDC**, cuando `KEPT_OIDC_ISSUER` y `KEPT_OIDC_CLIENT_ID` están definidos ([configuración](/es/reference/configuration/)). Una identidad externa nunca se vincula a una cuenta porque el correo coincide; una persona nueva entra por invitación, o por un dominio o grupo permitido. Los tokens del proveedor de identidad nunca se guardan.
- **Google**, cuando `KEPT_GOOGLE_CLIENT_ID` y `KEPT_GOOGLE_CLIENT_SECRET` están definidos, con la URI de redirección que Administrador → Estado muestra. Se aplican las mismas reglas que OIDC, excepto que nadie entra por dominio: solo una cuenta existente que haya vinculado Google, o una persona invitada.
- **Vincular y desvincular** un inicio de sesión externo se hace en Configuración → Yo → Métodos de inicio de sesión. Vincular requiere un inicio de sesión en los últimos diez minutos; desvincular pide la contraseña (o ese inicio de sesión reciente en una cuenta sin contraseña). Una cuenta conserva al menos una forma de entrar.

Las **sesiones** duran 30 días con HTTPS, se extienden una vez al día de uso, con cookies `Secure` y con prefijo `__Secure-`. Con HTTP sin cifrar duran 12 horas y nunca se extienden, y Kept rechaza las acciones que revelan o cambian un secreto ([HTTPS](/es/install/https/)). Las acciones sensibles piden la contraseña de nuevo, o un inicio de sesión en los últimos diez minutos; renovar un inicio de sesión no reinicia esos diez minutos.

`KEPT_HTTP_SIGN_IN_DAYS` (de 1 a 30, sin definir por defecto) permite que quien ejecuta el servidor haga que un inicio de sesión por HTTP sin cifrar dure esos días, renovándose mientras se usa. Es la única configuración que relaja esto, no se puede cambiar desde la app y no hace nada con HTTPS. Los secretos siguen rechazándose por HTTP, los diez minutos se mantienen y cerrar sesión en todas partes sigue terminando todos los inicios de sesión. El coste: por HTTP sin cifrar, cualquiera que pueda ver el tráfico puede copiar una cookie de inicio de sesión, y con la configuración activa, una copia copiada sigue funcionando mientras se use, hasta que ese dispositivo cierre sesión o se cierren tus otros dispositivos ([Permanecer en tu red](/es/install/home-network/#permanecer-en-tu-red)).

Las **solicitudes de otros sitios** se rechazan: una escritura que lleva la cookie de Kept debe venir del origen de `KEPT_PUBLIC_URL`, o recibe un 403 antes incluso de leer la sesión. Lo mismo aplica al primer arranque, que aún no tiene cookie, antes de intentar su código de configuración.

`KEPT_EXTRA_ADDRESSES` (sin definir por defecto) permite que quien ejecuta el servidor enumere otros orígenes exactos que cuentan como Kept. Se leen una sola vez al arrancar y se comparan enteros con el `Origin` del navegador; `Host` y `X-Forwarded-*` no influyen. Un comodín, o una mezcla de `http` y `https`, impide el arranque. El rechazo nombra `KEPT_PUBLIC_URL` y nunca la lista. Las llaves de acceso, los inicios de sesión externos, OAuth y todos los enlaces permanecen en `KEPT_PUBLIC_URL`: una llave de acceso se comprueba contra esa dirección sea cual sea lo que diga la solicitud. El coste: una página servida en una dirección listada puede actuar en nombre de quien haya iniciado sesión allí ([Más de una dirección](/es/install/home-network/#más-de-una-dirección)).

Las páginas se sirven con una política de seguridad de contenido `default-src 'self'`, no pueden incrustarse en marcos, y reciben HSTS cuando la URL pública es HTTPS, salvo que `KEPT_HSTS=off` ([HSTS](/es/install/reverse-proxy/#hsts)).

## Límites de tasa

Tal como está:

| Qué | Límite |
|---|---|
| Intentos de inicio de sesión | 5 por minuto por dirección; por cuenta y dirección, 20 por hora, con retrasos que aumentan a partir del cuarto fallo (hasta 5 minutos) en lugar de bloquear la cuenta |
| Otras rutas de autenticación | 100 por minuto por dirección y ruta |
| API y MCP, por token | 120 lecturas y 30 escrituras por minuto |
| Restablecimiento de contraseña y enlace mágico | 3 por hora por cuenta |
| La página de un enlace compartido | 60 vistas por minuto por enlace |

Los límites se guardan en la base de datos, así que las réplicas los comparten. La dirección del cliente viene del socket, o de `X-Forwarded-For` solo cuando la conexión viene de una dirección en `KEPT_TRUSTED_PROXIES` ([proxies inversos](/es/install/reverse-proxy/#confía-en-el-proxy-y-solo-en-el-proxy)).

## Solicitudes salientes (SSRF)

Kept obtiene solo direcciones que alguien configuró: la URL base de un proveedor de IA, webhooks, push, un emisor OIDC, los metadatos de un cliente OAuth, un servidor Homebox del que importar, búsquedas de códigos de barras, la comprobación de actualizaciones, el buzón de correo entrante (IMAP) de una ubicación y el Paperless-ngx de una ubicación. Cada una pasa por la misma protección ([`apps/server/src/net/ssrf.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/net/ssrf.ts)):

- la dirección se comprueba **cuando se hace la conexión**, después de resolver el nombre, para que un nombre que cambie entre la comprobación y la solicitud no se cuele;
- se rechazan los rangos privados, de bucle local, de enlace local (incluida la dirección de metadatos en la nube), NAT de operador, multicast y reservados, en IPv4 e IPv6;
- se rechazan las redirecciones, para que un host público no pueda rebotar la solicitud hacia dentro.

Una dirección rechazada devuelve `400 private_address`. En un servidor autoalojado, un administrador de instancia puede permitir direcciones privadas (**Administrador → Configuración → Permitir direcciones privadas**), algo que necesita un proveedor en tu propia red, como [Ollama](/es/admin/ollama/). Está desactivado por defecto.

## Entrada hostil

Las importaciones y las subidas se tratan como hostiles. Los valores predeterminados:

| Límite | Predeterminado |
|---|---|
| ZIP de importación | 5 GB sin comprimir, compresión 100:1 por entrada, 200.000 entradas, sin enlaces simbólicos |
| Imágenes | decodificadas hasta 100 megapíxeles, de una en una por debajo de 3 GB de RAM o un límite de contenedor por debajo de 3 GB |
| PDF | analizados en un proceso hijo, 20 s y 256 MB |
| Subidas | `KEPT_MAX_FILE_MB` (25 MB por defecto), rechazadas antes de leer el cuerpo |

Los archivos guardados se obtienen mediante un enlace firmado de cinco minutos en una ruta que no lee sesión, con `nosniff` y una política `default-src 'none'; sandbox`, y como descarga a menos que el archivo sea uno de los JPEG recodificados propios de Kept. Las celdas de CSV exportado que empiezan como una fórmula se neutralizan.

## Lo que sale del servidor

- **Nada sobre Kept en sí.** No hay telemetría de ningún tipo; la telemetría propia de la biblioteca de inicio de sesión está desactivada. El trazado y la notificación de errores van solo a un recolector que tú configures ([monitorización](/es/admin/observability/#trazado-y-reporte-de-errores)).
- **La comprobación de actualizaciones está desactivada por defecto.** Activada, consulta a GitHub la última versión una vez al día, enviando solo la solicitud ([actualizaciones](/es/admin/upgrades/#saber-si-hay-una-nueva-versión)).
- **Lo que ve un proveedor de IA**, cuando una ubicación usa uno: las fotos como una copia recodificada con EXIF y XMP eliminados (Kept se niega a enviar una imagen que aún los tenga), el prompt fijo y los idiomas de la ubicación para la extracción, la pregunta y los resultados de herramientas que el rol de quien pregunta permite para el asistente, y los campos descriptivos para la búsqueda semántica. **Nunca valores secretos**, ni dinero para la búsqueda. El registro propio de Kept de cada llamada guarda tokens y coste, nunca el prompt, la imagen, la respuesta ni la clave. Ver [Proveedores de IA](/es/users/ai-providers/).
- **Enlaces compartidos** (`/s/<token>`) son la única página que cualquiera puede abrir sin iniciar sesión. El token son 32 bytes aleatorios, se muestra una sola vez y se guarda como su SHA-256; nunca llega a una línea de registro. La página se lee mediante una función de base de datos que toma el hash del token y devuelve solo nombres, tipos, dónde están los objetos, cantidades, estado, notas y fotos, para la caja, el lugar o la búsqueda compartida en esa ubicación. Las fotos son vistas previas con el GPS eliminado, como URL firmadas de cinco minutos, y solo para esos objetos. Un enlace se detiene cuando se revoca o caduca, o cuando su creador deja de administrar la ubicación; se comprueba en cada vista.
- **Copias de seguridad** son instantáneas restic cifradas con una contraseña de al menos 12 caracteres antes de salir; sin contraseña no hay copia de seguridad ([copias de seguridad](/es/admin/backups/)).

## Informar de una vulnerabilidad

Usa la **notificación privada de vulnerabilidades** de GitHub en el repositorio (la pestaña **Seguridad** → **Informar de una vulnerabilidad**); es el único canal y no hay dirección de correo electrónico de seguridad. No abras una incidencia pública. [SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md) tiene los detalles y las versiones compatibles, que se aplican desde la 1.0. Para comprobar que una imagen es la que compiló el responsable del mantenimiento, consulta [verificar una versión](/es/admin/verify-release/).
