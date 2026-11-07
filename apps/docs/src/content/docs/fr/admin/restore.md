---
title: Restaurer et l'exercice
description: Ramener une sauvegarde dans une nouvelle base de données vide, prouver qu'elle correspond, l'intervertir - et s'y exercer chaque mois.
sidebar:
  order: 2
---

Kept restaure **uniquement dans une nouvelle base de données vide**, la vérifie, et vous laisse le basculement. Il refuse une base de données qui contient déjà quelque chose, ainsi il ne peut pas être dirigé par erreur vers la base en service.

## Restaurer

1. **Lister les instantanés :**

   ```sh
   docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
   ```

   Cela exécute la CLI dans un conteneur `kept` jetable, qui contient le volume de données, les clés, l'identifiant propriétaire issu de votre `compose.override.yaml`, ainsi que les réglages de sauvegarde (ceux de `.env`, ou ceux enregistrés dans Administration → Sauvegardes ; voir [sauvegardes](/fr/admin/backups/#lactiver)).

2. **Créer une base de données vide** à côté de celle en service, en tant que super-utilisateur de la base de données :

   ```sh
   docker compose exec db psql -U postgres -c "CREATE DATABASE kept_restored OWNER kept_owner"
   docker compose exec db psql -U postgres -d kept_restored -c \
     "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
   ```

   Sur un Postgres géré, exécutez plutôt, pour la nouvelle base de données, les lignes d'extension et de propriété du [SQL du fournisseur](/fr/install/managed-postgres/#le-sql).

3. **Restaurer dedans**, après avoir chargé `.env` dans le shell au préalable (`set -a; . ./.env; set +a`) :

   ```sh
   docker compose run --rm --no-deps --entrypoint kept \
     -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_restored" \
     kept admin restore <snapshot>
   ```

   Kept extrait la base de données et les fichiers de l'instantané, vérifie le dump par rapport à son manifeste, vérifie que `pg_restore` correspond à la version majeure du serveur et que les extensions existent, restaure dans une seule transaction, puis compare **le nombre de lignes et l'empreinte des données de chaque table** avec le manifeste : toute table dont les données diffèrent, même avec le même nombre de lignes, fait échouer la restauration. Les fichiers retournent dans le magasin nommé par `KEPT_STORAGE`, et la somme SHA-256 de chacun est vérifiée. L'opération se termine en affichant le basculement.

4. **Intervertir**, avec Kept arrêté, en tant que super-utilisateur :

   ```sh
   docker compose stop kept
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept RENAME TO kept_before_restore"
   docker compose exec db psql -U postgres -c "ALTER DATABASE kept_restored RENAME TO kept"
   docker compose up -d
   ```

   Conservez `kept_before_restore` jusqu'à ce que vous soyez sûr, puis supprimez-la.

Renommer une base de données nécessite le super-utilisateur, dont aucun des comptes de Kept ne dispose : c'est pourquoi Kept affiche ces commandes au lieu de les exécuter.

## Après la perte du serveur

Sur la nouvelle machine : installez Kept comme indiqué dans [Installer avec Docker Compose](/fr/install/compose/), et avant le premier démarrage placez les **clés du kit de récupération** dans `.env` (`KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET`, et `KEPT_SECRET_KEY_VERSION` et `KEPT_SECRET_KEYS_RETIRED` si le kit les mentionne), avec la cible de sauvegarde et son mot de passe dans `compose.override.yaml`. Puis :

```sh
docker compose up -d db
docker compose run --rm --no-deps --entrypoint kept kept admin backup --list
docker compose run --rm --no-deps --entrypoint kept kept admin restore <snapshot>
docker compose up -d
```

La base de données `kept` de la nouvelle installation est encore vide (le service `migrate` n'a pas encore tourné), elle accepte donc la restauration directement ; il n'y a rien à intervertir.
Sans les clés, tout revient sauf les valeurs secrètes et les clés d'IA, qui restent illisibles.

## L'exercice mensuel

Une sauvegarde que personne n'a restaurée est un espoir, pas une sauvegarde. Une fois par mois, restaurez le dernier instantané dans une base de données jetable et laissez Kept la comparer (avec `.env` chargé, comme ci-dessus) :

```sh
docker compose exec db psql -U postgres -c "CREATE DATABASE kept_drill OWNER kept_owner"
docker compose exec db psql -U postgres -d kept_drill -c \
  "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; CREATE EXTENSION vector; ALTER SCHEMA public OWNER TO kept_owner;"
docker compose run --rm --no-deps --entrypoint kept kept admin backup drill \
  --into "postgres://kept_owner:${KEPT_DB_OWNER_PASSWORD}@db:5432/kept_drill"
docker compose exec db psql -U postgres -c "DROP DATABASE kept_drill"
```

L'exercice restaure le dernier instantané valide, compare les nombres de lignes et les empreintes, vérifie la somme SHA-256 de 50 fichiers (`--all-files` les vérifie tous), et enregistre l'exercice dans la base de données **en service**, ce qui efface l'alerte "Exercice de restauration dû" dans Administration → Statut. Il ne touche jamais aux données en service.

## Vérifier le dépôt

Le worker vérifie le dépôt chaque semaine (`restic check`). Pour vérifier maintenant, ou pour aussi relire une partie des données :

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup verify --read-data 5%
```

Avec le stockage de fichiers S3, la vérification contrôle aussi chaque fichier du manifeste par rapport au compartiment. Si un plantage a laissé un verrou périmé sur le dépôt, `kept admin backup unlock` le supprime ; il refuse pendant qu'une sauvegarde est en cours.
