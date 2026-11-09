---
title: Sessions de scan
description: Comptez une pièce, remplissez des boîtes ou déplacez des objets en passant devant leurs étiquettes avec l'appareil photo ouvert. Chaque étiquette visible est lue, chacune une fois, en ligne comme hors ligne, et rien ne change tant que vous n'avez pas terminé.
---

Une **session de scan** garde l'appareil photo ouvert pendant que vous marchez. Chaque étiquette Kept visible est lue,
plusieurs à la fois, et comptée une fois. Utilisez-la pour :

- **Compter** une pièce, une étagère, une boîte ou un lieu entier : ce que vous scannez est marqué comme vu, et le
  résumé indique ce qui manque et ce qui s'est retrouvé ailleurs.
- **Remplir** des boîtes : tout ce que vous scannez va dans la boîte actuelle. Scannez la boîte suivante pour changer.
- **Déplacer vers** un emplacement ou une boîte : tout ce que vous scannez y est déplacé.

Une session prend en charge jusqu'à 5 000 étiquettes et fonctionne sans signal une fois que le téléphone a ouvert une session
en ligne : l'écran est récupéré la première fois qu'il est utilisé, puis conservé sur le téléphone.

Une session lit les codes QR et les codes-barres. Une étiquette sans code QR (ruban étroit pour étiqueteuse) s'ouvre
depuis **Scanner** une à la fois, par son court ID imprimé ([Scanner un code sans QR code](/fr/users/short-ids/#scanner-un-code-sans-qr-code)).

## Démarrer une session

- **Scanner → Démarrer une session**, puis choisissez quoi faire et où.
- Depuis la page d'un emplacement : **Compter ici**.
- Depuis le menu d'une boîte : **Compter cette boîte** ou **Remplir cette boîte**.
- Depuis la page d'un déplacement : **Remplir les boîtes**.
- Depuis la carte d'une pièce sur la carte : **Compter cette pièce**.

Là où ce n'est pas encore choisi, choisissez-le dans la liste ou touchez **Scanner son étiquette**.

Pour le comptage d'un emplacement, **Inclure les emplacements qu'il contient** est activé par défaut. Activez **Une boîte que vous
scannez compte ce qu'elle contient** quand vous comptez des boîtes sans les ouvrir.

## Pendant que vous scannez

| Vous scannez | Compter | Remplir, Déplacer vers |
|---|---|---|
| Un objet de la liste | Trouvé, vert, le compteur monte | Ajouté, vert |
| La même étiquette à nouveau | Un léger bip, pas de comptage | Idem |
| Un objet d'un autre emplacement ici | Ambre : **Trouvés ailleurs**, avec l'endroit où il devrait être | Ajouté |
| Un objet d'un autre lieu | Ambre, avec le lieu | Ajouté si vous pouvez modifier les deux |
| Un objet dans un lieu que vous ne faites que consulter | Gris : **Lecture seule ici** | Gris, non ajouté |
| L'étiquette d'un emplacement | Kept suggère de le compter depuis sa propre page | Refusé : une pièce ne peut pas être déplacée |
| Une étiquette vierge, ou un code sur plusieurs objets | Kept pour le résumé | Idem |
| Un code-barres produit | Apparié à l'objet qui le porte | Idem |
| Un numéro de série ou une étiquette d'inventaire (Data Matrix, Code 39…) | Apparié à l'objet qui le possède, en ligne | Idem |
| Un code que ce téléphone ne connaît pas, hors ligne | **À vérifier plus tard** | Idem |

Le compteur affiche "312 sur 340" pour un comptage. Chaque lecture joue une courte tonalité et dessine un cadre sur
l'étiquette : vert pour une nouvelle trouvaille, ambre pour ailleurs, gris pour tout le reste.

- **Annuler la dernière lecture** revient en arrière sur la dernière.
- **Pause** arrête l'appareil photo. Une minute sans lecture le met aussi en pause.
- **Destination** (Remplir, Déplacer vers) : touchez-le, puis scannez la boîte ou l'emplacement suivant.
- Les **scanners de codes-barres USB ou Bluetooth** fonctionnent sur le même écran : ce qu'ils saisissent est lu comme une
  étiquette.
- **Lampe** apparaît sur les téléphones qui en ont une (Android).

Fermez l'application, rechargez ou perdez la batterie : la session reste sur le téléphone. **Scanner → Reprendre la session**
la récupère.

## Terminer et enregistrer

**Terminer** affiche le résumé. Rien n'a encore changé.

- **Trouvé** : marqué comme vu, au moment où chaque étiquette a été lue.
- **Manquants** : laissés tranquilles par défaut. Choisissez **Marquer pas ici** pour chacun, ou **Tout marquer pas ici**.
- **Sans étiquette** : les objets de la liste sans étiquette. Cochez ceux que vous avez vus.
- **Trouvés ailleurs** et **Dans un autre lieu** : laissés tranquilles, ou **Déplacer ici**.
- **Non appariés** : étiquettes vierges et codes qui correspondent à plusieurs objets. Chaque étiquette vierge a
  **Attribuer** : une nouvelle boîte, un objet existant ou un emplacement existant. Collez les vierges sur les étagères et les portes,
  scannez-les toutes en une seule marche, puis attribuez-les ici.

Un comptage liste aussi ce qui est prêté ou en réparation (jamais manquant), et ce qui est dans un emplacement à l'intérieur qu'aucun
n'a compté (**Non comptés**, jusqu'à ce que vous touchiez **J'ai vérifié**). Un objet compté en nombre a **−** et **+** sur
sa ligne. Chaque résultat est conservé : voir [Comptages et inventaires](/fr/users/counts/).

**Enregistrer** envoie la session. Hors ligne, elle attend sur le téléphone et s'enregistre une fois que vous êtes de retour en
ligne. La session est une entrée dans **Activité**, "Garage compté : 312 sur 340", avec **Annuler** pendant 7 jours. Annuler
remet en place chaque date de vue, chaque "pas ici" et chaque déplacement, sauf si quelque chose a changé depuis.

Un objet jeté à la corbeille pendant votre marche est exclu de l'enregistrement, et le résumé après enregistrement indique
combien il y en a eu.

## Qui peut faire quoi

| | Propriétaire, admin, membre | Lecteur |
|---|---|---|
| Compter | Enregistré | Une vérification : le même écran et les mêmes totaux, rien d'enregistré |
| Remplir, Déplacer vers | Là où vous pouvez modifier à la fois l'objet et sa destination | Non proposé |

Si votre rôle change pendant que vous marchez et que vous ne pouvez plus modifier là-bas, l'enregistrement est refusé et la
session reste sur le téléphone avec son résumé.

## Limites sur iPhone

- Pas de vibration : les applications web ne peuvent pas vibrer sur iPhone. La tonalité et le cadre coloré accompagnent chaque
  lecture.
- L'écran peut encore s'assombrir dans l'application installée : gardez-le éveillé dans **Réglages → Luminosité et affichage →
  Verrouillage automatique** pendant que vous faites un grand comptage.
- La lecture peut être plus lente sur les vieux iPhone. Tenez le téléphone un peu plus loin des étiquettes serrées pour que
  plusieurs tiennent dans le champ.
- Pas de commande de lampe depuis le web.
