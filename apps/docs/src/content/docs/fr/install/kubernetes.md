---
title: Installation sur Kubernetes avec Helm
description: Le chart Helm de Kept pour k3s et autres clusters Kubernetes.
sidebar:
  order: 4
---

:::caution[Pas encore testé sur un véritable cluster]
Le chart (`charts/kept/` dans le dépôt) est rendu et validé (`helm lint`, `helm template`
et `kubeconform` sont exécutés à chaque vérification), et chaque version pousse l'image avec celui-ci, mais il n'a pas encore été installé sur un véritable cluster. Considérez une première installation comme un test. Son README contient les valeurs, les secrets à créer et les commandes ; cette page explique ce qu'il fait.
:::

Le chart utilise la même image que Compose, avec les mêmes [variables d'environnement](/fr/reference/configuration/).

- **Secrets en premier.** Le chart n'écrit jamais de secret : vous créez le secret des identifiants de base de données (et, avec le Postgres inclus, celui du superutilisateur) avant l'installation, puis vous référencez les options facultatives (les clés, S3, les informations d'identification de sauvegarde, SMTP, le jeton de métriques) par leur nom dans les valeurs.
- **Postgres :** un StatefulSet groupé sur la même image pgvector épinglée que Compose, pour un démarrage rapide, ou votre propre PostgreSQL 18. Avec le secret du superutilisateur de base de données (ou celui de l'administrateur du fournisseur), un Job crée les rôles et extensions de Kept ; sans celui-ci, exécutez le [SQL managé PostgreSQL](/fr/install/managed-postgres/#le-sql) vous-même.
- **Migrations** s'exécutent dans un Job hook avec le identifiant du propriétaire, donc la nouvelle version ne peut pas être servie avant que ses migrations soient appliquées. Avec une cible de sauvegarde configurée, ce Job effectue d'abord un [instantané avant mise à niveau](/fr/admin/upgrades/). Avec le Postgres inclus, le Job de la première installation s'exécute après l'installation, donc ne passez pas `--wait` lors de cette première commande `helm install`.
- **Fichiers stockés localement** résident sur un volume ReadWriteOnce, donc le Déploiement utilise la stratégie `Recreate` : une mise à niveau arrête l'ancien pod avant le démarrage du nouveau. Les mises à jour glissantes ne sont possibles qu'avec le stockage de fichiers S3 et les clés dans un secret.
- **Les sauvegardes s'exécutent dans le worker**, jamais dans un CronJob : la même tâche nocturne que dans Compose, configurée dans Administration → Sauvegardes ou verrouillée par les valeurs du chart.
- **Déploiement séparé web et worker** est une option ; le worker est une seule réplique.
- **Les volumes sont conservés** lors de `helm uninstall` ; supprimez les revendications vous‑même pour supprimer les données.
- helm test interroge le Kept en cours d'exécution pour `/readyz` et `/version`.

La version du chart correspond à la version de Kept : la version 1.0.1 publie le chart 1.0.1. Il est publié en tant qu'artefact OCI signé à côté de l'image à chaque release ; voir [vérification d'une release](/fr/admin/verify-release/).
