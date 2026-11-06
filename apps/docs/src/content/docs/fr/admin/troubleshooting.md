---
title: Dépannage
description: Modes de défaillance réels d'un serveur Kept, leurs causes et le correctif.
---

Chaque entrée est un symptôme, sa cause et le correctif. Les commandes supposent Docker Compose ; sous Helm,
les mêmes vérifications s'appliquent aux pods.

## D'abord, regardez

- **Administration → Statut** diagnostique la plupart des problèmes à lui seul : la messagerie, les tâches d'arrière-plan échouées, le
  balayage des rappels, les sauvegardes et l'exercice de restauration, les disques, la version et ses migrations, HTTPS.
- **Les journaux :** `docker compose logs kept` et `docker compose logs migrate`. `KEPT_LOG_FORMAT=pretty`
  les rend lisibles à l'œil ; `KEPT_LOG_LEVEL` (par défaut `info`) règle le niveau.
- **Un identifiant de requête :** chaque réponse porte `x-request-id` ; recherchez-le dans le journal pour trouver la ligne
  qui appartient à un signalement.
- **Les sondes :** `/healthz` (le processus sert le HTTP), `/readyz` (les deux connexions à la base de données
  répondent), `/version` (version, commit, source). Voir [surveillance](/fr/admin/observability/).
- **Vérifications à exécuter :** `kept admin backup verify`, `kept admin storage verify --store local`
  (ou `s3`) et `kept admin config` ([la CLI](/fr/admin/cli/)).

## `docker compose up` s'arrête au service `bootstrap`

**Cause :** la commande ponctuelle `bootstrap` (`kept bootstrap`) n'a pas pu créer les accès à la base de données. Son journal
dit pourquoi : `docker compose logs bootstrap`. Cas courants : l'image est antérieure à 1.13.0 et n'a pas de
commande `bootstrap` (définissez `KEPT_IMAGE` à 1.13.0 ou une version ultérieure) ; ou la boucle locale de la base de données a été configurée pour
exiger un mot de passe, et `KEPT_DB_SUPERUSER_PASSWORD` dans `.env` ne le contient pas.

**Correctif :** corrigez ce que la ligne nomme et relancez `docker compose up -d` ; le bootstrap peut être lancé
autant de fois qu'il faut.

## Kept s'arrête au démarrage avec `kept: invalid environment: …` ou une autre ligne `kept:`

**Cause :** l'environnement est vérifié avant tout démarrage, et le premier problème arrête le processus avec une ligne qui le nomme. Cas courants :

