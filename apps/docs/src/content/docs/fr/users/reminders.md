---
title: Rappels et notifications
description: "Ce dont Kept vous rappelle, le fonctionnement du centre de notifications, la mise en place des canaux pour ntfy, Telegram et Apprise, et les réglages par lieu."
---

Kept vous rappelle les échéances planifiées, les garanties qui expirent et les délais d’enregistrement, les documents
et objets qui expirent, les prêts en retard, les compteurs non relevés depuis longtemps, le stock bas, l’arrivée et le
départ des membres, et les plafonds de dépenses IA. **À traiter** dans Accueil montre ce qui est à faire ou en retard ; la cloche ouvre
le centre de notifications, où **Terminer**, **Reporter**, **Renouveler** et **Marquer comme rendu** agissent sur
place.

Cette page présente ce qui vous parvient, la mise en place des canaux et les réglages par lieu. Pour les notifications
push sur un téléphone, voir [Kept sur votre téléphone](/fr/users/phone-app/#notifications).

## Ce qui vous parvient

**À traiter** dans Accueil affiche six compteurs, toujours au même endroit : **En retard**, **À faire**,
**Échéances proches**, **Prêtés**, **Incertain** et **Stock bas**. Un zéro est grisé, pas masqué.
**Empruntés** et **Pas vus depuis longtemps** apparaissent quand il y a quelque chose. Sur ordinateur, chacun nomme
son élément le plus urgent. Touchez-en un pour ouvrir la liste correspondante, déjà filtrée.

Le centre de notifications (la cloche) liste tout ce qui est à faire ou en retard, groupé par type. De là vous pouvez
**Terminer**, **Reporter**, **Renouveler** ou **Marquer comme rendu** sans quitter la page.

## Paramètres

**Paramètres → Moi → Notifications** choisit ce qui vous parvient et comment :

- **Récapitulatif quotidien** : un unique résumé quotidien plutôt que des notifications individuelles.
- **Heures calmes** : aucune notification pendant les heures choisies. Rien n’est envoyé ni par push ni par e-mail dans
  ces heures ; ce qui devient à faire attend la fin des heures calmes pour être envoyé.
- **Flux d’agenda** : un lien privé pour votre application d’agenda, affichant les échéances.

Les notifications push sur téléphone sont traitées dans [Kept sur votre téléphone](/fr/users/phone-app/#notifications).

## Le tableau des notifications

**Ce qui vous parvient** est un seul tableau. Les lignes sont les types, groupés :

- **Échéances** : calendriers, garanties, délais d’enregistrement, documents, objets qui expirent,
  compteurs non relevés depuis longtemps.
- **Prêts** : prêts en retard.
- **Stock** : stock bas.
- **Personnes** : arrivée et départ des membres.
- **IA** : plafonds de dépenses et récapitulatif mensuel.

Les colonnes sont vos canaux :

- **Dans Kept** : le centre de notifications et **À traiter** dans Accueil.
- **E-mail** : à l’adresse e-mail de votre compte.
- **Push** : vers votre téléphone (si le push est configuré).
- **Webhook / ntfy / Telegram / Apprise** : une fois que vous en avez ajouté un, une colonne apparaît pour chaque type.

Les avis membres et IA ne vont qu’à Kept et par e-mail. Désactiver **Dans Kept** pour un type le désactive partout : rien d’autre n’est envoyé pour lui. Sur téléphone, chaque type présente ses canaux sous forme d’interrupteurs.

## Réglages par lieu

- **Tous les lieux** fixe ce que vous recevez partout, y compris les lieux ajoutés plus tard.
- **Choisir un lieu** pour le modifier uniquement là. Un point marque ce qui est défini pour ce lieu seul.
- **Remettre ce lieu comme tous les lieux** efface ces dérogations.
- Un type dont le module est désactivé là s’affiche en pause (ses rappels attendent le retour du module).
- Où vous êtes observateur, vous ne recevez que l’arrivée et le départ des membres.
- Où vous êtes membre, Kept démarre avec seulement les prêts que vous enregistrez : activez ce que vous voulez là-bas.

## Mise en place des canaux

### ntfy

Ajoutez votre serveur (`https://ntfy.sh` ou le vôtre) et un sujet difficile à deviner, plus un jeton d’accès si le sujet en a besoin. Kept conserve tout cela chiffré et ne les réaffiche jamais. **Tester** en envoie un maintenant.

### Telegram

Créez un robot avec @BotFather, envoyez-lui un message, puis ajoutez son jeton et votre identifiant de chat. Kept conserve tout cela chiffré et ne les réaffiche jamais. **Tester** en envoie un maintenant.

### Apprise

Quand votre serveur dispose d’Apprise, collez une ou plusieurs URL Apprise, comme `discord://…`, pour atteindre Discord, Slack, Matrix, Signal et plus. Kept conserve tout cela chiffré et ne les réaffiche jamais. **Tester** en envoie un maintenant.

## Rappels de prêt

**Prêter** un objet (ou une partie d’une quantité) à un membre ou un contact, avec une date d’échéance et des photos de l’état. Kept ne contacte jamais l’emprunteur ; **Copier un rappel** vous donne le texte à envoyer vous-même. Une boîte part avec tout ce qu’elle contient, chaque objet sur sa propre ligne. Voir [Kits et remises](/fr/users/kits/).

## Voir aussi

- [Kept sur votre téléphone](/fr/users/phone-app/) pour les notifications push et l’usage hors ligne.
- [Usage quotidien](/fr/users/everyday-use/) pour la vue d’ensemble.
- Véhicules et machines pour les relevés de compteurs et les calendriers d’entretien.
