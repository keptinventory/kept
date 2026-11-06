---
title: Vehículos y máquinas
description: "Registra lecturas, servicios y combustible de cualquier cosa con medidor: autos, generadores, calderas. Horarios por fecha o por lectura, programas iniciales, consumibles de existencias e informe de historial."
---

Kept registra cualquier objeto con un medidor: un auto, un generador, una caldera, una cortacésped. Un objeto cuyo tipo es medido obtiene **Medidores**: lecturas, servicios y horarios. **Vehículos** (preconfiguraciones Household y Complete) reúne todos los vehículos en un solo lugar, cada uno con pestañas para su resumen, lecturas, servicios, documentos, costos y, en Complete, combustible.

Esta página cubre registrar lecturas y servicios, horarios, combustible e informe de historial. Para las formas de mapa que puede llevar un vehículo, consulta [formas de mapa](/es/users/map-shapes/).

## Registrar una lectura

Una lectura funciona desde Inicio, desde el vehículo y sin conexión. Una lectura que no encaja entre sus vecinas se rechaza, y Kept te dice por qué. Una foto del tablero se une a las fotos de prueba del vehículo.

## Registrar un servicio

Un registro de servicio guarda la visita al taller:

- **Fecha** y **leyendo** en ese momento.
- **El taller** y **la factura**. La IA puede completar las partidas desde la factura.
- **Partidas** con sus costos.
- **Horarios completados**: guardar reinicia su cuenta.
- Líneas **De existencias** (abajo).
- **Notas**.

En la pestaña **Servicios** de un vehículo, toca un servicio para abrirlo: todo lo que contiene, incluidas las notas.

- **Editar** abre el mismo formulario, ya completado. Guardar cambia solo lo que cambiaste.
- **Eliminar** pregunta primero y luego ofrece **Deshacer**. Sus líneas y la factura van con él; los horarios que completó cuentan desde el servicio anterior.
- Quién puede: quien lo registró, y el propietario y los administradores de la ubicación. Un observador puede abrirlo, no cambiarlo.
- Una factura que aún se está leyendo es un **borrador**: **Finalizar registro** o **Descartar borrador**.

## De existencias

Cuando Consumibles está activo para la ubicación, una línea de servicio puede elegir un consumible de la misma ubicación: el filtro de aceite en el estante.

- Guardar quita del conteo del consumible la cantidad de la línea (1 cuando la cantidad está vacía).
- Kept se niega a quitar más de lo que queda.
- Editar la línea, quitarla, eliminar el servicio o deshacer cualquiera de estos vuelve a dejar el conteo correcto.
- Una factura que aún se está leyendo no quita nada hasta que la guardes.

El **Historial** del consumible muestra el uso, con un enlace al servicio.

El asistente y los clientes MCP pueden registrar un servicio de la misma manera ("usó 4,5 litros del aceite de motor"). La tarjeta de confirmación del asistente muestra cada línea **De existencias** antes de que se mueva algo.

## Horarios

Un horario es un recordatorio para volver a hacer algo, por fecha o por lectura.

- **Agregar programas iniciales** agrega los usuales: cambio de aceite, rotación de llantas, líquido de frenos, filtro de aire.
- **Un evento único** (una fecha, sin repetición) queda hecho cuando lo completas. Sale de Pendiente y Vencido, y **Horarios** lo lista como **Listo** con el día. Deshaz la finalización, o elimina ese servicio, y vuelve a estar pendiente.
- Los horarios pendientes y vencidos aparecen en el **Te necesita** de Inicio, y en el feed del calendario y el centro de notificaciones. Consulta recordatorios y notificaciones.

## Combustible (preconfiguración Complete)

En la preconfiguración Complete, la pestaña **Combustible** registra cada llenado. El formulario pide la **cantidad** (en tu unidad: litros, galones o una carga en kWh para un EV) y el **costo**; el precio por unidad se calcula a partir de esos, no se introduce. También tiene fecha y hora, **Tanque lleno** o **Parcial**, el **Odómetro** (opcional, se comprueba con las lecturas anteriores y posteriores), una foto del odómetro, el recibo de la bomba, una nota y la estación — se agrega una estación nueva a tus proveedores cuando guardas. **Me salté un llenado antes de este** marca un hueco, para que el consumo siga correcto: el consumo se mide de un llenado completo al siguiente, y vuelve a mostrarse después de dos llenados completos con lecturas de odómetro.

## Unidades

- **Odómetro**: el odómetro de un vehículo nuevo cuenta en **km**; el medidor de un generador cuenta horas. La unidad de un medidor no se puede cambiar aún una vez creado.
- **Lecturas y cantidades de combustible** se guardan exactamente como se introdujeron y nunca se convierten.
- **Uso de combustible** se muestra como L/100 km, o kWh/100 km para una carga; por hora en un medidor de horas.

## Costos

La pestaña **Costos** de un vehículo muestra sus costos de combustible, servicio y tarifas. Insights muestra las mismas cifras de tus vehículos bajo **Costos de vehículos**.

## Leer una tarjeta de registro

En el modo Label, **Leer la tarjeta** lee una tarjeta de registro: VIN, matrícula y vencimiento de la licencia.

## Informe de historial

**Informe de historial** hace un PDF para un período: historial del odómetro con fotos de prueba, servicios con sus facturas, combustible y documentos, y costos solo donde puedes ver dinero.

## Relacionado

- [Uso diario](/es/users/everyday-use/) para la visión general.
- [Conteos e inventarios](/es/users/counts/) para consumibles registrados en existencias.
- [Proveedores de IA](/es/users/ai-providers/) para leer facturas y tarjetas.
