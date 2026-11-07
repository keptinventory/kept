---
title: Kept sur votre téléphone
description: Installer Kept sur l’écran d’accueil, ce qui fonctionne sans connexion, à quoi ressemblent la synchronisation et les conflits, l’appareil photo, le verrouillage de l’app et les notifications.
---

Kept n’a pas d’application dans les boutiques d’applis. C’est une application web que vous installez depuis le navigateur (une PWA) : elle s’ouvre depuis sa propre icône, en plein écran, conserve une copie de votre inventaire sur le téléphone et fonctionne hors ligne. Tout ce qui est sur cette page nécessite Kept en **HTTPS** : en HTTP simple, les téléphones bloquent l’appareil photo, l’installation, les notifications push et la localisation ([HTTPS](/fr/install/https/)).

## L’installer

**Installer sur votre téléphone** sur la liste de contrôle de l’accueil, et **Aide → Installer sur votre téléphone**, affichent les étapes pour votre appareil :

| Appareil | Étapes |
|---|---|
| iPhone, iPad | Dans Safari, appuyez sur **Partager**, puis sur **Ajouter à l’écran d’accueil**, puis sur **Ajouter**. Ouvrez Kept depuis sa nouvelle icône. |
| Android | Ouvrez le menu du navigateur (les trois points), appuyez sur **Installer l’application** ou **Ajouter à l’écran d’accueil**, puis ouvrez Kept depuis sa nouvelle icône. |
| Ordinateur | Dans Chrome ou Edge, l’icône d’installation à la fin de la barre d’adresse, ou **Installer Kept** dans le menu. Dans Safari sur un Mac, **Fichier › Ajouter au Dock**. |

L’étape de la liste se coche la première fois que vous ouvrez Kept depuis son icône. Quand une nouvelle version est prête, Kept affiche **Une nouvelle version est prête** avec **Recharger** ; il ne se recharge jamais tout seul pendant qu’un envoi est en cours ou qu’une capture est ouverte.

## Ce qui fonctionne hors ligne

Le téléphone conserve une copie de chaque lieu auquel vous appartenez, rafraîchie à chaque synchronisation. Les réponses hors ligne indiquent **d’après la dernière synchronisation** et l’heure.

| Fonctionne hors ligne | Nécessite une connexion |
|---|---|
| Parcourir les lieux, les pièces, les boîtes et les objets | Modifier les détails d’un objet, les paramètres, l’administration |
| Recherche, intitulée **Sur ce téléphone** | L’assistant et le nommage par IA |
| Capturer, déplacer, marquer comme vu, absent | Imports, exports et rapports |
| Enregistrer un relevé, ajouter une pièce ou un endroit | Enregistrer un service (il implique de l’argent) |
| Vérification de boîte, pour une boîte ouverte au moins une fois en ligne | Tout ce qui touche à l’argent ou à des valeurs secrètes |
| Scanner une étiquette, réclamer une étiquette vierge | |

La copie ne contient jamais de valeurs secrètes ni les coordonnées des personnes. L’argent et les documents restent hors du téléphone, sauf si vous gardez un lieu disponible hors ligne derrière le verrouillage de l’app (ci-dessous). La déconnexion supprime la copie de cette personne du téléphone.

## La synchronisation, comme vous la voyez

Ce que vous faites hors ligne entre dans une file d’attente et est envoyé quand le téléphone est de nouveau en ligne. Une ligne sous l’en-tête n’apparaît que s’il y a quelque chose à dire :

- **Hors ligne · 12 en attente de synchronisation**, ou **Hors ligne · d’après la dernière synchronisation, 14:02**.
- Les nouveaux objets affichent **ID en attente** jusqu’à ce que le serveur leur attribue leur identifiant court ; leurs étiquettes peuvent être imprimées une fois celui-ci reçu (Étiquettes propose **Imprimer les étiquettes en attente**).
- **Sur iPhone, la file n’avance que si Kept est ouvert** : la ligne indique **Ouvrir pour terminer la synchronisation (12)**. Laissez Kept ouvert à l’écran un instant quand vous êtes de nouveau en ligne.
- **Mettez à jour Kept pour terminer la synchronisation** signifie que le serveur est plus récent que l’application : rechargez. La file est conservée.
- **Ce navigateur peut effacer la copie hors ligne de Kept après des semaines sans utilisation** : le téléphone a refusé le stockage permanent à Kept. Ouvrez Kept de temps en temps pour qu’il synchronise.

**Quand un changement ne peut pas s’appliquer.** Si quelqu’un d’autre a supprimé, déplacé ou retiré un objet pendant que vous étiez hors ligne, votre changement est abandonné et la ligne l’indique, par exemple "Un changement n’a pas pu s’appliquer : la perceuse a été supprimée par Alfred", avec **Restaurer** pour réessayer. Les autres changements qui nécessitent une décision vont dans **Réception** ("2 changements à examiner").

**Quand vous modifiez tous les deux la même chose en ligne**, Kept fusionne les champs que seul l’un de vous a modifiés et vous demande pour le reste : **Garder ma version**, **Garder leur version** ou **Modifier**.

