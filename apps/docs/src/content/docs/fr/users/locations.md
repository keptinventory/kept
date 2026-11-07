---
title: Lieux, pièces et boîtes
description: "L'arborescence dans laquelle tout se trouve : lieux, pièces et endroits, boîtes et contenus, Sans emplacement, les présentations d'un lieu (Liste, Grille, Graphe, Tableau, Carte), et Sélection pour plusieurs objets à la fois."
---

Tout se trouve dans une arborescence : un lieu (Maison, Garage, une unité de stockage) contient des **pièces et endroits** ("pièce ou endroit" est le mot de Kept pour désigner n'importe quel emplacement), qui contiennent des objets. Un objet peut être une **boîte ou contenant** qui contient d'autres objets, aussi profondément que vous le souhaitez. Chaque lieu possède également **Sans emplacement**, pour les objets qui n'ont pas encore d'emplacement.

- Sur un lieu, une pièce ou un endroit, ou une boîte, **Ajouter ici** ajoute un Objet, une **Boîte / contenant** ou une **Pièce ou endroit**, ou [meuble à compartiments](#mobilier-à-compartiments).
- Les listes possèdent une zone de recherche, **+ Filtrer**, des **Vues** enregistrées, et un bouton **Affichage** pour l'ordre de tri et le regroupement. Les filtres vivent dans l'adresse, donc une liste filtrée peut être mise en signet ou partagée.
- **Sélectionner** (à côté de la zone de recherche, pour toute personne pouvant modifier des objets) coche les objets dans la liste d'un lieu, d'un emplacement ou d'une boîte, en Liste ou Grille. **Maj+clic** sur la case à cocher d'une ligne (ou **Maj+Espace** dessus) pour cocher toutes les lignes à partir de celle que vous avez cochée en dernier. Ensuite : **Déplacer**, **Ajouter des tags…** ou **Supprimer des tags…**, **Définir un champ…**, **Prendre** (dans le plateau), **Imprimer les étiquettes**, **Ajouter à un sinistre** et **Dossier de sinistre** (propriétaires et administrateurs, où Reçus et garanties se trouvent), ou **Mettre à la corbeille**. La barre est celle du [Tableau](/fr/users/spreadsheet/).
- **Définir un champ…** attribue une valeur unique (type, marque, modèle, état et autres) à chaque objet sélectionné. Les modifications sont marquées **Pas encore enregistré** et attendent jusqu'à **Enregistrer N changements** ; un **Annuler** rétablit toute la sauvegarde. Cela nécessite une connexion. Si quelqu'un a modifié l'un d'entre eux pendant ce temps-là, cet élément attend : **Garder ma version** ou **Garder leur version**.
- **Mettre à la corbeille** prend jusqu'à 200 éléments à la fois et nécessite une connexion. Il demande d'abord ce qu'il advient du contenu d'une boîte (le déplacer dehors ou le jeter aussi) et concernant tout objet prêté, puis un **Annuler** les ramène tous.
- **Ordre :** les emplacements et les objets sont lus de A à Z avec les nombres dans l'ordre (Boîte 2 avant Boîte 10), identique dans l'application, hors ligne, dans les exportations et pour les applications IA. Les étages conservent l'ordre dans lequel ils ont été créés : le premier est le rez-de-chaussée sur la carte. Sur un emplacement, **Affichage → Objets : trier par** ordonne ses objets ; ses emplacements restent de A à Z.
- **Votre propre ordre :** sur un emplacement, **Gérer → Ordre des emplacements ici → Ordre personnalisé** place les emplacements internes dans l'ordre que vous choisissez, avec **Monter** et **Descendre** sur chacun (clavier aussi). **De A à Z** revient à tout moment, et passer à nouveau à **Ordre personnalisé** rétablit votre ordre. L'arborescence, la carte, les exportations et les applications IA le suivent. Le niveau supérieur d'un lieu reste de A à Z.
- **Transformer des emplacements en boîtes…** sur la page **Gérer** d'un emplacement, elle liste les emplacements internes : cochez-en quelques-uns, ou **Tout sélectionner**, et ils deviennent des boîtes en une seule étape, chacun conservant son ID, son étiquette et son contenu. Un emplacement contenant d'autres emplacements ne peut pas être sélectionné : une boîte ne contient que des objets. Le **Annuler** du toast les ramène tous en tant qu'emplacements, tels qu'ils étaient ; il reste dans l'historique pendant 7 jours.
- **L'assistant et les applications IA** peuvent faire de même : renommer un emplacement, changer son type, le déplacer, définir ses champs et l'ordre des emplacements qu'il contient, et transformer des emplacements en boîtes (`update_place` et `turn_into_boxes`, [clients MCP](/fr/users/mcp-clients/)). L'assistant affiche une carte pour confirmation préalable ; **Annuler** fonctionne comme dans l'application.
- **L'arborescence des emplacements** (à côté de la page sur un ordinateur, **Tous les emplacements** sur un téléphone) affiche les boîtes sous chaque emplacement avec le nombre d'objets qu'elles contiennent, jusqu'à 50 par emplacement, puis **+N boîtes**. La flèche située à côté d'un emplacement replie ce qui se trouve dessous ; **Tout replier** et **Tout déplier** agissent sur tous les emplacements d'un coup. Kept mémorise vos replis pour votre compte, sur chaque appareil. Les emplacements situés au-dessus de la page que vous consultez restent ouverts, même après **Tout replier**.
- **Sa largeur** (sur un ordinateur, à partir de 1280 px de large) : faites glisser la ligne le long du bord de l'arborescence, ou concentrez-vous dessus et utilisez les touches fléchées, Début et Fin. **Réduire les emplacements**, le bouton en haut de l'arborescence, le réduit pour laisser toute la place à la page ; **Développer les emplacements** le rétablit. Cet appareil mémorise les deux.
- Sur un lieu, **Les ranger** parcourt **Sans emplacement** un objet à la fois avec un sélecteur d'emplacement.
- Une boîte ouverte depuis son étiquette affiche une grille de photos de son contenu.
- **Présentations :** la page d'un lieu bascule entre **Liste**, **Grille**, **Graphe**, **Tableau** et **Carte**, chacune avec son icône. **Graphe** représente le lieu sous forme de graphe de ses étages, pièces, boîtes et objets, en 2D ou 3D ([Le graphe](/fr/users/graph/)). **Tableau** affiche ses objets sous forme de tableau, sur un écran de 1024 px de large ou plus ([Vue du tableau](/fr/users/spreadsheet/)), donc un téléphone montre Liste · Grille · Graphe · Carte. **Carte** montre le lieu en 3D, étage par étage, avec ses pièces, étagères et boîtes ([La carte des lieux](/fr/users/location-map/)). Le menu **Affichage** de la liste propose le même choix. La page propre d'un emplacement (hors Sans emplacement) possède également ce commutateur, sans Tableau. Kept mémorise la présentation pour chaque lieu et chaque emplacement sur cet appareil.
- **Grille** affiche les emplacements et les objets d'un lieu ou d'une pièce sous forme de tuiles, sous les mêmes intitulés Emplacements et Objets que la Liste ; chaque intitulé se replie. **Affichage → Taille** choisit **Petit**, **Moyen** ou **Grand** pour les tuiles (3, 2 ou 1 par rangée sur un téléphone), et Kept mémorise votre préférence de taille sur cet appareil.
- Sur un ordinateur ou une tablette, la barre latérale indique le lieu où vous vous trouvez : sur sa page, ainsi que sur ses pièces, objets, boîtes et paramètres.

![Un lieu dans la grille avec de petites tuiles : l'en-tête Emplacements · 9 au-dessus des pièces, puis l'en-tête Objets · 20+ au-dessus des objets, six tuiles par rangée, chacune avec son nom uniquement](../../../../assets/screens/grid-desktop-light.webp)

![La même grille en thème sombre](../../../../assets/screens/grid-desktop-dark.webp)

Les liens utilisent des identifiants, jamais le chemin, donc déplacer un objet ne rompt jamais un lien vers celui-ci.

## Mobilier à compartiments

Une étagère cube, une bibliothèque ou une armoire à tiroirs constitue un seul emplacement, et chaque cube, étagère ou tiroir est un emplacement intérieur, avec son propre nom, son étiquette et, si vous le souhaitez, son propre code.

- **Ajouter ici → Pièce ou endroit → Meuble à compartiments…** crée le meuble et tous ses compartiments en une seule étape. Choisissez un modèle : une étagère cube 1 × 4, 2 × 2, 2 × 4, 4 × 4 ou 2 × 8, une bibliothèque (6 étagères), une armoire à tiroirs (9) ou une unité de rangement (4). Modifiez le nombre d'étagères ou de tiroirs avant de l'ajouter. Le type du meuble est **Meubles** ; ses compartiments sont **Case**, **Étagère** ou **Tiroir**.
- **Comment il est posé :** une étagère cube qui n'est pas carrée peut être **Debout** ou **Couché**. Une étagère cube 2 × 4 debout comporte 4 rangées de 2 ; couchée, 2 rangées de 4. Les compartiments sont construits selon son orientation.
- **Comptage :** de la gauche supérieure, ligne par ligne, tel que vous le voyez devant vous. Un 4 × 4 va de Case 1 à Case 16 ; un 2 × 4 sur le côté a de 1 à 4 sur la rangée du haut et de 5 à 8 sur la rangée du bas. La feuille montre les numéros avant que vous l'ajoutiez. Les **noms des compartiments** utilisent `{n}` pour le numéro, `{row}` pour la rangée et `{col}` pour la colonne.
- **Codes :** **Son propre code** attribue un code au meuble (`KX01`), et **Codes des compartiments** définit un modèle pour les compartiments, tel que `{parent}-F{col:02}{row:02}` : `{parent}` représente le code du meuble, `{col:02}` la colonne sur deux chiffres. Un 4 × 4 obtient alors `KX01-F0101` à `KX01-F0404`. Chaque code est vérifié par rapport à la règle de format du lieu (**Paramètres → le lieu → Général → Vos propres codes**) et par rapport aux codes existants ; s'il ne convient pas, rien n'est créé et Kept attribue un nom au code. La lecture ou la recherche d'un code permet de trouver son compartiment.
- **Annuler :** le **Annuler** du toast place le meuble et ses compartiments dans la corbeille et libère leurs codes, tant qu'aucun objet n'y a été placé ou modifié depuis.
- **Étiquettes :** sur le nouveau meuble, **Tout étiqueter ici** imprime une étiquette pour lui et pour chaque compartiment, dans l'ordre de comptage.
- **Sa page** affiche les compartiments tels qu'ils sont, numérotés comme leurs étiquettes. Appuyez sur un compartiment pour l'ouvrir. **Imprimer leurs étiquettes** les imprime à nouveau tous, dans l'ordre de comptage, avec les noms qu'ils ont actuellement.
- **Mettre à la corbeille :** ses compartiments partent à la corbeille avec lui et reviennent avec lui lors de **Restaurer**. Si quelque chose se trouve dans le meuble ou dans un compartiment, Kept ne pose la question que pour cela : **Les déplacer vers** la pièce où il se trouve (ou **Choisir un autre emplacement**), ou **Les mettre aussi à la corbeille**. Une boîte part telle quelle, avec ce qu'elle contient. Un emplacement que vous avez ajouté vous-même au meuble compte comme quelque chose dedans. Le **Annuler** du toast remet chaque chose dans son compartiment.

### Retourner le mobilier

- **Le tourner…** sur la page du meuble, pour une étagère cube qui n'est pas carrée.
- **Son haut est maintenant :** **À droite** ou **À gauche**, lorsque vous lui faites face. Chaque compartiment se déplace avec l'unité, avec ses objets et son étiquette imprimée.
- **Ses compartiments** sont demandés à chaque fois, car les étiquettes sont déjà appliquées :
  - **Renuméroter :** chaque compartiment reçoit le numéro, le nom et le code de l'endroit où il se trouve maintenant, comptés à nouveau depuis le coin supérieur gauche. Un ancien code fonctionne toujours : il ouvre le compartiment actuellement situé à l'emplacement qu'il avait nommé. Réimprimez les étiquettes pour les nouveaux noms.
  - **Conserver les codes :** seule son orientation change. Chaque compartiment conserve son numéro, son nom et ses codes.
- La feuille montre la nouvelle grille avant que vous ne la retourniez. Un nom ou un code que vous avez vous-même saisi reste associé à son compartiment, quel que soit le cas.
- **Annuler** le rétablit, avec ses numéros, noms et codes intacts, tant qu'aucun changement n'a été effectué dessus depuis.

### Fusionner et diviser les compartiments

Un insert de cube ou une étagère retirée fusionne deux ou plusieurs compartiments en un seul.
- **Fusionner ou diviser…**, puis appuyez sur des compartiments côte à côte formant un rectangle, et sélectionnez **Fusionner**.
  Celui en haut à gauche reste, avec son numéro, son nom et son code. Les autres sont envoyés à la corbeille ; leurs codes et leurs étiquettes imprimées ouvrent le compartiment fusionné, et leur contenu y est déplacé.
- Pour diviser un compartiment fusionné, appuyez dessus et sélectionnez **Diviser**. Chaque cellule revient avec son code et son étiquette ; les objets restent dans celui en haut à gauche.
- **Annuler** inverse l'opération dans les deux cas.
- **Vos propres modèles :** **Paramètres → Compte → Modèles → Meubles** contient les modèles d'emplacement personnels du compte : cubes alignés et empilés (debout), étagères ou tiroirs, les types, les noms et le motif de code, partagés avec les lieux que vous sélectionnez. Les propriétaires et administrateurs les créent ; toute personne pouvant ajouter des emplacements les utilise.
- Les **applications IA** peuvent faire de même : `create_place` prend un `template`, et `update_place` un `turn` ([clients MCP](/fr/users/mcp-clients/#les-outils)). La fusion et la division restent dans l'application.

## Masquer Personnel

Tout le monde possède un lieu **Personnel**. Si vous n'en avez aucune utilité, activez **Masquer Personnel** dans **Paramètres → Moi → Vos lieux**, et désactivez-le pour l'afficher à nouveau à tout moment. C'est votre propre préférence : personne d'autre ne remarque de changement.
- **Absent de :** les lieux dans le menu, Accueil, les listes, la recherche et leurs filtres. Un module ne suivant que Personnel (par exemple, Véhicules) quitte le menu avec celui-ci.
- **Immuable :** tout ce qu'il contient. Un lien vers Personnel ou vers un objet qu'il contient l'ouvre toujours. Masquer sert à ranger, pas à protéger : cela ne verrouille rien.
- **Les rappels vous parviennent toujours**, sous forme de notifications, dans le résumé et dans le flux du calendrier. Désactivez-les dans **Paramètres → Moi → Notifications**, où Personnel est toujours indiqué.
- **Capture** commence dans votre autre lieu, ou dans Personnel si vous ne pouvez ajouter aucun objet ailleurs.
- **Importer** propose les autres lieux que vous possédez ou administrez, ou Personnel s'il n'y en a aucun. Une importation antérieure s'ouvre toujours depuis Activité, où qu'elle ait été placée.
- **Garder disponible hors ligne** dans **Paramètres → Cet appareil** conserve la ligne de Personnel tant que sa copie est sur l'appareil, permettant ainsi de le désactiver.
- **Exporter mes données** transporte le premier autre lieu que vous possédez, et Personnel reste sur **Exporter un lieu**. Si vous ne possédez aucun autre lieu, il transporte Personnel.
- **Votre clé personnelle IA** paie également pour un lieu que vous possédez et utilisez seul, lorsque le compte de ce lieu n'a pas de clé propre. Il ne paie jamais pour un lieu partagé.
- **L'assistant** exclut Personnel, sauf si vous l'ouvrez depuis Personnel. **Connexions** (jetons personnels et applications connectées) conservent les lieux que vous leur avez donnés, visibles ou masqués.
Vous ne pouvez pas le masquer tant qu'il s'agit de votre seul lieu. S'il devient votre seul lieu ultérieurement (si vous partez, si vous êtes supprimé, si l'autre lieu est supprimé), il réapparaît alors tout seul, et se masque à nouveau lorsque vous en possédez un autre.

## Voir aussi
- [Utilisation quotidienne](/fr/users/everyday-use/) pour avoir une vue d'ensemble.
- [Tags](/fr/users/tags/) pour ce qu'est un objet outre son emplacement.
- [Partage d'un lieu](/fr/users/everyday-use/#partager-un-lieu) pour permettre à des personnes d'y accéder.
