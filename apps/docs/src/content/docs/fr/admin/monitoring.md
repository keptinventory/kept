---
title: Prometheus et Grafana
description: "Collectez les /metrics de Kept avec Prometheus, visualisez-les dans Grafana, et configurez des alertes sur les sauvegardes, le disque et les redémarrages."
---

Un guide pour surveiller Kept avec Prometheus et Grafana. Les métriques elles-mêmes, les vérifications de santé, les journaux et le traçage se trouvent sur [Surveillance](/fr/admin/observability/).

## 1. Activer `/metrics`

Créez un jeton dans un terminal :

```sh
openssl rand -hex 32
```

et collez la valeur dans `.env` à côté de `compose.yaml` :

```sh
KEPT_METRICS_TOKEN=<the value>
```

`.env` est lu tel quel, donc `$(openssl …)` y serait pris à la lettre. Appliquez ensuite :

```sh
docker compose up -d
```

Compose transmet la variable à Kept. Sans elle, `/metrics` n'existe pas. Vérifiez qu'il répond :

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

Sur Kubernetes, placez `KEPT_METRICS_TOKEN` dans un Secret et nommez-le dans le champ `metrics.tokenSecret` du chart ([Kubernetes](/fr/install/kubernetes/)).

## 2. Collecter les métriques

Enregistrez le jeton dans un fichier lisible par Prometheus, par exemple `/etc/prometheus/kept-token`, et ajoutez une tâche :

```yaml
scrape_configs:
  - job_name: kept
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kept-token
    static_configs:
      - targets: ['kept:8080']
```

`kept:8080` est le service Kept sur le réseau Compose ; depuis ailleurs, utilisez l'adresse et le port par lesquels Prometheus accède à Kept. Rechargez Prometheus : sa page des cibles doit afficher `kept` comme actif.

## 3. Quoi surveiller

| Métrique | À surveiller |
|---|---|
| `kept_process_uptime_seconds` | Retombe à un faible chiffre quand le processus redémarre |
| `kept_process_resident_memory_bytes` | Croissance vers la limite de mémoire du conteneur |
| `kept_db_pool_connections{state="waiting"}` | Supérieur à 0 pendant plus d'une minute : requêtes en attente de la base de données |
| `kept_backup_last_success_timestamp_seconds` | Datant de plus de 36 heures (0 signifie qu'aucune bonne sauvegarde n'a encore été effectuée) |
| `kept_backup_last_run_status{status="failed"}` | 1 : la dernière sauvegarde a échoué |
| `kept_disk_used_ratio{volume="data"}` | Supérieur à 0.85 |
| `kept_update_available` | 1 : une version plus récente est disponible. Reste à 0 sauf si la vérification des mises à jour est activée ([mises à jour](/fr/admin/upgrades/)) |

Les données de sauvegarde et de disque proviennent d'une vérification effectuée chaque heure ; elles peuvent donc dater de jusqu'à une heure.

## 4. Grafana

Un tableau de bord avec un panneau par ligne :

- **Stat** : `kept_build_info`, selon son libellé `version`.
- **Série temporelle** : `kept_process_uptime_seconds` et `kept_process_resident_memory_bytes`.
- **Série temporelle** : `kept_db_pool_connections`, selon `pool` et `state`.
- **Stat** : `time() - kept_backup_last_success_timestamp_seconds`, l'âge de la sauvegarde en secondes.
- **Stat** : `kept_backup_last_run_status`, selon `status`.
- **Jauge** : `kept_disk_used_ratio{volume="data"}`, de 0 à 1.

## 5. Alertes

```yaml
groups:
  - name: kept
    rules:
      - alert: KeptDown
        expr: up{job="kept"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: Kept is down

      - alert: KeptBackupStale
        expr: >-
          kept_backup_last_success_timestamp_seconds > 0
          and time() - kept_backup_last_success_timestamp_seconds > 36 * 3600
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Kept's last good backup is more than 36 hours old

      - alert: KeptBackupFailed
        expr: kept_backup_last_run_status{status="failed"} == 1
        labels:
          severity: critical
        annotations:
          summary: Kept's last backup failed

      - alert: KeptDiskFilling
        expr: kept_disk_used_ratio{volume="data"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Kept's data disk is over 85% full

      - alert: KeptUpdateAvailable
        expr: kept_update_available == 1
        for: 1h
        labels:
          severity: info
        annotations:
          summary: A new Kept release is available
```

Les 36 heures et 85 % correspondent aux alertes d'administration propres à Kept ([surveillance des sauvegardes](/fr/admin/backups/#le-surveiller)). La condition `> 0` maintient silencieuse la règle de sauvegarde périmée sur un Kept qui n'a pas encore effectué sa première sauvegarde : la métrique vaut 0 jusque-là.

## Voir aussi

- [Surveillance](/fr/admin/observability/) : vérifications de santé, métriques, journaux, traçage et rapports d'erreurs.
- [Sauvegardes](/fr/admin/backups/) pour activer les sauvegardes.
- [Dépannage](/fr/admin/troubleshooting/) lorsqu'une alerte se déclenche.