**Se déconnecter avec des captures non envoyées** vous avertit d’abord : la déconnexion supprime les captures qui n’ont pas été synchronisées. Si votre session expire, le téléphone supprime sa copie de votre inventaire mais conserve vos captures non envoyées, verrouillées, jusqu’à ce que vous vous reconnectiez. Si quelqu’un d’autre se connecte sur ce téléphone, Kept indique combien de captures sont en attente d’un autre compte et ne les supprime que lorsque cette personne accepte.

## L’appareil photo, la galerie et le scan

- **Capture** garde l’appareil photo ouvert pour une photo après l’autre. **Galerie** sélectionne plusieurs photos à la fois ; chacune devient un brouillon. Si l’appareil photo est bloqué, Kept indique comment l’autoriser, et en HTTP simple Capture se rabat sur le choix de fichiers.
- Les photos iPhone en HEIC sont conservées comme originaux ; si l’une ne peut pas être prévisualisée, elle affiche **Aperçu indisponible** et n’est jamais refusée.
- **Partager vers Kept** : sur Android et Chrome sur ordinateur, l’application installée apparaît dans la feuille de partage, donc un reçu ou un PDF d’une autre application arrive dans Capture. L’iPhone ne permet pas aux applications web d’apparaître dans la feuille de partage : enregistrez le fichier, puis utilisez **Galerie** dans Capture.
- **Scanner** lit les étiquettes Kept et les codes-barres produits, même hors ligne, depuis la copie du téléphone, ainsi que les codes Data Matrix, Code 39, Code 93, ITF, Codabar, PDF417 et Aztec ; un numéro de série ou une étiquette d’inventaire ouvre son objet quand vous êtes en ligne. La liste complète :
  [Identifiants courts et étiquettes](/fr/users/everyday-use/#id-courts-et-étiquettes).
- **Suggérer où je suis**, un interrupteur dans le sélecteur d’emplacement de Capture, compare votre position avec les positions de vos lieux sur le téléphone lui-même et propose celui qui est à proximité. Votre position n’est jamais envoyée ni conservée. Un lieu a une position uniquement s’il en avait une dans un [export Kept](/fr/users/import-export/#un-export-kept) : pouvoir la définir dans l’application arrivera, et jusque-là un lieu sans position n’est jamais proposé.
- **Dicter** remplit le nom à la voix là où le navigateur le permet.

**Paramètres → Diagnostic** vérifie l’appareil photo, la prise en charge hors ligne et le stockage, et copie un rapport de ce qu’il a trouvé.

## Le verrouillage de l’app

**Paramètres → Cet appareil → Verrouillage de l’app** verrouille Kept sur ce téléphone avec un code PIN de 6 à 12 chiffres, et avec **Déverrouiller avec Face ID ou l’empreinte** là où le téléphone peut vous vérifier. Le verrou activé, Kept demande au démarrage à froid et après 5 minutes caché ou inactif, en ligne comme hors ligne.

Face ID ou l’empreinte déverrouille ici Kept sur cet appareil seulement ; ils ne vous connectent jamais. Pour vous connecter avec Face ID ou une empreinte, ajoutez une clé d’accès dans [Connexion et sécurité](/fr/users/sign-in-security/).

- Dix codes PIN faux de suite suppriment la copie de Kept de ce téléphone et vous déconnectent, en conservant vos propres captures non envoyées. **Mot de passe oublié ? Déconnectez-vous et reconnectez-vous** fait la même chose.
- Le verrou tient à l’écart quelqu’un qui tient le téléphone. Il n’arrête pas quelqu’un qui aurait copié le stockage du navigateur et tenterait des PINs ; la page des paramètres le dit.

**Garder disponible hors ligne**, sur la même page, ajoute les prix et les documents d’un lieu à la copie du téléphone, chiffrés derrière le verrou. Il faut le verrouillage de l’app activé, la taille du téléchargement est affichée d’abord, et un avertissement indique que quiconque déverrouille Kept sur le téléphone les voit. Un appareil conserve ainsi au plus 250 Mo, avec des fichiers jusqu’à 25 Mo chacun.

## Notifications

Dans **Paramètres → Moi → Notifications**, sous **Cet appareil**, **Activer** allume le push : les rappels s’affichent même quand Kept est fermé. **Tester** en envoie un pour vérifier.

- **iPhone et iPad** envoient le push uniquement à l’application installée : ajoutez Kept à l’écran d’accueil, ouvrez-le depuis là, et activez-le. D’ici là, les rappels peuvent arriver par e-mail.
- Le push nécessite HTTPS. Si le serveur ne peut pas envoyer de push, ou si le navigateur ne peut pas le recevoir, la page le dit ; l’e-mail et le centre de notifications fonctionnent toujours.
- Les heures de silence bloquent le push et l’e-mail jusqu’à leur fin. Ce que chaque lieu envoie, et comment, est traité dans [utilisation quotidienne](/fr/users/everyday-use/#rappels-et-notifications).
