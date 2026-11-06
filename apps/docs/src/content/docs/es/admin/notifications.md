---
title: Correo, push y el feed del calendario
description: Configura el correo saliente y el push web en un servidor de Kept, y lo que los operadores deben saber sobre los enlaces privados del calendario que hace la gente.
---

Kept llega a la gente fuera de la app por **correo**, **push web** a un navegador o la app instalada, **ntfy**, **Telegram** y **Apprise**, y un **feed del calendario** al que se suscribe su app de calendario. Todo también llega al centro de notificaciones de la app, que no necesita configuración. La gente elige qué le llega en **Configuración → Notificaciones** (Reminders and alerts → **Abrir**). Esta página es el lado del operador. Todas las variables están listadas en la [referencia de configuración](/es/reference/configuration/).

## Correo

| Variable | Qué hace |
|---|---|
| `KEPT_SMTP_URL` | El servidor SMTP, como `smtp://` o `smtps://`, con credenciales si las necesita: `smtps://user:password@mail.example.org:465`. |
| `KEPT_SMTP_FROM` | El From de cada correo. Predeterminado: `Kept <no-reply@<your KEPT_PUBLIC_URL host>>`. La mayoría de los proveedores envía solo desde una dirección que han verificado, así que configúralo. |

Con Compose, pon ambas en `.env`; `compose.yaml` las pasa a `kept` y `migrate`. Con el chart de Helm, `smtp.existingSecret` nombra un Secret que contiene `KEPT_SMTP_URL`, y `smtp.from` establece el remitente. Kept abre una conexión por correo; las opciones de URL propias de nodemailer (como `?pool=true`) pasan a través de la URL.

### Cuando `KEPT_SMTP_URL` no está configurado

El correo solo se registra como pendiente: una advertencia por correo, `mail not sent: no mail transport is configured`, que nombra el tipo de correo y nunca la dirección, el enlace ni el token. **Administrador → Estado** muestra **Mail: Not configured** y el aviso **El correo no está configurado**. Sin correo no hay enlaces de inicio de sesión, restablecimientos de contraseña, invitaciones por correo, alertas por correo ni informes por correo. Las invitaciones por enlace y las contraseñas funcionan sin él, y los recordatorios siguen llegando a la gente por push y en la app. **Envíamelo por correo** y **Volver a enviar** en Print inventory están bloqueados, y los propietarios y administradores reciben un enlace **Configurar email** a esta página; la API rechaza `email: true` y las programaciones de informes con 409 `mail_not_configured`.

Cuando el correo está configurado, una cuenta cuya dirección no esté verificada no puede añadir una passkey ni una app de autenticación hasta que lo esté.

### Lo que Kept envía

Cada correo se envía como texto y HTML en el idioma del destinatario (inglés, árabe, francés, alemán o italiano; inglés cuando Kept no lo sabe). Los enlaces llevan su token después de `#`, así que un escáner de correo o un registro del servidor nunca tiene uno usable.

