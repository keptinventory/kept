---
title: Mises à niveau et retour en arrière
description: Mettre à niveau Kept, l'instantané qu'il prend d'abord, revenir à une version précédente et les mises à niveau majeures de Postgres.
sidebar:
  order: 5
---

## Mise à niveau

Avec Compose, faites pointer `KEPT_IMAGE` dans `.env` vers la nouvelle version et :

```sh
docker compose pull
docker compose up -d
```

Votre propre compilation à partir d'une copie du dépôt plutôt : `git pull`, `docker build -t kept:local .`, puis
`docker compose up -d` avec `KEPT_IMAGE=kept:local`.

Une version peut aussi modifier `compose.yaml` ; ses notes l'indiquent. Téléchargez le fichier de la version par-dessus le vôtre
(`curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.yaml`, ou
`compose.full.yaml` si vous utilisez celui-là) ; `.env` reste tel quel.

### Paramètres nécessitant le nouveau compose.yaml

`compose.yaml` transmet à Kept les paramètres qu'il nomme, et aucun autre. Une mise à niveau vers la 1.14.5 qui ne fait que
modifier `KEPT_IMAGE` conserve le fichier de la 1.14.4, qui ne transmet pas `KEPT_HTTP_SIGN_IN_DAYS` ni
`KEPT_EXTRA_ADDRESSES` et définit `KEPT_TRUSTED_PROXIES` lui-même. Ces lignes dans `.env` ne font rien tant que
vous n'avez pas téléchargé le `compose.yaml` de la 1.14.5 (ou `compose.full.yaml`) et exécuté `docker compose up -d`.

### Caddy et Ollama déplacés vers compose.full.yaml

À partir de la 1.14.5, `compose.yaml` exécute uniquement Kept et sa base de données. Caddy (le profil `https`),
Ollama (le profil `ollama`) et le déploiement réparti commenté se trouvent dans
`compose.full.yaml` : le même fichier avec ces éléments en plus. **Si vous utilisez Caddy ou Ollama**, téléchargez
`compose.full.yaml` à la place et définissez `COMPOSE_FILE=compose.full.yaml` dans `.env` :

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v<version>/compose.full.yaml
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose --profile https up -d   # the profiles you use: https, ollama or both
```

Sinon, le prochain téléchargement de `compose.yaml` supprime Caddy : Compose considère son conteneur comme un orphelin,
et une fois celui-ci disparu, Kept reste en http simple. Les services de Kept, le réseau et les volumes
(certificats de Caddy dans `caddy-data`, les modèles dans `ollama`) sont les mêmes dans les deux fichiers, donc
rien n'est perdu. Sans Caddy ni Ollama, rien ne change.

**Derrière votre propre proxy**, `KEPT_TRUSTED_PROXIES` dans `.env` atteint Kept à partir de la 1.14.5. Avant,
`compose.yaml` définissait sa propre valeur, donc une ligne dans `.env` était ignorée et chaque visiteur partageait les
limites de connexion du proxy. Une valeur déjà présente dans `.env` prend effet une fois que vous avez téléchargé le
`compose.yaml` de la 1.14.5 ([ci-dessus](#paramètres-nécessitant-le-nouveau-composeyaml)) ; une valeur dans un
`compose.override.yaml` peut être déplacée vers `.env`. Avec Caddy de `compose.full.yaml`, laissez-la vide ou
conservez `172.29.72.200` dans la liste ([proxies inversés](/fr/install/reverse-proxy/#faites-confiance-au-proxy-et-seulement-au-proxy)).

### Liens de connexion (1.14.0)

La 1.14.0 fait passer Kept à better-auth 1.7.13, qui corrige un avis selon lequel l'état d'une connexion OAuth
pouvait être utilisé comme lien magique pour se connecter à la place de quelqu'un d'autre (GHSA-965c-763c-88jm). Un lien magique
envoyé par courriel, ou une connexion Google ou OIDC lancée, avant la mise à niveau ne fonctionne plus : demandez un nouveau
lien, ou connectez-vous à nouveau.

### Installation sans clone (1.13.0)

Depuis la 1.13.0, `compose.yaml` n'a besoin ni d'une copie du dépôt ni de mots de passe de base de données : un service
`bootstrap` à usage unique crée les accès à chaque démarrage. Une installation effectuée avant continue de fonctionner
telle quelle : ses cinq lignes `KEPT_DB_*_PASSWORD` dans `.env` sont utilisées telles quelles
([une installation antérieure à la 1.13.0](/fr/install/compose/#une-installation-datant-davant-la-1130)). Deux objets à
savoir : un `KEPT_IMAGE` vide ne compile plus la copie locale (il exécute le `compose.yaml`
nommé par la version), et le `compose.override.yaml` de la sauvegarde nocturne lit le mot de passe du propriétaire depuis le
volume `kept-owner` une fois que `.env` ne le contient plus ([sauvegardes](/fr/admin/backups/#lactiver)).

Le service `migrate` à usage unique exécute d'abord `kept migrate` : les migrations s'appliquent **une fois, sous un
verrou de base de données**, avant que la nouvelle version ne réponde à une requête. Les migrations de Kept n'ajoutent que
(une colonne ou une table n'est supprimée ou renommée qu'entre deux versions), donc la version précédente continue de
fonctionner avec le nouveau schéma, ce qui rend le retour possible.

Lisez les notes de version avant une version majeure (`1.x` vers `2.0`).

### L'image a été déplacée (1.8.0)

Depuis la 1.8.0, l'image est `ghcr.io/keptinventory/kept` et le chart
`oci://ghcr.io/keptinventory/charts/kept`. Les versions jusqu'à la 1.7.1 restent à
`ghcr.io/ibrahimroshdy/kept`, qui ne reçoit plus de nouvelles versions. Pour mettre à niveau, changez le nom de l'image une seule fois :

