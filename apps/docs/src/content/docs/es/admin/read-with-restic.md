---
title: Lee tu inventario solo con restic
description: El servidor se ha ido. Con restic, la contraseña de la copia de seguridad y cualquier ordenador, abre la copia legible de todo lo que tenías - sin Kept, sin red.
sidebar:
  order: 3
---

Cada instantánea nocturna contiene una **copia legible** de cada ubicación: un `index.html` que abres en un
navegador, una hoja de cálculo (CSV) de los objetos, miniaturas y los recibos y documentos a los que
enlazan las páginas. Está hecha para el día en que Kept no pueda funcionar: el servidor ardió, el
disco falló o Kept ya no existe. Solo necesitas:

- **restic**, el programa de copias de seguridad, en cualquier ordenador (Windows, macOS o Linux). Su
  documentación lista un paquete o una descarga para cada sistema. Usa la versión 0.19.1, la que
  usa Kept, o una más nueva.
- **El repositorio y su contraseña**, de [el kit de recuperación](/es/admin/recovery-kit/), y, para un
  bucket de S3 o un servidor SFTP, las credenciales que el kit lista junto a ellos.
- La copia de seguridad misma: el disco, el bucket o el servidor SFTP al que se envió.

## 1. Apunta restic a la copia de seguridad

La sección de copia de seguridad del kit de recuperación da la ubicación y la contraseña del
repositorio y, para S3, las dos claves. En una terminal:

```sh
export RESTIC_REPOSITORY='<the repository line from the kit>'
export RESTIC_PASSWORD='<the backup password from the kit>'
# S3 only:
export AWS_ACCESS_KEY_ID='<from the kit>'
export AWS_SECRET_ACCESS_KEY='<from the kit>'
```

En Windows PowerShell, `$env:RESTIC_REPOSITORY = '…'` y así sucesivamente. Una copia de seguridad en
directorio copiada en un portátil es solo su ruta: la carpeta `restic` dentro del directorio de la
copia de seguridad.

## 2. Elige una instantánea

```sh
restic snapshots
```

lista cada instantánea con su hora y sus etiquetas. Toma la más reciente etiquetada como `nightly` (o
`manual`); una instantánea `pre_upgrade` contiene solo la base de datos, no la copia legible.
Anota su ID.

## 3. Restaura la copia legible

```sh
restic restore <snapshot ID> --target ./kept-readable --include /backup/readable
```

Esto restaura solo la copia legible, no el volcado de la base de datos ni los archivos de tamaño
completo, en una carpeta nueva `kept-readable`.

## 4. Ábrela

Abre `kept-readable/backup/readable/index.html` en un navegador. Lista cada ubicación, con su
propietario y cuándo se hizo la copia; el `index.html` de cada ubicación lista sus lugares y
objetos, con sus fotos, datos de compra y documentos. El `README.txt` que está junto dice lo mismo.

Las páginas no necesitan red ni cargan nada de ningún otro sitio. El CSV de cada ubicación se abre
en una hoja de cálculo.

La copia de cada ubicación es lo que su **propietario** podía ver en Kept: el dinero aparece como
lo vio el propietario, y los valores secretos (la contraseña de Wi-Fi que guardaste en el router)
nunca están en ella. Una ubicación cuya copia falló esa noche aparece como "no incluida esta
noche"; toma la instantánea anterior.

## Navega sin restaurar

En Linux y en macOS con macFUSE, `restic mount ./mnt` muestra cada instantánea como carpetas que
puedes abrir en el sitio. Necesita FUSE, que Windows no tiene; `restore` funciona en todas
partes.
