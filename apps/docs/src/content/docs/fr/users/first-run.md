---
title: Vos premières minutes
description: Réclamez un nouveau Kept avec son code de configuration, créez votre premier foyer, ajoutez des objets, invitez des personnes et choisissez une langue et un thème.
---

Cette page commence une fois que Kept fonctionne et que vous pouvez ouvrir son adresse. Son installation est présentée dans
[Installer avec Docker Compose](/fr/install/compose/).

## 1. Réclamer le serveur avec le code de configuration

La première fois que Kept démarre sans administrateur, il affiche un code de configuration à usage unique dans ses journaux, sous la forme
`KEPT SETUP CODE: K7Q-2M9`. Ouvrir l’adresse de Kept vous emmène sur **Configurer cette instance de Kept**, en trois étapes :

1. **Code de configuration.** Saisissez les six caractères. Le tiret est facultatif et la casse n’a pas d’importance. Le code
   cesse de fonctionner après utilisation. Journaux perdus ? `kept admin setup-code` en délivre un nouveau
   ([comment faire, sous Compose](/fr/install/compose/#3-terminer-la-configuration)).
2. **Premier compte.** Votre nom, votre e-mail et un mot de passe d’au moins 8 caractères. Ce compte est l’
   **administrateur de l’instance** : il gère le serveur (utilisateurs, inscription, sauvegardes). Il ne peut pas voir à l’intérieur du foyer de qui que ce soit,
   sauf s’il y est invité.
3. **Options de l’instance.** Un seul interrupteur : **Permettre à toute personne ayant l’adresse de créer un compte**. Laissez-le
   désactivé pour un foyer : les personnes rejoignent via une invitation, ou vous les ajoutez. Vous pouvez le modifier plus tard dans
   Paramètres → Administration.

**Terminer la configuration** vous amène à l’accueil.

:::caution[Terminez-le immédiatement]
Tant que la configuration n’est pas terminée, toute personne pouvant ouvrir l’adresse pourrait essayer de réclamer le serveur.
:::

L’IA et la recherche par code-barres ne font pas partie de la configuration. Kept fonctionne sans elles, et vous pouvez connecter l’IA plus tard
([Fournisseurs d’IA](/fr/users/ai-providers/)).

## 2. Lire la liste Premiers pas de l’accueil

L’accueil s’ouvre avec **Premiers pas**, une ligne avec votre progression et l’étape suivante, déduite de ce que vous avez réellement fait, de sorte que les étapes se cochent d’elles-mêmes. La flèche ouvre les étapes :

| Étape | Ce qu’elle demande |
|---|---|
| **Passer Kept en HTTPS** | Affiché à l’administrateur de l’instance tant que Kept est servi en HTTP simple. Les téléphones bloquent l’appareil photo, l’installation de Kept, les notifications push et la localisation en HTTP. Voir [HTTPS](/fr/install/https/). |
| **Créez votre premier foyer** | Un lieu, ci-dessous. |
| **Ajouter 3 objets** | Quelques objets dont vous détesteriez perdre la trace. |
| **Imprimez votre première étiquette** | Quand les Étiquettes sont activées dans un lieu. |
| **Inviter quelqu’un** | Un lien ou un code QR ; personne n’a besoin d’e-mail. |
| **Connecter un fournisseur d’IA** | Non affiché aux membres invités, ni dans un lieu sur le préréglage Essentiel. |
| **Installer sur votre téléphone** | Se coche lui-même la première fois que vous ouvrez Kept depuis son icône sur l’écran d’accueil. |

**×** le masque définitivement ; **Aide → Liste Premiers pas → La réafficher** le montre de nouveau. Il disparaît de lui-même quand toutes les étapes sont terminées. Plus d’informations sur l’accueil dans [usage au quotidien](/fr/users/everyday-use/#accueil).

## 3. Créez votre premier foyer

Tout le monde a un lieu **Personnel** dès le départ : il est à vous seul (pas de membres, d’invitations ni de
liens de partage) et c’est là qu’atterrit une capture sans lieu. Renommez-le dans **Paramètres du lieu →
Général**, et Kept affiche le nouveau nom partout. Une fois que vous avez un autre lieu, vous pouvez le [masquer
](/fr/users/locations/#masquer-personnel) dans **Paramètres → Moi → Vos lieux**. Les objets partagés appartiennent à
un lieu qui leur est propre. Choisissez **Créez votre premier foyer** (ou **Nouveau lieu** sur l’accueil) :

1. **Comment s’appelle ce lieu ?** Un nom, comme Maison ou Garage, et son type : maison, appartement,
   garage, box de stockage, bureau, résidence secondaire ou autre.
2. **Pièces.** Le modèle du type préremplit des pièces et des emplacements ; renommez-les, supprimez-les ou ajoutez-en avec **Ajouter une pièce ou un endroit**.
   Tout lieu comporte aussi **Sans emplacement**, pour les objets qui n’ont pas encore de place. **Passer** ne conserve que
   Sans emplacement.
3. **Ce que vous suivez.** Trois préréglages :
   - **Essentiel** : trouver des objets : pièces, boîtes, étiquettes et recherche.
   - **Foyer** : ajoute les reçus et garanties, les rappels, le prêt, le dossier et les véhicules.
   - **Terminer** : ajoute le carburant, les objets qui s’épuisent, les mots de passe et codes, le déménagement et
     "Connecter ChatGPT ou Claude".

Le fuseau horaire et la devise viennent de votre navigateur. Modifiez-les, et activez ou désactivez des modules individuels,
dans les **Paramètres du lieu** du lieu (**Général** et **Ce que vous suivez**). Désactiver un module le masque ; rien n’est supprimé.

## 4. Ajoutez votre premier objet

Le moyen le plus rapide est **Capture**, l’onglet du milieu sur un téléphone : pointez l’appareil photo, appuyez sur le déclencheur et
l’objet est enregistré là où la puce de lieu en haut l’indique. Un nom est facultatif pendant la capture :
avec un fournisseur d’IA connecté, Kept le nomme à partir de la photo ; sans, les objets sans nom attendent dans
la **Réception** pour recevoir un nom. Sur un ordinateur, **Ajouter ici** sur une pièce ou une boîte ajoute un objet avec un formulaire.
[Usage au quotidien](/fr/users/everyday-use/) présente la capture, les étiquettes et le reste.

## 5. Inviter des personnes

Le partage se fait par lieu : quelqu’un que vous invitez à Home voit Home, et rien d’autre chez vous.
Après avoir créé un lieu, l’accueil affiche une carte **Inviter des personnes à …** ; la même page se trouve sous
**Paramètres du lieu → Membres → Inviter**.

1. Choisissez le **Rôle** et, sous **Accès**, **Pas de date de fin** ou **Jusqu’à une date**. Leur accès, et
   tous les jetons qu’ils créent, s’arrêtent à cette date.
2. **Créer un lien d’invitation.** Vous obtenez le lien avec **Copier le lien** et un code QR à **scanner avec leur téléphone**. Le lien fonctionne une fois, pendant 7 jours, et apparaît sous Membres comme invitation en attente jusqu’à son utilisation, où vous pouvez le révoquer.
3. **Envoyer par e-mail** ne fonctionne que quand le serveur a l’e-mail configuré (`KEPT_SMTP_URL`).

### Les rôles

| Rôle | Ce qu’ils peuvent faire dans ce lieu |
|---|---|
| **Propriétaire** | Tout, y compris les règles à deux facteurs, le transfert et la suppression. Il n’y a qu’un propriétaire. |
| **Administration** | Inviter et retirer des membres et des lecteurs, les paramètres et les modules, l’import et l’export, les liens de partage et les packs de réclamation, supprimer définitivement. Seul le propriétaire accorde ou retire les administrateurs. |
| **Membre** | Ajouter, modifier, déplacer, prêter et mettre au rebut des objets ; enregistrer des relevés et des services ; imprimer des étiquettes ; utiliser la capture IA. L’argent est visible. |
| **Lecteur** | Consulter et rechercher uniquement. L’argent est masqué, sauf si le lieu autorise les lecteurs à le voir ; l’assistant répond mais ne peut rien modifier. |

La matrice complète est `MATRIX` dans
[`packages/shared/src/roles.ts`](https://github.com/keptinventory/kept/blob/main/packages/shared/src/roles.ts).

### Personnes sans e-mail

Pour un enfant ou un parent sans e-mail, un propriétaire ou un administrateur utilise **Ajouter quelqu’un sans e-mail** sur la
page Membres. Kept crée un **compte géré** avec un nom d’utilisateur et affiche un code à usage unique (il fonctionne
une fois, pendant 30 minutes). La personne se connecte avec **J’ai un code à usage unique**, son nom d’utilisateur et le
code, et choisit son propre mot de passe ; vous ne le voyez jamais. Celui ou celle qui a créé le compte (tant qu’il ou elle est encore
propriétaire ou administrateur là), ou le propriétaire de ce lieu, peut délivrer un nouveau code plus tard, ce qui déconnecte le
compte partout. La personne peut ajouter un e-mail pour prendre le compte en charge. Un compte géré ne peut pas posséder un lieu, et un lieu
contient au plus 20 comptes gérés.

## 6. Langue et thème

**Paramètres → Moi → Affichage** contient les choix d’affichage de l’appareil, appliqués avant le tracé de la page :

- **Langue** : English, العربية, Français, Deutsch, Italiano, Tiếng Việt, Українська ou Español.
  Ouvrez la liste, ou saisissez pour en trouver une : son nom, son nom en anglais ou dans la langue que vous
  utilisez, et les petites fautes de frappe passent (`german`, `deutsch` et `francais` fonctionnent tous). L’arabe présente toute l’application de droite
  à gauche. Les pages de connexion ont le même sélecteur.
- **Chiffres arabes orientaux** : Occidentaux (0123) ou Orientaux (٠١٢٣), affichés uniquement quand la langue est l’arabe.
  Les identifiants courts et les numéros de série restent toujours en chiffres occidentaux.
- **Région** : **États-Unis** (Oct 29) ou **Royaume-Uni** (29 Oct, 29/10/2026), affichée uniquement
  quand la langue est l’anglais.
- **Format de date** : **Par défaut** (29 Oct, avec l’année seulement pour les autres années), 29 Oct 2026,
  29/10/2026 ou 2026-10-29 (comme l’écrit le Royaume-Uni). Chaque choix affiche la date du jour
  écrite ainsi, dans votre région. Les dates d’achat et de
  garantie affichent toujours l’année.
- **Thème** : **Système** (suit le réglage clair ou sombre de l’appareil), **Clair** ou **Sombre**.
- **Largeur du contenu** : **Centré** ou **Pleine largeur**, sur les écrans de 768 px et plus larges.

## 7. Faire la visite

**Aide → La visite** vous guide dans Kept sur les vrais écrans, en courts chapitres de trois à six
pas chacun :

| Chapitre | Ce qu’il montre |
|---|---|
| Basics | Accueil, vos lieux, Scanner, Rechercher, et où se trouve tout le reste. |
| Things & places | ajouter à un lieu, ce qu’il contient, et la page d’un objet et ses onglets. |
| Graph & 3D map | le commutateur Liste · Grille · Graphe · Tableau · Carte (Tableau sur un ordinateur), le graphe en 2D ou 3D, en 3D ou en plan, les épingles, les étages et Ranger, où une pièce se déplace avec ce qu’elle contient. |
| Capture & Inbox | choisir ce que vous capturez, le déclencheur, et relire ce que Kept a lu. |
| Scanning | une session de scan : compter, emballer ou déplacer, où, et ce que Terminer change. |
| Search & labels | le champ de recherche, les vues enregistrées, Sélectionner (déplacer, imprimer des étiquettes, Mettre à la corbeille), l’impression d’étiquettes et Scanner, qui peut poser une étiquette vierge sur un lieu que vous avez. |
| Moving | démarrer un déménagement, ses boîtes, et où elles sont. |
| Lending | ce qui est prêté, Marquer comme rendu, et Prêter sur un objet. |
| Schedules & reminders | un nouveau planning, ce qui est dû, Terminer, et comment les rappels vous parviennent. |
| Paperwork & warranties | la bibliothèque de documents, ce qui expire, ajouter un fichier, les réclamations. |
| Vehicles & fuel | la liste des véhicules, enregistrer un relevé ou un service, les services que vous pouvez ouvrir, et le carburant. |
| Import & export | d’où vient un import, le fichier et l’export. |
| Settings & sharing | les notifications, vos lieux, inviter des personnes, ce que vous suivez. |

- En haut : combien de chapitres sont terminés, avec une barre fine, et **Faire la visite**. Une fois qu’un part est
  terminé, cela indique **Reprendre la visite** et reprend au premier chapitre que vous n’avez pas terminé.
- En dessous, une courte ligne par chapitre : son numéro et ses pas. Appuyez sur une ligne pour démarrer la visite à
  ce chapitre. Les chapitres terminés se replient sous **Terminé (N)** ; ouvrez-le pour en rejouer un.
- La visite démarre depuis Aide. La barre du haut d’une page garde les outils propres à cette page ; le **Démarrer une session** d’une session de scan
  comporte un petit **Montre-moi** pour son chapitre.
- La bulle indique où vous êtes : "Chapitre 3 sur 12 · étape 2 sur 5".
- **Suivant** passe à la suite, **Retour** revient en arrière dans le chapitre, les flèches font les deux, et **Échap**
  ou **×** le ferme.
- La dernière étape d’un chapitre nomme le suivant : **Continuer** y va directement, **Arrêter ici**
  termine la visite là. Le dernier chapitre se termine par **Terminé**.
- La page continue de fonctionner pendant la visite : appuyez sur ce qui est hors du surlignage. Aller quelque part
  où la visite ne s’est pas ouverte la ferme.
- Un chapitre terminé indique **Terminé** sur Aide, sur chaque appareil. Un chapitre que vous fermez à mi-chemin recommence
  à sa première étape la fois suivante.
- Un chapitre qui a besoin de quelque chose à montrer et ne trouve rien crée un exemple clairement nommé, comme
  "Exemple : perceuse sans fil". Quand la visite se termine, vous choisissez de le garder ou de l’abandonner ; cela ne touche jamais
  à ce que vous avez déjà.
- La visite ne démarre jamais d’elle-même.

Quelques indications à usage unique apparaissent aussi la première fois que vous utilisez Capture, Scanner, les valeurs suggérées de la Réception
ou les Étiquettes.

Après la mise à jour de Kept, **Nouveautés de Kept** affiche les points forts de cette version, une fois par version
pour chaque personne, sur chaque appareil : un par diapositive, avec une image ou un court clip, son titre et une
ligne. **Suivant** et **Retour**, les points, les flèches ou un balayage passent de l’un à l’autre ; le **Compris** de la dernière
diapositive le range, et **Aide → Nouveautés** le réaffiche. Les clips sont lus en sourdine et
peuvent être mis en pause ; avec la réduction des mouvements activée, ils restent immobiles jusqu’à ce que vous appuyiez sur **Lire**. Hors ligne, une
diapositive montre l’icône de sa section à la place de son image. Il ne s’affiche jamais sur un nouveau compte, ni par-dessus
Capture ou Scanner. Les points forts sont en anglais dans toutes les langues, avec un lien vers les notes de version complètes
sur GitHub.

:::tip[Gardez les clés]
Avant la première clé d’IA, valeur secrète ou sauvegarde, Kept attend que l’administrateur de l’instance ait enregistré le
[trousseau de récupération](/fr/admin/recovery-kit/) (Administration → État le demande). Sans le trousseau, une sauvegarde ne peut pas
ramener les clés d’IA ni les mots de passe enregistrés sur un nouveau serveur.
:::
