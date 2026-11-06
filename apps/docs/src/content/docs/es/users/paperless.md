---
title: Paperless-ngx
description: Enlaza un objeto o lugar a sus recibos, manuales y tarjetas de garantía en Paperless-ngx. Kept guarda el enlace y un título, no el archivo, a menos que lo copies.
---

Si guardas tu documentación en [Paperless-ngx](https://docs.paperless-ngx.com/), Kept puede vincular un objeto a sus documentos allí en lugar de subirlos dos veces. El taladro muestra su recibo y su manual; la cocina muestra la factura del refrigerador.

Opcional: solo si ya usas Paperless-ngx. Kept funciona igual sin él.

## Antes de empezar

| Lo que necesitas | Por qué |
|---|---|
| **Paperless-ngx 2.16 o posterior** | Kept solicita la versión 9 de la API de Paperless, que 2.16 añadió y 3.x sigue sirviendo |
| **Un token de API** | En Paperless: **Mi perfil**, luego la flecha circular junto al token de API. Kept ve lo que ese usuario de Paperless ve, así que basta con un usuario que solo pueda ver tus documentos |
| **Kept puede alcanzar Paperless** | Desde la máquina en la que se ejecuta Kept, no desde tu teléfono |
| **`https`**, o tu propia red | Con `http` sin cifrar el token viaja sin protección, así que Kept acepta `http` solo para una dirección en tu red local. Esa dirección necesita **Administrador → Configuración → Permitir direcciones privadas** ([solicitudes salientes](/es/admin/security-model/#solicitudes-salientes-ssrf)) |

## Conectar

Un propietario o administrador de la ubicación:

1. **Configuración de ubicación → Paperless**.
2. **Dirección de Paperless**: la dirección en la que abres Paperless, como
   `https://paperless.example.com` (una ruta como `/paperless` está bien).
3. **Token de API**, luego **Conectar**. Kept inicia sesión primero e indica por qué si no
   puede: un token rechazado, una dirección que no responde como Paperless, una versión demasiado
   antigua.

Una vez conectado, la página muestra la versión de Paperless y cuántos documentos están vinculados.
**Probar conexión** vuelve a consultar a Paperless. Para cambiar el token, escribe uno nuevo y pulsa
**Guardar**; déjalo vacío para conservar el guardado.

## Vincular documentos

En la página de un objeto, bajo **Documentación**, **Vincular desde Paperless** está junto a **Añadir
un archivo** (en la página de un lugar, junto a **Agregar documento**). Abre una búsqueda en tu
Paperless: palabras del título o del texto, un remitente, un tipo o una etiqueta. Basta con el
inicio de una palabra: `Camel` encuentra "Camelot". La sintaxis de búsqueda de Paperless pasa
tal cual al escribirla, como `title:manual` o `*amel*` para el medio de una palabra. Marca uno
o más y pulsa **Vincular**.

Los documentos vinculados aparecen en la misma lista de Documentación que los archivos. Cada uno
muestra su miniatura, su título, el tipo y el remitente de Paperless, y su fecha, con:

- **Tipo**: *Manual*, *Garantía*, *Recibo*, *Factura* o *Documento*. Cámbialo cuando el tipo de
  Paperless no diga qué es el documento.
- **Abrir en Paperless**: la página del documento en Paperless, en una pestaña nueva.
- **Descargar**: el documento, a través de Kept. Miembros y superiores.
- **Copiar en Kept**: ver más abajo.
- **Desvincular**: se quita del objeto. Paperless lo conserva.

El tipo proviene del tipo de documento en Paperless y luego de sus etiquetas: se reconocen *Recibo*,
*Factura*, *Manual* y *Garantía* (y las mismas palabras en francés, alemán, italiano y árabe);
todo lo demás es un documento. Después el tipo es tuyo para cambiarlo, y **Copiar en Kept** copia
el documento con ese tipo. El filtro **Tipo** en Documentación estrecha los archivos y los
documentos vinculados juntos.

**Desde una [importación de Homebox](/es/users/import-export/#una-exportación-de-homebox):** un enlace de Homebox
a uno de tus documentos de Paperless (`…/documents/123`, o el de la API
`…/api/documents/123/download/`) en la dirección a la que está conectada esta ubicación entra como
un documento vinculado en el objeto o lugar. Su título proviene de Paperless, su tipo del tipo de
adjunto de Homebox. Conecta Paperless antes de importar; cualquier otro enlace sigue siendo un
enlace simple.

Kept solicita los títulos a Paperless cuando se ejecuta la importación, no cuando comprueba la
exportación. Si no se puede alcanzar Paperless, o no tiene un documento o no lo muestra a su
usuario, la importación termina de todos modos y ese enlace conserva el título de Homebox, o su
dirección si Homebox no tiene ninguno. El informe de la importación dice cuántos. Para obtener
el título de Paperless más tarde, **Desvincula** el documento y usa **Vincular desde Paperless**,
o **Copiar en Kept**.

## Vinculado o copiado

| | Vinculado | Copiado en Kept |
|---|---|---|
| Lo que Kept guarda | El número del documento en Paperless, su título, su tipo, el tipo de Paperless, el remitente y la fecha | El propio archivo, como adjunto en el objeto |
| Si Paperless está caído | Los títulos siguen mostrándose, con una nota de que no se puede alcanzar Paperless | Nada cambia |
| En las copias de seguridad y exportaciones de Kept | No: un enlace necesita el Paperless de este servidor | Sí, como cualquier otro archivo |
| Si el documento cambia en Paperless | Su título se actualiza cuando lo copias | La copia queda como estaba |

**Copiar en Kept** es por documento y explícito: úsalo para lo que deba sobrevivir sin Paperless,
como un recibo que necesitarás para una reclamación de garantía. La copia es el archivo que
Paperless sirve para descargar (su PDF archivado cuando haya hecho uno), verificado y dimensionado
como una subida.

## Quién puede hacer qué

| | Lector | Miembro | Administrador, propietario |
|---|---|---|---|
| Ver documentos vinculados y miniaturas | ✓ | ✓ | ✓ |
| Buscar en Paperless, vincular, copiar, descargar | | ✓ | ✓ |
| Cambiar el tipo, desvincular | | Los suyos | Cualquiera |
| Conectar, cambiar, desconectar | | | ✓ |

Los recibos y las facturas son dinero: donde el dinero está oculto para ti en una ubicación, los
recibos y las facturas vinculados también lo están, y no puedes convertir un documento vinculado
en recibo ni factura.

Un [token personal](/es/users/mcp-clients/#crea-un-token-personal) lee los enlaces de un objeto o lugar
(`GET /api/v1/paperless-links?thingId=…`), nunca la conexión, una búsqueda, una miniatura o un
documento. La herramienta MCP `get_thing` lista los documentos vinculados de un objeto por título.

## Privacidad

- El token se sella con la clave secreta de Kept, como la contraseña de un buzón. Kept nunca lo
  muestra, ni lo registra, ni lo incluye en una entrada de auditoría ni en una exportación.
- Tu navegador nunca habla con Paperless con el token. Las búsquedas, miniaturas y descargas pasan
  por Kept, que primero comprueba que puedas ver el objeto. Las miniaturas son recodificadas por
  Kept y se guardan cinco minutos.
- **Abrir en Paperless** es un enlace normal: inicias sesión en Paperless como tú mismo.
- Mover un objeto a otra ubicación elimina sus enlaces: nombran documentos en el Paperless de la
  ubicación anterior, que quizá los miembros de la nueva ubicación no vean.

## Desconectar

**Configuración de ubicación → Paperless → Desconectar** elimina la conexión y todos los enlaces a
sus documentos. Los documentos copiados en Kept permanecen.

## Aún no disponible

- Sincronización bidireccional: Kept no cambia nada en Paperless.
- Emparejar recibos con objetos automáticamente.
- Enviar los archivos propios de Kept a Paperless.
