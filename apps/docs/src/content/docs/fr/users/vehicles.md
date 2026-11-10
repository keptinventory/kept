---
title: Véhicules et machines
description: "Enregistrer des relevés, entretiens et carburant pour tout ce qui a un compteur : voitures, groupes électrogènes, chaudières. Échéances par date ou par relevé, échéances de base, consommables depuis le stock et rapport d'historique."
---

Kept suit tout ce qui a un compteur : une voiture, un groupe électrogène, une chaudière, une tondeuse. Un objet de type compteur possède **Compteurs** : relevés, entretiens et échéances. **Véhicules** (préréglages Household et Complete) regroupe tous les véhicules au même endroit, chacun avec des onglets pour sa synthèse, ses relevés, ses entretiens, ses documents, ses coûts et, sur Complete, son carburant.

Cette page couvre l'enregistrement des relevés et des entretiens, les échéances, le carburant et le rapport d'historique. Pour les formes de carte qu'un véhicule peut porter, voir [formes de carte](/fr/users/map-shapes/).

## Enregistrer un relevé

Un relevé fonctionne depuis Accueil, depuis le véhicule et hors ligne. Un relevé qui ne s'encadre pas entre ses voisins est refusé, et Kept explique pourquoi. Une photo du tableau de bord rejoint les photos de preuve du véhicule.

## Enregistrer un entretien

Une fiche d'entretien conserve la visite à l'atelier :

- La **date** et le **relevé** au moment de la visite.
- **L'atelier** et **la facture**. L'IA peut remplir les lignes à partir de la facture.
- Les **Lignes** avec leurs coûts.
- Les **échéances terminées** : l'enregistrement relance leur compteur.
- Les lignes **Depuis le stock** (ci-dessous).
- Les **notes**.

Sur l'onglet **Entretiens** d'un véhicule, appuyez sur un entretien pour l'ouvrir : tout ce qu'il contient, notes comprises.

- **Modifier** ouvre le même formulaire, prérempli. L'enregistrement ne change que ce que vous avez modifié.
- **Supprimer** demande confirmation, puis propose **Annuler**. Ses lignes et sa facture partent avec lui ; les échéances qu'il avait terminées reprennent leur compteur à partir de l'entretien précédent.
- Qui peut : la personne qui l'a saisi, ainsi que le propriétaire et les administrateurs du lieu. Un lecteur peut l'ouvrir, pas le modifier.
- Une facture encore en cours de lecture est un **brouillon** : **Terminer la saisie** ou **Supprimer le brouillon**.

## Depuis le stock

Quand les consommables sont activés pour le lieu, une ligne d'entretien peut choisir un consommable du même lieu : le filtre à huile sur l'étagère.

- L'enregistrement déduit la quantité de la ligne (1 si la quantité est vide) du stock du consommable.
- Kept refuse d'en prendre plus qu'il n'en reste.
- Modifier la ligne, la retirer, supprimer l'entretien ou annuler l'une de ces actions remet le stock à niveau.
- Une facture encore en cours de lecture ne prend rien tant que vous ne l'enregistrez pas.

L'**historique** du consommable montre l'utilisation, avec un lien vers l'entretien.

L'assistant et les clients MCP peuvent enregistrer un entretien de la même manière (« 4,5 litres d'huile moteur utilisés »). La carte de confirmation de l'assistant montre chaque ligne **Depuis le stock** avant que quoi que ce soit ne bouge.

## Échéances

Une échéance est un rappel pour refaire quelque chose, par date ou par relevé.

- **Ajouter les échéances de base** ajoute les habituelles : vidange, permutation des pneus, liquide de frein, filtre à air.
- **Une occurrence unique** (une date, sans répétition) est faite une fois que vous la terminez. Elle quitte À faire et En retard, et **Échéances** la liste comme **Terminé** avec le jour. Annuler l'achèvement, ou supprimer cet entretien, et elle est à nouveau due.
- Les échéances à faire et en retard apparaissent dans **À traiter** de l'accueil, ainsi que dans le flux calendrier et le centre de notifications. Voir les rappels et notifications.

## Carburant (préréglage Complete)

