---
title: Le kit de récupération
description: Les clés et les informations d'identification de sauvegarde qui transforment une sauvegarde en un Kept fonctionnel. Conservez-les partout sauf sur le serveur.
sidebar:
  order: 4
---

Kept scelle chaque valeur secrète qu'il stocke (clés d'IA, et les secrets que vous conservez sur des éléments, tels que le mot de passe Wi-Fi d'un routeur) avec `KEPT_SECRET_KEY`, et signe les sessions avec `KEPT_AUTH_SECRET`. Ni l'un ni l'autre n'est présent dans la base de données ou la sauvegarde, exprès : quelqu'un qui obtient votre sauvegarde ne devrait pas obtenir vos secrets avec elle. L'autre côté de ceci : **sans la clé, une restauration ramène tout sauf les valeurs secrètes et les clés d'IA, qui restent illisibles pour de bon.**

Le kit de récupération est tout ce dont vous auriez besoin pour reconstruire Kept à partir de sa sauvegarde. Conservez-le dans un gestionnaire de mots de passe ou sur du papier, quelque part qui ne serait pas perdu avec le serveur.

## Ce qu'il contient

- `KEPT_SECRET_KEY` et `KEPT_AUTH_SECRET`;
- après une rotation de clé, la version de la clé (`KEPT_SECRET_KEY_VERSION`) et chaque clé retirée (`KEPT_SECRET_KEYS_RETIRED`), dont les anciennes sauvegardes ont encore besoin ;
- le référentiel restic de la sauvegarde, **son mot de passe et ses identifiants de stockage** (les clés S3 et la région, ou la clé SFTP et la clé d'hôte épinglée du serveur sous forme de ligne `known_hosts`), ou « Aucune sauvegarde configurée » ;
- l'adresse de l'instance, la version et la révision de Kept, quand le kit a été créé ;
- les étapes de restauration en termes simples, et les commandes pour
  [lire votre inventaire avec restic seul](/fr/admin/read-with-restic/), avec le référentiel rempli.

C'est du texte simple, ou une page imprimable faite à partir des mêmes lignes (aucun script, rien chargé depuis nulle part).

## Obtention

Depuis le serveur, à tout moment :

```sh
docker compose exec kept kept admin recovery-kit
```

Il imprime dans le terminal ; rien n'est écrit nulle part. `--format html` donne la page imprimable, et `--out <file>` l'écrit dans un fichier lisible uniquement par vous. Les clés s'affichent même lorsque la base de données est inactive ; la moitié sauvegarde nécessite la connexion du propriétaire de la base de données (`KEPT_OWNER_DATABASE_URL`, le `compose.override.yaml` que [les sauvegardes](/fr/admin/backups/#lactiver) utilisent pour l'obtenir), et sans cela, le kit indique qu'il manque. Avec cette connexion, l'impression compte comme un téléchargement (ci-dessous) et est auditée.

Depuis le web : **Administration → Statut → Kit de récupération → Télécharger le kit de récupération**, en tant qu'administrateur d'instance, via HTTPS uniquement, après avoir entré à nouveau votre mot de passe (ou, pour un compte sans mot de passe, dans les dix minutes suivant la connexion : une connexion avec une clé de sécurité compte ; sinon « Connectez-vous à nouveau »). Choisissez un fichier texte ou une page imprimable. Chaque téléchargement est audité, et rien du kit n'est conservé quelque part où un visiteur ultérieur pourrait l'ouvrir.

## Quand Kept le demande

L'installation n'attend pas le kit, mais Kept vous demande de l'accuser réception avant la première de : stocker une valeur secrète, ajouter une clé d'IA, ou configurer des sauvegardes. Jusqu'alors, Administration → Statut le demande ; un téléchargement compte comme cette accusé de réception. La page de statut demande à nouveau lorsque le kit que vous avez téléchargé est périmé : après modification des paramètres de sauvegarde ou rotation de la clé (`kept admin rotate-key`).

## Si vous définissez les clés vous-mêmes

Avec `KEPT_SECRET_KEY` et `KEPT_AUTH_SECRET` dans votre propre environnement (générez chacun avec `kept admin gen-key`), Kept les utilise tels quels et le volume `kept-config` reste vide. Le kit les affiche toujours ; conserver une copie reste votre tâche.

## Rotation de la clé

```sh
docker compose exec kept kept admin rotate-key
```

crée une nouvelle clé actuelle et ré-enveloppe chaque secret stocké dessous. Elle nécessite la connexion du propriétaire de la base de données, donc le service `kept` doit disposer de `KEPT_OWNER_DATABASE_URL` (le `compose.override.yaml` que [les sauvegardes](/fr/admin/backups/#lactiver) utilisent pour l'obtenir). Elle indique quoi définir si vous gérez les clés vous-même. L'ancienne clé passe dans la liste des clés retirées, donc les sauvegardes effectuées avant la rotation s'ouvrent toujours : téléchargez un nouveau kit ensuite.