| La ligne dit | Correctif |
|---|---|
| `kept: invalid environment: KEPT_PUBLIC_URL` | Définissez l'adresse : `docker compose run --rm init` ([installation](/fr/install/compose/#1-écrire-env)) |
| `KEPT_DATABASE_URL has no password, and KEPT_DB_APP_PASSWORD_FILE: … does not exist` | Le bootstrap n'a pas été lancé : démarrez avec `docker compose up -d`, qui le lance d'abord, et non `docker compose up kept` seul |
| `KEPT_SECRET_KEY and KEPT_AUTH_SECRET are set together or not at all` | Définissez les deux, ou supprimez les deux pour utiliser la paire générée dans le volume de configuration |
| `<path>/secrets.json exists but …; fix or restore it` | Le fichier de clés généré est endommagé : remettez les clés depuis [le kit de récupération](/fr/admin/recovery-kit/) |
| `KEPT_BACKUP_DIR is inside KEPT_DATA_DIR …` | Pointez la sauvegarde vers un autre disque |
| `a backup target is set, and the nightly backup dumps the database as kept_owner …` | Donnez au worker `KEPT_OWNER_DATABASE_URL` ([sauvegardes](/fr/admin/backups/#lactiver)) |
| `set one backup target, not …` | Gardez une seule cible parmi `KEPT_BACKUP_DIR`, `KEPT_BACKUP_S3_BUCKET`, `KEPT_BACKUP_SFTP` |
| `KEPT_STORAGE=s3 needs …` | Ajoutez les paramètres S3 qu'il nomme ([stockage](/fr/admin/storage/)) |
| `KEPT_OIDC_ISSUER is set without KEPT_OIDC_CLIENT_ID` | Ajoutez l'identifiant client, ou désactivez l'émetteur |

Chaque variable se trouve dans la [référence de configuration](/fr/reference/configuration/).

## Vous avez changé un mot de passe de base de données dans `.env`, et maintenant rien ne se connecte

**Cause :** avec le `compose.yaml` de Kept 1.13.0, cela se corrige tout seul : le bootstrap met le mot de passe de chaque accès à celui de `.env` (ou de son fichier) à chaque `docker compose up -d`. Cela arrive avec un ancien `compose.yaml`, qui définissait les mots de passe une fois, lors de la création initiale du volume `kept-db`.

**Correctif :** utilisez le `compose.yaml` actuel et lancez `docker compose up -d`. Avec l'ancien, changez le mot de passe du rôle dans Postgres pour qu'il corresponde, puis redémarrez :

```sh
docker compose exec db psql -U postgres -c "ALTER ROLE kept_app PASSWORD '<the new password>'"
```

(Le rôle est `kept_owner`, `kept_app`, `kept_auth` ou `kept_system`, selon la variable.)

## `/readyz` répond 503

**Cause :** l'une des deux connexions à la base de données du web (`app` et `system`, affichée comme `false` dans
le corps de la réponse) ne peut pas exécuter de requête. Le journal contient `readiness check failed`. Au démarrage, Kept attend
environ deux minutes qu'une base de données toujours en démarrage soit prête avant d'abandonner.

**Correctif :** vérifiez que `docker compose ps db` est en bon état et que l'accès nommé `false` a le bon
mot de passe (ci-dessus). Sur un Postgres géré, vérifiez que les quatre accès existent
([Postgres géré](/fr/install/managed-postgres/#les-quatre-connexions)).

## « Ce Kept est configuré pour … » ou « La requête ne provient pas de ce site. »

- **L'application :** « Ce Kept est configuré pour *adresse*. Ouvrez-le à cette adresse. », sur la page de connexion ou comme
  barre au-dessus de l'application quand une sauvegarde est refusée.
- **L'API :** 403, « La requête ne provient pas de ce site. »

**Cause :** une écriture qui porte le cookie de Kept doit provenir de l'origine exacte de
`KEPT_PUBLIC_URL`, ou de l'une des `KEPT_EXTRA_ADDRESSES` : schéma, hôte et port. Kept la compare avec l'en-tête `Origin` du navigateur,
qui est l'adresse dans la barre d'adresse ; un proxy inverse au milieu ne change rien. Ouvrir Kept
à une autre adresse (une IP au lieu du nom, `http` au lieu de `https`, un autre port, l'adresse
interne du proxy) fait de chaque écriture un 403. Les liens, les codes QR et les courriels d'invitation sont construits
à partir de la même valeur, et les clés d'accès sont enregistrées pour son nom d'hôte.

**Correctif :** définissez `KEPT_PUBLIC_URL` exactement comme l'affiche la barre d'adresse du navigateur, redémarrez, et
ouvrez toujours Kept là. Si vous accédez vraiment à Kept à deux adresses réelles, comme un nom de réseau local et un
nom Tailscale, listez les autres dans `KEPT_EXTRA_ADDRESSES`
([Plus d'une adresse](/fr/install/home-network/#plusieurs-adresses)).

## Kept ne démarre pas après une mise à niveau, et `migrate` s'est terminé avec une erreur

**Cause :** le service `kept` démarre seulement après la réussite de `migrate`. Avant de migrer une base de données qui contient
des données, `kept migrate` prend un instantané avant mise à niveau lorsqu'une cible de sauvegarde est définie ; **si l'instantané échoue, rien
n'est migré** et le processus se termine avec la raison ([les mises à niveau](/fr/admin/upgrades/#linstantané-avant-chaque-mise-à-niveau)).

**Correctif :** lisez `docker compose logs migrate`, corrigez la sauvegarde (cible, mot de passe, montage sur
`migrate`), puis relancez `docker compose up -d`. Pour mettre à niveau sans l'instantané volontairement, définissez
`KEPT_UPGRADE_SNAPSHOT=off` pour cette exécution.

## Kept refuse de démarrer avec `downgrade_refused`

**Cause :** l'image est plus vieille de plus d'une version que la base de données (ou la base de données a des migrations
qu'aucune version enregistrée n'a créées). Un retour d'une version est autorisé ; plus ne l'est pas.

**Correctif :** relancez la version plus récente, ou [restaurez](/fr/admin/restore/) l'instantané avant mise à niveau pris
par la plus ancienne. `KEPT_ALLOW_DOWNGRADE=1` force le démarrage et est audité ; utilisez-le seulement quand les notes
d'une version l'indiquent ([revenir d'une version](/fr/admin/upgrades/#revenir-à-une-version-précédente)).

## Le code d'initialisation est perdu, ou l'initialisation est verrouillée

**Cause :** le code n'est affiché qu'une fois, par le processus qui l'a créé. Les codes erronés verrouillent l'adresse
qui les a envoyés, et de nombreux codes erronés verrouillent l'instance.

**Correctif :** `docker compose run --rm migrate admin setup-code` émet un nouveau code et lève le verrouillage à
l'échelle de l'instance ; un verrouillage par adresse se termine de lui-même. Si tout le monde est verrouillé en même
temps, lisez l'entrée suivante.

## Tout le monde atteint les mêmes limites de connexion

**Cause :** derrière un proxy inverse, Kept voit l'adresse du proxy pour chaque visiteur sauf si le proxy est dans
`KEPT_TRUSTED_PROXIES`, si bien que tout le monde partage un même ensemble de limites.

**Correctif :** indiquez dans `KEPT_TRUSTED_PROXIES` l'adresse du proxy telle que Kept la voit
([proxies inverses](/fr/install/reverse-proxy/#faites-confiance-au-proxy-et-seulement-au-proxy)).

## Les téléversements échouent, ou les grandes photos n'arrivent jamais

**Cause :** Kept refuse un fichier dépassant `KEPT_MAX_FILE_MB` (25 Mo par défaut) avec 413. Un proxy placé devant a
souvent sa propre limite de taille de corps, plus petite, et échoue en premier.

**Correctif :** relevez la limite du proxy à au moins `KEPT_MAX_FILE_MB`
([laisser passer les téléversements](/fr/install/reverse-proxy/#laisser-passer-les-téléversements)).

## La caméra, l'installation, les notifications push ou la géolocalisation ne fonctionnent pas sur les téléphones

**Cause :** les téléphones ne les autorisent que sur une origine sécurisée ; une adresse de réseau local en HTTP simple
n'en est pas une. En HTTP, Kept refuse aussi d'afficher les valeurs secrètes, les exportations, les jetons d'accès, les
connexions OAuth, le téléchargement du kit de récupération et les paramètres de sauvegarde.

**Correctif :** [mettez Kept en HTTPS](/fr/install/https/) et définissez `KEPT_PUBLIC_URL` à l'adresse `https://`.

## L'enregistrement d'un fournisseur d'IA ou d'un webhook échoue : « Cette adresse se trouve sur un réseau privé. »

**Cause :** les requêtes sortantes sont refusées vers les adresses privées, de bouclage et réservées (`private_address`).
Un fournisseur sur votre propre réseau, y compris `http://ollama:11434/v1` de Compose, se résout en l'une d'elles.

**Correctif :** un administrateur de l'instance active **Administration → Paramètres → Autoriser les adresses privées**.
Voir le [modèle de sécurité](/fr/admin/security-model/#requêtes-sortantes-ssrf).

## Aucun courriel n'arrive

**Cause :** sans `KEPT_SMTP_URL` et `KEPT_SMTP_FROM`, les courriels ne sont qu'enregistrés comme dus, et Administration →
Statut indique que la messagerie n'est pas configurée.

**Correctif :** définissez les deux et redémarrez ([installation](/fr/install/compose/#5-suite)).

## Les sauvegardes ne s'exécutent pas, ou l'alerte « Sauvegarde périmée » se déclenche

**Cause :** généralement l'un des cas suivants : aucune cible ou aucun mot de passe (il n'y a pas de sauvegarde non chiffrée), le
worker sans `KEPT_OWNER_DATABASE_URL`, une cible de répertoire non montée dans le conteneur, ou une cible qui
n'appartient pas à l'utilisateur de Kept (uid 10001).

**Correctif :** suivez [les sauvegardes](/fr/admin/backups/#lactiver), puis lancez-en une à la main et lisez ce
qu'elle dit :

```sh
docker compose run --rm --no-deps --entrypoint kept kept admin backup
```

Elle se termine avec le code 1 en cas d'avertissement, par son nom :

| Avertissement | Signification et action |
|---|---|
| `backup_suspicious_size` | bien plus petite que la dernière bonne ; si la réduction est réelle, `kept admin backup --accept-size` |
| `files_unreadable` | restic n'a pas pu lire certains fichiers ; vérifiez les permissions du volume de données |
| `blob_checksum_mismatch` | un fichier stocké ne correspond plus à son SHA-256 ; vérifiez le disque |
| `readable_incomplete` | la copie lisible d'un emplacement a échoué ; le journal le nomme |

Après un plantage, un verrou restic périmé peut bloquer chaque exécution : `kept admin backup unlock` le supprime
(il refuse si une sauvegarde est en cours).

## Une restauration refuse de démarrer

**Cause :** Kept ne restaure que dans une base de données **vide**, et vérifie que `pg_restore` correspond à la version
majeure Postgres du serveur et que les extensions existent.

**Correctif :** créez une nouvelle base de données vide avec les extensions, comme dans
[restauration](/fr/admin/restore/#restaurer) ; ne pointez jamais la restauration vers la base en service.

## Après une restauration, les valeurs secrètes et les clés d'IA ne peuvent pas être lues

**Cause :** elles sont scellées avec `KEPT_SECRET_KEY`, qui n'est pas dans la sauvegarde.

**Correctif :** mettez les clés du kit de récupération dans `.env` (avec `KEPT_SECRET_KEY_VERSION` et
`KEPT_SECRET_KEYS_RETIRED` s'il les liste) et redémarrez. Si le kit liste des clés retirées, exécutez
`kept admin rotate-key --resume` une fois Kept lancé. Sans la clé, ces valeurs sont perdues définitivement.

## `kept admin` dit `KEPT_OWNER_DATABASE_URL … is required`

**Cause :** la plupart des commandes d'administration ont besoin de l'accès propriétaire de la base de données, que seul
le service `migrate` détient.

**Correctif :** exécutez-les avec `docker compose run --rm migrate admin <command>`, ou pour `rotate-key`,
`backup`, `restore` et `export`, donnez au service `kept` l'accès propriétaire dans
`compose.override.yaml` ([la CLI](/fr/admin/cli/#lexécuter-sous-compose)).

## Un conteneur dédié au worker n'est pas en bon état

**Cause :** avec `KEPT_ROLE=worker`, la vérification de santé lit le fichier touché par la boucle de tâches
(`/tmp/kept-worker-alive`) ; elle échoue quand la boucle n'a pas interrogé la base de données depuis deux minutes.

**Correctif :** vérifiez le journal du worker et sa connexion à la base de données ; les mêmes vérifications de base de
données que pour `/readyz` s'appliquent.

## Toujours bloqué

Ouvrez un ticket avec la version provenant de `/version`, la façon dont Kept s'exécute, et les lignes de journal
pertinentes avec tout ce qui est privé retiré. Un problème de sécurité passe par le signalement privé de vulnérabilités
à la place ([modèle de sécurité](/fr/admin/security-model/#signalement-dune-vulnérabilité)).
