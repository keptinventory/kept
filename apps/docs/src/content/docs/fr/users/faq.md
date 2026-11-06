---
title: Questions et réponses
description: Courtes réponses aux questions que les gens posent avant et après l’installation de Kept, chacune avec un lien vers la page contenant le détail.
---

## Kept envoie-t-il des informations sur moi ou mon serveur quelque part ?

Non. Il n’y a aucune télémétrie, même pas un compteur d’installations avec consentement. La vérification des mises à jour est désactivée
jusqu’à ce qu’un administrateur l’active, puis elle n’envoie que la demande de la dernière version. La recherche de codes-barres
et l’IA sont aussi désactivées jusqu’à ce que quelqu’un les connecte. Voir [observabilité](/fr/admin/observability/) et
[mises à jour](/fr/admin/upgrades/).

## Où sont stockées mes données ?

Sur votre serveur : la base de données dans Postgres, et les fichiers (photos, reçus, documents) sur le
volume de données de Kept ou dans un bucket S3 que vous choisissez. Votre téléphone conserve une copie pour une utilisation hors ligne, sans
valeurs secrètes. Voir [stockage des fichiers](/fr/admin/storage/) et [l’application téléphone](/fr/users/phone-app/).

## Comment supprimer mon compte ?

Paramètres → Moi → Supprimer mon compte, avec votre mot de passe. D’abord, remettez chaque lieu que vous possédez (autre
que Personnel) à quelqu’un d’autre, ou supprimez-le ; le seul administrateur de l’instance doit d’abord nommer un autre administrateur
. Le compte attend ensuite 30 jours : se connecter affiche la date et un moyen de le conserver, et rien
d’autre ne s’ouvre. Ensuite, il est supprimé avec votre lieu Personnel. Ce que vous avez ajouté dans les lieux d’autres personnes
y reste. [Exportez vos données](/fr/users/import-export/#exportation) d’abord si vous voulez une
copie.

## Puis-je l’utiliser sans IA ?

Oui. Tout fonctionne sauf nommer les objets à partir de photos, lire les reçus, l’assistant et la recherche
par sens. Sans fournisseur, les objets capturés attendent dans la Boîte de réception un nom, et la recherche utilise
des mots-clés. Voir [fournisseurs d’IA](/fr/users/ai-providers/).

## Quels fournisseurs d’IA fonctionnent, et qui paie ?

Groq (recommandé), OpenAI, Anthropic, Google, OpenRouter, ou tout serveur compatible OpenAI tel qu’
Ollama. Vous utilisez votre propre clé ; le travail dans un lieu est payé par la clé du propriétaire de ce lieu, et vous
pouvez plafonner la dépense. Voir [fournisseurs d’IA](/fr/users/ai-providers/).

## Fonctionne-t-il hors ligne ?

Sur un téléphone avec Kept installé, oui pour trouver et capturer : navigation, recherche, capture, déplacement
des objets, relevés, contrôles de boîtes et scan des étiquettes. Les modifications de détails, les rapports, les importations et exportations
nécessitent une connexion. Ce que vous faites hors ligne se synchronise lorsque vous revenez. Voir
[Kept sur votre téléphone](/fr/users/phone-app/#ce-qui-fonctionne-hors-ligne).

## Y a-t-il une application dans l’App Store ou Google Play ?

Non. Kept est une application web que vous ajoutez à l’écran d’accueil depuis le navigateur. Il faut que Kept soit en HTTPS.
Voir [Kept sur votre téléphone](/fr/users/phone-app/#linstaller) et [HTTPS](/fr/install/https/).

## Fonctionne-t-il sur arm64, ou sur un Raspberry Pi ?

Les images sont compilées pour amd64 et arm64, donc les serveurs ARM et Docker sur Apple Silicon les exécutent. Un
Raspberry Pi avec 1 Go ou plus peut convenir, plus lentement ; aucune version n’est testée sur un tel appareil. Kept est testé
sur 1 Go de RAM et un ou deux cœurs de processeur (arm64). Voir [ce qui a été testé](/fr/install/hardware/).

## Combien de personnes peuvent utiliser un Kept ?

Kept est dimensionné selon les objets plutôt que les personnes : ses cibles sont 10 000 objets dans un lieu et
50 000 dans une instance ; le test sur 1 Go a utilisé 3 000 dans un seul lieu. Les personnes rejoignent un lieu par invitation,
et chaque lieu peut aussi contenir jusqu’à 20 comptes gérés pour les personnes sans e-mail. Voir [ce dont il a besoin](/fr/install/hardware/) et
[inviter des personnes](/fr/users/first-run/#5-inviter-des-personnes).

## Puis-je conserver plus d’un foyer, ou partager seulement une partie de mes objets ?

Oui. Chaque lieu (une maison, un garage, un box de stockage, la maison d’un parent) est partagé séparément, avec
ses propres membres et rôles ; partager le garage ne partage rien d’autre. Une personne peut appartenir à plusieurs
lieux, et chacun a un lieu Personnel privé. Voir
[vos premières minutes](/fr/users/first-run/#5-inviter-des-personnes).

## En quoi Kept est-il différent de Homebox ?

Les deux permettent de suivre ce que vous possédez et où c’est. Kept propose aussi :

- **Une carte 3D** de vos étages, pièces, étagères et boîtes.
- **Véhicules** : relevés, entretiens, carburant et leurs coûts.
- **Rappels** pour les garanties, entretiens, prêts et faible stock.
- **Utilisation hors ligne** sur votre téléphone, avec des étiquettes que vous imprimez et scannez.
- **IA, si vous le souhaitez** : capture à partir d’une photo, et un serveur MCP pour les assistants.

Il importe une sauvegarde Homebox, vous pouvez donc l’essayer avec vos propres objets.

## Puis-je migrer depuis Homebox ?

Oui. Depuis Homebox v0.26.1 ou plus récent (v0.27.0 recommandé), faites une sauvegarde dans Homebox (**Collection →
Tools → Backup & Restore → Create Backup**, puis **Download**), importez ce ZIP dans Kept, vérifiez ce qui va se passer, puis
importez. Les photos, reçus, garanties, entretiens et étiquettes sont transférés, et les anciennes étiquettes Homebox
scannent toujours. Un objet arrive vendu seulement si Homebox a un acheteur ou un prix pour lui (une date de vente
seule reste dans ses notes), et les objets archivés arrivent **Archivé** sauf si vous choisissez **En cours d’utilisation**
ou **Laisser de côté**. Connectez [Paperless-ngx](/fr/users/paperless/) d’abord et les liens de Homebox vers
ses documents arrivent comme des liens Paperless. Voir
[importation et exportation](/fr/users/import-export/#un-export-homebox) ; une importation faite avant la 1.14.1 peut être
[réparée](/fr/users/import-export/#réparer-une-importation-antérieure). Un Homebox plus ancien
n’a pas de sauvegarde que Kept puisse lire : mettez d’abord à jour une copie, ou importez sa feuille de calcul. Voir
[venir depuis un Homebox plus ancien](/fr/users/import-export/#venir-dun-homebox-plus-ancien).

## Comment le sauvegarder ?

Le serveur prend chaque nuit un instantané chiffré restic de la base de données, des fichiers et d’une copie lisible
de chaque lieu, vers un autre disque, un bucket S3 ou un serveur SFTP. Gardez le kit de récupération ailleurs
. Pour emporter un lieu, exportez-le. Voir [sauvegardes](/fr/admin/backups/),
[le kit de récupération](/fr/admin/recovery-kit/) et [importation et exportation](/fr/users/import-export/#exportation).

## Que faire si le serveur est perdu avec la maison ?

La copie lisible de la sauvegarde s’ouvre dans n’importe quel navigateur avec restic, le mot de passe de la sauvegarde et un ordinateur portable,
sans Kept. Pour remettre Kept lui-même en route sur une nouvelle machine, il vous faut aussi le kit de récupération. Voir
[lire votre inventaire avec restic seul](/fr/admin/read-with-restic/) et [restaurer](/fr/admin/restore/).

## Quelles langues parle-t-il ?

Anglais, arabe (affiché de droite à gauche), français, allemand, italien, vietnamien, ukrainien et
espagnol, choisis par appareil. Voir [langue et thème](/fr/users/first-run/#6-langue-et-thème).

## Sous quelle licence est-il ?

La GNU Affero General Public License, version 3 (AGPL-3.0). Vous pouvez l’exécuter, le modifier et le partager ; si
vous exécutez pour d’autres personnes sur un réseau une version modifiée, vous devez leur proposer son code source. Le
texte est dans le
[LICENSE](https://github.com/keptinventory/kept/blob/main/LICENSE) du dépôt.

## Kept est-il gratuit ? Sera-t-il payant ?

Kept auto-hébergé est gratuit et open source. Les applications mobile et de bureau et une version cloud sont en cours.

## Y a-t-il une version ?

Oui : `1.0.0` a été la première version signée, sur GHCR sous `ghcr.io/keptinventory/kept`, et chaque
version depuis est listée sur la [page des versions](https://github.com/keptinventory/kept/releases).
Les mises à jour exécutent leurs migrations une fois, prennent d’abord un instantané de la base de données, et peuvent
revenir en arrière d’une version. Voir [installer avec Docker Compose](/fr/install/compose/) et
[mises à jour](/fr/admin/upgrades/).
