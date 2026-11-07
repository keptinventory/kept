---
title: Photos de pièce
description: Photographiez une pièce, un placard ou une étagère, et Kept répertorie ce qu'il contient en tant que brouillons dans la Boîte de réception, chacun avec sa propre image, en ignorant ce que Kept possède déjà.
---

**Pièce** est un mode de capture permettant de remplir Kept rapidement : prenez jusqu'à cinq photos d'une pièce, d'un placard ou d'une étagère, et l'IA liste chaque objet qu'elle voit. Kept fusionne le même objet vu sur deux photos, omet ce qui est déjà présent dans Kept, et place le reste dans la Boîte de réception sous forme de brouillons déjà associés à cette pièce, chacun avec son propre découpage issu de la photo.

## Avant de commencer

Le mode Pièce lit les photos avec l'IA, il a donc besoin de ce dont toute capture IA nécessite :

- **Capture par IA** activée dans le lieu (un propriétaire ou un administrateur l'active, dans **Paramètres du lieu → Ce qu'il faut suivre**), et un fournisseur d'IA capable de lire des photos ([fournisseurs d'IA](/fr/users/ai-providers/)).
- Vous pouvez modifier les objets du lieu : membres, administrateurs et propriétaires. Les spectateurs ne voient pas le mode.

Lorsque le mode Pièce ne peut pas s'exécuter, il indique la raison au lieu de se cacher : la capture par IA est désactivée dans le lieu, aucun fournisseur capable de lire des photos n'est configuré, ou le budget IA est épuisé pour le moment.

## Prenez les photos

1. Ouvrez **Capture**, puis **Pièce** sur la bande des modes. Depuis la page d'un emplacement, **Remplir à partir de photos** l'ouvre sur cet emplacement ; sur la [carte du lieu](/fr/users/location-map/), la carte d'une pièce comporte **Photographier cette pièce**.
2. Vérifiez où vont les photos : la puce d'emplacement en haut. Une capture de pièce va dans une pièce, un endroit ou une boîte, jamais dans la zone Sans emplacement.
3. Prenez de 1 à 5 photos, ou choisissez-les avec **Galerie**. Tenez-vous dans l'encadrement de la porte et prenez une photo par mur. Chaque photo attend dans le plateau, où vous pouvez la supprimer.
4. **Envoyer**. Hors ligne, les photos restent sur le téléphone et sont envoyées lorsqu'il revient en ligne, comme toute capture.

Kept lit les étiquettes présentes sur les photos sur le téléphone avant leur envoie. Un objet dont l'étiquette est visible est connu avec certitude, où qu'il se trouve dans le lieu.

## Examinez la pièce

La Boîte de réception affiche une seule carte **Pièce** en tête du lot de captures, avec les brouillons qu'elle a créés dessous :

- **Nouveaux objets** : chacun sous forme de brouillon dans la pièce, avec sa propre image, nom, marque, modèle et couleur remplis là où la photo les montrait. Acceptez, modifiez ou rejetez-les comme tout autre brouillon, ou utilisez **Accepter les noms** pour l'ensemble du lot. Un brouillon ressemblant à un objet déjà possédé est signalé comme doublon probable.
- **Meubles de rangement** (étagères, bibliothèques, armoires, penderies, commodes) : **Ajouter comme lieu** transforme chacun en emplacement intérieur à la pièce, permettant d'y placer des objets. Les autres meubles (un canapé, un lit, une table) restent des brouillons comme tout autre objet.
- **Déjà dans Kept** : objets montrés par les photos que la pièce possède déjà, selon la même étiquette, la même marque et modèle, ou le même nom. Cochez-les et utilisez **Marquer comme vu**. Un objet dont l'étiquette a été lue commence coché.
- Chaque photo indique ce qu'elle a fourni. *« Impossible de lire la photo 3 »* signifie que cette photo a échoué et que les autres comptent quand même ; *« Cette photo contenait plus ; prenez une photo plus rapprochée »* signifie qu'elle montrait plus qu'une photo ne peut lister (60 objets).

Les personnes, les animaux et la pièce elle-même (murs, sols, fenêtres, portes, équipements) ne sont jamais listés, et aucune image n'est jamais découpée d'une personne.

**Terminé** ferme la carte. **Rejeter** supprime les photos. Lorsqu'aucune photo ne peut être lue, **Réessayer** les relit.

### Sur la carte

Lorsque la pièce est dessinée sur la [carte du lieu](/fr/users/location-map/), chaque objet accepté est placé sur le sol de la pièce avec une forme devinée à partir de son type et de son nom, dans un espace libre. La prochaine fois que vous **Organisez**, la carte liste ce que Kept a placé, afin que vous puissiez déplacer chaque objet là où il se trouve réellement. Le placement effectué par Kept n'interrompt jamais quelqu'un qui organise la carte en même temps.

## Quel est le coût

Chaque photo correspond à une lecture IA, et une capture de plusieurs photos ajoute un appel texte court supplémentaire qui fusionne ce que les photos ont en commun. Avant d'envoyer, le plateau montre une borne supérieure, telle que *« Environ 3 photos · jusqu'à ~31 000 jetons · Groq »* : la photo, les instructions et la plus longue réponse autorisée par Kept, pour chaque photo ; une réponse plus courte coûte moins cher. Un modèle qui réfléchit avant de répondre facture sa réflexion en supplément.

La lecture des pièces compte dans les mêmes budgets et plafonds que les autres lectures de photos. Lorsque le plafond est atteint, la carte indique *« En attente du budget IA »*, et les photos sont lues lorsque l'IA reprend. Chaque appel apparaît dans **Utilisation de l’IA** sous **Photo de pièce** ou **Photos de pièce fusionnées**.

## Confidentialité

- Ce que reçoit le fournisseur est identique à toute capture : une copie de chaque photo avec les données de localisation et d'appareil supprimées, ainsi que les instructions fixes.
- **Les photos complètes de la pièce sont supprimées lorsque vous fermez la carte de la pièce** (Terminé ou Rejeter). Chaque brouillon ne conserve que son propre découpage.
- **Pendant que la carte de la pièce est ouverte, ses photos sont privées aux personnes qui l'examinent** : propriétaires, administrateurs et membres du lieu. Les spectateurs ne les voient pas sur la page de la pièce ou de la boîte, dans la recherche ou sur leur téléphone, et ni un jeton API en lecture seule, une connexion MCP en lecture seule ni un lien de partage ne peuvent y accéder. Tant qu'elle est en cours d'examen, une photo de pièce ne devient jamais la photo de couverture d'une boîte.
- Pour conserver les photos complètes à la place, un propriétaire ou un administrateur active **Garder les photos de pièce après la revue** dans **Paramètres du lieu → Général**. Après **Terminé**, elles restent sur la page de la pièce comme des photos ordinaires, visibles par tous ceux qui voient le lieu.

## Dans Essayez Kept

[Essayez Kept](/fr/try/kept/) ne possède pas de caméra et n'exécute pas d'IA : le mode Pièce propose **Utiliser une photo de pièce d'exemple**, une pièce illustrée, et chaque photo de pièce donne les mêmes résultats d'exemple, afin que vous puissiez voir la carte Pièce, les brouillons et les meubles sans fournisseur. Le plateau indique *« Aucune IA ne s'exécute dans cette démo »* où une installation réelle afficherait le coût.
