---
title: La CLI de l'exploitant
description: "kept migrate et kept admin : ce que fait chaque commande et comment les exécuter sous Compose."
sidebar:
  order: 7
---

L'image contient une commande `kept` pour la personne qui fait tourner le serveur : migrations, le moyen de revenir quand plus personne ne peut se connecter, clés, sauvegardes. `kept admin --help` liste tout ; chaque commande qui change quelque chose est auditée, et la personne dont le compte est touché est prévenue par courriel.

## L'exécuter sous Compose

La plupart des commandes ont besoin de l'identifiant de connexion **du propriétaire** de la base (`KEPT_OWNER_DATABASE_URL`), que seul le service ponctuel `migrate` détient ; le conteneur de service ne l'a jamais. Son point d'entrée est `kept`, donc :

```sh
docker compose run --rm migrate admin <command>
```

Deux types de commande ont besoin des volumes du conteneur de service :

- `recovery-kit` lit les clés du volume de configuration et les affiche même sans base de données : `docker compose exec kept kept admin recovery-kit`. avec `KEPT_OWNER_DATABASE_URL` (ci-dessous) il détient aussi le dépôt de sauvegarde, son mot de passe et ses identifiants.
- `token create` a besoin des clés et des identifiants de connexion du service, que le conteneur `kept` possède : `docker compose exec kept kept admin token create …` ([ci-dessous](#un-jeton-depuis-le-serveur)).
- `rotate-key`, `backup`, `restore` et `export` ont besoin des clés ou des fichiers ainsi que de l'identifiant du propriétaire. Donnez `KEPT_OWNER_DATABASE_URL` au service `kept` dans un `compose.override.yaml` ([comme pour les sauvegardes](/fr/admin/backups/#lactiver)), puis exécutez-les dans un conteneur ponctuel : `docker compose run --rm --no-deps --entrypoint kept kept admin <command>`.

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `kept migrate` | Applique les migrations en attente une fois, sous verrou de base de données (le service `migrate` l'exécute à chaque démarrage). |
| `kept admin setup-code` | Réémet le code de configuration initiale, pendant que la configuration est en attente, et lève le verrouillage à l'échelle de l'instance. |
| `kept admin reset-password <login>` | Un code de réinitialisation du mot de passe à usage unique, valide une heure ; déconnecte le compte partout. |
| `kept admin disable-user <login>` / `enable-user <login>` | Empêche un compte de se connecter (et met fin à ses sessions), ou l'autorise à nouveau. |
| `kept admin transfer-ownership <locationId> <toUserId>` | Donne un lieu à un autre propriétaire ; l'ancien propriétaire devient administrateur de ce lieu. |
| `kept admin recovery-kit [--format text\|html] [--out <file>]` | Le kit de récupération à garder hors du serveur : les clés, le dépôt de sauvegarde et ses identifiants, les étapes de restauration. Voir [le kit de récupération](/fr/admin/recovery-kit/). |
| `kept admin token create --user <login> --scope read\|write --name <name>` | Un jeton personnel pour les clients MCP et Home Assistant, affiché une seule fois ; `--expires <days>`, `--location <id or name>` (répétable), `--confirm-cross-location`. Depuis la 1.13.0. Voir [un jeton depuis le serveur](#un-jeton-depuis-le-serveur). |
| `kept admin gen-key` | Affiche une nouvelle clé, pour définir vous-même `KEPT_SECRET_KEY` ou `KEPT_AUTH_SECRET`. |
| `kept admin rotate-key` | Rend une nouvelle clé secrète courante et ré-emballe tous les secrets stockés. `--resume` termine une opération interrompue ; `--drop <version>` supprime une clé retirée qu'aucun élément n'utilise. |
| `kept admin backup` | Sauvegarde maintenant (un instantané restic) ; `--list` liste les instantanés, et les anciennes sauvegardes antérieures à restic ; `--accept-size` accepte une sauvegarde bien plus petite comme nouvelle normale. Voir [les sauvegardes](/fr/admin/backups/). |
| `kept admin backup verify` | Vérifie le dépôt de sauvegarde ; `--read-data <percent>` lit aussi cette part des données ; avec le stockage de fichiers S3, vérifie les fichiers par rapport au bucket (`--all-files` pour chacun, pas un sur vingt). |
| `kept admin backup drill --into <database>` | Restaure la sauvegarde la plus récente dans une base de données **vide** jetable et la vérifie : l'[exercice mensuel](/fr/admin/restore/#lexercice-mensuel). |
| `kept admin backup unlock` | Supprime un verrou restic périmé après un plantage ; refusé tant qu'une sauvegarde tourne. |
| `kept admin restore <snapshot>` | Restaure un instantané (ou `latest`) dans une base de données **vide** et le vérifie ; `--legacy <id>` restaure une sauvegarde antérieure à restic, pour une version. Voir [la restauration](/fr/admin/restore/). |
| `kept admin readable --out <dir>` | Écrit la [copie lisible](/fr/admin/read-with-restic/) de chaque lieu (HTML, CSV, fichiers) dans un répertoire ; `--location <id>` pour un seul, `--no-pdf` sans les PDF d'inventaire. |
| `kept admin storage copy --to s3\|local` | Copie tous les fichiers vers l'autre stockage, en vérifiant l'empreinte de chacun ; `--dry-run` compte seulement. Voir [changer de stockage de fichiers](/fr/admin/storage/). |
| `kept admin storage verify --store s3\|local` | Vérifie que chaque fichier référencé par la base est dans ce stockage avec les bons octets. |
| `kept admin export --out <dir>` | Toutes les lignes, brutes, avec les secrets toujours scellés, et tous les fichiers, dans un nouveau répertoire : la sortie de secours, aussi sensible qu'une sauvegarde. |
| `kept admin backfill-pdf-text` | Lit le texte des PDF importés avant que Kept ne lise les PDF, pour que la recherche les trouve. |
| `kept admin config` | Affiche la [référence de configuration](/fr/reference/configuration/) pour cette version. |

`kept admin seed` existe pour le développement et refuse de tourner en production.

## Un jeton depuis le serveur

L'application crée des jetons personnels uniquement en HTTPS (Paramètres → Connexions refuse en simple `http`). Un Kept sur un réseau domestique en `http` peut tout de même connecter une application d'IA ou [Home Assistant](/fr/users/home-assistant/) : la personne qui fait tourner le serveur crée le jeton là-bas. Depuis la 1.13.0 :

```sh
docker compose exec kept kept admin token create \
  --user ibrahim@example.com --scope read --name "Home Assistant"
```

- `--user` désigne la personne pour laquelle le jeton agit : son adresse courriel, ou le nom d'utilisateur d'un compte géré. Il peut faire ce qu'elle peut faire, et rien de plus.
- `--scope read` lit seulement ; `--scope write` peut aussi modifier des objets.
- Sans `--location`, il atteint tous les lieux auxquels la personne appartient, sauf ceux qu'il ne peut pas : un lieu qui demande l'authentification à deux facteurs (un jeton créé ici n'a pas de second facteur ; créez celui-là dans Paramètres → Connexions, en HTTPS) et, pour un jeton d'écriture, ceux où elle est lecteur. Chacun laissé de côté est nommé. `--location` (un identifiant ou un nom, répétable) les choisit à la place.
- Un jeton d'écriture qui traverse des lieux dont les membres diffèrent s'arrête avec un avertissement, comme dans l'application ; `--confirm-cross-location` l'autorise quand même.
- `--expires <days>` y met fin après ce nombre de jours ; sans cela, il fonctionne jusqu'à révocation.

Il affiche le jeton une seule fois, sur la ligne commençant par `KEPT TOKEN:`, ainsi que l'adresse du serveur MCP. Kept n'en conserve qu'une empreinte. La personne le voit dans **Paramètres → Connexions**, où elle peut le révoquer, et est prévenue par courriel.