Sur le préréglage Complete, l'onglet **Carburant** enregistre chaque plein. Le formulaire demande la **quantité** (dans votre unité : litres, gallons, ou une charge en kWh pour un véhicule électrique) et le **coût** ; le prix par unité se calcule à partir de ceux-ci, il n'est pas saisi. Il comporte aussi la date et l'heure, **Plein complet** ou **Partiel**, le compteur kilométrique (facultatif, vérifié par rapport aux relevés avant et après), une photo du compteur kilométrique, le ticket de pompe, une note et la station — une nouvelle station est ajoutée à vos fournisseurs lors de l'enregistrement. **J'ai oublié un plein avant celui-ci** marque un trou, pour que la consommation reste juste : la consommation se mesure d'un plein complet au suivant, et réapparaît après deux pleins complets avec relevés du compteur kilométrique.

## Unités

- **Compteur kilométrique** : le compteur d'un nouveau véhicule compte en **km**, ou en **mi** quand votre réglage **Unités** (Paramètres → Moi → Affichage) est **Impérial**. Celui d'un groupe électrogène compte en heures.
- **Changer d’unité** : les propriétaires et les administrateurs le trouvent sur la fiche du compteur kilométrique de la synthèse, et sur un compteur dans la page d'un objet. Un compteur kilométrique passe de km à mi, ou l'inverse, de l'une de deux façons :
  - **Changer seulement le nom** : les relevés étaient toujours dans la nouvelle unité. Chaque valeur reste telle quelle.
  - **Convertir les relevés** : chaque relevé (y compris ceux en attente de vérification), le décalage de remplacement, la limite par jour et les échéances qui suivent le compteur kilométrique (tous les tant de km, le préavis, le relevé à partir duquel elles comptent et un report jusqu'à un relevé) sont convertis à 1 mi = 1,609344 km, au millième.

  Avant d'enregistrer, Kept indique combien de relevés changent et le dernier avant et après. Le changement entre dans l'historique du véhicule comme **Unité du compteur modifiée**, et le message qui suit propose **Annuler**, qui remet chaque valeur exactement. Annuler est refusé, avec la raison, dès que quelque chose a changé sur le compteur depuis : un relevé enregistré, gardé ou modifié, ou une échéance modifiée. Un compteur horaire ou un compteur personnalisé peut seulement changer de nom.
- Les **relevés et quantités de carburant** sont conservés comme saisis. Seul **Convertir les relevés** change un relevé, et cela peut être annulé. Les quantités de carburant (litres, gallons, kWh) ne sont jamais converties.
- La **consommation de carburant** suit votre réglage **Unités**, quelle que soit l'unité du compteur kilométrique : **L/100 km**, ou **kWh/100 km** pour une charge, en métrique ; **mpg** (gallons américains) ou **mi/kWh** en impérial. Sur un compteur horaire, elle est par heure, dans l'unité saisie. Le PDF du rapport d'historique suit le réglage de la personne qui le crée.
- **Une photo du tableau de bord dans l'autre unité** : quand la photo montre des miles et que le compteur kilométrique compte en km, ou l'inverse, le relevé attend dans la **Réception** comme tout relevé par photo. Sa fiche indique ce que la photo montrait et donne la valeur dans l'unité du compteur kilométrique, avec un bouton pour l'utiliser. Rien n'est converti avant que vous choisissiez.

## Coûts

L'onglet **Coûts** d'un véhicule montre ses coûts de carburant, d'entretien et de frais. Dans Insights, les mêmes chiffres pour vos véhicules figurent sous **Coûts des véhicules**.

## Lire une carte d'immatriculation

En mode étiquette, **Lire la carte** lit une carte d'immatriculation : VIN, plaque et expiration du permis.

## Rapport d'historique

Le **rapport d'historique** génère un PDF pour une période : historique du compteur kilométrique avec photos de preuve, entretiens avec leurs factures, carburant et documents, et coûts uniquement là où vous pouvez voir l'argent.

## Voir aussi

- [Usage quotidien](/fr/users/everyday-use/) pour la vue d'ensemble.
- [Comptages et inventaires](/fr/users/counts/) pour les consommables suivis en stock.
- [Fournisseurs d'IA](/fr/users/ai-providers/) pour la lecture des factures et des cartes.
