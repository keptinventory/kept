---
title: Connexion et sécurité
description: Les clés d’accès et l’application d’authentification dans les Paramètres, les codes de secours, la configuration à nouveau de l’application, sa désactivation, ce que Kept refuse et pourquoi, et pourquoi le verrouillage de l’application n’est pas une clé d’accès.
---

**Paramètres → Connexion et sécurité** décrit les moyens de connexion de votre compte au-delà du mot de passe :
les clés d’accès, et l’authentification à deux facteurs avec une application d’authentification.

## Confirmez votre identité

Toute modification sur cette page demande d’abord :

- un compte avec mot de passe : **votre mot de passe** ;
- un compte sans celui-ci (clé d’accès, lien e-mail ou seulement Google) : **une connexion datant de moins de dix
  minutes**. Si elle est plus ancienne, la feuille propose **Se reconnecter**.

L’ajout d’une clé d’accès demande aussi le mot de passe sur un compte qui en possède déjà un, et nécessite toujours une connexion durant les dix dernières minutes, quel que soit le compte : le navigateur exécute alors sa propre boîte de dialogue pour la clé d’accès.
L’activation ou la désactivation de l’authentification à deux facteurs ne compte pas comme une nouvelle connexion.

La dissociation de Google ou de votre connexion OIDC dans **Moyens de connexion** demande la même confirmation.

Chaque modification déconnecte tous les autres appareils, sauf le renommage d’une clé d’accès. Kept vous envoie un courriel lorsqu’une clé d’accès est ajoutée ou retirée, lorsqu’une connexion externe est dissociée, lorsque l’authentification à deux facteurs est activée, configurée à nouveau ou désactivée, et lorsque de nouveaux codes de secours sont générés. Il vous envoie aussi un courriel chaque fois qu’un code de secours sert à se connecter, avec l’heure, l’appareil, le nombre de codes restants et ce qu’il faut faire si ce n’était pas vous. Les comptes gérés (un nom d’utilisateur, sans e-mail) ne reçoivent aucun courriel.

## Clés d’accès

Une clé d’accès vous permet de vous connecter avec Face ID, une empreinte ou le verrouillage d’écran de votre téléphone, sans saisir de mot de passe. Kept ne la voit jamais : elle reste sur l’appareil ou dans votre gestionnaire de mots de passe. Elle appartient à une adresse : sur un Kept comportant [plus d’une adresse](/fr/install/home-network/#plusieurs-adresses), ajoutez-la et utilisez-la à l’adresse principale.

| | |
|---|---|
| **Ajouter une clé d’accès** | Nommez-la (Kept suggère l’appareil : "Mac", "iPhone"), puis répondez à la boîte de dialogue du navigateur. Fermer cette boîte de dialogue n’entraîne aucun changement. |
| **Synchronisé** | Votre gestionnaire de mots de passe ou la plateforme la conserve également sur vos autres appareils. |
| **Cet appareil uniquement** | Elle réside uniquement sur cet appareil ou cette clé de sécurité. |
| **Renommer** | Ce nom vous appartient, jusqu’à 64 caractères. |
| **Retirer** | Elle cesse de vous permettre de vous connecter. Supprimez-la également sur l’appareil si vous ne souhaitez plus la conserver là. |

Chaque clé d’accès ajoutée par Kept vérifie qu’il s’agit bien de vous (Face ID, une empreinte ou un code PIN), donc une connexion avec clé d’accès compte comme une authentification à deux facteurs en soi, y compris dans les lieux qui l’exigent.

## L’application d’authentification

L’authentification à deux facteurs avec une application telle que 1Password, Google Authenticator ou Aegis : après votre mot de passe, un lien e-mail ou Google, la connexion demande son code à six chiffres.

- **Activer** : confirmez votre identité, scannez le code QR (ou saisissez la clé), entrez un code, puis enregistrez les dix codes de secours. Elle n’est activée qu’une fois ce code validé.
- **8 codes de secours restants sur 10** : chaque code de secours permet de se connecter une seule fois, utile lorsque votre téléphone est indisponible.
- **Nouveaux codes de secours** : dix nouveaux codes, affichés une seule fois. Les anciens codes cessent de fonctionner.
- **Configurer à nouveau** : pour un nouveau téléphone ou une autre application. Scannez le nouveau code QR et saisissez un code provenant de la nouvelle application. Jusqu’à ce que vous le fassiez, l’application actuelle continue de fonctionner ; fermez la feuille à mi-chemin et rien ne change. Une fois cela effectué, les codes de l’ancienne application et ses anciens codes de secours cessent de fonctionner.
- **Désactiver** : la connexion ne demande plus de code.

## Ce que Kept refuse

Ces éléments sont refusés par le serveur, indépendamment de ce que l’écran affiche :

- **Suppression de votre dernière méthode de connexion.** Une clé d’accès ne peut pas être supprimée, et la connexion Google ou votre connexion OIDC ne peuvent pas être dissociées, lorsque rien d’autre ne permettrait de se connecter : un mot de passe, une autre clé d’accès, Google ou la connexion OIDC (tant que ce Kept la propose encore), ou un lien e-mail (lorsque ce Kept envoie des courriels et que votre adresse est confirmée).
- **Désactivation de l’authentification à deux facteurs là où elle est requise.** Lorsqu’un lieu auquel vous appartenez exige l’authentification à deux facteurs et que vous n’avez pas de clé d’accès, l’application d’authentification reste active. Ajoutez d’abord une clé d’accès. De la même manière, votre dernière clé d’accès reste active tant que ce lieu dépend d’elle et que l’application est désactivée.
- **Ajout d’une clé d’accès ou de l’application avant la confirmation de votre adresse**, lorsque ce Kept envoie des courriels. Connectez-vous une fois avec un lien envoyé à l’adresse, puis réessayez.

## Le verrouillage de l’application n’est pas une clé d’accès

**Paramètres → Cet appareil → Déverrouiller avec Face ID ou l’empreinte** déverrouille Kept sur cet appareil uniquement,
après qu’il est déjà connecté ([le verrouillage de l’application](/fr/users/phone-app/#le-verrouillage-de-lapp)). Il ne peut pas vous connecter. Si le navigateur le propose lors de la connexion et que Kept répond *Cette clé d’accès ne permet pas de se connecter à ce compte*, connectez-vous autrement, puis ajoutez une véritable clé d’accès ici.
