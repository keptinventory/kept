---
title: Modules et préréglages
description: "Ce que chaque lieu suit : les préréglages Essentiel, Foyer et Complet, les modules derrière eux, et ce que désactiver l'un d'eux fait."
---

Chaque lieu fonctionne avec un **préréglage** : un ensemble de **modules** activés ensemble. Un préréglage est un point de départ : un propriétaire ou un administrateur peut ensuite activer ou désactiver des modules individuellement, et en désactiver un ne fait que le masquer. Rien n'est supprimé.

Vous choisissez le préréglage lors de la création du lieu ([Vos premières minutes](/fr/users/first-run/)). Le lieu **Personnel** d'un nouveau compte commence sur Essentiel. L'importation d'une sauvegarde Homebox dans un nouveau lieu commence aussi sur Essentiel, avec chaque module pour lequel la sauvegarde contient des données coché en plus ([importer depuis Homebox](/fr/users/import-export/#un-export-homebox)).

## Les trois préréglages

- **Essentiel** : trouver des objets : pièces, boîtes, étiquettes et recherche.
- **Foyer** : ajoute les reçus et garanties, les rappels, les prêts, les documents et les véhicules.
- **Complet** : ajoute le carburant, les consommables, les mots de passe et codes, le déménagement, et « Connecter ChatGPT ou Claude ».

Le fuseau horaire et la devise ne font pas partie du préréglage : ils se trouvent dans **Paramètres du lieu → Général**.

## Ce que chaque module ajoute

Les noms ci-dessous sont les interrupteurs de **Ce que vous suivez**.

| Module | Depuis | Ce que cela apporte |
|---|---|---|
| **Étiquettes et codes QR** | Essentiel | Des étiquettes imprimables pour les objets et les lieux ; scanner une étiquette ouvre ce sur quoi elle est apposée. |
| **Argent et dépenses** | Foyer | Les prix, les totaux et **Statistiques**. Chaque devise sur sa propre ligne, jamais convertie. |
| **Reçus et garanties** | Foyer | Les dates de garantie ; une garantie qui expire apparaît comme un rappel. |
| **Rappels** | Foyer | Les plannings : ce qui est dû, par date ou par relevé. |
| **Prêts** | Foyer | Prêter des objets et en emprunter. |
| **Documents** | Foyer | La bibliothèque de documents ; les dates de documents alimentent les rappels. |
| **Véhicules** | Foyer | Les véhicules et les machines. |
| **Carburant** | Complet | Le carburant et la recharge. Nécessite Véhicules. |
| **Consommables** | Complet | **Garder au moins** sur un objet ; un stock faible apparaît comme un rappel. |
| **Déménagement** | Complet | Le mode déménagement. Nécessite Étiquettes et codes QR. |
| **Mots de passe et codes** | Complet | Les champs secrets : cachés jusqu'à ce qu'une personne autorisée en révèle un, ce qui est journalisé. |
| **Connecter ChatGPT ou Claude** | Complet | La connexion MCP, pour qu'une application d'IA puisse travailler avec le lieu. |

## L'IA dans ce lieu

La capture par IA et l'assistant s'activent dans n'importe quel préréglage une fois qu'un fournisseur d'IA est connecté pour le lieu. Ils partagent un seul interrupteur, **Capture par IA et assistant**, sous **IA dans ce lieu** sur la même page, pour qu'un lieu puisse rester hors de l'IA pendant qu'un fournisseur est connecté. Choisir un préréglage ne le change pas. Voir [Fournisseurs d'IA](/fr/users/ai-providers/).

## Désactiver un module

Un module désactivé est masqué partout où il apparaîtrait (ses écrans, ses entrées de menu, ses filtres) et ses rappels se mettent en pause. Le réactiver fait tout revenir, car rien n'a été supprimé.

- **Les rappels se mettent en pause avec leur module.** Les plannings et les objets qui expirent attendent avec **Rappels**, les dates de garantie et d'immatriculation avec **Reçus et garanties**, les dates de documents avec **Documents** (les documents d'un véhicule continuent aussi de fonctionner tant que **Véhicules** est activé), les prêts avec **Prêts**, le stock faible avec **Consommables**. Les rappels concernant les compteurs non relevés récemment fonctionnent toujours.
- **Les dépendances disparaissent aussi.** Le carburant nécessite Véhicules, et le déménagement nécessite Étiquettes et codes QR : désactiver celui dont un module a besoin désactive aussi ce module. Son interrupteur indique alors *Nécessite Véhicules · désactivé dans ce lieu*.
- **Le menu suit tous vos lieux.** Sous **Suivi**, une entrée (Plannings, Prêts, Documents, Consommables, Véhicules, Déménagement, Statistiques) s'affiche dès que son module est activé dans l'un de vos lieux. Sous **Outils**, **Étiquettes** s'affiche tant que les étiquettes sont activées quelque part, et **Comptages** est toujours présent. Activité, Corbeille et Notifications sont toujours présents aussi.

## Changer plus tard

Un propriétaire ou un administrateur ouvre **Paramètres du lieu → Ce que vous suivez**. Le sélecteur de préréglage active tous les modules à la fois ; **Ajuster** en dessous comporte un interrupteur par module. Avant d'enregistrer, **Lors de l'enregistrement** liste ce qui s'active et ce qui se désactive.

## Voir aussi

- [Lieux, pièces et boîtes](/fr/users/locations/) pour les emplacements à l'intérieur d'un lieu.
- [Partager un lieu](/fr/users/sharing/) pour les rôles.
