---
title: Webhooks
description: "POSTs firmados a tu propio servidor cuando cambian cosas: los eventos, la carga útil, la verificación de la firma, las entregas y reintentos, y el secreto."
---

Un **webhook** es Kept publicando en una dirección que eliges cuando ocurre algo en una ubicación: se agrega, mueve o envía a la papelera un elemento, se registra una lectura o vence un recordatorio. Cada POST está firmado, por lo que tu servidor puede saber que proviene de Kept. Transporta IDs y los nombres de los campos que cambiaron, nunca sus valores: para ver el elemento mismo, tu servidor lo obtiene de la
[API](/api/) con su propio token.

Los propietarios y administradores gestionan los webhooks de una ubicación en **Configuración de ubicación → Webhooks**: **Agregar webhook**, la dirección y los eventos que acepta. **Configuración → Conexiones** muestra los webhooks que gestionas en tus ubicaciones.

## Los eventos

| Evento | Se envía cuando |
|---|---|
| `thing.created` | Se agrega un elemento |
| `thing.updated` | Se cambia un elemento |
| `thing.moved` | Se mueve un elemento |
| `thing.trashed` | Un elemento va a la papelera |
| `thing.restored` | Un elemento vuelve de la papelera |
| `thing.lifecycle_changed` | Cambia el estado de un elemento, como perdido o vendido |
| `reading.logged` | Se registra una lectura de medidor |
| `reminder.due` | Vence un recordatorio |

Cada carga útil tiene los mismos campos:

```json
{
  "id": "evt_…",
  "event": "thing.updated",
  "occurred_at": "2026-10-03T09:12:44.000Z",
  "location_id": "…",
  "entity": { "type": "thing", "id": "…" },
  "changed_fields": ["…"],
  "actor": { "type": "user", "id": "…" }
}
```

`entity.type` es `thing`, `reading` o `reminder` (`webhook` para una prueba); `changed_fields`
nombra los campos que cambió una escritura, y está vacío para un recordatorio; `actor.type` es
`user`, `token` o `system`.

**Enviar una prueba** publica un evento `ping`, enviado una vez y sin reintentos, y muestra el
estado que respondió tu servidor: la forma más rápida de comprobar una nueva dirección.

## Verificación de la firma

Cada entrega lleva un encabezado `Kept-Signature`:

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`t` es cuándo fue firmado (segundos Unix). `v1` es un HMAC-SHA256, con el secreto del webhook, de
`<t>.<body>`: la marca de tiempo, un punto, luego el cuerpo exacto de la solicitud. Tu servidor
calcula el mismo HMAC, lo compara con `v1` en tiempo constante y rechaza un `t` antiguo (más de
cinco minutos, por ejemplo). El diálogo del secreto tiene un fragmento listo para usar **Verificar
una entrega (Node.js)**.

## El secreto

El secreto de firma se muestra solo una vez al crear el webhook: cópialo entonces. Kept lo mantiene
sellado para firmar con él y nunca lo muestra nuevamente. ¿Lo perdiste? **Nuevo secreto** crea otro;
el actual deja de funcionar inmediatamente, por lo que las entregas fallarán en la verificación hasta
que tu servidor tenga el nuevo uno.

## Entregas

Las **Entregas** de cada webhook muestran las últimas 30 días, primero las más recientes: una fila
por entrega, con su estado, el estado que respondió tu servidor (o ninguno) y cuántos intentos
tomó.

- **Esperando para enviar**: en cola.
- **Entregado**: tu servidor respondió con un estado 2xx.
- **Falló, intentando de nuevo**: cualquier otra respuesta, ninguna respuesta dentro de 10 segundos
  o un redireccionamiento (Kept no sigue redireccionamientos). Kept intenta de nuevo.
- **Rendido**: 10 intentos en aproximadamente 24 horas todos fallidos.

Como máximo 10 entregas por segundo salen por ubicación, así que un aumento de cambios no
inunda tu servidor.

Cuando una entrega rinde, el webhook se marca como **Fallando desde** esa fecha y los
administradores de la instancia reciben una alerta. Sigue enviando; la próxima entrega que logre
pasar borra la marca.

Un webhook se cambia a **Desactivado** cuando un propietario o administrador lo desactiva, o cuando
la persona que lo creó ya no es administrador de la ubicación. Eliminarlo es definitivo: Kept deja
de enviar a él y sus entregas se olvidan.

## Tu propio webhook, para recordatorios

Separado de los webhooks de una ubicación, **Configuración → Yo → Notificaciones** puede agregar un
webhook como uno de tus propios canales, junto a correo electrónico, push, ntfy, Telegram y Apprise
([recordatorios](/es/users/reminders/)). Recibe un POST por recordatorio (`reminder.due`) con IDs, el
tipo de recordatorio, su tipo de origen y fecha de vencimiento, el elemento, lugar o ubicación de
que se trata, y un enlace de regreso a Kept: sin nombres ni valores. Se firma de la misma manera,
con un secreto mostrado una sola vez.

Un envío fallido se reintenta hasta 10 veces en aproximadamente 24 horas; si ninguno logra pasar,
el canal se marca como **Fallando desde** y Kept te envía un correo electrónico una vez. **Prueba**
envía uno ahora. Puedes tener hasta cinco.

## Direcciones en tu propia red

Kept se niega a publicar en direcciones privadas (como `192.168.x.x`), por lo que un webhook no
puede apuntar a un router o a otro servicio en la red del servidor. Un administrador de instancia
puede permitirlo en **Administrador → Registro** (**Permitir direcciones privadas**), para un
receptor que aloques tú mismo, como Home Assistant. El mismo interruptor permite que un proveedor
de IA, una importación de Homebox y un inicio de sesión de OIDC alcancen esa red, así que actívalo
sabiendo quién puede agregarlos. Consulta el
[modelo de seguridad](/es/admin/security-model/#solicitudes-salientes-ssrf)
