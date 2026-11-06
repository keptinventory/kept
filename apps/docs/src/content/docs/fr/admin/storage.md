---
title: Changement de stockage des fichiers
description: Déplacez les fichiers de Kept entre le disque du serveur et un bucket S3 avec une copie vérifiée.
sidebar:
  order: 6
---

Kept stocke les fichiers (photos, reçus, documents) sur le volume de données (`KEPT_STORAGE=local`,
par défaut) ou dans un bucket compatible S3 (`KEPT_STORAGE=s3` avec les variables `KEPT_S3_*`). Changer
`KEPT_STORAGE` seul ne déplace rien : les fichiers déjà stockés restent où ils étaient et Kept
ne peut plus les trouver. Les déplacer, c'est les copier.

## Moving

Les fichiers ne changent jamais une fois stockés, la copie est donc sûre pendant que Kept fonctionne
et elle peut être répétée : un fichier déjà présent à destination avec le bon hash est ignoré.

1. Ajoutez les paramètres de la destination à côté des paramètres actuels (pour S3 : `KEPT_S3_BUCKET`,
   `KEPT_S3_ACCESS_KEY_ID`, `KEPT_S3_SECRET_ACCESS_KEY` et, si nécessaire, `KEPT_S3_ENDPOINT`,
   `KEPT_S3_REGION`, `KEPT_S3_FORCE_PATH_STYLE`), en laissant `KEPT_STORAGE` tel quel.
2. **Copiez pendant que Kept fonctionne :** `kept admin storage copy --to s3` (ou `--to local`). Chaque fichier
   référencé par la base de données, et ses versions redimensionnées, est copié et son SHA-256 vérifié. `--dry-run`
   ne compte que.
3. **Arrêtez Kept**, puis copiez de nouveau : seuls les fichiers arrivés depuis sont copiés.
4. Définissez `KEPT_STORAGE` sur le nouveau stockage, puis démarrez Kept.
5. **Vérifiez :** `kept admin storage verify --store s3` contrôle chaque fichier référencé par la base de données.

Les anciens fichiers restent où ils étaient ; supprimez-les vous-même une fois satisfait.

## Avant de choisir S3

- Activez le **versioning du bucket** : avec le stockage S3, les sauvegardes ne contiennent pas les fichiers, et le versioning
  est ce qui permet de restaurer un fichier supprimé ou écrasé ([sauvegardes](/fr/admin/backups/#quand-les-fichiers-sont-dans-s3)).
- Les téléphones récupèrent les fichiers directement depuis le bucket, via des liens signés à durée de vie courte. Si le serveur
  accède au bucket à une adresse que les téléphones ne peuvent pas atteindre (dans Compose, par exemple), définissez
  `KEPT_S3_PUBLIC_ENDPOINT` sur celle qu'ils peuvent utiliser.
- Servez le bucket depuis son propre nom d'hôte, jamais celui de Kept.
