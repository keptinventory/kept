---
title: El grafo
description: Ver una ubicación como un grafo de sus pisos, habitaciones, cajas y objetos, en 2D o 3D, con lo que necesita atención y tus etiquetas.
---

La página de una ubicación tiene cinco diseños: **Lista**, **Cuadrícula**, **Grafo**, **Tabla** y **Mapa**. Tabla solo está en pantallas anchas, así que un teléfono muestra Lista · Cuadrícula · Grafo · Mapa. **Grafo** dibuja la ubicación como nodos y enlaces: la ubicación, sus pisos, las habitaciones en ellos, los estantes, armarios y cajas en las habitaciones, y los objetos dentro de esos. Kept recuerda tu elección para cada ubicación en cada dispositivo. La página de un piso o una habitación también tiene **Grafo**, abierta en ese lugar.

El grafo necesita una conexión, como el mapa: no forma parte de la copia sin conexión del teléfono. Se carga solo cuando lo abres.

## 2D

El grafo 2D muestra un lugar en el centro y dos niveles alrededor: lo que está directamente dentro en el primer anillo, y lo que está en esos en el segundo, cuando hay espacio para ello.

- **Tamaño** muestra cuánto hay dentro: un nodo más grande contiene más objetos.
- Un nodo cuyo contenido no se dibuja muestra su cantidad.
- **Elige** un nodo para ver su tarjeta. **Elígelo de nuevo**, o **Entra** en la tarjeta, para ponerlo en el centro.
- La **ruta** sobre el grafo (Inicio › Planta baja › Garaje) regresa al nivel anterior.
- **Habitaciones · Cajas · Todo** elige qué tan profundo dibuja: solo lugares, lugares y cajas, o todo hasta los objetos.

Arrastra para mover el grafo, desplázate o haz pellizco para hacer zoom, y el botón de la casa muestra toda la ubicación de nuevo.

## 3D

**3D** muestra toda la ubicación a la vez: la ubicación arriba, cada piso como una capa a su propia altura, las habitaciones en un anillo alrededor de su piso, y lo que contienen extendido en abanico más allá de ellas. Una ubicación sin pisos es una capa.

Gira lentamente solo hasta que lo toques, y quieto inicia cuando tu dispositivo pide menos movimiento. Arrastra para girarlo, desplázate o haz pellizco para hacer zoom. Los botones de al lado lo giran a izquierda y derecha, miran desde más alto o más bajo, hacen zoom, inician o detienen el giro, y muestran toda la casa. Los botones de piso (como en el mapa) traen un piso al frente; **Todo** muestra todos los pisos.

Elegir un nodo trae su rama al frente: todo lo de afuera se desvanece, y muestra lo que contiene. Kept recuerda si prefieres 2D o 3D en cada dispositivo.

## Puntos y etiquetas

Los puntos en un nodo muestran lo que necesita atención dentro, en los colores del mapa: **Stock bajo** (rojo), **Prestado** (azul) y **Vence pronto** (naranja). Vienen de los mismos lugares que los puntos del mapa: Consumibles, Préstamos, y programaciones, garantías y documentos. El nombre de cada nodo para lectores de pantalla también los dice ("Garaje, Habitación, 9 objetos, 1 prestado").

Activa **Etiquetas** para agregar tus etiquetas como fichas en sus propios colores, cada una vinculada a los lugares y cajas que contienen los objetos en los que aparecen. Elige una etiqueta para listar lo que la lleva.

## La tarjeta

La tarjeta muestra dónde está un nodo, qué es, cuántos objetos contiene, sus puntos y lo que tiene dentro (elige cualquiera de ellos). **Abrir** va a su página, **Muestra en el mapa** abre el mapa en él (o en el lugar que contiene un objeto), y **Entra** lo pone en el centro del grafo 2D. En un teléfono, la tarjeta es una hoja en la parte inferior; **×** o Escape la cierra.

## Con un teclado o un lector de pantalla

Cada nodo es un botón. Tab se mueve por ellos en el orden del árbol, Enter selecciona uno y Enter otra vez entra, y Escape cierra la tarjeta y luego sube un nivel. Debajo del grafo, una lista de lo que muestra (para lectores de pantalla, y visible cuando entras con Tab) hace lo mismo.

## Ubicaciones grandes

Kept dibuja hasta 2,000 objetos en un grafo. Después de eso, el resto se cuenta en sus lugares y cajas pero no se dibuja. En 3D, una ubicación con más de unos 450 lugares, cajas y objetos muestra los objetos solo para la rama que elegiste.
