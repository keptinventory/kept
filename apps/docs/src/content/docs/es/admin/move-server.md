---
title: Trasladarse a un nuevo servidor
description: Dos formas de mover Kept - la instancia completa mediante una copia de seguridad, o una ubicación a la vez mediante una exportación.
sidebar:
  order: 8
---

## La instancia completa: mediante una copia de seguridad

Esto mueve todo (cada cuenta, ubicación, archivo y ajuste) y es el mismo procedimiento que
recuperarse de un servidor perdido:

1. En el servidor antiguo, toma una copia de seguridad y déjala terminar, e imprime el
    [kit de recuperación](/es/admin/recovery-kit/).
2. En el nuevo servidor, [instala Kept](/es/install/compose/) con las claves del kit en `.env` y el mismo
    objetivo de copia de seguridad, pero **no inicies Kept todavía**.
3. [Restaura](/es/admin/restore/#después-de-perder-el-servidor) la última copia de seguridad en la nueva base de datos vacía.
4. Apunta la dirección antigua al nuevo servidor (DNS o tu proxy), mantén `KEPT_PUBLIC_URL` igual,
    y inicia Kept. Las etiquetas y los códigos QR siguen funcionando porque la dirección no ha cambiado.
5. Detén el servidor antiguo una vez que el nuevo haya sido verificado, y mantén su disco hasta que el nuevo haya tenido un
    buena copia de seguridad y un [ejercicio de restauración](/es/admin/restore/#el-simulacro-mensual).

Si la dirección cambia, las etiquetas ya impresas todavía llevan la antigua: apunta el nombre de host antiguo
al nuevo servidor también, y agrégalo entre los nombres de host anteriores de la instancia: Kept luego redirige una
visita bajo el nombre antiguo a la misma página en la nueva dirección.

## Una ubicación a la vez: mediante una exportación

Un propietario exporta una ubicación, con sus archivos y, si elige, sus valores secretos bajo un
frase de acceso; en el nuevo servidor lo importan a una nueva ubicación. Esto mueve un hogar sin
el resto de la instancia, y funciona entre dos instancias que ejecutan versiones diferentes, siempre que
el nuevo no sea más antiguo que el antiguo (un Kept más antiguo podría rechazar una exportación de uno más reciente).

1. En el servidor antiguo, en **Configuración → Exportar**, exporta la ubicación. Elige si incluir
    valores secretos; si lo haces, establece una frase de acceso. Las exportaciones se realizan solo por HTTPS y permanecen listas para
    descargarlas durante 7 días.
2. En el nuevo servidor, inicia sesión, abre **Configuración → Importar**, y elige la exportación de Kept (el ZIP).
    Kept lo verifica primero y muestra qué agregará antes de que se escriba nada; proporciona la frase de acceso
    para recuperar los valores secretos.
3. La importación crea una **nueva ubicación** con los objetos, lugares, archivos, informes de estado, movimientos
    y su historial. Impresas
    las etiquetas siguen funcionando: el código corto de una etiqueta se mantiene cuando está libre en el nuevo servidor, y
    se vuelve a emitir cuando no lo está, en cuyo caso escanear la etiqueta antigua aún abre el objeto.
4. Invita a las personas que compartieron la ubicación; la importación las enumera, pero no invita a nadie por
    sí misma.
