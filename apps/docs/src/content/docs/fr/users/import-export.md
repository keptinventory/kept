---
title: Import et export
description: Faites entrer des objets depuis un tableur, Homebox ou un autre Kept, et exportez un lieu en entier avec une copie lisible sans Kept.
---

Les importations et les exportations se trouvent dans **Paramètres → Importer** et **Paramètres → Exporter**. Elles concernent les **propriétaires et administrateurs** d'un lieu, s'exécutent en arrière-plan sur le serveur et nécessitent une connexion. Pour déplacer un serveur entier, ou un foyer entre serveurs, voir aussi [déplacer vers un nouveau serveur](/fr/admin/move-server/).

## Importation

**Paramètres → Importer** demande d'où il vient :

| Source | Ce que c'est |
|---|---|
| **Un tableur (CSV)** | Un objet par ligne, avec une ligne d'en-tête nommant les colonnes ; aussi l'export tableur propre à Homebox |
| **Un export Homebox** | Le ZIP de Homebox v0.26.1 ou plus récent, v0.27.0 recommandé (Collection → Outils → Sauvegarde et restauration → Créer une sauvegarde → Télécharger) |
| **Un export Kept** | Un lieu exporté depuis ce Kept ou un autre |

Chaque importation est vérifiée avant d'écrire quoi que ce soit : **Vérifier l'import** montre **Ce que l'import fera**, ligne par ligne, avec la raison de tout ce qu'elle saute. Puis elle s'exécute avec une barre de progression. Vous pouvez quitter la page ; l'importation se poursuit, et Paramètres → Importer montre le chemin parcouru. Si elle s'arrête, **Reprendre** continue depuis la dernière ligne. **Annuler l'import** conserve ce qui a déjà été importé.

Lancer à nouveau la même importation saute ce qu'elle a déjà fait entrer, de sorte qu'une nouvelle exécution ne crée jamais de doublons. Une archive (un ZIP) peut aller jusqu'à 5 Go. Les objets importés arrivent confirmés, et non dans la Réception.

### Un tableur (CSV)

