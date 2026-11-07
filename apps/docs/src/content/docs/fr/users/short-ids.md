---
title: Identifiants courts et étiquettes
description: Identifiants de six caractères, impression d’étiquettes sur feuilles, rouleaux et ruban d’étiqueteuse, ce que le scanner fait de chaque code lu, lire un code sans QR code, et quel code Kept conserve où.
---

Quand un nouvel objet parvient au serveur, il reçoit un identifiant court : six lettres et chiffres, comme `7KQ-4MZ`,
jamais réutilisé. Jusqu’à là, il affiche **ID en attente**. Une étiquette porte l’identifiant en texte et, sur tous les
supports sauf le ruban étroit d’étiqueteuse, dans un QR code qui ouvre l’objet. Une étiquette garde son code pour
toujours, donc un exemplaire perdu se réimprime avec le même.

Les listes, les résultats de recherche et la palette ⌘K affichent un objet par son nom. Son code s’y affiche comme du ruban
d’étiquette ambré seulement lorsqu’il a une étiquette imprimée : une étiquette confirmée avec **Bien imprimé ?**, ou une
étiquette vierge qui lui est attribuée. La feuille de contenu d’une boîte de déménagement compte aussi, une fois confirmée
de la même façon ([Déménagement](/fr/users/moving/)). L’ambré signifie « celui-ci est étiqueté ». Sur sa propre page, un objet
ou un emplacement sans étiquette imprimée affiche son code petit et gris, après le reste ; s’il a une étiquette, il affiche le
ruban. Un objet avec plusieurs étiquettes (une étiquette vierge qui lui a été attribuée, par exemple) affiche le code de la
dernière imprimée. La recherche et le scanner trouvent un objet avec n’importe lequel de ses codes.

## Impression

**Impression** (**Étiquettes** dans le menu, ou **Étiquette** sur un objet) : choisissez ce qu’il faut imprimer (une
sélection, **Étiqueter tout ce qui n'a pas d'étiquette imprimée** dans un lieu ou un emplacement, ou une feuille vierge),
choisissez le **support d’étiquettes**, choisissez où commencer sur une feuille partiellement utilisée, et imprimez depuis
le navigateur. **L’aperçu de la feuille** est l’impression elle-même, en plus petit : les mêmes
QR codes, noms et emplacements, répartis sur les mêmes lignes. Un nom n’est jamais raccourci : un long nom passe à la ligne et sa
taille d’écriture diminue, et s’il ne tient toujours pas, il est listé avant l’impression, avec un lien pour le renommer.
La page est réglée sur le papier de la feuille sans marges, donc les réglages par défaut de la boîte de dialogue d’impression
(échelle 100 %) placent chaque étiquette dans sa cellule.

Les supports d’étiquettes :

| Support | Taille | Chaque étiquette |
|---|---|---|
| Feuille A4, 24 étiquettes | 70 × 37 mm, 3 × 8 | QR code, identifiant court, nom et emplacement |
| Feuille A4, 65 étiquettes | 38 × 21 mm, 5 × 13 | QR code et identifiant court |
| Feuille Letter, 30 étiquettes (modèle Avery 5160) | 67 × 25 mm, 3 × 10 | QR code, identifiant court, nom et emplacement |
| Rouleaux pour imprimante d’étiquettes | 50 × 30, 40 × 30 et 62 × 29 mm | QR code, identifiant court, nom et emplacement |
| Ruban d’étiqueteuse, 9 et 12 mm (Brother TZe et équivalents) | 40 et 50 mm de long | Identifiant court en gros, et le nom. Pas de QR code |
| Ruban d’étiqueteuse, 18 et 24 mm | 50 et 60 mm de long | QR code, identifiant court en gros, et le nom |

