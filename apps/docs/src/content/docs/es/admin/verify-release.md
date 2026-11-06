---
title: "Verificar una release"
description: "Comprueba que una imagen de Kept es la que compiló y firmó el mantenedor."
sidebar:
  order: 11
---

Cada imagen de lanzamiento está firmada con **cosign**, con una clave que tiene el mantenedor, e incluye un
SBOM (la lista de todo lo que contiene) y un archivo de avisos de terceros. Las imágenes de lanzamiento tienen etiquetas
`X.Y.Z`, `X.Y` y `X`, todas apuntando a un mismo resumen verificado; nunca hay un `latest`.

Para comprobar una imagen antes de ejecutarla, instala cosign y verifícala contra `cosign.pub` del
repositorio:

```sh
cosign verify --key cosign.pub <image>:<version>
```

Las firmas se registran en el registro de transparencia público, y las notas de cada lanzamiento dan el comando
exacto. Una firma válida imprime las afirmaciones verificadas y termina con código 0; cualquier otra cosa significa que no la
ejecutes. Fija en `KEPT_IMAGE` el resumen que imprimió (`<image>@sha256:…`) para ejecutar exactamente esa imagen.

El chart de Helm se publica como artefacto OCI junto a la imagen y se firma igual. Un Kept en ejecución
informa su versión, el commit del que se compiló y su repositorio de origen en `/version`,
y sirve los avisos de terceros de la imagen en `/notices.txt` (enlazado desde la línea de versión de la
app).
