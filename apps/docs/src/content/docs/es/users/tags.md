---
title: Etiquetas
description: Las etiquetas dicen qué más es un objeto, además de dónde está. Agrégalas en cualquier lugar, filtra por varias, abre la página de una etiqueta y etiquétalas en un teléfono sin señal.
---

**Lugares** dicen dónde está un objeto. **Etiquetas** dicen qué más es: *acampada*, *invierno*, *niños*, *frágil*. Un objeto puede tener hasta 50 etiquetas; una cuenta hasta 1,000.

Las etiquetas pertenecen a la cuenta, así que cada ubicación de ella las comparte. Solo los objetos tienen etiquetas (las cajas son objetos); los lugares, documentos y personas no.

## Añadiendo etiquetas

- **La página de un objeto:** **Etiquetas → Agregar etiqueta**. Elige uno, o escribe un nombre nuevo y **Crear**. Un nombre cercano a una etiqueta existente se lista primero bajo **¿Quisiste decir**, así *Campng* no se convierte en un segundo *Camping*.
- **Añadiendo un objeto:** el campo **Etiquetas** en **Añadir un objeto**.
- **Capturar:** **Añadir etiquetas** debajo del nombre. Las etiquetas permanecen para las siguientes fotos, como el lugar hace.
- **Muchos de una vez:** **Seleccionar** en el contenido de un lugar, la página de una etiqueta o la Bandeja de entrada, luego **Agregar etiquetas…** o **Quitar etiquetas…**. Otras etiquetas permanecen como están.
- **Vista de hoja de cálculo:** la columna **Etiquetas** y **Etiquetas…** para una selección.

Cada cambio tiene **Deshacer**.

## Quién puede hacer qué

| | Dueño | Administrador | Miembro | Visitante |
|---|---|---|---|---|
| Ver etiquetas, filtrar por ellas | ✓ | ✓ | ✓ | ✓ |
| Etiquetar objetos, crear una nueva etiqueta | ✓ | ✓ | ✓ | |
| Renombrar, recolorear, combinar, eliminar una etiqueta | ✓ | ✓ | | |

## Colores

Cada etiqueta tiene un color de un conjunto fijo de doce, elegido para ser legible en claro y oscuro. Una nueva etiqueta toma el color menos utilizado. Cambiálo en **Configuración → Cuenta → Etiquetas → Editar**. Los colores de una importación de Homebox se vuelven el más cercano de los doce.

## La página de una etiqueta

Haz clic en una etiqueta en la página de un objeto, o en una fila en **Configuración → Cuenta → Etiquetas**. Lista todo lo que tiene la etiqueta en tus ubicaciones, con cuántos hay en cada uno, y la búsqueda, filtros y agrupamiento habituales de la lista. Los dueños y administradores renombran, recolorean, combinan y eliminan la etiqueta aquí.

- **Combinar** une una etiqueta con otra: sus objetos obtienen la otra etiqueta.
- **Eliminar** solo funciona para una etiqueta que ningún objeto tenga, incluidos los objetos en la Papelera. En su lugar, combina.
- Renombrar, recolorear, combinar y eliminar pueden deshacerse durante 7 días.

## Buscar por etiqueta

- **Filtro → Etiqueta:** **es cualquiera de**, **tiene todas las de** (objetos con cada etiqueta elegida) o **no es ninguna de**.
- **Visualización → Grupo: Etiqueta** lista cada objeto bajo su primera etiqueta, A a Z; los objetos sin etiqueta al final.
- La búsqueda encuentra nombres de etiquetas, y buscar por significado también las conoce.

## Sin conexión

El teléfono conserva tus etiquetas: las fichas aparecen, y el filtro de etiquetas funciona en la búsqueda sin conexión. Las etiquetas que añades o quitas, y las que creas, se guardan en el teléfono y se sincronizan cuando vuelves a estar en línea.

## IA y MCP

- **Capturar:** con la IA activada, una foto sugiere etiquetas de tu lista, nunca nuevas. Confirma o recházalas en la Bandeja de entrada.
- **MCP y el asistente:** `get_thing` devuelve etiquetas; `list_tags` las lista; `tag_things` las agrega o quita; `search_things` toma varias etiquetas, cualquiera o todas; `add_thing` y `update_thing` toman nombres de etiquetas.

## Importaciones

- **Homebox:** las etiquetas vienen con sus colores; las etiquetas anidadas se aplanan. Las etiquetas en las ubicaciones de Homebox no se conservan, y el informe de importación lo indica.
- **CSV:** una columna `tags` crea las etiquetas que nombra.
