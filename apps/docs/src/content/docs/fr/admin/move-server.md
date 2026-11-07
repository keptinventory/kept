---
title: Transfert vers un nouveau serveur
description: Deux façons de déplacer Kept - l'ensemble de l'instance via une sauvegarde, ou un lieu à la fois via une exportation.
sidebar:
  order: 8
---

## L'ensemble de l'instance : par une sauvegarde

Cela déplace tout (chaque compte, lieu, fichier et réglage) et c'est la même procédure que
la récupération après perte d'un serveur :

1. Sur l'ancien serveur, effectuez une sauvegarde et laissez-la se terminer, puis imprimez le
   [kit de récupération](/fr/admin/recovery-kit/).
2. Sur le nouveau serveur, [installer Kept](/fr/install/compose/) avec les clés du kit dans `.env` et la même
   cible de sauvegarde, mais **ne démarrez pas Kept encore**.
3. [Restaurer](/fr/admin/restore/#après-la-perte-du-serveur) la dernière sauvegarde dans la nouvelle base de données vide.
4. Pointez l'ancienne adresse vers le nouveau serveur (DNS, ou votre proxy), gardez `KEPT_PUBLIC_URL` identique,
   puis démarrez Kept. Les étiquettes et les codes QR continuent de fonctionner car l'adresse n'a pas changé.
5. Arrêtez l'ancien serveur une fois que le nouveau a été vérifié, et conservez son disque jusqu'à ce que le nouveau ait effectué une bonne sauvegarde et un [exercice de restauration](/fr/admin/restore/#lexercice-mensuel).

Si l'adresse change toutefois, les étiquettes déjà imprimées portent encore l'ancienne : pointez également l'ancien nom d'hôte vers le nouveau serveur, et ajoutez-le parmi les anciens noms d'hôte de l'instance : Kept redirige alors une visite sous l'ancien nom vers la même page à la nouvelle adresse.

## Un lieu à la fois : par une exportation

Un propriétaire exporte un lieu, avec ses fichiers et, s'il le choisit, ses valeurs secrètes sous une phrase de passe ; sur le nouveau serveur, ils l'importent dans un nouveau lieu. Cela déplace un ménage sans le reste de l'instance, et fonctionne entre deux instances exécutant des versions différentes, à condition que le nouveau ne soit pas plus ancien que l'ancien (une version ancienne de Kept peut refuser une exportation provenant d'une version plus récente).

1. Sur l'ancien serveur, dans **Paramètres → Exporter**, exportez le lieu. Choisissez si vous voulez inclure
   les valeurs secrètes ; si c'est le cas, définissez une phrase de passe. Les exportations sont effectuées uniquement en HTTPS, et restent disponibles au téléchargement pendant 7 jours.
2. Sur le nouveau serveur, connectez-vous, ouvrez **Paramètres → Importer**, et choisissez l'exportation Kept (le ZIP).
   Kept la vérifie d'abord et montre ce qu'elle ajoutera avant d'écrire quoi que ce soit ; fournissez la phrase de passe
   pour ramener les valeurs secrètes.
3. L'importation crée un **nouveau lieu** avec les objets, les emplacements, les fichiers, les rapports d'état, les déplacements
   et leur historique. Les étiquettes imprimées
   continuent de fonctionner : le code court de l'étiquette est conservé lorsqu'il est libre sur le nouveau serveur, et
   réédité lorsqu'il ne l'est pas ; dans ce cas, scanner l'ancienne étiquette ouvre toujours l'objet.
4. Invitez les personnes qui ont partagé le lieu ; l'importation les liste, mais n'invite personne automatiquement.
