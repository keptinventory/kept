---
title: Modèle de sécurité
description: Ce que l'opérateur doit savoir sur la façon dont Kept sépare les foyers, protège les secrets, authentifie les utilisateurs, et ce qui quitte le serveur.
---

Cette page est le résumé de l'opérateur du modèle de menace de Kept et des mécanismes derrière celui-ci. Les
pages destinées aux développeurs approfondissent le sujet : [sécurité au niveau des lignes](/fr/developers/rls/), [authentification](/fr/developers/auth/)
et [l'architecture](/fr/developers/architecture/).

## Les foyers sont séparés par la base de données

Kept se connecte à Postgres avec quatre connexions, chacune autorisée uniquement à effectuer ce dont elle a besoin :

| Connexion | Utilisée par | Ce qu'elle peut faire |
|---|---|---|
| `kept_owner` | `kept migrate`, `kept admin`, la sauvegarde nocturne | possède le schéma ; jamais utilisée pour servir une requête |
| `kept_app` | chaque requête web, les routes d'administration d'instance incluses | lit et écrit les tables de l'application, toujours sous sécurité au niveau des lignes (`NOBYPASSRLS`, `FORCE` RLS sur chaque table) |
| `kept_auth` | connexion (Better Auth) | son propre schéma `auth` seulement |
| `kept_system` | tâches d'arrière-plan qui couvrent plusieurs foyers (scan de rappel, rétention), le code d'installation | uniquement des politiques système explicites |

Chaque requête s'exécute dans une transaction qui nomme la personne connectée, et chaque politique interroge une fonction qui détermine les lieux auxquels cette personne appartient. Lorsqu'aucune personne n'est définie, les politiques ne retournent rien, donc un chemin de code qui oublie la portée échoue fermé. Un test de fuite couvrant le schéma vérifie les chemins requête, auth et worker. Les détails se trouvent dans [sécurité au niveau des lignes](/fr/developers/rls/).

Cela signifie pour vous : le conteneur de service ne contient jamais la connexion du propriétaire, sauf si vous lui en fournissez une pour les sauvegardes ([sauvegardes](/fr/admin/backups/#lactiver)). Un administrateur d'instance n'a **aucun accès dans l'application** aux lieux des autres personnes ; un opérateur ayant un accès à la base de données peut contourner cela, c'est pourquoi la base de données elle-même doit rester privée au serveur.

## Clés et chiffrement

- **`KEPT_SECRET_KEY`** scelle chaque valeur secrète : champs secrets des objets, clés IA, paramètres des canaux de notification, secrets de webhook, mots de passe des boîtes aux lettres électroniques entrantes, jetons API Paperless-ngx, clé privée web push, mot de passe de sauvegarde. AES-256-GCM
avec une clé de données par ligne, chaque texte chiffré lié à sa table, sa ligne et son champ, de sorte qu'il ne puisse pas être échangé.
- **`KEPT_AUTH_SECRET`** signe les sessions et les jetons. Il est séparé afin que l'un ou l'autre puisse être fait pivoter séparément.
- **Générés au premier démarrage** lorsque les deux sont non définis, dans le volume de configuration (jamais le volume de données), avec une ligne de journal indiquant où. Définissez-les vous-même avec `kept admin gen-key` ; le démarrage refuse une clé inférieure à 32 octets, et refuse une clé définie sans l'autre.
- **Ni l'un ni l'autre n'est présent dans la base de données ou la sauvegarde.** Conservez [le kit de récupération](/fr/admin/recovery-kit/). Sans la clé secrète, une restauration ramène tout sauf les valeurs secrètes et les clés IA.
- **Rotation :** `kept admin rotate-key` crée une nouvelle clé actuelle et ré-enveloppe chaque valeur scellée ;
  l'ancienne clé est conservée comme version retirée afin que les anciennes sauvegardes restent ouvrables. `--resume` termine une exécution interrompue, `--drop <version>` supprime une clé retirée non utilisée
  ([l'interface CLI](/fr/admin/cli/#commandes)).
- **Les mots de passe des boîtes aux lettres électroniques entrantes sont en écriture seule :** le serveur, le nom d'utilisateur et le mot de passe d'une boîte aux lettres électroniques entrantes sont scellés ensemble ; la page affiche le serveur et le nom d'utilisateur, jamais le mot de passe.
- **Les clés IA sont en écriture seule :** une fois enregistrées, Kept n'affiche que leurs quatre derniers caractères.
- **Les jetons Paperless-ngx sont en écriture seule :** l'adresse Paperless et le jeton d'un lieu sont scellés ensemble ; la page affiche l'adresse, jamais le jeton, et le navigateur ne communique jamais avec Paperless en l'utilisant. Les miniatures et les téléchargements passent par Kept, après le contrôle d'accès propre à Kept.

## Connexion

Kept utilise Better Auth sur sa propre connexion et son schéma. Avec quoi un compte peut-il se connecter :

- **E-mail et mot de passe.** Une réinitialisation de mot de passe déconnecte le compte partout, et le propriétaire est informé par e-mail lorsqu'un identifiant change.
- **Clés d’accès**, enregistrées pour le nom d'hôte de `KEPT_PUBLIC_URL`. Chacune doit vérifier son utilisateur (Face ID, une empreinte digitale, un code PIN) et être détectable.
- **Double authentification** avec une application d'authentification (TOTP) ou une clé d'accès ayant vérifié l'utilisateur. Un code unique envoyé par e-mail n'est jamais un deuxième facteur. Le propriétaire d'un lieu peut exiger la double authentification pour tous ses membres. Les comptes sans mot de passe peuvent également utiliser l'application d'authentification.
- **Paramètres → Connexion et sécurité** ajoute, renomme et supprime les clés d'accès, et active l'application d'authentification, crée de nouveaux codes de secours, la configure à nouveau et la désactive
  ([Connexion et sécurité](/fr/users/sign-in-security/)). Toute modification demande le mot de passe, ou une connexion datant de moins de dix minutes sur un compte sans mot de passe, et déconnecte chaque autre appareil (mise à part le renommage). Le serveur refuse la suppression du dernier moyen d'accès, et la désactivation de la double authentification tandis qu'un lieu l'exige et que le compte ne possède aucune clé d'accès. Configurer à nouveau l'application laisse l'ancien secret fonctionner jusqu'à ce qu'un code du nouveau soit validé.
- **Liens magiques** réservés aux comptes existants (pas d'inscription ouverte), valables 15 minutes. Les jetons envoyés par e-mail voyagent dans le fragment `#fragment` du lien et sont consommés par une requête POST provenant de la page, de sorte qu'un analyseur de messagerie ouvrant des liens ne puisse pas les épuiser ; seul un hachage est stocké.
- **Noms d'utilisateur** pour les comptes gérés (personnes sans adresse e-mail).
- **OIDC**, lorsque `KEPT_OIDC_ISSUER` et `KEPT_OIDC_CLIENT_ID` sont définis
  ([configuration](/fr/reference/configuration/)). Une identité extérieure n'est jamais liée à un compte au seul motif que l'e-mail correspond ; une nouvelle personne accède par invitation, ou par un domaine ou groupe autorisé. Les jetons du fournisseur d'identité ne sont jamais stockés.
- **Google**, lorsque `KEPT_GOOGLE_CLIENT_ID` et `KEPT_GOOGLE_CLIENT_SECRET` sont définis, avec l'URI de redirection que montre Administration → Statut. Les mêmes règles que pour l'OIDC s'appliquent, sauf que personne ne se connecte par domaine : seul un compte existant ayant lié Google, ou une personne invitée, peut accéder.
- **Liaison et suppression de liaison** d'une connexion externe ont lieu dans Paramètres → Moi → Moyens de connexion.
  La liaison nécessite une connexion datant de moins de dix minutes ; la suppression de liaison demande le mot de passe (ou cette récente connexion sur un compte sans mot de passe). Un compte conserve au moins un moyen d'accès.

**Les sessions** durent 30 jours en HTTPS, prolongées une fois par jour d'utilisation, avec des cookies préfixés `Secure` et `__Secure-`. En HTTP simple, elles durent 12 heures et ne sont jamais prolongées, et Kept refuse les actions qui révèlent ou modifient un secret ([HTTPS](/fr/install/https/)). Les actions sensibles demandent à nouveau le mot de passe, ou une connexion datant de moins de dix minutes ; renouveler une connexion ne remet pas à zéro ces dix minutes.

`KEPT_HTTP_SIGN_IN_DAYS` (1 à 30, non défini par défaut) permet à celui qui exécute le serveur de faire durer une connexion en HTTP simple autant de jours, renouvelée tant qu'elle est utilisée. C'est le seul paramètre qui assouplit cela, il ne peut pas être modifié depuis l'application, et il n'a aucun effet en HTTPS. Les secrets restent refusés en HTTP, les dix minutes restent, et se déconnecter partout met toujours fin à chaque connexion. Le coût : en HTTP simple, un cookie de connexion peut être copié par quiconque peut voir le trafic, et avec le paramètre activé, une copie reste fonctionnelle tant qu'elle est utilisée, jusqu'à ce que cet appareil se déconnecte ou que vos autres appareils soient déconnectés
([Rester sur votre réseau](/fr/install/home-network/#rester-sur-votre-réseau)).

**Les requêtes provenant d'autres sites** sont refusées : une écriture qui porte le cookie de Kept doit venir de l'origine de `KEPT_PUBLIC_URL`, sinon elle reçoit une erreur 403 avant même que la session soit lue. Il en va de même pour la configuration initiale, qui n'a pas encore de cookie, avant que son code de configuration soit essayé.

`KEPT_EXTRA_ADDRESSES` (non défini par défaut) permet à celui qui exécute le serveur de lister d'autres origines exactes considérées comme faisant partie de Kept. Elles sont lues une fois au démarrage et comparées en entier à l'origine du navigateur `Origin` ; l'en-tête `Host` et `X-Forwarded-*` n'ont aucun rôle. Un caractère générique, ou un mélange de `http` et `https`, empêche le démarrage. Le refus nomme `KEPT_PUBLIC_URL` et jamais la liste. Les clés d'accès, les connexions externes, OAuth et chaque lien restent sur `KEPT_PUBLIC_URL` : une clé d'accès est vérifiée par rapport à cette adresse indépendamment de ce qu'indique la requête. Le coût : une page servie à une adresse listée peut agir pour quiconque y est connecté
([Plusieurs adresses](/fr/install/home-network/#plusieurs-adresses)).

Les pages sont servies
avec une politique de sécurité de contenu `default-src 'self'`, ne peuvent pas être encadrées, et reçoivent HSTS lorsque l'URL publique est en HTTPS, sauf si `KEPT_HSTS=off` ([HSTS](/fr/install/reverse-proxy/#hsts)).

## Limites de débit

Telles qu'implémentées :

| Élément | Limite |
|---|---|
| Tentatives de connexion | 5 par minute par adresse ; par compte et adresse, 20 par heure, avec des délais qui augmentent après le quatrième échec (jusqu'à 5 minutes) plutôt qu'un verrouillage |
| Autres routes d'authentification | 100 par minute par adresse et par route |
| API et MCP, par jeton | 120 lectures et 30 écritures par minute |
| Réinitialisation de mot de passe et lien magique | 3 par heure par compte |
| Page d'un lien de partage | 60 vues par minute par lien |

Les limites sont stockées dans la base de données, donc les répliques les partagent. L'adresse du client provient du
socket, ou de l'en-tête `X-Forwarded-For` uniquement lorsque la connexion provient d'une adresse figurant dans
`KEPT_TRUSTED_PROXIES` ([proxy inverse](/fr/install/reverse-proxy/#faites-confiance-au-proxy-et-seulement-au-proxy)).

## Requêtes sortantes (SSRF)

Kept ne récupère que les adresses configurées par quelqu'un : l'URL de base d'un fournisseur d'IA, les webhooks, les notifications push,
un émetteur OIDC, les métadonnées d'un client OAuth, un serveur Homebox depuis lequel importer,
les recherches de codes-barres,
la vérification de mise à jour, la boîte aux lettres électroniques entrantes d'un lieu (IMAP) et le serveur Paperless-ngx d'un lieu. Chaque demande passe par le même garde-fou
([`apps/server/src/net/ssrf.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/net/ssrf.ts)) :

- l'adresse est vérifiée **lors de l'établissement de la connexion**, après la résolution du nom, donc un nom qui change entre une vérification et la requête ne peut pas passer à travers ;
- les adresses privées, de boucle locale, de liaison locale (y compris l'adresse de métadonnées cloud), le NAT de grade opérateur,
  le multicast et les plages réservées sont rejetés, en IPv4 et IPv6 ;
- les redirections sont rejetées, donc un hôte public ne peut pas faire rebondir la requête vers l'intérieur.

Une adresse refusée retourne `400 private_address`. Sur un serveur auto-hébergé, un administrateur d'instance peut autoriser les adresses privées (**Administration → Paramètres → Autoriser les adresses privées**), ce dont a besoin un fournisseur sur votre propre réseau, tel qu'[Ollama](/fr/admin/ollama/). Cette option est désactivée par défaut.

## Entrées hostiles

Les importations et les téléversements sont considérés comme hostiles. Les valeurs par défaut :

| Limite | Défaut |
|---|---|
| Importation ZIP | 5 Go non compressés, compression 100:1 par entrée, 200 000 entrées, aucun lien symbolique |
| Images | décodées jusqu'à 100 mégapixels, une à la fois sous 3 Go de RAM ou une limite de conteneur sous 3 Go |
| PDFs | analysés dans un processus enfant, 20 s et 256 Mo |
| Téléversements | `KEPT_MAX_FILE_MB` (25 Mo par défaut), refusés avant la lecture du corps |

Les fichiers stockés sont récupérés via un lien signé de cinq minutes sur un chemin ne lisant aucune session, avec
`nosniff` et une politique `default-src 'none'; sandbox`, et en tant que téléchargement sauf si le fichier est l'un des JPEG ré-encodés propres à Kept. Les cellules CSV exportées commençant comme une formule sont neutralisées.

## Ce qui quitte le serveur

- **Rien concernant Kept lui-même.** Il n'y a aucune télémétrie quelconque ; la télémétrie propre à la bibliothèque de connexion est désactivée. Le suivi et le signalement des erreurs ne vont qu'à un collecteur que vous définissez
([surveillance](/fr/admin/observability/#suivi-et-rapport-derreurs)).
- **La vérification de mise à jour est désactivée par défaut.** Activée, elle interroge GitHub pour la dernière version une fois par jour,
  en n'envoyant que la requête
  ([mises à niveau](/fr/admin/upgrades/#savoir-quune-nouvelle-version-existe)).
- **Ce qu'un fournisseur d'IA voit**, lorsqu'un lieu en utilise un : photos sous forme de copie ré-encodée avec EXIF et XMP supprimés (Kept refuse d'envoyer une image qui les conserve encore), le prompt fixe et les langues du lieu pour l'extraction, la question et les résultats des outils que le rôle de l'utilisateur autorise pour l'assistant, ainsi que les champs descriptifs pour la recherche sémantique. **Jamais de valeurs secrètes**,
  et jamais d'argent pour la recherche. L'enregistrement propre à Kept de chaque appel enregistre les jetons et le coût, jamais le prompt, l'image, la réponse ou la clé. Consultez [fournisseurs d'IA](/fr/users/ai-providers/).
- **Liens de partage** (`/s/<token>`) sont la seule page que n'importe qui peut ouvrir sans se connecter. Le jeton
  comporte 32 octets aléatoires, affiché une seule fois et stocké sous forme de son SHA-256 ; il n'apparaît jamais dans un journal. La page
  est lue via une fonction de base de données qui prend le hachage du jeton et renvoie uniquement les noms,
  les types, l'emplacement des objets, leurs quantités, leur état, leurs notes et leurs photos, pour la boîte, l'emplacement ou
  la recherche partagée dans ce lieu. Les photos sont des aperçus avec GPS supprimé, sous forme d'URL signées de cinq minutes, et
  uniquement pour ces objets. Un lien cesse de fonctionner lorsqu'il est révoqué ou expiré, ou lorsque son créateur n'administre plus
  le lieu ; il est vérifié à chaque affichage.
- **Sauvegardes** sont des instantanés restic chiffrés avec un mot de passe d'au moins 12 caractères avant leur départ ; sans mot de passe, il n'y a pas de sauvegarde ([sauvegardes](/fr/admin/backups/)).

## Signalement d'une vulnérabilité

Utilisez le **signalement privé de vulnérabilité** de GitHub sur le dépôt (l'onglet **Security** →
**Report a vulnerability**) ; c'est le seul canal, et il n'existe pas d'adresse e-mail de sécurité. N'ouvrez pas
de ticket public. [SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md)
contient les détails et les versions prises en charge, qui s'appliquent à partir de la version 1.0. Pour vérifier qu'une image est celle construite par le mainteneur, consultez [vérification d'une version](/fr/admin/verify-release/).
