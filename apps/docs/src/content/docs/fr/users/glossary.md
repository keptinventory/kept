---
title: Glossaire
description: Les mots que Kept emploie à sa manière, en langage clair.
---

Kept emploie quelques mots à sa manière. Cette page explique ce que chacun signifie et où en lire plus.

## A

**Administration** : un rôle dans un lieu. Peut inviter et supprimer des membres et des lecteurs, modifier les paramètres et les modules, importer et exporter, créer des liens de partage et des dossiers de sinistre, et supprimer définitivement. Seul le propriétaire accorde ou retire des administrateurs. [Les rôles](/fr/users/first-run/#les-rôles)

**Fournisseur d'IA** : le service que Kept appelle pour nommer des objets à partir de photos, lire des reçus, exécuter l'assistant et, avec un modèle d'embeddings, rechercher par sens : Groq, OpenAI, Anthropic, Google, OpenRouter, ou un serveur compatible OpenAI tel qu'Ollama. Vous apportez votre propre clé. [Fournisseurs d'IA](/fr/users/ai-providers/)

## B

**Sauvegarde** : un instantané restic nocturne de la base de données, des fichiers et d'une copie lisible, chiffré avec un mot de passe que vous choisissez et envoyé vers un autre disque, un bucket S3 ou un serveur SFTP. [Sauvegardes](/fr/admin/backups/)

Boîte : voir Conteneur.

## C

**Capture** : ajouter un objet en prenant sa photo. Avec un fournisseur d'IA, Kept le nomme à partir de la photo ; sans un, il attend dans la Réception un nom.

**Dossier de sinistre** : un ZIP du rapport pour l'assurance contenant chaque reçu, facture, photo et numéro de série pour un sinistre, partagé avec l'assureur par un lien de téléchargement. [Rapports](/fr/users/reports/)

**Compartiment** : un emplacement dans un meuble, créé à partir d'un modèle d'emplacement : un cube, une étagère ou un tiroir, avec son propre nom, sa propre étiquette et, si vous le souhaitez, son propre code. Les compartiments côte à côte peuvent être fusionnés en un seul, et séparés à nouveau. [Meubles avec compartiments](/fr/users/locations/#mobilier-à-compartiments)

**État des lieux** : un état de la façon dont un logement loué était à votre entrée et à votre sortie, pour un litige de dépôt de garantie. [États des lieux](/fr/users/condition-reports/)

**Consommable** : un objet compté par quantité, par exemple des vis, de l'huile ou des piles, avec un minimum qui déclenche un rappel de stock bas. Un service peut en prendre un **Depuis le stock**.

**Contenant** : un objet qui en contient d'autres, comme une boîte ou un sac. Les contenants s'imbriquent, une boîte dans une boîte sur une étagère. Un contenant est un objet, pas un emplacement.

**Compter** : compter un emplacement, ou vérifier une boîte, par rapport à ce que Kept attend d'y trouver. Chaque comptage est conservé, avec ce qui a été trouvé et ce qui manquait. Aussi appelé un inventaire. [Comptages et inventaires](/fr/users/counts/)

## D

**Brouillon**: un objet enregistré par la Capture que personne n'a encore vérifié. Il attend dans la Réception jusqu'à ce qu'il soit accepté ou rejeté. [La capture et la Réception](/fr/users/everyday-use/#la-capture-et-la-réception)

## F

**Meubles** : une sorte d'emplacement pour les meubles de rangement, ajoutés avec leurs compartiments en une seule étape : une étagère à cubes, une bibliothèque, une commode. Les meubles dessinés sur la carte, comme un bureau, sont un objet avec une forme à la place. [Meubles avec compartiments](/fr/users/locations/#mobilier-à-compartiments)

## G

**Graphe** : l'une des dispositions d'un lieu : ses étages, pièces, boîtes et objets sous forme de nœuds et de liens, en 2D ou en 3D, avec des épingles pour ce qui requiert de l'attention. [Le graphique](/fr/users/graph/)

## H

**Remise** : prêt d'une boîte avec tout ce qu'elle contient : un seul enregistrement, avec une ligne pour la boîte et une pour chaque objet qu'elle contient, chacun revenant par lui-même. [Kits et remises](/fr/users/kits/)

## I

**Réception** : où les objets vous attendent : captures sans nom, ce que l'IA a lu et qui nécessite un examen, les reçus arrivés par e-mail, les relevés qui semblent incorrects, et les modifications de téléphone qui requièrent une décision.

**Sinistre** : un cambriolage, un incendie, une inondation ou une perte, avec les objets qu'il a affectés. [Rapports](/fr/users/reports/#sinistres-et-dossiers-de-déclaration)

**Instance** : un serveur Kept en cours d'exécution, avec ses comptes et ses lieux.

**Administrateur de l'instance** : une personne qui fait fonctionner le serveur : utilisateurs, inscriptions, sauvegardes. Un administrateur de l'instance ne peut pas voir à l'intérieur d'un lieu à moins d'y avoir été invité.

**Rapport pour l'assurance** : un PDF et un CSV de chaque objet avec sa photo, sa marque, son modèle, son numéro de série, sa date d'achat, son prix, sa valeur actuelle et ses reçus, avec des totaux par emplacement et par devise. [Rapports](/fr/users/reports/#rapport-pour-lassurance)

## K

**Kit** : un contenant avec une liste des pièces qui devraient s'y trouver. Déplacez une pièce, prêtez-la ou perdez-la, et le kit le sait toujours. [Kits et remises](/fr/users/kits/#kits)

## L

**Support d'étiquettes** : ce sur quoi les étiquettes sont imprimées : une feuille A4 ou Letter, un rouleau d'imprimante à étiquettes, ou un ruban d'étiqueteuse. Le ruban étroit (9 et 12 mm) n'a pas la place pour un code QR ; **Scanner** lit son ID court imprimé à la place. [Impression](/fr/users/short-ids/#impression)

**Disposition** : la façon dont la page d'un lieu affiche ce qu'il contient : **Liste**, **Grille**, **Graphe**, **Tableau** (sur un ordinateur) ou **Carte**. Kept se souvient du choix par lieu et par appareil. [Lieux, pièces et boîtes](/fr/users/locations/)

**Prêts** : enregistrement du fait qu'un objet, ou une partie d'une quantité, est chez quelqu'un, avec une date de retour, son état et des photos.

**Lieu** : une maison, un garage, un box de stockage, un bureau ou tout autre endroit où vous gardez des objets. Chacun a ses propres membres, rôles, modules, fuseau horaire et devise.

## M

**Compte géré** : un compte avec un nom d'utilisateur et sans e-mail, pour un enfant ou un parent, créé par le propriétaire ou un administrateur d'un lieu. Un lieu contient au maximum 20 comptes. [Personnes sans e-mail](/fr/users/first-run/#personnes-sans-e-mail)

**Carte** : l'une des dispositions d'un lieu : le lieu en 3D, étage par étage, avec ses pièces, étagères et boîtes, que les membres et plus haut organisent. [La carte des lieux](/fr/users/location-map/)

**MCP** (Model Context Protocol) : la façon dont une application d'IA telle que Claude se connecte à Kept pour trouver et modifier des objets, dans le cadre de votre rôle. [Connecter un client IA](/fr/users/mcp-clients/)

**Compteurs** : relevés, services et plannings, pour un objet dont le type comporte un compteur : une voiture, un générateur, une chaudière. [Véhicules et machines](/fr/users/vehicles/)

**Membre** : un rôle dans un lieu. Peut ajouter, modifier, déplacer, prêter et mettre à la corbeille des objets, enregistrer des relevés et des services, imprimer des étiquettes et utiliser la capture par IA. L'argent est visible.

**Module** : une partie de Kept activée ou désactivée par lieu, comme Prêts ou Véhicules. [Modules et préréglages](/fr/users/modules/)

## N

**À traiter** : les comptages de l'accueil de ce qui demande de l'attention : En retard, À échéance, Expirant, Prêté, Incertain et Stock bas. [Accueil](/fr/users/home/)

## O

**Propriétaire** : le rôle qui détient un lieu. Tout ce qu'un administrateur peut faire, plus les règles d'authentification à deux facteurs, le transfert et la suppression. Il n'y a qu'un seul propriétaire.

## P

**Lieu personnel** : votre propre lieu, créé avec votre compte. Il n'est jamais partagé : pas de membres, d'invitations ou de liens de partage. Vous pouvez [le masquer](/fr/users/locations/#masquer-personnel) une fois que vous en avez un autre.

**Emplacement** : une pièce ou un endroit à l'intérieur d'un lieu : un étage, une pièce, une étagère, un tiroir. Une boîte est un contenant, pas un emplacement.

**Modèle d'emplacement** : les meubles et leurs compartiments en une seule recette : la disposition (cubes en largeur et en hauteur, étagères ou tiroirs), les types, les noms et un motif de code. Kept propose des étagères à cubes, une bibliothèque, une commode et une unité de rangement ; un compte ajoute les siens sous **Paramètres → Compte → Modèles → Meubles**. [Meubles avec compartiments](/fr/users/locations/#mobilier-à-compartiments)

**Préréglage** : l'ensemble des modules avec lesquels un lieu commence : Essentiels, Foyer ou Complet. [Modules et préréglages](/fr/users/modules/)

## R

**Relevé** : la valeur d'un compteur à un instant donné, par exemple un compteur kilométrique ou un compteur d'heures.

**Kit de récupération** : les clés du serveur, le dépôt et les identifiants de la sauvegarde, et les étapes de restauration, à imprimer ou à enregistrer en dehors du serveur. Sans lui, une sauvegarde ne peut pas restaurer les clés d'IA ni les mots de passe enregistrés. [Le kit de récupération](/fr/admin/recovery-kit/)

**RLS** (sécurité au niveau des lignes) : les règles de base de données qui séparent les lieux : chaque requête ne voit que ce que la personne connectée peut voir. [Sécurité au niveau des lignes](/fr/developers/rls/)

## S

**Planning** : quelque chose à refaire, par date ou par relevé, comme une vidange. [Rappels](/fr/users/reminders/)

**Champ secret** : un champ d'un objet, comme un mot de passe Wi-Fi ou un code de porte, stocké chiffré et masqué jusqu'à ce qu'une personne autorisée le révèle. Chaque révélation est consignée.

**Lien de partage** : un lien en lecture seule vers ce qui se trouve dans une boîte, un emplacement ou une recherche, pour une personne sans compte. [Liens de partage](/fr/users/sharing/#liens-de-partage)

**ID court** : le code à six caractères que possède chaque objet et emplacement, comme `7KQ-4MZ`, imprimé sur son étiquette. [IDs courts et étiquettes](/fr/users/short-ids/)

**Inventaire** : voir Compter.

## T

**Ruban** : le ruban ambré qu'un code affiche une fois qu'il possède une étiquette imprimée. Le ruban d'étiqueteuse est un support d'étiquettes. [IDs courts et étiquettes](/fr/users/short-ids/)

**Objet** : tout ce que vous suivez : une perceuse, une voiture, une boîte de câbles.

**Corbeille** : où attendent pendant 30 jours les objets mis à la corbeille. Les membres et plus haut les restaurent ; les administrateurs les suppriment définitivement.

## U

**Sans emplacement** : l'emplacement que chaque lieu possède pour les objets qui n'ont pas encore d'emplacement.

## V

**Véhicule** : un objet dont le type est Véhicule ou un type qui en dérive : une voiture, une moto, une bicyclette, un générateur. Les véhicules reçoivent des relevés, des services et des plannings, et le carburant avec Complet. Une chaudière a des compteurs mais n'est pas un véhicule. [Véhicules et machines](/fr/users/vehicles/)

**Lecteur** : un rôle dans un lieu. Peut seulement regarder et rechercher. L'argent est masqué à moins que le lieu n'autorise les lecteurs à le voir ; l'assistant répond mais ne peut rien modifier.

## W

**Nouveautés** : la carte après une mise à jour de Kept, avec les points forts de cette version, une fois par personne ; **Aide** la réaffiche. [Faire un tour](/fr/users/first-run/#7-faire-la-visite)

## Articles associés

- [Vos premières minutes](/fr/users/first-run/) pour bien commencer.
- [FAQ](/fr/users/faq/) pour les questions courantes.
