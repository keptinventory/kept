---
title: "Ein Release verifizieren"
description: "Prüfe, ob ein Kept-Image das ist, das der Maintainer gebaut und signiert hat."
sidebar:
  order: 11
---

Jedes Release-Image wird mit **cosign** signiert, mit einem Schlüssel, den der Maintainer hält, und wird mit einem
SBOM (der Liste von allem, was drin ist) und einer Datei mit Drittanbieter-Hinweisen ausgeliefert. Release-Images sind getaggt
als `X.Y.Z`, `X.Y` und `X`, die alle auf einen verifizierten Digest zeigen; es gibt nie ein `latest`.

Um ein Image zu prüfen, bevor du es ausführst, installiere cosign und verifiziere es anhand von `cosign.pub` aus dem
Repository:

```sh
cosign verify --key cosign.pub <image>:<version>
```

Signaturen werden im öffentlichen Transparenz-Log gespeichert, und die Notes jedes Release geben den genauen
Befehl an. Eine gute Signatur gibt die verifizierten Angaben aus und endet mit 0; alles andere heißt, dass du es nicht ausführen solltest. Pinne den
Digest, den es ausgegeben hat, in `KEPT_IMAGE` (`<image>@sha256:…`), um genau dieses Image auszuführen.

Das Helm-Chart wird als OCI-Artifact neben dem Image veröffentlicht und auf die gleiche Weise signiert. Ein laufendes
Kept gibt seine Version, den Commit, aus dem es gebaut wurde, und sein Quell-Repository unter `/version` an
und stellt die Drittanbieter-Hinweise des Images unter `/notices.txt` bereit (verlinkt von der Versionszeile in der
App).
