---
title: Tags
description: Tags disent ce qu'est autrement un objet, outre où il se trouve. Ajoutez-les partout, filtrez par plusieurs, ouvrez la page d'un tag, et étiquetez sur un téléphone sans réseau.
---

**Emplacements** disent où se trouve un objet. **Tags** disent ce qu'il est autrement : *camping*, *hiver*, *enfants*,
*fragile*. Un objet peut avoir jusqu'à 50 tags ; un compte jusqu'à 1 000.

Les tags appartiennent au compte, donc chaque emplacement les partage. Seuls les objets ont des tags (les boîtes sont des objets) ; les emplacements, les documents et les personnes n'en ont pas.

## Ajout de tags
- **Page d'un objet :** **Tags → Ajouter un tag**. Choisissez-en un, ou tapez un nouveau nom et **Créer**. Un nom proche d'un tag existant est listé en premier sous **Vouliez-vous dire**, donc *Campng* ne devient pas un deuxième *Camping*.
- **Ajout d'un objet :** le champ **Tags** dans **Ajout d'un objet**.
- **Capture:** **Ajouter des tags** sous le nom. Les tags restent pour les prochaines photos, comme l'emplacement.
- **Plusieurs à la fois :** **Sélectionner** dans le contenu d'un emplacement, la page d'un tag ou la Boîte de réception, puis
  **Ajouter des tags…** ou **Retirer des tags…**. Autres tags restent tels quels.
- **Vue feuille de calcul :** la colonne **Tags** et **Tags…** pour une sélection.

Tout changement possède **Annuler**.

## Qui peut faire quoi
| | Propriétaire | Administration | Membre | Lecteur |
|---|---|---|---|---|
| Voir les tags, filtrer par ceux-ci | ✓ | ✓ | ✓ | ✓ |
| Étiqueter les objets, créer un nouveau tag | ✓ | ✓ | ✓ | |
| Renommer, changer la couleur, fusionner, supprimer un tag | ✓ | ✓ | | |

## Couleurs
Chaque tag possède une couleur provenant d'un ensemble fixe de douze, choisi pour être lisible en clair et sombre. Un nouveau tag prend la couleur utilisée le moins. Modifiez-le dans **Paramètres → Compte → Tags → Modifier**. Les couleurs provenant d'une importation Homebox deviennent les plus proches parmi les douze.

## Page d'un tag
Cliquez sur un tag dans la page d'un objet, ou sur une ligne dans **Paramètres → Compte → Tags**. Il liste tout ce qui possède le tag dans vos emplacements, avec le nombre dans chacun, ainsi que la recherche, les filtres et le regroupement habituels de la liste. Les propriétaires et admins peuvent renommer, changer la couleur, fusionner et supprimer le tag ici.
- **Fusionner** fusionne un tag dans un autre : ses objets obtiennent l'autre tag.
- **Supprimer** fonctionne uniquement pour un tag que aucun objet n'a, y compris les objets dans la Corbeille. Utilisez la fusion à la place.
- Renommer, changer la couleur, fusionner et supprimer peuvent être annulés pendant 7 jours.

## Recherche par tag
- **Filtrer → Tag:** **est l'un de**, **a tous parmi** (objets avec chaque tag choisi) ou **n'est aucun de**.
- **Affichage → Group: Tag** liste chaque objet sous son premier tag, A à Z ; les objets sans tag dernières.
- La recherche trouve les noms des tags, et la recherche par signification les connaît aussi.

## Hors ligne
Le téléphone conserve vos tags : les puces s'affichent, et le filtre de tag fonctionne en recherche hors ligne. Les tags que vous ajoutez ou retirez, et ceux que vous créez, sont enregistrés sur le téléphone et synchronisés lorsque vous êtes de nouveau en ligne.

## IA et MCP
- **Capture:** avec l'IA activée, une photo suggère des tags provenant de votre liste, jamais de nouveaux. Confirmez-les ou rejetez-les dans la Boîte de réception.
- **MCP et l'assistant:** `get_thing` retourne les tags; `list_tags` les liste; `tag_things` les ajoute ou les enlève; `search_things` prend plusieurs tags, quelconques ou tous; `add_thing` et `update_thing` prennent les noms des tags.

## Importations
- **Homebox:** les tags arrivent avec leurs couleurs ; les tags imbriqués sont aplatis. Les tags sur les emplacements Homebox ne sont pas conservés, et le rapport d'importation le indique.
- **CSV:** une colonne `tags` crée les tags qu'elle nomme.
