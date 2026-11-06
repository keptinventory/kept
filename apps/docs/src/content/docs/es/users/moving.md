---
title: Mudanza
description: Empaca tu casa en cajas numeradas, imprime una etiqueta y una hoja de contenido para cada una, síguelas en la camioneta y escanea cada caja para desempacarla en su habitación.
---

**Mudanza** empaca una casa en cajas numeradas y las desempaca al otro lado. Cada caja es una caja Kept normal, así que lo que le pongas se sigue encontrando todo el camino: busca la tetera y Kept dice **Caja 7**. En la casa nueva, escanea la etiqueta de una caja, elige la habitación y la caja con todo lo que tiene dentro se mueve allí de una vez.

Funciona en un teléfono sin señal, que es la mayor parte del día de la mudanza.

![Un movimiento del Garaje a Casa: 2 empacadas, 2 en tránsito, 1 desempacada, las cuatro cajas aún por desempacar, y cada caja con la habitación a la que va](../../../../assets/screens/moving-desktop-light.webp)

![El mismo movimiento en el tema oscuro](../../../../assets/screens/moving-desktop-dark.webp)

## Actívalo

**Mudanza** es parte del preset **Completo**. Para cualquier otra ubicación, un propietario o administrador activa **Mudanza** en **Configuración de ubicación → Qué seguir**. Necesita **Etiquetas y códigos QR**, que tienen todos los presets. Su entrada, **Mudanza**, aparece entonces en la barra lateral (en un teléfono, bajo **Más**).

## 1. Inicia un movimiento

1. **Mudanza → Iniciar un movimiento**.
2. Un **nombre** ("Al nuevo piso"), y a dónde **Yendo a**: otra de tus ubicaciones, o las habitaciones de la misma cuando solo estás reorganizando.

¿Te mudas a una casa nueva? Agrégala primero como ubicación, con sus habitaciones, para que cada caja pueda ir directo a su habitación.

## 2. Empaca

- **Agregar una caja** da el siguiente número: Caja 1, Caja 2 y así sucesivamente. Elige la **Habitación a la que va** ahora si la sabes; se imprime en la hoja de contenido de la caja, y el desempaque empieza desde allí.
- Llena una caja desde su página: **Abrir la caja** para agregar objetos o moverlos dentro, o **Empaca con el escáner**: escanea objetos para tomarlos y luego la etiqueta de la caja para ponerlos dentro.
- **Imprimir etiquetas** imprime una etiqueta para cada caja (cualquier hoja de etiquetas que Kept soporte). Pégalas, una en cada caja, en un lado que veas en una pila.
- **Hojas de contenido** hace un PDF con una página por caja: su número, la habitación a la que va, lo que tiene dentro y su código. Pégalo a la caja; el código en él se escanea como la etiqueta. Una vez impreso, **¿Impreso OK?** bajo el PDF lo registra, y esas cajas muestran su código como cinta de etiqueta ámbar, como lo hace una etiqueta impresa desde **Imprimir etiquetas**.

## 3. En la camioneta

**Marcar todo en tránsito** cuando las cajas estén cargadas, o marca una caja a la vez desde su página.

El tablero empieza con los totales (**Empacado**, **En tránsito**, **Desempacado**) y lista las cajas **aún por desempacar**, para que al otro lado veas cuáles no han llegado. Busca, filtra y agrupa las cajas por estado o por habitación.

## 4. Desempaca

![Escanea para desempacar en un teléfono: Caja 1, yendo a la Cocina, con Desempacar en la Cocina](../../../../assets/screens/moving-phone-light.webp)

1. **Escanea para desempacar** durante el movimiento y apunta la cámara a la etiqueta de una caja o a su hoja de contenido. (¿Sin cámara? **Escribe el código** funciona igual.)
2. La habitación a la que va ya está elegida; cámbiala si quieres.
3. **Desempacar en la Cocina**. La caja, y todo lo que tiene dentro, está ahora en la cocina de la casa nueva. Escanea la siguiente caja de inmediato.

**Deshacer** en el mensaje pone la caja donde estaba. Cuando todas las cajas estén desempacadas, **Marca el movimiento como terminado**; **Ábrelo de nuevo** si una caja aparece después.

## Sin conexión

En un teléfono, un movimiento que hayas abierto una vez se guarda para uso sin conexión. Sin conexión aún puedes leer el tablero y el contenido de cada caja (tal como la última vez que se leyó), empacar, marcar cajas como empacadas o en tránsito, elegir la habitación a la que va una caja y desempacarlas. Esos cambios esperan en el teléfono, se muestran al instante y se sincronizan cuando vuelve a haber conexión; **Deshacer** en el mensaje te regresa mientras esperan.

Si dos teléfonos cambian la misma caja mientras están sin conexión:

- **Empacado, en tránsito, desempacado:** gana el cambio que se haya hecho por último en un teléfono, sin importar cuál se sincronice primero.
- **La habitación a la que va:** gana la habitación que se sincronice por última.
- **Una caja desempacada mientras tanto** conserva la habitación en la que se desempacó. Elegirle una habitación después no cambia nada: mueve la caja misma si pertenece a otro lugar.
- **Una habitación que alguien haya eliminado mientras tanto:** el cambio no puede aplicarse. La bandeja de entrada dice quién la eliminó, con **Restaurar**.

Iniciar un movimiento, agregar una caja, las hojas de contenido y marcar el movimiento como terminado requieren conexión.

## Desde una app conectada

Una app conectada con **Leer y cambiar** (ChatGPT, Claude: [conectar una app](/es/users/mcp-clients/)) puede iniciar un movimiento, agregar cajas, empacarlas, marcarlas en tránsito y desempacarlas, con las mismas reglas y Deshacer que aquí. Una conexión de solo lectura lista movimientos y cajas, y cuáles siguen faltando.

## Quién puede hacer qué

| | Visor | Miembro | Admin y propietario |
|---|---|---|---|
| Ver movimientos y sus cajas | Sí | Sí | Sí |
| Hacer las hojas de contenido | Sí | Sí | Sí |
| Confirmar las hojas de contenido impresas | | Sí | Sí |
| Iniciar un movimiento, agregar cajas, empacar, marcar y desempacar | | Sí | Sí |
| Eliminar un movimiento (sus cajas se quedan, como cajas) | | Sí | Sí |

Desempacar en otra ubicación requiere que también puedas agregar objetos allí. Cada cambio está en el historial de la caja y en la actividad de la ubicación.

Un export de Kept contiene también los movimientos: el número, el estado y la habitación a la que va de cada caja, con las cajas y todo lo que tienen dentro como objetos, donde están. Al importar, un movimiento a otra ubicación se vuelve un movimiento dentro de la nueva, con sus habitaciones a elegir de nuevo (el export contiene una ubicación). Una caja ya desempacada en otra ubicación está en el export de esa ubicación en su lugar, como un objeto.