Les rouleaux et le ruban impriment une étiquette par page, à la taille de l’étiquette : dans la boîte de dialogue
d’impression, choisissez votre imprimante d’étiquettes et cette taille. Pour une application d’étiqueteuse qui prend des
images, **Partager en images** fait un PNG par étiquette. Le ruban étroit n’a pas la place pour un QR code lisible, donc il
porte l’identifiant court en gros à la place : le scanner le lit dans le texte ([Lire un code sans QR
code](#scanner-un-code-sans-qr-code)).

Ensuite, **Bien imprimé ?** demande des nouvelles du lot que vous venez d’imprimer et l’enregistre ; à partir de là, ces
objets et emplacements affichent le ruban ambré. **Lots récents** montre ce que contient chacun, quand et où il a été fait et s’il
a été imprimé ; un lot non confirmé peut y être marqué **Bien imprimée** ou **Pas imprimée**, et se réimprime avec les mêmes
codes. Réimprimer les mêmes objets pendant que leur feuille n’est pas confirmée propose cette feuille au lieu d’une nouvelle.
Les objets dont l’identifiant est encore en attente ne peuvent pas encore être imprimés.

## Scanner

**Scanner** depuis Accueil et Recherche ouvre la caméra.

| Vous scannez | Kept |
|---|---|
| Une étiquette Kept pour un objet que vous voyez | L’ouvre et le marque vu à l’instant |
| Un code Kept imprimé sans QR code (ruban étroit) | L’ouvre, lu dans le texte, ou demande **Est-ce bien le code ?** d’abord quand la lecture n’est pas nette ([ci-dessous](#scanner-un-code-sans-qr-code)) |
| Une étiquette vierge | Propose **Nouvelle boîte ici**, **L’attacher à un objet existant** ou **L’attacher à un lieu existant** (une pièce, une étagère ou un endroit) |
| Un code-barres de produit | Propose de l’ajouter comme nouvel objet ; avec la recherche de codes-barres activée par l’administrateur, il est nommé à partir d’Open Food Facts, Open Products Facts ou Open Beauty Facts |
| Un numéro de série ou un marqueur d’actif qu’un objet a | Ouvre cet objet |
| Un code-barres qu’un objet a | Ouvre cet objet ; s’il y en a plusieurs, demande lequel |
| Un code que rien n’a encore | Nomme son type et propose de l’ajouter comme nouvel objet, en gardant le code comme code-barres ou comme numéro de série |
| Une étiquette Homebox, après un [import Homebox](/fr/users/import-export/) | Ouvre l’objet importé |
| Tout le reste | Dit que ce n’est pas une étiquette Kept |

Une étiquette attribuée à un emplacement s’y affiche comme du ruban ambré, comme une imprimée pour lui. L’attribution fonctionne
hors connexion : elle attend sur le téléphone jusqu’à la synchronisation, et si un autre téléphone a attribué la même
étiquette en premier, on vous dit ce qui l’a. Les membres, administrateurs et propriétaires peuvent attribuer ; les lecteurs
ne le peuvent pas.

Pour étiqueter un emplacement sur lequel vous avez déjà collé une étiquette vierge, ouvrez l’emplacement et choisissez **Ajouter un code
d’étiquette** (sous Gérer) : le scanner s’ouvre, et l’étiquette vierge que vous scannez propose d’abord cet emplacement.

Une étiquette reste avec ce sur quoi elle est collée. Quand les [compartiments sont fusionnés](/fr/users/locations/#fusionner-et-diviser-les-compartiments), les étiquettes de ceux qui disparaissent dans la fusion ouvrent le compartiment fusionné ; une division redonne son étiquette à chacun. Quand un meuble est [tourné](/fr/users/locations/#retourner-le-mobilier), chaque compartiment garde son étiquette, qu’il soit renuméroté ou non.

Les codes que Kept lit, et où un nouvel objet les conserve :

| Code | En général sur | Kept le conserve comme |
|---|---|---|
| QR code | Étiquettes Kept, étiquettes Homebox | L’étiquette |
| EAN-13, EAN-8, UPC-A, UPC-E | Produits | Code-barres |
| Code 128, Codabar | Étiquettes de magasin, d’actifs et de bibliothèque | Code-barres |
| ITF-14 | Cartons | Code-barres, quand son chiffre de contrôle est correct ; sinon vous choisissez |
| Code 39, Code 93 | Marqueurs d’actifs, autocollants informatiques | Numéro de série, ou code-barres si vous le choisissez |
| Data Matrix | Électronique, chargeurs, pièces | Un code GS1 : son GTIN comme code-barres et son numéro de série comme numéro de série. Texte brut : vous choisissez |
| PDF417, Aztec | Étiquettes d’expédition, cartes de garantie, billets | Vous choisissez ; le texte trop long pour l’un ou l’autre champ (64 caractères pour un code-barres, 100 pour un numéro de série) n’est pas conservé |

Une étiquette Kept l’emporte dans tous ces cas. Un numéro de série correspond exactement à ce qui a été stocké, et seulement en
ligne : la copie hors connexion du téléphone ne contient aucun numéro de série. Les codes GS1 saisis avec des parenthèses, comme
`(01)04006381333931(21)K7Q2X9`, sont lus de la même façon.

Une étiquette usée, ou pas de caméra : **Saisir le code**. La caméra Capture reconnaît aussi les étiquettes Kept, et propose
d’ouvrir cette boîte ou d’y capturer.

### Scanner un code sans QR code

Une étiquette sans QR code (ruban étroit) se scanne par son identifiant court imprimé. Pointez **Scanner** vers le code, pour
qu’il remplisse environ un tiers de la largeur de la caméra, et restez immobile un moment : Kept lit les six caractères dans
le texte et ouvre l’objet, comme il le ferait à partir d’un QR code, et un message indique quel code il a lu.

- **Sur le téléphone, même hors connexion.** La lecture se fait sur le téléphone ; la photo n’est envoyée nulle part. Cela fonctionne sans connexion pour tout ce qui est dans la copie du téléphone.
- **Jamais le mauvais objet.** Kept n’ouvre un code que lorsqu’il a lu chaque caractère clairement, deux fois de suite, et que le code est l’un des vôtres. Quand il n’est pas sûr, il montre le code lu et ce qu’il ouvre, et demande **Est-ce bien le code ?** avant de l’ouvrir. Un code qui ne correspond à aucune de vos étiquettes n’ouvre rien : **Scanner à nouveau**, ou **Saisir le code**.
- **Seulement l’impression de Kept.** Il lit l’identifiant court tel que Kept l’imprime, avec son propre caractère. Un code saisi à la main dans une étiqueteuse, avec le caractère de l’étiqueteuse, peut ne pas se lire : saisissez-le plutôt.

Seul **Scanner** lit les codes imprimés. Les sessions de scan, la vérification des boîtes et la caméra Capture ne lisent que les QR codes et les codes-barres.

## Liens connexes

- [Sessions de scan](/fr/users/scanning-sessions/) pour scanner une boîte entière d’un coup.
- [Tags](/fr/users/tags/) pour dire ce qu’est d’autre un objet.
- [Utilisation quotidienne](/fr/users/everyday-use/) pour la vue d’ensemble.
