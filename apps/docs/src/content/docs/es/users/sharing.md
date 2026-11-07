---
title: Compartir una ubicación
description: Invita a personas con un rol y una fecha de fin, comparte enlaces de solo lectura y imprime una lista en papel.
---

Una ubicación se comparte invitando a personas a ella, cada una con un rol y una fecha de fin opcional. Tu
ubicación personal nunca se comparte: no tiene miembros, invitaciones ni enlaces para compartir.

Esta página cubre invitaciones, roles, enlaces compartidos e impresión.

## Invitando a personas

La tarjeta **Invitar a personas a …** en Inicio aparece después de crear una ubicación. La misma página está bajo
**Configuración de ubicación → Miembros → Invitar**.

1. Elige el **Rol**, y bajo **Acceso** ya sea **Sin fecha de fin** o **Hasta una fecha**. Su
   acceso se detiene en esa fecha, y cualquier token que hayan creado para la API también se detiene.
2. **Crear enlace de invitación.** El enlace funciona una vez, durante 7 días. Muestra el código QR para escanear con su
   teléfono, o copia el enlace. Una invitación pendiente aparece bajo **Miembros** hasta que se use, y puedes
   revocarla allí.
3. **Enviar por correo** solo funciona cuando el servidor tiene el correo configurado.

Alguien sin dirección de correo electrónico aún puede recibir una cuenta: los propietarios y administradores la añaden desde
**Configuración de ubicación → Miembros → Añadir a alguien sin correo**. Se convierte en una cuenta gestionada — Kept
crea una dirección para ella que no puede recibir correo, establece su contraseña con un código de restablecimiento, y al
propietario se le informa de cada nueva cuenta.

Cualquiera excepto el propietario puede **Salir de esta ubicación**. Un administrador de instancia no puede ver dentro de un hogar a menos que
lo hayan invitado a ese hogar.

## Roles

| Rol | Qué pueden hacer en esa ubicación |
|---|---|
| **Propietario** | Todo, incluyendo las reglas de autenticación de dos factores, transferencia y eliminación. Hay un solo propietario. |
| **Administrador** | Invitar y eliminar miembros y espectadores, cambiar la configuración y los módulos, importar y exportar, crear enlaces compartidos y paquetes de reclamación, eliminar permanentemente. Solo el propietario otorga o quita administradores. |
| **Miembro** | Añadir, editar, mover, prestar y enviar objetos a la papelera; registrar lecturas y servicios; imprimir etiquetas; usar la captura con IA. El dinero es visible. |
| **Espectador** | Solo mirar y buscar. El dinero está oculto a menos que la ubicación permita a los espectadores verlo. El asistente responde pero no puede cambiar nada. |

## Enlaces compartidos

Los enlaces compartidos muestran a alguien sin una cuenta qué hay en una caja, un lugar o una búsqueda, de solo lectura.
Los propietarios y administradores crean uno a partir de:

- **Acciones → Compartir un enlace de solo lectura** en una caja.
- La sección **Gestionar** de un lugar.
- **Comparte esta lista** en Buscar: una búsqueda filtrada a una ubicación, sin filtros de estado o precio.

Elige cuánto tiempo funciona: un día, una semana, 30 días (el predeterminado), 90 días o un año. El enlace se muestra una vez, así que cópialo entonces.

### Qué ven

El nombre, la foto, el tipo, dónde está, la cantidad, el estado y las notas de cada objeto, de A a Z. Nunca precios,
números de serie, campos secretos, personas, préstamos o documentos. Los objetos en la Papelera, los borradores y los
objetos que vendiste o perdiste no se muestran.

### Se mantiene actual

La página muestra la caja, el lugar o la búsqueda tal como está cuando se abre. El enlace de una búsqueda coincide con sus
palabras y sus filtros de lugar, tipo y etiqueta.

### Gestionando enlaces

**Configuración de ubicación → Enlaces compartidos** lista cada enlace con su estado y con qué frecuencia se abrió.

- **Vista previa como destinatario** muestra la página como la ve el destinatario.
- **Revocar** lo detiene de inmediato.
- Un enlace también se detiene cuando expira, o cuando la persona que lo creó ya no administra la ubicación.

## Imprimiendo una lista

Para entregar una lista en papel a alguien, imprímela. **Imprimir inventario** en una ubicación crea un PDF de sus
objetos, agrupados por lugar, con fotos y IDs cortos. Los precios aparecen únicamente para las personas que pueden ver
el dinero. Cualquier persona que pueda ver la ubicación puede crear uno.

**Envíamelo por correo** también envía el PDF por correo cuando esté listo, y **Volver a enviar** envía toda
la ubicación cada lunes o el primer día del mes. **Configuración → Yo → Notificaciones** muestra estos envíos y los detiene.
Un informe de más de 10 MB no se adjunta: imprímelo desde Kept en su lugar.

## Relacionado

- [Tus primeros minutos](/es/users/first-run/#5-invita-a-personas) para invitar a personas durante la configuración.
- [Uso diario](/es/users/everyday-use/) para el panorama general.
- [Kits y entregas](/es/users/kits/) para prestar objetos.
