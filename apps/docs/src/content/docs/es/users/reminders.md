---
title: Recordatorios y notificaciones
description: Lo que Kept te recuerda, cómo funciona el centro de notificaciones, configuración de canales para ntfy, Telegram y Apprise, y configuración por ubicación.
---

Kept te recuerda las programaciones vencidas, las garantías que están por vencer y las fechas límite de registro, los documentos
y los objetos que caducan, los préstamos vencidos, los contadores que no se han leído lately, el stock bajo, los miembros que se unen y
se van, y los límites de gasto de IA. La pantalla principal **Te necesita** muestra lo que está por vencer o vencido; la campana abre
el centro de notificaciones, donde **Completo**, **Posponer**, **Renovar** y **Marcar como devuelto** actúan en
el lugar.

Esta página cubre lo que te llega, cómo configurar canales y la configuración por ubicación. Para notificaciones
push en un teléfono, consulta [Kept en tu teléfono](/es/users/phone-app/#notificaciones).

## Lo que te llega

La pantalla principal **Te necesita** muestra seis conteos, siempre en el mismo lugar: **Vencido**, **Vencimiento**,
**Expirando**, **Prestado**, **Incierto** y **Stock bajo**. Un cero aparece atenuado, no oculto.
**Prestado en** y **Sin ver hace mucho** aparecen cuando tienen algo. En una computadora cada uno nombra
su elemento más urgente. Toca uno para abrir esa lista, ya filtrada.

El centro de notificaciones (la campana) enumera todo lo que está por vencer o vencido, agrupado por tipo. Desde
ahí puedes usar **Completo**, **Posponer**, **Renovar** o **Marcar como devuelto** sin salir de la página.

## Configuración

**Configuración** → **Yo** → **Notificaciones** elige lo que te llega y cómo:

- **Resumen diario**: un solo resumen diario en lugar de notificaciones individuales.
- **Horas de silencio**: no hay notificaciones durante las horas que configuras. No se envía push ni correo en
  ellas; lo que vence espera hasta que terminen y se envía entonces.
- **Fuente de calendario**: un enlace privado para tu aplicación de calendario, que muestra las fechas de vencimiento.

El push en un teléfono se cubre en [Kept en tu teléfono](/es/users/phone-app/#notificaciones).

## La tabla de notificaciones

**Lo que te llega** es una sola tabla. Las filas son los tipos, agrupados:

- **Fechas de vencimiento**: programaciones, garantías, fechas límite de registro, documentos, objetos que caducan,
  contadores no leídos últimamente.
- **Préstamos**: préstamos vencidos.
- **Existencias**: stock bajo.
- **Personas**: miembros que se unen y se van.
- **IA**: límites de gasto y el resumen mensual.

Las columnas son tus canales:

- **En Kept**: el centro de notificaciones y Te necesita de la pantalla principal.
- **Correo electrónico**: a la dirección de correo de tu cuenta.
- **Push**: a tu teléfono (donde está configurado el push).
- **Webhook / ntfy / Telegram / Apprise**: una vez que agregas uno, aparece una columna para cada tipo.

Los avisos de membresía y de IA solo van a Kept y al correo. Desactivar **En Kept** para un tipo lo desactiva
en todas partes: no se envía nada más para ese tipo. En un teléfono, cada tipo muestra sus canales como interruptores
debajo.

## Configuración por ubicación

- **Todas las ubicaciones** establece lo que recibes en todas partes, incluso en las ubicaciones que agregues después.
- **Elige una ubicación** para cambiarlo solo ahí. Un punto marca lo que está configurado solo para esa ubicación.
- **Restablecer esta ubicación a todas las ubicaciones** borra esas excepciones.
- Un tipo cuyo módulo está desactivado ahí aparece como pausado (sus recordatorios esperan hasta que el módulo vuelva).
- Donde eres visualizador solo recibes miembros que se unen y se van.
- Donde eres miembro, Kept empieza solo con los préstamos que registras: activa lo que quieras ahí.

## Configuración de canales

### ntfy

Agrega tu servidor (`https://ntfy.sh` o el tuyo) y un tema difícil de adivinar, además de un token de acceso
si el tema lo necesita. Kept mantiene todo esto cifrado y no lo muestra de nuevo.
**Prueba** envía uno ahora.

### Telegram

Crea un bot con @BotFather, envíale un mensaje y luego agrega su token y tu ID de chat. Kept mantiene
todo esto cifrado y no lo muestra de nuevo. **Prueba** envía uno ahora.

### Apprise

Cuando tu servidor tiene Apprise, pega una o más URLs de Apprise, como `discord://…`, para llegar
a Discord, Slack, Matrix, Signal y más. Kept mantiene todo esto cifrado y no lo muestra de nuevo.
**Prueba** envía uno ahora.

## Recordatorios de préstamos

**Prestar** un objeto (o parte de una cantidad) a un miembro o contacto, con fecha de vencimiento y fotos del estado.
Kept nunca envía mensajes al prestatario; **Copiar un recordatorio** te da el texto para que lo envíes tú mismo.
Una caja va con todo lo que hay dentro, cada objeto en su propia línea. Consulta
[Kits y entregas](/es/users/kits/).

## Relacionado

- [Kept en tu teléfono](/es/users/phone-app/) para notificaciones push y uso sin conexión.
- [Uso diario](/es/users/everyday-use/) para el panorama general.
- Vehículos y máquinas para lecturas de contadores y calendarios de servicio.
