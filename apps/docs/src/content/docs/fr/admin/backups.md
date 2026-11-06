---
title: Sauvegardes
description: Instantanés restic chiffrés pris chaque nuit de la base de données, des fichiers et d'une copie lisible, vers un autre disque, un compartiment S3 ou un serveur SFTP.
sidebar:
  order: 1
---

Chaque nuit, Kept prend un **instantané restic** : chiffré avec un mot de passe de votre choix,
dédupliqué (une nuit sans nouveauté n'ajoute presque rien) et envoyé vers un emplacement qui n'est pas le disque du serveur lui-même.

## Ce qu'un instantané contient

- **La base de données**, exportée d'un instant cohérent, avec un manifeste du nombre de lignes de chaque table et un condensé de ses données, pour qu'une restauration puisse prouver qu'elle a bien ramené exactement ce qui était là.
- **Les fichiers** (photos, reçus, documents), lorsqu'ils sont stockés sur le disque du serveur. Avec le stockage de fichiers S3, ce n'est pas le cas : voir [ci-dessous](#quand-les-fichiers-sont-dans-s3).
- **Une copie lisible de chaque lieu** : pages web, tableurs, vignettes et reçus qui s'ouvrent dans un navigateur avec rien d'autre que restic. Voir
  [lire votre inventaire avec restic seul](/fr/admin/read-with-restic/).

Les clés ne sont **pas** dans la sauvegarde. Conservez [le kit de récupération](/fr/admin/recovery-kit/) ailleurs.

## Où cela peut aller

| Cible | Défini avec | Le dépôt restic |
|---|---|---|
| Un répertoire : un autre disque, ou un partage NAS monté sur le serveur | `KEPT_BACKUP_DIR` (absolu, en dehors de `KEPT_DATA_DIR`) | `<directory>/restic` |
| Un compartiment compatible S3 : AWS, ou le point de terminaison S3 d'un autre fournisseur | `KEPT_BACKUP_S3_BUCKET` et les autres `KEPT_BACKUP_S3_*` | `restic/` sous `KEPT_BACKUP_S3_PREFIX` |
| Un serveur SFTP | `KEPT_BACKUP_SFTP` (la syntaxe `sftp:` de restic), `KEPT_BACKUP_SFTP_KEY_FILE`, `KEPT_BACKUP_SFTP_KNOWN_HOSTS` | l'emplacement que vous indiquez |

Définissez une seule cible. Privilégiez une autre machine ou un autre site : un répertoire sur le même disque que les données de Kept est refusé, et la page de statut avertit lorsque la cible partage un disque avec lui. Les points de terminaison S3 de Backblaze B2 et de Cloudflare R2 devraient fonctionner mais n'ont pas été testés. SFTP fige la clé d'hôte du serveur depuis le fichier known-hosts et ne se connecte que si elle correspond.

## L'activer

Les administrateurs d'instance définissent la cible et le mot de passe dans **Administration → Sauvegardes**, en HTTPS, après avoir pris connaissance du kit de récupération. "Tester" vérifie que Kept peut ouvrir (ou créer) le dépôt ; "Lancer maintenant" en lance un immédiatement. Une variable d'environnement prime sur l'écran et apparaît verrouillée, pour qu'un opérateur puisse corriger la cible dans le déploiement.

**Le mot de passe** fait au moins 12 caractères (`KEPT_BACKUP_PASSWORD`, ou défini sur l'écran).
**Pas de mot de passe, pas de sauvegarde :** Kept n'écrit jamais de sauvegarde non chiffrée. Perdez le mot de passe et la sauvegarde devient illisible, c'est pourquoi il figure dans le kit de récupération.

La sauvegarde s'exécute dans le worker en tant que propriétaire de la base de données, le worker a donc aussi besoin de `KEPT_OWNER_DATABASE_URL`. Avec Compose, `compose.yaml` transmet déjà toutes les variables `KEPT_BACKUP_*` depuis `.env` à Kept et à `migrate` (qui prend un instantané avant une mise à jour) ; un `compose.override.yaml` à côté ajoute la connexion du propriétaire et, pour une cible répertoire, le montage sur les deux :

```yaml
services:
  kept:
    environment:
      KEPT_OWNER_DATABASE_URL: postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD:-}@db:5432/kept
      KEPT_DB_OWNER_PASSWORD_FILE: /owner/kept_owner
    volumes:
      - kept-owner:/owner:ro
      - /mnt/backup/kept:/backups
  migrate:
    volumes:
      - /mnt/backup/kept:/backups
```

Le mot de passe du propriétaire provient du volume `kept-owner`, où l'amorçage le conserve (une installation antérieure à la 1.13.0 avec `KEPT_DB_OWNER_PASSWORD` dans `.env` utilise plutôt celui-ci, et la ligne du fichier ne fait rien).

Puis définissez la cible et le mot de passe sur l'écran, ou verrouillez-les dans `.env`
(`KEPT_BACKUP_DIR=/backups`, `KEPT_BACKUP_PASSWORD=…`).

Le répertoire doit appartenir à l'utilisateur de Kept :

```sh
sudo mkdir -p /mnt/backup/kept
sudo chown 10001:10001 /mnt/backup/kept
sudo chmod 700 /mnt/backup/kept
```

## Quand et combien de temps

- **Quand :** chaque nuit à l'heure définie dans Administration → Sauvegardes, `HH:MM` en UTC (par défaut `02:30`).
  Une nouvelle heure s'applique dès la nuit suivante, sans redémarrage ; `KEPT_BACKUP_TIME` la fixe à la place.
- **Lancer maintenant** en lance un immédiatement ; appuyer à nouveau pendant qu'il attend ou s'exécute est refusé
  ("Une sauvegarde est déjà en cours") plutôt que d'être mis en file deux fois. Une sauvegarde interrompue par un redémarrage ou par un manque de mémoire ne la bloque pas ; le lancement suivant la marque comme interrompue.
- **Sur une petite machine** (moins de 4 Go, ou une limite de conteneur sous 4 Go) restic tourne sur au
  plus deux cœurs avec une limite souple de mémoire ; `GOMAXPROCS` et `GOMEMLIMIT` dans l'environnement de Kept (avec Compose,
  un `compose.override.yaml`) remplacent les deux.
- **Combien de temps ils sont conservés :** le dernier instantané de chacun des **7 derniers jours, 4 semaines et 6
  derniers mois** (`KEPT_BACKUP_KEEP_DAILY`, `_WEEKLY`, `_MONTHLY`). Le `KEPT_BACKUP_KEEP` de l'alpha est
  lu comme le nombre quotidien pour une version. Les instantanés pris avant une mise à jour gardent leurs 3 derniers.
- **Une sauvegarde anormalement petite** (un export de moins de la moitié de la taille de la dernière bonne, ou bien moins
  d'objets, d'emplacements ou de fichiers) est quand même effectuée, mais rien d'ancien n'est supprimé cette nuit-là et les administrateurs sont
  alertés, pour qu'une mauvaise nuit ne puisse jamais écarter les bons instantanés.

## Le surveiller

Administration → Statut affiche la dernière sauvegarde et son âge, le nombre d'instantanés, la taille du dépôt,
le dernier exercice de restauration et les disques. Les administrateurs sont alertés par courriel et notification poussée lorsque :

| Alerte | Quand |
|---|---|
| Échec de la sauvegarde | un lancement échoue |
| Sauvegarde obsolète | aucune bonne sauvegarde depuis 36 heures alors qu'une cible est définie |
| Taille suspecte | un lancement était bien plus petit que le dernier bon |
| Espace disque faible | le disque de données ou une cible répertoire est plein à 85 % |
| Versionnage du compartiment désactivé | les fichiers sont dans S3 et le compartiment ne conserve aucune ancienne version |
| Exercice de restauration dû | aucun [exercice de restauration](/fr/admin/restore/#lexercice-mensuel) depuis 30 jours |

`/metrics` (avec `KEPT_METRICS_TOKEN`) ajoute l'heure de la dernière bonne sauvegarde et l'utilisation des disques. Voir
[surveillance](/fr/admin/observability/).

## Quand les fichiers sont dans S3

restic sauvegarde les fichiers sur le disque, pas les objets d'un compartiment. Avec `KEPT_STORAGE=s3`, l'instantané contient
la base de données, le manifeste et la copie lisible, et **le compartiment garde les fichiers en sécurité lui-même** :
activez le **versionnage du compartiment** (et, si votre fournisseur l'offre, la réplication vers une autre région). Kept
vérifie le versionnage à chaque lancement et alerte tant qu'il est désactivé. Le contrôle hebdomadaire et l'exercice de restauration
comparent le condensé de chaque fichier du manifeste avec le compartiment.

## Les sauvegardes de l'alpha

Les sauvegardes antérieures à restic, faites par l'alpha (`runs/` et `blobs/` à côté du nouveau répertoire `restic/`), ne
sont plus jamais écrites, et restent restaurables avec `kept admin restore --legacy <id>` pour une version. Supprimez-les
dès qu'un instantané restic a passé un exercice de restauration.