- Compose : `KEPT_IMAGE=ghcr.io/keptinventory/kept:1.8.0`.
- Helm : `image.repository: ghcr.io/keptinventory/kept`, ou installez le chart depuis sa nouvelle adresse.

La clé de signature est la même, donc `cosign verify --key cosign.pub ghcr.io/keptinventory/kept:<version>`
fonctionne comme avant ([vérifier une version](/fr/admin/verify-release/)).

### Savoir qu'une nouvelle version existe

Kept peut vérifier les nouvelles versions, et c'est **désactivé par défaut**. Activé, il interroge GitHub une fois par jour pour
obtenir la dernière version du dépôt à partir duquel son image a été construite, n'envoyant que la requête (pas de
version, pas d'identifiant d'instance). Rien n'est téléchargé ni installé. `KEPT_UPDATE_CHECK=true`
l'active et le verrouille ; `false` le verrouille en désactivé.

Le commutateur se trouve dans Admin → Sign-up, sous "New versions". Admin → Status indique "Kept X is available"
lorsqu'une version plus récente existe, et son **Vérifier maintenant** interroge immédiatement.

## L'instantané avant chaque mise à niveau

Lorsque `kept migrate` trouve des migrations en attente sur une base de données qui contient déjà des données, et qu'une cible
de sauvegarde est configurée, il prend d'abord un instantané restic de la seule base de données étiqueté `pre_upgrade`. **Si
l'instantané échoue, rien n'est migré** et la commande s'arrête avec la raison. Les 3 derniers
instantanés pre-mise à niveau sont conservés.

- Pas de cible de sauvegarde : Kept migre quand même, le consigne bruyamment, et Admin → Status indique qu'il a été "upgraded
  without a backup" jusqu'à la prochaine bonne sauvegarde.
- `KEPT_UPGRADE_SNAPSHOT=off` (ou `kept migrate --skip-snapshot`) le saute volontairement.
- L'[application Home Assistant](/fr/install/home-assistant/) n'en prend jamais : la sauvegarde de Home Assistant
  avant la mise à jour est le moyen de revenir en arrière.
- Une base de données toute neuve n'en prend jamais.

Pour que cela fonctionne, le service `migrate` a besoin des clés et des paramètres de sauvegarde ainsi que de la connexion
du propriétaire. Le fichier Compose lui fournit les trois ; une cible de type répertoire a aussi besoin de son montage sur `migrate`
([sauvegardes](/fr/admin/backups/#lactiver)).

## Revenir à une version précédente

Pour revenir en arrière, exécutez à nouveau l'image de la version précédente : `KEPT_IMAGE` vers l'ancien tag, puis
`docker compose up -d`. Il n'y a pas de migrations inverses ; la version précédente fonctionne avec le schéma plus récent.

Kept enregistre les migrations de chaque version dans la base de données et vérifie au démarrage :

- la base de données est **une version en avance** sur l'image : Kept démarre et Admin → Status indique qu'il a été
  ramené depuis X ;
- **plus d'une** version en avance, ou en avance par des migrations qu'aucune version enregistrée n'a faites : Kept refuse de
  démarrer (`downgrade_refused`) et nomme les deux versions. C'est le moment de
  [restaurer](/fr/admin/restore/) l'instantané pre-mise à niveau à la place. `KEPT_ALLOW_DOWNGRADE=1` force le
  démarrage et le forçage est audité.

De la 1.14.4 à la 1.14.3 : la carte de la 1.14.3 a un minimum de 1 m. Une pièce de moins de 1 m de côté conserve sa taille
jusqu'à ce que quelqu'un appuie sur **Terminé** dans **Organiser**, ce qui l'enregistre à 1 m (ou refuse, si cela la fait
chevaucher la pièce suivante). Pour conserver ces tailles, n'organisez pas la carte tant que vous n'êtes pas revenu à la 1.14.4.

## Mises à niveau majeures de Postgres

Le fichier Compose de Kept fixe Postgres 18 par digest, et ses mises à jour de dépendances ne proposent jamais de saut
majeur. Une nouvelle version majeure se fait par **export et restauration**, jamais par changement de tag sur le volume
existant (les fichiers de données d'une version majeure ne s'ouvrent pas dans une autre) :

1. Lancez une sauvegarde et laissez-la se terminer : `docker compose run --rm --no-deps --entrypoint kept kept admin backup`.
2. Arrêtez Kept : `docker compose stop kept`.
3. Remplacez l'image `db` par la nouvelle version majeure, sur un **nouveau** volume (renommez `kept-db` dans
   `compose.yaml`, ou mettez l'ancien de côté) ; conservez l'ancien volume jusqu'à ce que vous ayez terminé.
4. `docker compose up -d db` : le script d'initialisation crée les rôles et les extensions dans la base de données vide.
5. [Restaurez](/fr/admin/restore/#après-la-perte-du-serveur) la sauvegarde dans celle-ci, puis `docker compose up -d`.

L'image de Kept embarque les outils client de la version majeure de Postgres qu'elle prend en charge, et la restauration
vérifie qu'ils correspondent à ceux du serveur.
