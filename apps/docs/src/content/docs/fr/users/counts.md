---
title: Comptages et inventaires
description: Tout comptage et toute vérification de boîte sont conservés, avec ce qui a été trouvé, ce qui manquait et où se trouve chaque objet maintenant. Comptez un emplacement à plusieurs, planifiez un comptage tous les quelques mois, comparez avec le précédent et exportez un CSV.
---

Un comptage conserve chaque résultat. **Comptages** liste chaque comptage et vérification de boîte d'un lieu, du plus récent au plus ancien, et la page d'un comptage montre ce qu'il a trouvé, ce qu'il a laissé manquant et où se trouve chaque objet maintenant.

Ouvrez-le depuis **Plus → Comptages**, depuis la page d'un lieu (**Comptages**), ou depuis la page d'un emplacement (**Comptages passés**). Après avoir enregistré un comptage, **Voir ce comptage** l'ouvre.

## La liste des Comptages

Recherchez par ce qui a été compté, et filtrez par type (comptages, vérifications de boîte), emplacement, qui a compté, **Ayant des manquants** et date. Regroupez par emplacement, personne ou mois. La liste est paginée, et chaque filtre est dans l'adresse, donc une liste filtrée peut être ajoutée aux favoris ou enregistrée comme une vue.

## La page d'un comptage

- **Trouvé X sur Y**, quand, combien de temps cela a pris, qui a compté (tout le monde, dans un comptage partagé) et qui l'a terminé.
- **Depuis le comptage précédent** du même emplacement ou de la même boîte : « 1 nouveau manquant · 0 retrouvé · 2 nouveaux objets », avec un lien vers le précédent.
- Ses listes, chaque ligne renvoie à l'objet, avec son emplacement actuel :

| Liste | Ce que cela signifie |
|---|---|
| Trouvé | Lu pendant le comptage : marqué vu |
| Manquant | Sur la liste, non lu et non marqué pas ici |
| Trouvé ailleurs | Lu ici, mais Kept le situait ailleurs, et vous l'avez laissé là |
| Déplacé ici | Trouvé ailleurs, et déplacé ici |
| Marqué pas ici | Choisi sur le résumé |
| Prêté, En réparation, Dans la corbeille | Jamais manquant : absent pour une raison que Kept connaît |
| Non compté : Étagère du fond | Dans une zone que personne n'a comptée (voir ci-dessous) |

Un objet mis à la corbeille depuis le comptage s'affiche toujours, marqué **Mis à la corbeille**.

**Exporter en CSV** enregistre le comptage sous forme de tableur : objet, identifiant court, où il était attendu, le résultat, combien ont été trouvés sur combien, et où il se trouve maintenant.

Les comptages enregistrés avant Kept 1.14 affichent leurs totaux ; ils n'enregistraient pas ce qui manquait ni ce qui se trouvait ailleurs.

## Jamais « manquant » pour une raison

Un objet prêté, en réparation ou dans la corbeille n'est jamais listé comme manquant. Le résumé donne à chacun son propre groupe, « Avec Murdock (3) », « En réparation (1) », et le comptage les maintient ainsi.

## Non compté, et « J'ai vérifié »

Un comptage d'un emplacement contenant d'autres emplacements (ou d'un lieu entier) a des zones : l'emplacement et chaque emplacement qu'il contient. Une zone où rien n'a été lu est **Non compté** : ses objets sont listés sous « Non compté : Étagère du fond », pas sous Manquant. Si vous avez regardé et que la zone était vraiment vide de ces objets, appuyez sur **J'ai vérifié** : ils deviennent Manquants.

## Comptage en nombre

Un objet avec une quantité (6 boîtes) compte pour tous quand son étiquette est lue. Utilisez **−** et **+** sur sa ligne pour dire combien vous en avez trouvés. Si vous en avez trouvé moins, choisissez **Marquer le reste pas ici** : le reste est séparé en sa propre ligne, marqué pas ici, comme le fait une vérification de boîte. Annuler le remet ensemble.

## Comptage à plusieurs

Un comptage commencé en ligne est partagé. Toute autre personne ouvrant un comptage du même emplacement voit **Comptage en cours par Sam : Rejoindre**. Rejoindre ajoute ce que vous avez lu au même comptage, chaque lecture avec qui l'a faite ; le résumé montre ce que les autres ont trouvé, et leurs zones comptent comme comptées. Quiconque comptant là peut le terminer, et terminer nécessite une connexion. Un comptage rejoint sur plusieurs jours reste ouvert jusqu'à ce que quelqu'un le termine.

## Couverture des étiquettes

La configuration du comptage indique combien des objets qui s'y trouvent ont des étiquettes (« 62 % des objets ici ont des étiquettes »), avec **Imprimer les étiquettes du reste**. Un objet sans étiquette n'est jamais manquant : cochez-le sur le résumé si vous l'avez vu.

## Comptages planifiés

Sur la page d'un emplacement, **Compter régulièrement** planifie un comptage tous les 1 à 24 mois. C'est un planning de l'emplacement, avec le rappel habituel (une semaine avant), à échéance et en retard, et la tuile Needs-you. Compter cet emplacement (avec ou sans les emplacements qu'il contient) le marque comme fait ; annuler le comptage annule aussi cela. Pour compter un lieu entier régulièrement, planifiez-le sur son emplacement racine.

## Qui peut faire quoi

| | Propriétaire, administrateur, membre | Lecteur |
|---|---|---|
| Voir Comptages, la page d'un comptage, comparer, exporter en CSV | ✓ | ✓ |
| Compter, rejoindre un comptage | ✓ | Une coche : rien n'est enregistré, pas listé |
| Planifier un comptage | ✓, avec Schedules activé | — |