1. **Choisir le fichier**, et le lieu dans lequel il entre : un lieu dont vous êtes propriétaire ou que vous administrez. Un fichier accepte au plus 10 000 lignes (8 Mo) ; découpez un fichier plus gros. Sous le fichier, **Les colonnes que Kept lit** liste toutes les colonnes comprises, et **Télécharger un exemple de CSV** fournit un petit fichier pour démarrer.
2. **Associer les colonnes.** Pour chaque colonne, choisissez le champ vers lequel elle va, y compris **Un champ de type…** pour vos propres champs de type. Une colonne doit être le nom : tout objet en a besoin.
3. **Quelques choix :**
   - Une colonne d'emplacement comme `Garage > Shelf A` crée les pièces et les emplacements : choisissez le séparateur, et si vous voulez **Créer les emplacements nommés par le fichier qui n'existent pas encore**.
   - Là où vont les lignes sans emplacement (Non placé par défaut).
   - Comment les dates sont écrites (déduites du fichier quand c'est possible), et la devise pour les lignes qui n'en ont pas.
   - **Associer la colonne type à vos types par leur nom**, dans n'importe laquelle des langues de Kept ; désactivé, le type est conservé dans les notes.
4. **Vérifier l'import**, lire le rapport, et importer.

Les colonnes que Kept lit : nom, quantité, emplacement, type, marque, modèle, numéro de série, code-barres, couleur, état, notes, étiquettes, autres noms, date d'achat, prix, devise, boutique, lien vers le manuel, le code d'une ancienne étiquette, votre propre code, un identifiant de ligne (ainsi une réimportation saute la ligne), et les champs propres à vos types. Les en-têtes dans n'importe laquelle des langues de Kept sont associés pour vous. Les étiquettes et les autres noms sont séparés par des virgules, un prix est un nombre sans le signe de devise, et les dates s'écrivent d'une seule manière dans tout le fichier.

#### Le tableur de Homebox

Chaque Homebox peut exporter un tableur (jusqu'à la v0.25 : **Outils → Import/Export → Exporter l'inventaire**). Homebox v0.10.3 et v0.11.0 l'écrivent avec des séparateurs de tabulation (`homebox-items.tsv`) ; Kept lit les deux. Quand les colonnes sont celles de Homebox (`HB.name`, `HB.location`, …), Kept le signale, associe les colonnes lui-même et lit ce qu'un import de tableur ordinaire laisserait tomber :

| Colonne Homebox | Kept |
|---|---|
| `HB.asset_id`, et le lien de l'objet dans `HB.url` (v0.13 et ultérieur) | Anciennes étiquettes : une étiquette Homebox imprimée ouvre l'objet |
| `HB.sold_*` | Avec un acheteur ou un prix : l'objet s'est terminé comme vendu, avec sa date, son acheteur, ses notes et son prix. Une date de vente seule reste dans les notes |
| `HB.archived` | Votre choix : **Archivé** (par défaut), **En service**, ou **Laisser de côté**. Un objet avec une vente se termine vendu |
| `HB.warranty_expires`, `HB.lifetime_warranty` | Une garantie à partir de la date d'achat, où Garanties est activé |
| `HB.warranty_details`, `HB.insured` | Lignes dans les notes |

Un prix de 0 est lu comme pas de prix (Homebox écrit 0 quand aucun n'a été défini). Les lignes de lieu qu'un tableur de la v0.26 ou ultérieur énumère sont laissées de côté ; les emplacements viennent du chemin de lieu de chaque objet. Un tableur ne peut pas transporter de photos, de fichiers, de maintenance ni d'objets dans des objets, et les champs personnalisés ne sont importés que si vous les associez à un champ de type. Pour tout cela, utilisez le fichier ZIP d'export.

### Un export Homebox

Kept lit le fichier ZIP d'export propre à Homebox, qui contient tout, y compris les fichiers. Dans Homebox, ouvrez **Collection → Outils → Sauvegarde et restauration**, choisissez **Créer une sauvegarde**, et **Téléchargez** la sauvegarde une fois qu'elle est listée. Cela existe depuis Homebox v0.26 : utilisez la v0.26.1 ou plus récente (l'image Docker de la v0.26.0 perd les pièces jointes), et la v0.27.0 si vous le pouvez. Un Homebox antérieur à la v0.26 n'a pas d'export : voir [venir d'un Homebox plus ancien](#venir-dun-homebox-plus-ancien). Un ZIP sans le `manifest.json` de Homebox est refusé avec ce conseil.

:::tip[If Homebox says "Topic has been Shutdown"]
Homebox v0.26 fait une exportation à chaque démarrage. Redémarrez Homebox et exportez à nouveau, ou mettez à jour vers la v0.27.0, qui n'a pas cette limite.
:::

Après l'import, Kept affiche la collection et sa date d'exportation. Elle va dans **Un nouveau lieu** ou **Un lieu que vous gérez**, où les objets déjà présents restent et une nouvelle exécution n'ajoute que ce qui est nouveau. Un nouveau lieu est créé quand vous appuyez sur **Importer**, et non avant : une importation que vous laissez à sa vérification ne laisse rien derrière. **Se connecter à Homebox (facultatif)** lit la devise de la collection, que le ZIP ne contient pas : donnez l'adresse de Homebox et une clé API, ou un email et un mot de passe. Ils sont utilisés une fois et jamais stockés.

Pour un nouveau lieu, **Ce que vous suivez** vient ensuite : **Essentiel** (pièces, boîtes, étiquettes et recherche), et par-dessus, cochés, ce qu'utilise la sauvegarde : **Prix sur 10 objets** active l'Argent, **5 garanties** active les Garanties, **2 entrées de maintenance** active les Plannings. Décochez-en une et ces données restent dans les notes des objets sous forme de texte, qui ne peuvent pas devenir des fiches ultérieurement. Une sauvegarde sans rien de cela commence avec l'Essentiel seul. **Aussi pour Personnel** donne à votre lieu Personnel la même chose, donc le menu ne montre que ce que vous suivez. Changez l'un ou l'autre à tout moment dans **Paramètres du lieu → Ce que vous suivez** ; désactiver quelque chose ne supprime jamais rien.

Puis choisissez :

- **Les prix sont en** : la devise, demandée seulement quand la sauvegarde contient des prix. En choisir une relabelle les montants ; elle ne les convertit pas.
- **Articles archivés** : **Archivé** (par défaut : archivé aussi dans Kept, toujours vôtre, rangé), **En service**, ou **Laisser de côté**. Un objet archivé avec un acheteur ou un prix se termine vendu.
- **Objets en quantité 0** : **Garder 0 ou archiver** (par défaut : un type dont vous êtes à court garde 0, tout le reste arrive archivé), **Mettre à 1**, ou **Laisser de côté**. Chacun de ceux qui entrent a "Quantité dans Homebox : 0" dans ses notes. Un objet qui contient d'autres objets n'est jamais archivé ni laissé de côté pour son 0, et un lieu qui devient une boîte n'a pas de quantité à vérifier.
- **Ajouter un champ oui/non « Assuré »**, et **Laisser de côté les emplacements et étiquettes de départ de Homebox** (les huit pièces et six étiquettes avec lesquelles chaque nouvelle collection Homebox commence, quand elles sont inutilisées).
- **Ceux-ci ressemblent à des boîtes** : des lieux nommés comme une boîte ou un bac (Box 01, Bin 2, Kiste 3…) qui ne contiennent aucun autre lieu. Cochez-les, ou **Tout choisir**, et ils entrent comme des boîtes : des objets qui contiennent des objets, avec leurs étiquettes et ce qu'ils contiennent. Le reste entre comme des emplacements.
- **Champs personnalisés** : pour chacun, **Ajouter au type** ou **Garder dans les notes**.
- **Types** : pour chaque type Homebox, un type Kept, **Nouveau type…** avec un nom que vous tapez, ou **Sans type**. Les types propres de Homebox 0.27, `global.item` et `global.location`, se lisent comme **Article** et Lieu, comme dans Homebox ; le fourre-tout **Article** commence comme **Sans type**.

La vérification liste chaque entrée qui demande un regard, chacune avec ce qui lui est arrivé en mots, et la page de l'importation garde cette liste après l'importation : ouvrez-la depuis **Activité** (Une importation a été exécutée).

Ce qui passe :

| Homebox | Kept |
|---|---|
| Collection | Un lieu |
| Emplacements (imbriqués) | Pièces et emplacements, en conservant l'arborescence |
| Objets | Objets ; un objet contenant d'autres objets devient une boîte, jamais tout son type |
| Fabricant, modèle, numéro de série | Marque, modèle, numéro de série |
| Date d'achat, boutique et prix | Un achat avec sa boutique |
| Garantie, garantie à vie | Une garantie |
| Détails de vente | Avec un acheteur ou un prix (plus de 0) : l'objet s'est terminé comme vendu, avec sa date, son prix, son acheteur et ses notes. Une date de vente seule n'est pas une vente : l'objet reste en service, la date dans ses notes |
| Étiquettes | Étiquettes avec leurs couleurs (étiquettes imbriquées aplaties) |
| Photos, manuels, reçus, fichiers de garantie | Photos, manuels, le reçu de l'achat, le document de la garantie |
| Liens | Liens. Un lien vers un document du [Paperless-ngx](/fr/users/paperless/) auquel le lieu est connecté (la même adresse) entre comme un lien Paperless, comme **Lier depuis Paperless** le fait, avec son titre provenant de Paperless (celui de Homebox si Paperless ne peut pas en fournir ; le rapport dit combien) ; connectez Paperless avant d'importer |
| Maintenance effectuée | Fiches de service |
| Maintenance planifiée | Plannings ponctuels |
| Modèles | Modèles de compte, dans la mesure où ils correspondent |

Les notificateurs, les membres et les rôles ne sont pas importés. Lorsqu'un module est désactivé dans le lieu, le texte de cette fiche est conservé dans les notes de l'objet. La description d'un lieu n'est pas conservée (les emplacements n'ont pas de notes) ; la vérification nomme chacun.

Homebox écrit des dates que personne n'a saisies : certaines mises à jour remplissent les champs de date vides, et une sauvegarde peut porter une date vide comme dernier jour de l'an 0. Kept lit une date antérieure à l'an 1000 comme pas de date, et une vente a besoin d'un acheteur ou d'un prix.

#### Réparer une importation antérieure

Les importations antérieures à Kept 1.13.0 transformaient une quantité de 0 en 1, faisaient d'un type entier un type de boîte quand l'un de ses objets en contenait un autre (de sorte que chaque objet de ce type s'ouvrait sur un onglet Contenu vide), et pouvaient créer un type nommé `global.item`. Les importations antérieures à 1.14.1 marquaient un objet comme vendu quand Homebox n'avait qu'une date de vente. Ouvrez l'importation depuis **Activité** (Une importation a été exécutée) : **Réparer cet import** liste ce qu'il peut corriger, par nom :

- **Archiver les objets qui avaient une quantité de 0 dans Homebox** (toujours en service, avec quantité 1) ;
- **Rendre au type son statut de type ordinaire** (un objet qui contient des objets reste une boîte) ;
- **Renommer `global.item` en Article** ;
- **Remettre en service les objets marqués vendus pour une date seule** : vendus sans acheteur et sans prix, et non modifiés depuis. Un objet archivé dans Homebox revient aussi en service : archivez-le à nouveau à la main.

Cochez ce que vous voulez et appuyez sur **Réparer**. Un seul **Annuler** remet tout en arrière.

**Les anciennes étiquettes continuent de fonctionner.** Chaque identifiant de ressource Homebox (`000-001`) est mémorisé et listé sous **Vos codes** sur l'objet. Le scanner de Kept reconnaît une étiquette Homebox et ouvre l'objet importé ; si vous pointez l'ancien nom d'hôte Homebox vers Kept, le scan avec l'appareil photo du téléphone fonctionne aussi. Les longs identifiants d'objet et de lieu Homebox (ceux de ses liens d'étiquette) sont mémorisés pour le scan mais ne sont pas listés. Les objets importés reçoivent leurs propres codes Kept, qui restent hors des listes jusqu'à ce que vous imprimiez leurs étiquettes.

### Venir d'un Homebox plus ancien

Un Homebox antérieur à la v0.26 ne peut pas créer le fichier ZIP d'export. Deux moyens d'entrer :

- **Tout, photos et maintenance comprises :** mettez à jour une copie de Homebox vers la v0.27.0 et exportez le ZIP depuis la copie. Testé depuis Homebox v0.10.3 (la dernière version de l'original `hay-kot/homebox`) directement vers la v0.27.0.
- **Plus rapide, avec moins :** importez son [tableur](#le-tableur-de-homebox).

La mise à jour ne peut pas être annulée (dès la v0.23, les propres notes de Homebox le disent), donc elle tourne sur une copie et votre Homebox reste tel quel :

1. **Arrêtez Homebox et copiez son dossier de données**, celui monté sur `/data` (`homebox.db` avec ses fichiers `-wal` et `-shm`, et les pièces jointes). Conservez l'original comme votre sauvegarde.
2. **Démarrez Homebox v0.27.0 sur la copie.** Homebox vit maintenant à `ghcr.io/sysadminsmedia/homebox` ; la v0.26 et les versions ultérieures ont besoin de `HBOX_AUTH_API_KEY_PEPPER`, 32 caractères aléatoires ou plus :

   ```sh
   docker run --rm -p 7745:7745      -e HBOX_AUTH_API_KEY_PEPPER="$(openssl rand -hex 24)"      -v /path/to/homebox-copy:/data      ghcr.io/sysadminsmedia/homebox:0.27.0
   ```

   Le premier démarrage met à jour la base de données d'un seul coup. Il ajoute aussi les huit pièces de départ de Homebox, que Kept laisse de côté par défaut quand elles sont vides.
3. **Connectez-vous** avec votre compte habituel et ouvrez **Collection → Outils → Sauvegarde et restauration**. Choisissez **Créer une sauvegarde**, puis **Téléchargez** la sauvegarde une fois qu'elle est listée.
4. **Importez-le dans Kept** comme [un export Homebox](#un-export-homebox).
5. Arrêtez la copie et supprimez-la une fois l'importation terminée.

Les photos ajoutées avant que Homebox n'enregistre les types de fichiers passent aussi : Kept vérifie chaque fichier lui-même.

### Un export Kept

Un export Kept arrive toujours comme **un nouveau lieu**, avec ses objets, emplacements, fichiers, états des lieux, déménagements et historique, et la position du lieu si elle en a une (pour [Suggérer où je suis](/fr/users/phone-app/#lappareil-photo-la-galerie-et-le-scan)). S'il contient des valeurs secrètes, **Ouvrir les secrets** avec la phrase de passe choisie lors de l'export ; sans elle, tout le reste est importé. Les ouvrir nécessite le HTTPS : en HTTP simple, l'écran d'importation le dit et importe le reste. **Personnes à inviter** liste qui a partagé le lieu ; personne n'est invité par l'importation, alors invitez chaque personne vous-même.

**États des lieux** reviennent avec leurs jours, notes, pièces et photos, et chaque photo conserve l'heure à laquelle Kept l'a reçue pour la première fois. Un rapport terminé revient terminé à la même heure, et reste verrouillé. Sur le nouveau serveur, les photos et la fin sont au nom de la personne qui les a importées ; l'historique montre toujours qui a fait quoi avant l'importation.

**Déménagements** reviennent avec leurs boîtes : le numéro, l'état et la pièce de destination de chaque boîte, et un déménagement fait est refait. Un déménagement vers un autre lieu entre comme un déménagement à l'intérieur du nouveau, avec ses pièces à choisir à nouveau.

Un export fait par un Kept plus récent que le serveur dans lequel vous importez peut être refusé : mettez ce serveur à jour d'abord.

### L'historique LubeLogger d'un véhicule

Dans l'aperçu d'un véhicule, **Importer depuis LubeLogger** prend le CSV que LubeLogger exporte pour un véhicule : son carburant, ses interventions (réparations et améliorations incluses) ou ses relevés de compteur kilométrique, un fichier à la fois. Kept lit le fichier, dit de quel type il est et devine comment les dates et les décimales sont écrites (LubeLogger les écrit dans la langue de son serveur) ; changez l'une ou l'autre si la devinette est fausse, et dites si le carburant est en litres ou en gallons. **Vérifier** montre ce qui serait ajouté et quelles lignes ne le peuvent pas, et pourquoi ; **Importer** les ajoute, du plus ancien au plus récent, avec leurs relevés de compteur kilométrique. Importer à nouveau le même fichier n'ajoute rien. Les propriétaires et administrateurs du lieu peuvent importer.

### Mots de recherche après une importation

Quand un fournisseur d'IA est connecté, la fin d'une importation peut proposer **Ajouter des mots de recherche avec l'IA ?**, avec une estimation des jetons qu'elle prend. Elle tourne en arrière-plan et ajoute des alias dans les langues du lieu, comme les objets capturés les reçoivent ([Fournisseurs d'IA](/fr/users/ai-providers/)).

## Exportation

**Paramètres → Exporter** a deux sortes :

- **Exporter un lieu**, un dont vous êtes propriétaire ou que vous administrez : tout objet, emplacement, photo, document, état des lieux et déménagement y est toujours inclus.
- **Exporter mes données** : votre lieu Personnel avec ses fichiers, votre profil et vos préférences, et vos propres appels d'IA. Avec [Personnel masqué](/fr/users/locations/#masquer-personnel) il porte le premier autre lieu dont vous êtes propriétaire, et Personnel est sur **Exporter un lieu**.

**Ce qu'il contient** en plus : les objets archivés et terminés (vendus, donnés, jetés), la Corbeille, l'historique, les appels d'IA, et **Une copie lisible sans Kept** : pages web, tableurs, vignettes et reçus qui s'ouvrent dans n'importe quel navigateur, optionnellement avec le PDF de l'inventaire, dans une langue qui lui est propre.

**Inclure les secrets** est pour le propriétaire du lieu. Les valeurs secrètes sont chiffrées avec une phrase de passe d'au moins 12 caractères, saisie deux fois. Quiconque a le fichier et la phrase de passe peut lire chaque secret qu'il contient, et Kept ne peut pas récupérer une phrase de passe oubliée. La copie lisible ne contient jamais de secrets.

Un export sans secrets laisse de côté chaque valeur secrète et le dit : chaque objet ou emplacement qui en avait une nomme le champ dans `secretsWithheld`, le manifeste les compte, et la copie lisible comporte une ligne à ce sujet. Il s'importe comme n'importe quel autre export ; les champs arrivent vides. En HTTP simple, c'est le seul type (**Inclure les secrets** nécessite le HTTPS, [Kept sur un réseau domestique](/fr/install/home-network/)).

L'exportation est construite en arrière-plan ; vous êtes notifié quand elle est prête. Chaque exportation reste dans la liste, prête à **Télécharger**, pendant sept jours. Chaque fichier du ZIP est daté de la création de l'exportation.

### Exportations et sauvegardes

Une exportation est ce que vous emportez : un lieu, lisible partout, importable dans n'importe quel Kept. La sauvegarde nocturne du serveur est distincte et couvre l'instance entière ; elle contient aussi une copie lisible de chaque lieu ([sauvegardes](/fr/admin/backups/)). Supprimer un lieu propose **Exporter d'abord**.

## Déplacement entre instances

Pour déplacer un foyer vers un autre serveur Kept : exportez le lieu (avec les secrets si nécessaire), puis importez le ZIP là-bas comme un export Kept. Les étiquettes imprimées continuent de fonctionner : une étiquette garde son code quand ce code est libre sur le nouveau serveur, et sinon, l'ancienne étiquette ouvre toujours l'objet. Pour déplacer un serveur entier avec tous les comptes, utilisez plutôt une sauvegarde. Les deux façons sont dans [déplacer vers un nouveau serveur](/fr/admin/move-server/).
