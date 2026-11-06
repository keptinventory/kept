---
title: Verificare una release
description: Controlla che un'immagine Kept sia quella creata e firmata dal maintainer.
sidebar:
  order: 11
---

Ogni immagine di release è firmata con **cosign**, con una chiave in possesso del maintainer, e include un
SBOM (l'elenco di tutto ciò che contiene) e un file di avvisi di terze parti. Le immagini di release hanno tag
`X.Y.Z`, `X.Y` e `X`, che puntano tutte a un unico digest verificato; non esiste mai un `latest`.

Per controllare un'immagine prima di eseguirla, installa cosign e verificala con `cosign.pub` dal
repository:

```sh
cosign verify --key cosign.pub <image>:<version>
```

Le firme sono registrate nel log pubblico di trasparenza, e le note di ogni release indicano il comando
esatto. Una firma valida stampa le asserzioni verificate ed esce con 0; qualsiasi altra cosa significa non eseguirla. Fissa il
digest stampato in `KEPT_IMAGE` (`<image>@sha256:…`) per eseguire esattamente quell'immagine.

Il chart Helm è pubblicato come artefatto OCI accanto all'immagine e firmato allo stesso modo. Un Kept in esecuzione
riporta la sua versione, il commit da cui è stato compilato e il suo repository sorgente in `/version`,
e serve gli avvisi di terze parti dell'immagine in `/notices.txt` (collegato dalla riga della versione nell'
app).
