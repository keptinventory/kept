---
title: Installation auf Kubernetes mit Helm
description: Helm-Chart von Kept für k3s und andere Kubernetes-Cluster.
sidebar:
  order: 4
---

:::caution[Noch nicht auf einem echten Cluster getestet]
Das Chart (`charts/kept/` im Repository) rendert und validiert (`helm lint`, `helm template` und `kubeconform` laufen bei jedem Check), und jede Release veröffentlicht es zusammen mit dem Image, aber es wurde noch nicht auf einem echten Cluster installiert. Behandle eine erste Installation als Test. Das README enthält die Werte, die zu erstellenden Secrets und die Befehle; diese Seite erklärt, was es tut.
:::

Das Chart verwendet dasselbe Image wie Compose, mit denselben [Umgebungsvariablen](/de/reference/configuration/).

- **Secrets zuerst.** Das Chart schreibt nie ein Secret: du erstellst das Secret für die Datenbank-Logins (und bei gebündeltem Postgres das seines Superusers) vor der Installation, und verweist die optionalen (die Schlüssel, S3, die Backup-Zugangsdaten, SMTP, das Metrics-Token) in den Werten über ihren Namen.
- **Postgres:** ein gebündelter StatefulSet auf demselben gepinnten pgvector-Image wie Compose, für einen schnellen Start, oder dein eigenes PostgreSQL 18. Mit dem Secret eines Datenbank-Superusers (oder eines Provider-Admins) erstellt ein Job Kepts Rollen und Extensions; ohne eines führst du das [managed-Postgres-SQL](/de/install/managed-postgres/#das-sql) selbst aus.
- **Migrationen** laufen in einem Hook-Job mit dem Owner-Login, damit die neue Version nicht ausliefert, bevor ihre Migrationen angewendet sind. Ist ein Backup-Ziel konfiguriert, nimmt dieser Job zuerst einen [Pre-Upgrade-Snapshot](/de/admin/upgrades/) auf. Bei gebündeltem Postgres läuft der Job der ersten Installation nach der Installation, übergebe also bei diesem ersten `helm install` nicht `--wait`.
- **Lokal gespeicherte Dateien** liegen auf einem ReadWriteOnce-Volume, daher verwendet das Deployment die `Recreate`-Strategie: ein Upgrade stoppt den alten Pod, bevor der neue startet. Rolling Updates gibt es nur bei S3-Dateispeicherung und den Schlüsseln in einem Secret.
- **Backups laufen im Worker**, nie in einem CronJob: derselbe nächtliche Job wie in Compose, konfiguriert in Admin → Backups oder durch die Werte des Charts festgelegt.
- **Getrennte Web- und Worker-Deployments** sind eine Option; der Worker ist ein einzelnes Replikat.
- **Volumes bleiben erhalten** bei `helm uninstall`; lösche die Claims selbst, um die Daten zu entfernen.
- `helm test` fragt das laufende Kept nach `/readyz` und `/version`.

Die Version des Charts ist Kepts Version: Release 1.0.1 veröffentlicht Chart 1.0.1. Es wird als signiertes OCI-Artefakt neben dem Image mit jeder Release veröffentlicht; siehe [Release verifizieren](/de/admin/verify-release/).
