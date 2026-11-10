---
title: Connecter un client IA (MCP)
description: Connecter Claude Desktop ou un autre agent IA au serveur MCP (Model Context Protocol) de Kept, avec un jeton personnel ou OAuth.
---

Kept exécute un serveur [MCP](https://modelcontextprotocol.io/) à l’adresse de votre Kept suivie de
`/mcp`, par exemple `https://kept.example.org/mcp`. Une application IA qui parle le MCP peut alors répondre
à « Où est la perceuse ? » à partir de votre inventaire et, si vous l’y autorisez, ajouter, déplacer et modifier des objets.

![Claude Code connecté à Kept : « Ajoute ma TV au salon : Samsung QE55Q80C, numéro de série 0B7H3CJT500123 », et la réponse de Claude que la TV est dans Kept sous Maison › Salon](../../../../assets/screens/claude-mcp-light.webp)

Cette page concerne les applications extérieures à Kept. L’assistant de Kept utilise les mêmes outils et est présenté dans
[Fournisseurs d’IA](/fr/users/ai-providers/). Le fonctionnement interne du serveur est dans
[Serveur MCP](/fr/developers/mcp/).

Il y a deux façons de connecter une application :

- **Un jeton personnel** : tout client MCP qui permet de définir une adresse de serveur et un en-tête `Authorization`.
- **Un connecteur (OAuth)** : l’application vous envoie sur Kept pour vous connecter et choisir ce qu’elle peut faire. Cela nécessite que Kept soit à une adresse `https` accessible pour l’application.

:::note[Pas encore vérifié avec les applications]
Les tests de Kept connectent un client MCP des deux façons. Les vérifications avec claude.ai, ChatGPT et Claude Desktop restent à faire, donc il n’est pas encore confirmé lesquels se connectent comme connecteurs.
:::

## Avant de commencer

- **Activer « Connecter ChatGPT ou Claude » dans chaque lieu que l’application doit atteindre.** C’est sous **Paramètres du lieu → Ce que vous suivez**, et c’est activé uniquement dans le preset **Terminer**. Le propriétaire et les administrateurs le changent. Dans un lieu où c’est désactivé, un jeton ou un connecteur n’atteint rien.
- **L’application crée des jetons uniquement en `https`.** Paramètres → Connexions refuse de créer un jeton quand `KEPT_PUBLIC_URL` vaut un simple `http`. Il n’y a aucun réglage pour désactiver cela. Voir
  [HTTPS](/fr/install/https/). Sur un réseau domestique en `http`, la personne qui fait tourner le serveur peut en créer un là : [`kept admin token create`](/fr/admin/cli/#un-jeton-depuis-le-serveur).

## Créer un jeton personnel

Ouvrez **Paramètres → Connexions** et choisissez **Nouveau jeton**.

| Champ | Que saisir |
|---|---|
| **Nom** | Où vous l’utiliserez : « Claude Desktop, mon portable ». |
| Lieux | Un est coché pour vous. N’en ajoutez un autre que si l’application a besoin des deux. |
| **Ce qu’il peut faire** | **Lecture seule** : trouver des objets et lire ce qui est enregistré. **Lire et modifier** : ajouter, déplacer ou modifier aussi. Aucun des deux ne peut supprimer ni voir les champs secrets. |
| **Expire** | Une date, ou vide pour le garder jusqu’à ce que vous le révoquiez. Il prend fin à la fin de ce jour. |

Puis **Créer le jeton**. Un jeton ne fait jamais plus que vous : là où vous êtes lecteur, il ne peut que lire. Un jeton qui peut modifier des objets dans plusieurs lieux dont les membres diffèrent affiche un avertissement, **Ces lieux sont utilisés par des personnes différentes**, car une application pourrait alors déplacer des objets de l’un à l’autre. **Le créer pour tous** confirme ; un jeton par lieu est le choix le plus sûr.

Le jeton, `kpt_` suivi de deux parties, apparaît **une fois**, avec **Copier**. Kept ne conserve qu’une empreinte, donc un jeton perdu ne peut pas être réaffiché : révoquez-le et créez-en un autre.

Dans un lieu qui exige l’authentification à deux facteurs, un jeton ne fonctionne que si vous l’avez créé en étant connecté avec votre second facteur.

## Connecter un client avec le jeton

Sous le nouveau jeton, **Connecter une application** affiche deux valeurs, chacune avec un bouton Copier :

```text
Server address   https://kept.example.org/mcp
Authorization    Bearer kpt_…
```

Dans l’application, ajoutez un serveur MCP (cela peut s’appeler un connecteur ou une intégration) avec cette adresse, et envoyez le jeton dans cet en-tête. Kept ne fournit pas de fichier de paramètres pour une application donnée ; l’endroit où mettre l’adresse et l’en-tête se trouve dans la documentation de l’application.

Le point de terminaison répond uniquement en `POST`, ne conserve pas de session entre les requêtes, et refuse une requête dont le `Host` n’est pas l’adresse de Kept (ou une qu’elle a déjà utilisée) ou qui provient de la page d’un autre site web.

## Se connecter comme connecteur (OAuth)

Les applications qui le prennent en charge peuvent se connecter sans jeton à copier. C’est activé tout seul quand `KEPT_PUBLIC_URL` vaut `https`. **Administration → Statut → Connexions depuis d’autres apps** affiche le point de terminaison MCP et soit **Disponible**, soit **Nécessite une URL publique https**.

1. Dans l’application, ajoutez `https://kept.example.org/mcp` comme connecteur.
2. L’application trouve la connexion à Kept à partir de l’adresse et vous envoie sur Kept. Connectez-vous.
3. Kept affiche **_App_ veut utiliser votre Kept**. Le nom est celui que l’application se donne ; Kept ne peut pas confirmer qui l’a créée. Choisissez **Ce qu’il peut faire** et **Où** (ne sélectionnez que les lieux dont elle a besoin), puis **Autoriser** ou **Refuser**. La page indique aussi que l’application reste connectée après votre déconnexion de ce navigateur, et que tout ce qui déconnecte tous vos autres appareils la reconnecte.
4. L’application apparaît sous **Apps connectées** dans **Paramètres → Connexions**.

L’application reste connectée jusqu’à ce que vous appuyiez sur **Révoquer** et confirmiez (Kept demande **Déconnecter _App_ ?**), ou jusqu’à ce qu’elle ne soit pas utilisée pendant 30 jours ; elle doit alors se reconnecter. Chaque jeton d’accès qu’elle obtient dure une heure et l’application le renouvelle sans vous redemander ; Kept vérifie votre autorisation à chaque appel, donc **Révoquer** dans **Paramètres → Connexions** agit tout de suite.

L’application doit se reconnecter après tout ce qui déconnecte vos autres appareils : **Déconnexion de tous les autres appareils**, un nouveau mot de passe ou une réinitialisation du mot de passe, un changement de l’authentification à deux facteurs, des codes de secours ou des passkeys, la dissociation d’une connexion externe, une nouvelle adresse e-mail, ou un administrateur qui vous déconnecte partout ou désactive votre compte. Déconnecter un appareil choisi laisse l’application connectée.

Une exception : demander la suppression de votre compte déconnecte vos autres appareils mais conserve la connexion de l’application. L’application cesse de fonctionner pendant que le compte est en attente, et si vous gardez le compte, elle refonctionne sans se reconnecter.

Ce qui arrête un connecteur :

- **L’application ne peut pas joindre Kept.** Une application web comme claude.ai se connecte depuis ses propres serveurs, donc Kept doit être accessible depuis Internet, pas seulement sur votre réseau domestique ou votre tailnet.
- **Kept ne peut pas joindre l’application.** Une application s’identifie avec une adresse `https` pour un document qui la décrit, et Kept récupère ce document. Les adresses privées et locales sont refusées.
- **L’application s’enregistre elle-même.** Kept accepte les applications qui se décrivent avec un tel document (Client ID Metadata Documents) et a l’enregistrement dynamique de clients désactivé. Une application qui ne peut s’enregistrer que dynamiquement ne peut pas se connecter comme connecteur ; utilisez un jeton personnel si elle en accepte un.

## Ce qu’une application peut faire et ne peut pas faire

- **Elle ne voit que les lieux que vous avez choisis**, et dans chacun seulement les outils pour les parties de Kept activées dans ce lieu. Là où votre rôle masque des valeurs, elles sont aussi masquées pour l’application.
- **Les changements s’appliquent tout de suite et sont listés sous Modifications récentes par les connexions** sur la page Connexions, avec **Annulation pendant 7 jours**. L’annulation est refusée si le champ a changé depuis.
- **Il n’y a rien de destructif à appeler.** Aucun outil ne supprime, ne met à la corbeille, ne fusionne, ne transfère la propriété, ne révèle un champ secret, ne téléverse un fichier ni n’exécute une requête par lui-même.
- **Les fichiers passent par vous.** `attach_link` donne à l’application un lien qui ouvre la fiche de capture de Kept ; vous ajoutez la photo ou le reçu là, connecté.
- **Limites par jeton** : 120 lectures et 30 modifications par minute. Les réponses sont courtes et paginées, 20 éléments sauf si l’application en demande davantage, jusqu’à 200.
- **Le texte écrit par les personnes est marqué comme non fiable.** Les noms et les notes arrivent à l’application sous une clé `untrusted`, et Kept lui dit de ne jamais suivre les instructions qu’ils contiennent.

## Les outils

Une application ne voit que les outils qu’elle peut appeler dans chaque lieu ; `capabilities` les liste. [Masquer les éléments personnels](/fr/users/locations/#masquer-personnel) ne change pas ce qui a été donné à l’application. Les outils de **lecture** fonctionnent avec les deux types d’accès ; les outils de **modification** nécessitent **Lire et modifier** et un rôle de membre ou supérieur. La partie de Kept dont un outil a besoin est le nom sous **Ce que vous suivez**.

| Outil | Type | Besoin | Ce qu’il répond |
|---|---|---|---|
| `capabilities` | lecture | | Ce que je peux faire dans chaque lieu : ses parties et les outils que je peux y appeler. |
| `list_locations` | lecture | | Quels lieux je peux voir, avec mon rôle et leur fuseau horaire. |
| `search_things` | lecture | | Quels objets correspondent à ces mots : noms, alias, types, marques et notes, avec des filtres. |
| `where_is` | lecture | | Où est un objet : les meilleures correspondances avec leur chemin d’emplacement complet. |
| `get_thing` | lecture | | Ce que nous savons de cet objet (par identifiant ou identifiant court), qui l’a, et les pièces d’un kit. |
| `list_contents` | lecture | | Ce qui est dans cet emplacement ou ce contenant, sur 1 à 3 niveaux. |
| `thing_history` | lecture | | Ce qui est arrivé à cet objet, du plus récent au plus ancien : qui a fait quoi et quand. |
| `find_documents` | lecture | | Où est le reçu, le manuel ou la garantie d’un objet. |
| `upcoming` | lecture | Rappels | Ce qui est à faire, en retard ou expire bientôt : échéances, garanties, prêts et stock faible. |
| `add_thing` | modification | | Ajouter une ou plusieurs objets, avec un nouvel emplacement si nécessaire, et tous les champs définis par la fiche de création de l’application (voir ci-dessous). |
| `update_thing` | modification | | Modifier tous les champs d’un objet que le formulaire de modification de l’application change (voir ci-dessous) ; `null` en efface un. |
| `move_thing` | modification | | Déplacer un objet, ou une partie d’une quantité, vers un autre emplacement ou contenant. |
| `mark_seen` | modification | | Je viens de voir cet objet là où Kept indique qu’il est. |
| `create_place` | modification | | Ajouter un emplacement sous un autre emplacement, ou au sommet du lieu. Avec `template`, ajouter un meuble et un emplacement pour chacun de ses compartiments en une étape, comme le fait [Meubles avec compartiments](/fr/users/locations/#mobilier-à-compartiments) ; une seule annulation suffit pour tout annuler. Une pièce prend sa vraie taille, `width_cm` et `length_cm` (50 cm à 100 m), et apparaît sur la [carte](/fr/users/location-map/) avec elle. Un modèle de baie prend `units` et `numbering` ([Baies](/fr/users/locations/#baies)). |
| `update_place` | modification | | Modifier un emplacement comme le fait sa page : le renommer, changer son type, le déplacer dans un autre emplacement ou au sommet, définir ses champs, et l’ordre des emplacements qu’il contient (de A à Z ou ordre personnalisé, puis monter ou descendre). `turn` (`right` ou `left`, là où son haut est allé) tourne [un meuble avec compartiments](/fr/users/locations/#retourner-le-mobilier) sur le côté ou sur le dos, avec `renumber` vrai ou faux. Annulation pendant 7 jours, sauf un déplacement vers le haut ou vers le bas : le déplacement inverse annule. |
| `turn_into_boxes` | modification | | Transformer jusqu’à 50 emplacements en boîtes, comme le fait **Transformer des emplacements en boîtes**. Chacun garde son identifiant, son étiquette et ce qu’il contient ; celui qui contient des emplacements reste un emplacement, et il en va de même pour celui au sommet du lieu (transformez celui-là dans Kept). Une annulation les restaure tous. |
| `attach_link` | modification | | Un lien qui ouvre la fiche de capture de Kept pour ajouter une photo, un reçu ou un document. |
| `log_reading` | modification | | Enregistrer un relevé de compteur : odomètre, heures, électricité. |
| `lend_thing` | modification | Prêt | Prêter un objet à quelqu’un, avec une date d’échéance facultative. Une boîte ou un kit part avec tout ce qu’il contient, chacun sur sa propre ligne. |
| `return_thing` | modification | Prêt | Un objet prêté ou emprunté est revenu, en totalité ou en quantité. Une boîte ou un kit ramène ce qui est encore sorti avec lui. |
| `borrow_thing` | modification | Prêt | Enregistrer un objet emprunté à quelqu’un, avec une date d’échéance facultative. |
| `complete_schedule` | modification | Rappels | Une tâche planifiée a été faite, à une date ou à une valeur de compteur. |
| `snooze_schedule` | modification | Rappels | Reporter une tâche planifiée jusqu’à une date ou une valeur de compteur. |
| `add_warranty` | modification | Reçus et garanties | Enregistrer une garantie : son type, et quand elle se termine ou combien de mois. |
| `open_claim` | modification | Reçus et garanties | Ouvrir une réclamation de garantie pour un objet. |
| `update_claim` | modification | Reçus et garanties | Modifier le statut ou la référence d’une réclamation. |
| `log_service` | modification | | Enregistrer un service : date, qui l’a fait, total, lignes (chacune peut utiliser du stock d’un consommable), les échéances qu’il complète, et des notes. |
| `log_fuel` | modification | Carburant | Enregistrer un plein : quantité, unité, coût, si c’est un plein complet, et l’odomètre. |
| `adjust_stock` | modification | Consommables | Ajouter ou retirer du stock d’un consommable. |
| `list_tags` | lecture | | Quelles étiquettes il y a, et combien d'objets ont chacun. |
| `tag_things` | modification | | Ajouter des étiquettes à des objets, ou les retirer ; un nouveau nom crée l’étiquette. |
| `list_moves` | lecture | Déménagement | Quels déménagements il y a, avec combien de boîtes sont emballées, en transit et déballées. |
| `get_move` | lecture | Déménagement | Où est chaque boîte d’un déménagement, et quels numéros manquent encore. |
| `start_move` | modification | Déménagement | Commencer un déménagement, vers un autre lieu ou entre les pièces de celui-ci. |
| `add_box` | modification | Déménagement | Ajouter la prochaine boîte numérotée : une nouvelle, ou un contenant que vous avez. |
| `pack_into_box` | modification | Déménagement | Emballer des objets dans une boîte. |
| `set_box_status` | modification | Déménagement | Marquer une boîte comme emballée ou en transit, ou choisir sa pièce. |
| `unpack_box` | modification | Déménagement | Déballer une boîte dans une pièce ; tout ce qu’elle contient suit. |

**Les champs d’un objet.** `add_thing` et `update_thing` prennent tous les champs que vous pouvez définir sur un objet dans l’application, chacun dans son propre champ plutôt que dans les notes : nom, quantité, type (par nom, en anglais ou en arabe, ou par identifiant), marque (créée si nouvelle), modèle, numéro de série, code-barres, couleur, état, notes, autres noms, étiquettes (un nouveau nom crée l’étiquette, pour les membres et plus), à qui il est (une personne, créée si nouvelle), le lien du manuel, l’expiration et le nombre de jours avant de rappeler, le minimum d’un consommable, et les champs propres au type par clé. `add_thing` prend aussi où il va et l’achat (date, prix d’un avec sa devise, et le magasin) ; `update_thing` prend aussi d’où il vient, et son achat : la date, le magasin, sa ligne sur le reçu, le prix d’un avec sa devise et les notes, en modifiant l’achat qu’il a ou en en enregistrant un, comme le fait la page de l’objet. Un prix nécessite Money activé et un rôle qui voit l’argent, comme dans l’application ; un minimum nécessite **Consommables**. Un type que Kept ne connaît pas est laissé de côté et le `not_set` de la réponse l’indique ; la carte de l’assistant l’affiche comme « non défini » avec un sélecteur. Un équipement dans une baie prend `rack_units` (sa hauteur, 0 à côté des rails) et `rack_at` (son unité du bas comptée depuis le bas, sa face et s’il est en pleine profondeur), refusé comme dans l’application si l’unité est prise.

Les outils de déménagement sont réservés aux applications connectées ; l’assistant de Kept ne les utilise pas.

Tout outil qui prend un identifiant accepte aussi un identifiant court de 6 caractères comme `K7D2QX`. Les contrats complets sont dans
[`packages/mcp/src/tools.ts`](https://github.com/keptinventory/kept/blob/main/packages/mcp/src/tools.ts).

## Révoquer l’accès

Dans **Paramètres → Connexions**, trouvez le jeton ou l’application (filtrez par **Type**, Lieu ou **État**) et choisissez **Révoquer**.

- **Un jeton** : les applications qui l’utilisent cessent de fonctionner tout de suite. Les changements qu’il a faits restent, et peuvent encore être annulés pendant 7 jours.
- **Une application connectée** : elle n’accède plus à votre Kept tout de suite, et Kept oublie votre consentement, donc pour l’utiliser à nouveau vous la reconnectez depuis l’application.

Kept met aussi fin à l’accès de lui-même, et la liste en donne la raison : **Expiré**, **Terminé : vous avez quitté le lieu**, **Terminé : votre rôle a changé**, **Révoqué par un administrateur**, ou **Déconnecté par l’application**.
