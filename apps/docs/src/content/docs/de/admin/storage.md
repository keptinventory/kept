---
title: Dateispeicher wechseln
description: Verschiebe Kepts Dateien zwischen dem Datenträger des Servers und einem S3-Bucket mit verifizierter Kopie.
sidebar:
  order: 6
---

Kept speichert Dateien (Fotos, Belege, Dokumente) entweder auf dem Datenträger (`KEPT_STORAGE=local`, die
Voreinstellung) oder in einem S3-kompatiblen Bucket (`KEPT_STORAGE=s3` mit den `KEPT_S3_*`-Variablen). Nur
`KEPT_STORAGE` zu ändern verschiebt nichts: Die bereits gespeicherten Dateien bleiben dort, wo sie sind, und Kept
kann sie nicht mehr finden. Das Verschieben ist eine Kopie.

## Verschieben

Da gespeicherte Dateien nicht mehr ändern, ist die Kopie sicher, während Kept läuft, und sie kann wiederholt werden: Eine
Datei, die am Ziel bereits mit dem richtigen Hash existiert, wird übersprungen.

1. Füge die Einstellungen des Ziels neben die aktuellen (für S3: `KEPT_S3_BUCKET`,
   `KEPT_S3_ACCESS_KEY_ID`, `KEPT_S3_SECRET_ACCESS_KEY` und, falls nötig, `KEPT_S3_ENDPOINT`,
   `KEPT_S3_REGION`, `KEPT_S3_FORCE_PATH_STYLE`), während `KEPT_STORAGE` unverändert bleibt.
2. **Kopiere, während Kept läuft:** `kept admin storage copy --to s3` (oder `--to local`). Jede Datei, auf die die
   Datenbank verweist, und deren in der Größe veränderten Versionen werden kopiert und ihr SHA-256 geprüft. `--dry-run`
   zählt nur.
3. **Stoppe Kept** und kopiere erneut: Nur was seitdem angekommen ist, wird kopiert.
4. Setze `KEPT_STORAGE` auf den neuen Speicher und starte Kept.
5. **Prüfen:** `kept admin storage verify --store s3` prüft jede Datei, auf die die Datenbank verweist.

Die alten Dateien bleiben dort, wo sie waren; lösche sie selbst, sobald du zufrieden bist.

## Bevor du S3 wählst

- Aktiviere **Bucket-Versionierung**: Bei S3-Speicher enthalten die Backups die Dateien nicht, und Versionierung
  ist das, was eine gelöschte oder überschriebene Datei wiederbringt ([Backups](/de/admin/backups/#wenn-dateien-in-s3-liegen)).
- Telefone rufen Dateien direkt aus dem Bucket über kurzlebige signierte Links ab. Wenn der Server den Bucket über eine
  Adresse erreicht, die Telefone nicht erreichen (im Compose-Setup zum Beispiel), setze
  `KEPT_S3_PUBLIC_ENDPOINT` auf die, die sie erreichen.
- Stelle den Bucket über seinen eigenen Hostnamen bereit, nie über den von Kept.
