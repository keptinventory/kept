---
title: Lire votre inventaire avec restic seul
description: Le serveur est parti. Avec restic, le mot de passe de la sauvegarde et n'importe quel ordinateur, ouvrez la copie lisible de tout ce que vous possédiez - sans Kept, sans réseau.
sidebar:
  order: 3
---

Chaque instantané nocturne contient une **copie lisible** de chaque lieu : un fichier `index.html` que vous ouvrez dans un
navigateur, un tableur (CSV) des objets, des vignettes, ainsi que les reçus et documents vers lesquels les pages renvoient. Elle est prévue pour le jour où Kept ne peut plus fonctionner : le serveur a brûlé, le disque est mort, ou Kept a disparu depuis longtemps. Il vous faut seulement :

- **restic**, le programme de sauvegarde, sur n'importe quel ordinateur (Windows, macOS ou Linux). Sa documentation liste
  un paquet ou un téléchargement pour chacun. Utilisez la version 0.19.1, celle que Kept utilise, ou une version plus récente.
- **Le dépôt et son mot de passe**, depuis [le kit de récupération](/fr/admin/recovery-kit/), ainsi que, pour un bucket S3
  ou un serveur SFTP, les identifiants que le kit indique pour ces destinations.
- La sauvegarde elle-même : le disque, le bucket ou le serveur SFTP vers lequel elle a été envoyée.

## 1. Pointez restic vers la sauvegarde

La section Sauvegarde du kit de récupération indique l'emplacement et le mot de passe du dépôt, et, pour S3, les
deux clés. Dans un terminal :

```sh
export RESTIC_REPOSITORY='<the repository line from the kit>'
export RESTIC_PASSWORD='<the backup password from the kit>'
# S3 only:
export AWS_ACCESS_KEY_ID='<from the kit>'
export AWS_SECRET_ACCESS_KEY='<from the kit>'
```

Sur Windows PowerShell, `$env:RESTIC_REPOSITORY = '…'` et ainsi de suite. Une sauvegarde sous forme de répertoire copiée sur un
ordinateur portable n'est que son chemin : le dossier `restic` à l'intérieur du répertoire de sauvegarde.

## 2. Choisir un instantané

```sh
restic snapshots
```

affiche chaque instantané avec sa date et ses étiquettes. Choisissez le plus récent portant l'étiquette `nightly` (ou
`manual`) ; un instantané `pre_upgrade` ne contient que la base de données, pas la copie lisible. Notez son ID.

## 3. Restaurer la copie lisible

```sh
restic restore <snapshot ID> --target ./kept-readable --include /backup/readable
```

Cette commande restaure uniquement la copie lisible, pas le dump de la base de données ni les fichiers en taille réelle, dans un nouveau
dossier `kept-readable`.

## 4. Ouvrir la copie

Ouvrez `kept-readable/backup/readable/index.html` dans un navigateur. Il répertorie chaque lieu, avec son
propriétaire et la date à laquelle la copie a été faite ; le fichier `index.html` de chaque lieu répertorie ses emplacements et ses objets, avec
leurs photos, détails d'achat et documents. Le fichier `README.txt` à côté dit la même chose.

Les pages n'ont besoin d'aucun réseau et ne chargent rien d'ailleurs. Le CSV de chaque lieu s'ouvre dans un
tableur.

La copie de chaque lieu correspond à ce que son **propriétaire** pouvait voir dans Kept : l'argent s'affiche tel que le propriétaire le voyait,
et les valeurs secrètes (le mot de passe Wi-Fi que vous avez stocké sur le routeur) n'y figurent jamais. Un lieu dont la
copie a échoué cette nuit-là est indiqué comme "not included tonight" ; prenez l'instantané qui le précède.

## Parcourir sans restaurer

Sous Linux, et sous macOS avec macFUSE, `restic mount ./mnt` présente chaque instantané sous forme de dossiers que vous pouvez
ouvrir sur place. Cela nécessite FUSE, que Windows ne possède pas ; `restore` fonctionne partout.
