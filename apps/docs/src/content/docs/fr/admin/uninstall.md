---
title: Désinstallation
description: Supprimer Kept et tout ce qu'il a stocké - après avoir récupéré ce que vous souhaitez garder.
sidebar:
  order: 9
---

**Récupérez d'abord vos données.** Une fois les volumes supprimés, rien ne les fait revenir, sauf une sauvegarde.

1. Chaque propriétaire exporte ses emplacements (**Paramètres → Exporter**), ou conserve la dernière sauvegarde et le
   [kit de récupération](/fr/admin/recovery-kit/) en lieu sûr : avec restic seul, vous pouvez encore
   [lire votre inventaire](/fr/admin/read-with-restic/) plus tard.
2. Arrêtez et supprimez les conteneurs **et leurs volumes**, dans le dossier contenant `.env` :

   ```sh
   docker compose --profile https --profile ollama down --volumes
   ```

   Cela supprime `kept-db` (la base de données), `kept-data` (les fichiers), `kept-config` (les clés générées et
   les mots de passe de la base de données) et `kept-owner` (le mot de passe de connexion du propriétaire) ; avec
   `compose.full.yaml`, les certificats de Caddy et les modèles d'Ollama également. Sans `--volumes`, les données
   restent sur la machine.
3. Supprimez l'image : `docker image rm ghcr.io/keptinventory/kept:<version>` (le tag que vous avez exécuté, ou
   `kept:local` pour votre propre build), ainsi que `.env` à côté du fichier Compose.
4. Hors de la machine, supprimez ce que vous avez mis en place pour Kept vous-même :
   - **le compartiment de fichiers**, avec `KEPT_STORAGE=s3` (et ses anciennes versions, si le versioning était activé) ;
   - **la sauvegarde** : le répertoire `restic` sur le disque de sauvegarde, le préfixe `restic/` dans le compartiment
     de sauvegarde, ou le dépôt sur le serveur SFTP, ainsi que les `runs/` et `blobs/` alpha à côté ;
   - la base de données, si elle appartenait à un fournisseur : les rôles `kept_*` et la base de données elle-même ;
   - les enregistrements DNS, les routes du proxy et le `serve` Tailscale que vous avez ajoutés.