- **Inicio de sesión y la cuenta**: enlaces de inicio de sesión, restablecimientos de contraseña, confirmar y verificar una nueva dirección de correo y un aviso a la anterior, un aviso cuando alguien intenta registrarse con una dirección que ya tiene cuenta, y un aviso cuando cambia una credencial: la contraseña, una passkey añadida o eliminada, un inicio de sesión externo desvinculado, la autenticación de dos factores activada, reconfigurada o desactivada, y nuevos códigos de respaldo.
- **Personas y ubicaciones**: invitaciones por correo; al propietario de una ubicación, cada nuevo miembro o cuenta gestionada y cada membresía que llega a su fecha de fin.
- **Transparencia**: cuando un admin de la instancia (o `kept admin`) actúa sobre la cuenta de alguien; y a cada usuario activo cuando cambia el inicio de sesión OIDC de la instancia, su correo saliente o su proveedor de IA predeterminado.
- **Recordatorios**: un elemento vencido al momento, el resumen diario, una prueba de canal y un aviso cuando el webhook propio de una persona sigue fallando.
- **IA**: un límite mensual al alcanzar el 80% o el 100%, y el resumen mensual de IA opcional.
- **A los admins de la instancia**: alertas de admin, como máximo una vez al día por alerta ([la página de estado y las alertas](/es/admin/observability/#la-página-de-estado-y-las-alertas)).

### Cambiar el servidor de correo

Kept compara el host SMTP y el remitente con lo último que vio cada vez que arranca, nunca la contraseña. Si alguno cambió, el cambio se audita y se avisa a cada usuario activo, por la nueva ruta. El primer arranque con correo configurado solo lo registra.

## Push web

El push **no necesita claves tuyas**. En el primer arranque Kept genera un par de claves VAPID y lo guarda en la base de datos, la clave privada sellada con `KEPT_SECRET_KEY`. Para traer tu propio par, configura ambas:

| Variable | Qué hace |
|---|---|
| `KEPT_VAPID_PUBLIC_KEY` | La clave pública: base64url sin relleno de 65 bytes, como la escribe `generateVAPIDKeys()` de web-push. |
| `KEPT_VAPID_PRIVATE_KEY` | Su mitad privada (32 bytes, misma codificación). Nunca se registra. Configurar una sin la otra detiene Kept al arrancar. |
| `KEPT_VAPID_SUBJECT` | A quién pueden contactar los servicios de push: una URL `https:` o una dirección `mailto:`. Predeterminado: `KEPT_PUBLIC_URL` cuando es `https`, si no `mailto:` la dirección de `KEPT_SMTP_FROM`. |

El push **no está disponible** cuando:

- `KEPT_PUBLIC_URL` es `http` simple en cualquier cosa que no sea localhost: los navegadores se suscriben solo en una página segura. La gente ve "Push needs HTTPS." ([HTTPS](/es/install/https/))
- no hay subject: ni `KEPT_VAPID_SUBJECT`, ni URL pública `https` ni `KEPT_SMTP_FROM`. La gente ve "Push isn't set up on this server."

El correo y el centro de notificaciones siguen funcionando en cualquier caso.

La gente activa el push por dispositivo con **Activar** bajo **Cómo Kept te alcanza**, después de que lo pide el navegador. **En iPhone y iPad, las notificaciones funcionan solo desde la app instalada**: Kept lo indica y ofrece **Cómo instalar** ([la app del teléfono](/es/users/phone-app/)).

Lo que sale del servidor: Kept envía cada push por HTTPS al servicio de push al que se suscribió el navegador, así que necesita acceso a internet saliente; se rechazan las direcciones privadas y locales. Un push lleva un título, una línea de texto y un enlace, de menos de 3 KB, nunca dinero ni datos de contacto. El servicio de push lo guarda hasta un día mientras un dispositivo está offline. Una suscripción que el servicio informa como desaparecida se elimina.

:::caution[Losing the key]
Si no se puede abrir la clave privada almacenada, porque la clave secreta con la que se selló se ha ido, Kept hace un nuevo par y descarta todas las suscripciones push. No se pierde nada más: la gente vuelve a activar el push en cada dispositivo. Mantén [el kit de recuperación](/es/admin/recovery-kit/) y esto no ocurre nunca en una restauración ni en un [traslado](/es/admin/move-server/).
:::

## ntfy y Telegram

La gente los añade ella misma en Settings → Me → Notifications; no hay nada que configurar en el servidor. Kept publica en el endpoint JSON de un servidor ntfy y en la Bot API de Telegram (`api.telegram.org`), ambos a la vez y con la misma protección que los webhooks: un servidor ntfy en una dirección privada funciona solo cuando **Permitir direcciones privadas** está activado (Admin → Settings), y se rechazan las redirecciones. Sus ajustes (un topic y un token de ntfy, un token de bot de Telegram) se cifran como el secreto de un webhook y están cubiertos por la [rotación de claves](/es/admin/recovery-kit/). Un envío fallido se reintenta con el recordatorio y marca el canal "Failing since"; el siguiente envío que llega lo limpia. Las alertas de admin no van a ellos.

## Apprise

[Apprise](https://github.com/caronc/apprise) llega a Discord, Slack, Matrix, Signal, Pushover y más de 100 servicios más. Kept se comunica con un servidor **Apprise API** que ejecutas junto a él, y ofrece **Agregar Apprise** a la gente solo cuando `KEPT_APPRISE_URL` apunta a uno:

```yaml
# compose.yaml, beside the kept service
  apprise:
    image: caronc/apprise:2.0.0
    restart: unless-stopped

# and in the kept service's environment
KEPT_APPRISE_URL: http://apprise:8000
```

- Cada persona añade sus propias **URLs de Apprise** (una o más, como `discord://…` o `mailto://…`). Se cifran como el secreto de un webhook, no se vuelven a mostrar y están cubiertas por la [rotación de claves](/es/admin/recovery-kit/).
- Kept usa el `POST /notify/` sin estado de Apprise API y envía las URLs con cada mensaje, así que el servidor de Apprise no guarda nada. Se accede a él en tu red privada a propósito, con las redirecciones rechazadas.
- Las URLs genéricas `json://`, `xml://` y `form://` de Apprise (y sus formas `s`) pueden apuntar a cualquier host, incluidas máquinas de tu red, así que Kept las rechaza salvo que **Permitir direcciones privadas** esté activado (Admin → Settings).
- Un envío fallido (Apprise responde 424 cuando un servicio lo rechazó) se reintenta con el recordatorio y marca el canal "Failing since". Las alertas de admin no van a Apprise.

## El feed del calendario

Cada persona puede crear un enlace privado iCal de lo que vence y lo que se acaba, en **Configuración → Notificaciones → Fuente de calendario → Crear un enlace**. No hay nada que configurar en el servidor.

- **Lo que contiene**: eventos de todo el día de un mes atrás a 13 meses adelante, en las ubicaciones de la persona: títulos, rutas del lugar, nombres de ubicación y un enlace a Kept. Nunca dinero, secretos, notas ni datos de contacto de nadie. Solo los tipos que la persona recibe por algún canal, y nada de una parte de Kept que una ubicación haya desactivado. Las ubicaciones que exigen dos factores se omiten.
- **El enlace**: `https://kept.example.org/cal/<token>.ics`, se muestra una sola vez. Kept solo guarda el SHA-256 del token y lo redacta en los registros de peticiones. Se construye a partir de `KEPT_PUBLIC_URL` cuando se crea, así que un enlace creado antes de un cambio de dirección sigue apuntando a la dirección antigua.
- **Quién puede leerlo**: cualquiera que tenga el enlace, sin inicio de sesión. Un enlace desconocido o revocado, o uno que pertenece a una cuenta desactivada, responde 404 sin decir cuál. Cada enlace puede consultarse 60 veces por minuto.
- **Revocar**: **Revocar** en el enlace lo termina para siempre; los calendarios suscritos a él dejan de actualizarse. La lista mantiene la fila revocada y muestra cuándo se consultó por última vez cada enlace activo. Una persona puede tener como máximo 3 enlaces activos.

Google Calendar busca el enlace desde los servidores de Google, así que ahí funciona solo cuando Kept es accesible desde internet.
