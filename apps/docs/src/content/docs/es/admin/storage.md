---
title: Cambio del almacenamiento de archivos
description: Mueve los archivos de Kept entre el disco del servidor y un bucket S3 con una copia verificada.
sidebar:
  order: 6
---

Kept guarda los archivos (fotos, recibos, documentos) en el volumen de datos (`KEPT_STORAGE=local`, el valor por defecto) o en un bucket compatible con S3 (`KEPT_STORAGE=s3` con las variables `KEPT_S3_*`). Cambiar solo `KEPT_STORAGE` no mueve nada: los archivos ya guardados se quedan donde estaban y Kept no puede encontrarlos. Moverlos es copiarlos.

## Traslado

Los archivos no cambian una vez guardados, así que la copia es segura mientras Kept está en ejecución y se puede repetir: un archivo ya presente en el destino con el hash correcto se omite.

1. Añade la configuración del destino junto a la actual (para S3: `KEPT_S3_BUCKET`, `KEPT_S3_ACCESS_KEY_ID`, `KEPT_S3_SECRET_ACCESS_KEY` y, si hace falta, `KEPT_S3_ENDPOINT`, `KEPT_S3_REGION`, `KEPT_S3_FORCE_PATH_STYLE`), manteniendo `KEPT_STORAGE` como está.
2. **Copia mientras Kept se ejecuta:** `kept admin storage copy --to s3` (o `--to local`). Se copia cada archivo al que hace referencia la base de datos, junto con sus versiones redimensionadas, y se verifica su SHA-256. `--dry-run` solo cuenta.
3. **Detén Kept** y vuelve a copiar: solo se copia lo que haya llegado desde entonces.
4. Configura `KEPT_STORAGE` con el nuevo almacenamiento e inicia Kept.
5. **Verifica:** `kept admin storage verify --store s3` comprueba cada archivo al que hace referencia la base de datos.

Los archivos antiguos se dejan donde estaban; bórralos tú mismo cuando estés conforme.

## Antes de elegir S3

- Activa el **versionado del bucket**: con el almacenamiento en S3 las copias de seguridad no contienen los archivos, y el versionado es lo que recupera uno eliminado o sobrescrito ([copias de seguridad](/es/admin/backups/#cuando-los-archivos-están-en-s3)).
- Los teléfonos obtienen los archivos del bucket directamente, mediante enlaces firmados de corta duración. Si el servidor accede al bucket en una dirección a la que los teléfonos no pueden llegar (dentro de Compose, por ejemplo), configura `KEPT_S3_PUBLIC_ENDPOINT` con la que sí pueden.
- Sirve el bucket desde su propio nombre de host, nunca desde el de Kept.
