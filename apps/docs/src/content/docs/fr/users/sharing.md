---
title: Partage d'un lieu
description: Inviter des personnes ayant un rôle et une date de fin, partager des liens en lecture seule, et imprimer une liste sur papier.
---
Un lieu est partagé en invitant des personnes à y accéder, chacune avec un rôle et une date de fin optionnelle. Votre
lieu Personnel n'est jamais partagé : il ne comporte aucun membre, aucune invitation ni aucun lien de partage.

Cette page traite des invitations, des rôles, des liens de partage et de l'impression.

## Inviter des personnes

La carte **Inviter des personnes dans …** sur l'écran Accueil apparaît après la création d'un lieu. La même page se trouve sous
**Paramètres du lieu → Membres → Inviter**.

1. Choisissez le **Rôle**, et sous **Accès** soit **Pas de date de fin**, soit **Jusqu’à une date**. Leur
    accès s'arrête à cette date, et les jetons qu'ils ont créés pour l'API s'arrêtent également.

2. **Créer un lien d’invitation.** Le lien fonctionne une fois, pendant 7 jours. Montrez le code QR à scanner avec leur
    téléphone, ou copiez le lien. Une invitation en attente apparaît sous **Membres** jusqu'à ce qu'elle soit utilisée, et vous pouvez
    la révoquer là.

3. **Envoyer par e-mail** ne fonctionne que lorsque le serveur possède la configuration e-mail.

Une personne sans adresse e-mail peut néanmoins se voir créer un compte : les propriétaires et les administrateurs en ajoutent un depuis
**Paramètres du lieu → Membres → Ajouter quelqu’un sans e-mail**. Cela devient un compte géré — Kept
crée une adresse pour lui qui ne peut pas recevoir de courriel, définit son mot de passe avec un code de réinitialisation, et le
propriétaire est informé de chaque nouveau compte.

Toute personne sauf le propriétaire peut **Quitter ce lieu**. Un administrateur d'instance ne peut pas voir l'intérieur d'un lieu à moins
d'y avoir été invité.

## Rôles

| Rôle | Ce qu'ils peuvent faire dans ce lieu |
|---|---|
| **Propriétaire** | Tout, y compris les règles d'authentification à deux facteurs, le transfert et la suppression. Il n'y a qu'un propriétaire. |
| **Administration** | Inviter et retirer des membres et des lecteurs, modifier les paramètres et les modules, importer et exporter, créer des liens de partage et des dossiers de sinistre, supprimer définitivement. Seul le propriétaire accorde ou révoque les administrateurs. |
| **Membre** | Ajouter, éditer, déplacer, prêter et mettre à la corbeille des objets ; enregistrer des relevés et des entretiens ; imprimer des étiquettes ; utiliser la capture par IA. L'argent est visible. |
| **Lecteur** | Regarder et rechercher uniquement. L'argent est masqué sauf si le lieu permet aux lecteurs de le voir. L'assistant répond mais ne peut rien modifier. |

## Liens de partage

Les liens de partage montrent à quelqu'un sans compte ce qui se trouve dans une boîte, un emplacement ou une recherche, en lecture seule.
Les propriétaires et les administrateurs en créent un ainsi :

- **Actions → Partager un lien en lecture seule** sur une boîte.
- La section **Gérer** d'un emplacement.
- **Partager cette liste** sur Recherche : une recherche filtrée à un lieu, sans filtres d'état ou de prix.

Choisissez sa durée de validité : un jour, une semaine, 30 jours (par défaut), 90 jours ou un an. Le lien n'est affiché qu'une seule fois : copiez-le à ce moment-là.

### Ce qu'ils voient

Le nom, la photo, le type, l'emplacement, la quantité, l'état et les notes de chaque objet, de A à Z. Jamais les prix,
les numéros de série, les champs secrets, les personnes, les prêts ou les documents. Les objets dans la Corbeille, les brouillons et ceux que vous avez vendus ou perdus
ne sont pas affichés.

### Cela reste à jour

La page affiche la boîte, l'emplacement ou la recherche telle qu'elle est lorsqu'elle est ouverte. Le lien d'une recherche correspond à ses mots,
ainsi qu'à ses filtres d'emplacement, de type et de tag.

### Gestion des liens

**Paramètres du lieu → Liens de partage** liste chaque lien avec son état et le nombre de fois où il a été ouvert.

- **Aperçu comme le destinataire** montre la page telle que le destinataire la voit.
- **Révoquer** met fin au lien immédiatement.
- Un lien s'arrête également lorsqu'il expire, ou lorsque la personne qui l'a créé ne gère plus le lieu.

## Impression d'une liste

Pour remettre une liste sur papier à quelqu'un, imprimez-la. **Imprimer l'inventaire** sur un lieu crée un PDF de ses
objets, regroupés par emplacement, avec des photos et des IDs courts. Les prix n'apparaissent que pour les personnes pouvant voir
l'argent. Toute personne pouvant voir le lieu peut en créer un.

**Me l’envoyer par e-mail** envoie également le PDF lorsqu'il est prêt, et **Le renvoyer** envoie l'ensemble du lieu
chaque lundi ou le 1er du mois. **Paramètres → Moi → Notifications** répertorie ces options et
permet de les arrêter. Un rapport de plus de 10 Mo n'est pas joint : imprimez-le depuis Kept.

## Liens associés

- [Vos premières minutes](/fr/users/first-run/#5-inviter-des-personnes) pour inviter des personnes lors de la configuration.
- [Utilisation quotidienne](/fr/users/everyday-use/) pour une vue d'ensemble.
- [Kits et transferts](/fr/users/kits/) pour prêter des objets.
