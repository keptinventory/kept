---
title: Vérifier une version
description: Vérifiez qu'une image Kept est bien celle que le mainteneur a construite et signée.
sidebar:
  order: 11
---

Chaque image de version est signée avec **cosign**, avec une clé détenue par le mainteneur, et est livrée avec un
SBOM (la liste de tout ce qu'elle contient) et un fichier de mentions tierces. Les images de version sont étiquetées
`X.Y.Z`, `X.Y` et `X`, toutes pointant vers un même digest vérifié ; il n'existe jamais de `latest`.

Pour vérifier une image avant de l'exécuter, installez cosign et vérifiez-la avec `cosign.pub` du
dépôt :

```sh
cosign verify --key cosign.pub <image>:<version>
```

Les signatures sont enregistrées dans le journal de transparence public, et les notes de chaque version indiquent la commande
exacte. Une signature valide affiche les claims vérifiés et se termine par 0 ; tout autre résultat signifie : ne l'exécutez pas. Épinglez le
digest affiché dans `KEPT_IMAGE` (`<image>@sha256:…`) pour exécuter exactement cette image.

Le chart Helm est publié sous forme d'artefact OCI à côté de l'image et signé de la même manière. Un Kept en cours
d'exécution indique sa version, le commit à partir duquel il a été construit et son dépôt source à `/version`,
et sert les mentions tierces de l'image à `/notices.txt` (liées depuis la ligne de version dans l'
application).
