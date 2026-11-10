---
title: Installer avec Docker Compose
description: Exécuter Kept et son Postgres avec Docker Compose sur votre propre serveur ou homelab, se connecter pour la première fois, et garder les clés en sécurité.
sidebar:
  order: 1
---

Docker Compose est le moyen d'exécuter Kept sur une machine : Kept lui-même et Postgres 18 avec pgvector.
Caddy pour HTTPS et Ollama pour l'IA locale viennent avec un second fichier
([Caddy et Ollama](#caddy-et-ollama)). Vous avez besoin de Docker avec le plugin Compose. Testé sur une machine avec
1 Go de RAM et un cœur de CPU ; Kept et sa base de données utilisent environ 200–400 Mo
([ce qui a été testé](/fr/install/hardware/)).

Quatre étapes, sans copie du dépôt et sans mot de passe à créer :

```sh
mkdir kept && cd kept
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.yaml
docker compose run --rm init
docker compose up -d
```

`compose.yaml` fonctionne seul, il se colle donc aussi dans Portainer, Dockge et similaires (voir
[sans terminal](#sans-terminal)).

:::note[Images]
Les versions sont publiées sur `ghcr.io/keptinventory/kept`, étiquetées `1`, `1.2` et `1.2.3`, jamais
`latest` ; `1.0.0` est la première signée. Les mêmes images, signées avec la même clé, sont sur Docker
Hub sous `keptinventory/kept`. `compose.yaml` exécute la version avec laquelle il a été publié, sauf si
`KEPT_IMAGE` dans `.env` en nomme une autre ; `init` écrit là la version qu'il a exécutée.
[Vérifiez-la](/fr/admin/verify-release/) d'abord si vous voulez. Pour exécuter votre propre build, dans un checkout :
`docker build -t kept:local .` et `KEPT_IMAGE=kept:local`.
:::

## Ce qui s'exécute

| Service | S'exécute |
|---|---|
| `db` | Postgres, et reste en cours d'exécution |
| `kept` | Kept sur le port 8080, et reste en cours d'exécution |
| `bootstrap` | une fois à chaque démarrage, puis se termine : les connexions à la base de données et les extensions |
| `migrate` | une fois à chaque démarrage, puis se termine : les migrations de la base de données |
| `init` | seulement quand vous l'exécutez (`docker compose run --rm init`) : écrit `.env` |

## Caddy et Ollama

`compose.yaml` exécute Kept seul. `compose.full.yaml` est le même fichier plus Caddy pour HTTPS (le
profil `https`), Ollama pour l'IA locale (le profil `ollama`) et un déploiement web et worker séparé,
commenté. Il fonctionne aussi seul. Pour l'utiliser à la place :

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/compose.full.yaml
docker compose -f compose.full.yaml run --rm init
echo COMPOSE_FILE=compose.full.yaml >> .env
docker compose up -d
```

Avec `COMPOSE_FILE` dans `.env`, un simple `docker compose` lit `compose.full.yaml`, donc chaque commande
de cette documentation fonctionne telle quelle. Les services, le réseau et les volumes de Kept sont les
mêmes dans les deux fichiers : une installation peut changer à tout moment et conserver ses données.

## 1. Écrire `.env`

```sh
docker compose run --rm init
```

`init` demande **l'adresse à laquelle vous ouvrirez Kept**, telle que `http://kept.home.arpa:8080` ou
`https://kept.example.org`. Les liens, les codes QR sur les étiquettes imprimées et la vérification same-site
en sont dérivés, donc elle doit être exactement ce que le navigateur affiche, et ne doit pas changer :
**utilisez un nom plutôt qu'une adresse IP.** Un routeur domestique peut donner une nouvelle adresse à cette
machine un jour, et les étiquettes déjà imprimées pointeraient alors vers nulle part. Définissez le nom dans
le DNS de votre routeur, ou dans le fichier hosts de chaque appareil. Une adresse IP fonctionne toujours si
vous la confirmez.

Il écrit alors `.env` à côté de `compose.yaml` avec cette adresse (`KEPT_PUBLIC_URL`), le port
(`KEPT_HTTP_PORT`, depuis une adresse `http://`), l'image et un code de configuration (`KEPT_SETUP_CODE`),
et affiche le code. `.env` ne contient aucun mot de passe et n'est lisible que par vous. Relancez `init` pour
changer l'adresse : il met à jour ces lignes et conserve tout le reste que vous avez ajouté. Sans terminal,
donnez l'adresse en ligne de commande : `docker compose run --rm init --url http://kept.home.arpa:8080`.

Tout le reste est optionnel ; `compose.env.example` et la
[référence de configuration](/fr/reference/configuration/) indiquent ce que fait chaque variable.

## 2. Le démarrer

```sh
docker compose up -d
```

Compose démarre la base de données et attend qu'elle soit saine. Puis :

- **`bootstrap`** (ponctuel, `kept bootstrap`) crée les quatre connexions à la base de données de Kept et
  les extensions `pg_trgm`, `unaccent` et `vector`. Au premier démarrage il génère le mot de passe de
  chaque connexion dans un volume ; à chaque démarrage il définit le mot de passe de chaque connexion à
  cette valeur, pour que Postgres et Kept soient toujours d'accord.
- **`migrate`** (ponctuel, `kept migrate`) applique les migrations de la base de données une fois, sous verrou.
- **Kept** démarre sur le port 8080 (`KEPT_HTTP_PORT` change le port hôte).

## 3. Terminer la configuration

Ouvrez l'adresse, saisissez le code de configuration qu'`init` a affiché, et créez le premier compte : il
devient l'administrateur de l'instance. Kept affiche aussi le code dans son journal au premier démarrage :

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

Un code perdu est réédité avec :

```sh
docker compose run --rm migrate admin setup-code
```

Les mauvais codes verrouillent temporairement l'accès, par adresse et pour toute l'instance. Si Kept est
derrière un proxy qu'il ne fait pas confiance, tout le monde partage l'adresse du proxy ; voir
[proxies inverses](/fr/install/reverse-proxy/).

## 4. Garder les clés

Au premier démarrage, si `KEPT_SECRET_KEY` et `KEPT_AUTH_SECRET` ne sont pas définis, Kept génère les deux
dans le volume `kept-config` et écrit une ligne indiquant où. La clé secrète scelle chaque valeur secrète
(clés d'IA, mots de passe que vous stockez dans Kept) : **une sauvegarde restaure tout sauf ces valeurs,
sauf si vous avez aussi la clé.**

Affichez les clés et gardez-les ailleurs que sur ce serveur, par exemple dans un gestionnaire de mots de passe :

```sh
docker compose exec kept kept admin recovery-kit
```

Admin → Status vous demande d'acquitter le kit de récupération, et Kept l'exige avant la première valeur
secrète, clé d'IA ou réglage de sauvegarde. Voir [le kit de récupération](/fr/admin/recovery-kit/).

## 5. Suite

- [Mettre Kept en HTTPS](/fr/install/https/) : la caméra, l'installation de l'application, les notifications
  push et la géolocalisation ne fonctionnent qu'en HTTPS.
- [Configurer les sauvegardes](/fr/admin/backups/).
- Mail : définissez `KEPT_SMTP_URL` (`smtp://` ou `smtps://`, avec identifiants) et `KEPT_SMTP_FROM`
  pour les réinitialisations de mot de passe, les invitations et les rappels par e-mail. Sans eux, les
  rappels n'atteignent les personnes que dans l'application, et Admin → Status indique que le mail n'est
  pas configuré.

## Ce que Compose crée

| Volume | Contient | À sauvegarder ? |
|---|---|---|
| `kept-db` | la base de données Postgres | via la sauvegarde de Kept, jamais en copiant le volume pendant qu'il fonctionne |
| `kept-data` | fichiers téléversés (avec `KEPT_STORAGE=local`, par défaut) | via la sauvegarde de Kept |
| `kept-config` | les `KEPT_SECRET_KEY` et `KEPT_AUTH_SECRET` générés, et les mots de passe des connexions `kept_app`, `kept_auth` et `kept_system` | gardez le kit de récupération ; les mots de passe sont recréés s'ils sont perdus |
| `kept-owner` | le mot de passe de la connexion `kept_owner` | non ; il est recréé s'il est perdu |
| `caddy-data`, `caddy-config` | les certificats de Caddy (`compose.full.yaml`, profil `https`) | non ; Caddy en obtient de nouveaux |

Le superutilisateur de la base de données n'a pas de mot de passe dont qui que ce soit ait besoin : on y accède
uniquement depuis l'intérieur du conteneur de base de données, avec `docker compose exec db psql -U postgres`,
et par bootstrap, qui partage le réseau de ce conteneur. Sur le réseau, chaque connexion a besoin de son mot
de passe. Ne publiez jamais le port du service `db` (pas de `ports:` dessus) : Kept y accède via le réseau
compose.

Les conteneurs de Kept fonctionnent sous un utilisateur non root (uid 10001) avec un système de fichiers racine
en lecture seule, toutes les capacités Linux retirées et `no-new-privileges`. Le service `migrate` détient la
connexion du propriétaire de la base de données ; le conteneur de service ne la voit jamais (le volume
`kept-owner` n'y est pas monté) jusqu'à ce que vous lui en donniez une pour la sauvegarde nocturne
([sauvegardes](/fr/admin/backups/#lactiver)). `init` est la seule exception à la règle du non-root : il
fonctionne en root, sans réseau et seulement avec les capacités nécessaires pour créer `.env` dans votre dossier
et vous le remettre, puis se termine.

## Sans terminal

Portainer, Dockge et outils similaires prennent `compose.yaml` (ou `compose.full.yaml`) tel quel. Ils n'exécutent
pas `init`, définissez donc à la place deux variables dans leur éditeur d'environnement : `KEPT_PUBLIC_URL`
(l'adresse, comme ci-dessus) et `KEPT_SETUP_CODE` (six caractères parmi 0–9 et A–Z sans I, L, O et U, comme
`KPT-2X9` ; ou laissez vide et lisez le code dans le journal de Kept). Épinglez `KEPT_IMAGE` à une version si
l'outil ne le fait pas.

## Une installation datant d'avant la 1.13.0

Une installation faite avec une copie du dépôt contient les cinq lignes `KEPT_DB_*_PASSWORD` dans `.env`. Avec
ce `compose.yaml` elles sont utilisées telles quelles, et rien n'est généré : mettez à jour le checkout (ou
téléchargez le nouveau `compose.yaml` à côté de l'ancien `.env`) et lancez `docker compose up -d`. Supprimer ces
lignes plus tard, ou réécrire `.env` avec `init`, est aussi sans risque : au démarrage suivant de nouveaux mots
de passe sont générés et définis dans Postgres. Un `KEPT_IMAGE` vide servait à construire le checkout ; il
exécute maintenant la version nommée par `compose.yaml`, donc définissez `KEPT_IMAGE=kept:local` si vous
construisez vous-même.

## Web et worker séparément

Un conteneur sert l'application web et exécute les tâches de fond (`KEPT_ROLE=all`, par défaut). Pour les
séparer, lancez un second service Kept avec `KEPT_ROLE=worker` à côté d'un avec `KEPT_ROLE=web`. Un worker ne
sert pas de HTTP ; le healthcheck de l'image suit `KEPT_ROLE` et vérifie la boucle de tâches du worker à la
place, donc aucun n'a besoin d'être surchargé (`compose.full.yaml` a les deux services commentés). Le worker
exécute la sauvegarde nocturne, c'est donc lui qui a besoin de la connexion du propriétaire et du montage d'une
cible répertoire.
