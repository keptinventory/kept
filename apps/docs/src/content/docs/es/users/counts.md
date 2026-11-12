---
title: Conteos y revisiones de inventario
description: Cada conteo y revisión de caja se guarda, con lo que se encontró, lo que faltó y dónde está ahora cada objeto. Cuenta un lugar en grupo, planifica un conteo cada pocos meses, compáralo con el anterior y exporta un CSV.
---

Un conteo guarda cada resultado. **Conteos** lista cada conteo y revisión de caja de una ubicación, los más recientes primero, y la página de un conteo muestra qué encontró, qué dejó faltando y dónde está ahora cada objeto.

Ábrelo desde **Más → Conteos**, desde la página de una ubicación (**Conteos**) o desde la página de un lugar (**Conteos pasados**). Después de guardar un conteo, **Ver este conteo** lo abre.

## La lista de Conteos

Busca por lo que se contó y filtra por tipo (conteos, revisiones de caja), lugar, quién contó, **Tuvo faltantes** y fecha. Agrupa por lugar, persona o mes. La lista tiene páginas, y cada filtro queda en la URL, para que una lista filtrada pueda guardarse en favoritos o guardarse como vista.

## La página de un conteo

- **Encontrado X de Y**, cuándo, cuánto tardó, quién contó (todos, en un conteo compartido) y quién lo terminó.
- **Desde el recuento anterior** del mismo lugar o caja: "1 nuevo faltante, 0 encontrados de nuevo, 2 objetos nuevos", con un enlace al anterior.
- Sus listas, cada fila enlaza al objeto con dónde está ahora:

| Lista | Qué significa |
|---|---|
| Encontrado | Leído durante el conteo: marcado como visto |
| Faltante | En la lista, no leído y no marcado como ausente |
| Encontrado en otro lugar | Leído aquí, pero Kept lo tenía en otro lugar, y lo dejaste allí |
| Movido aquí | Encontrado en otro lugar y movido aquí |
| Marcado como ausente | Elegido en el resumen |
| Prestado, En reparación, En la papelera | Nunca faltante: fuera por un motivo que Kept conoce |
| No contado: Repisa trasera | En un área que nadie contó (ver más abajo) |

Un objeto enviado a la papelera desde el conteo sigue mostrándose, marcado **En la papelera**.

**Exportar CSV** guarda el conteo como hoja de cálculo: objeto, ID corto, dónde se esperaba, el resultado, cuántos se encontraron de cuántos, y dónde está ahora.

Los conteos guardados antes de Kept 1.14 muestran sus totales; no registraron qué faltaba ni qué estaba en otro lugar.

## Nunca "faltante" por un motivo

Un objeto prestado, en reparación o en la papelera nunca se lista como faltante. El resumen le da a cada uno su propio grupo, "Con Murdock (3)", "En reparación (1)", y el conteo los mantiene así.

## No contado, y "Lo revisé"

Un conteo de un lugar con lugares dentro (o de una ubicación completa) tiene **áreas**: el lugar y cada lugar dentro de él. Un área donde no se leyó nada está **No contado**: sus objetos se listan bajo "No contado: Repisa trasera", no bajo Faltante. Si miraste y el área de verdad estaba vacía de esos objetos, toca **Lo revisé**: pasan a ser faltantes.

## Contando cantidades

Un objeto con una cantidad (6 latas) cuenta como todas ellas cuando se lee su etiqueta. Usa **−** y **+** en su fila para decir cuántos encontraste. Si encontraste menos, elige **Marcar el resto como ausente** para él: el resto se separa como su propia fila, marcado como ausente, como hace una revisión de caja. Deshacer los vuelve a unir.

## Contando juntos

Un conteo iniciado en línea se comparte. Cualquiera que abra un conteo del mismo lugar ve **Conteo en progreso por Sam: Unirse**. Unirse agrega lo que leíste al mismo conteo, cada lectura con quién la leyó; el resumen muestra lo que los demás encontraron, y sus áreas cuentan como contadas. Cualquiera que esté contando allí puede terminarlo, y terminarlo requiere conexión. Un conteo unido durante varios días permanece abierto hasta que alguien lo termine.

## Cobertura de etiquetas

La configuración del conteo dice cuántos de los objetos allí tienen etiquetas ("El 62% de los objetos aquí tienen etiquetas"), con **Imprima etiquetas para el resto**. Un objeto sin etiqueta nunca falta: márcalo en el resumen si lo viste.

## Conteos planificados

En la página de un lugar, **Contar regularmente** planifica un conteo cada 1 a 24 meses. Es un programa del lugar, con el recordatorio habitual (una semana antes), vencido y atrasado, y el mosaico Needs-you. Contar ese lugar (con o sin los lugares dentro) lo marca como hecho; deshacer el conteo también deshace eso. Para contar regularmente una ubicación completa, planifícalo en su lugar principal.

## Quién puede hacer qué

| | Propietario, administrador, miembro | Lector |
|---|---|---|
| Ver Conteos, la página de un conteo, comparar, Exportar CSV | ✓ | ✓ |
| Contar, unirse a un conteo | ✓ | Una revisión: no se guarda nada, no se lista |
| Planificar un conteo | ✓, con Schedules activado | — |

## Desactivar los conteos

Conteos es un módulo, activo en todos los preajustes. Un propietario o administrador lo desactiva
en **Configuración de ubicación → Qué seguir** (**Conteos**). Desactivado en una ubicación, sus
lugares no tienen **Contar aquí**, **Contar regularmente** ni **Conteos pasados**, sus cajas no
tienen **Contar esta caja**, sus habitaciones en el mapa no tienen **Contar esta habitación**, e
**Iniciar una sesión** no ofrece contar allí. **Conteos** en Herramientas desaparece cuando está
desactivado en todas tus ubicaciones. Los conteos planificados dejan de recordarse. La **Revisión
de caja** se queda. No se borra nada: al volver a activarlo, cada conteo sigue ahí.
