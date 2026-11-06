---
title: Paperless-ngx
description: Liez un objet ou un lieu à ses reçus, manuels et cartes de garantie dans Paperless-ngx. Kept stocke le lien et un titre, pas le fichier, sauf si vous le copiez dans Kept.
---

Si vous conservez vos documents dans [Paperless-ngx](https://docs.paperless-ngx.com/), Kept peut lier un objet à ses documents là-bas au lieu de les téléverser deux fois. La perceuse affiche son reçu et son manuel ; la cuisine montre la facture du réfrigérateur.

Facultatif : uniquement si vous faites déjà tourner Paperless-ngx. Kept fonctionne de la même manière sans lui.

## Avant de commencer

| Vous avez besoin de | Pourquoi |
|---|---|
| **Paperless-ngx 2.16 ou version ultérieure** | Kept demande la version 9 de l'API de Paperless, ajoutée par la version 2.16 et encore servie par la version 3.x |
| **Un jeton d'API** | Dans Paperless : **Mon profil**, puis la flèche circulaire à côté du jeton d'API. Kept voit ce que cet utilisateur de Paperless voit, donc un utilisateur qui ne peut que consulter vos documents suffit |
| **Kept peut joindre Paperless** | Depuis la machine sur laquelle Kept tourne, et non depuis votre téléphone |
| **`https`**, ou votre propre réseau | En `http` simple, le jeton circule sans chiffrement, donc Kept n'accepte `http` que pour une adresse sur votre propre réseau. Une telle adresse nécessite **Administration → Paramètres → Autoriser les adresses privées** ([requêtes sortantes](/fr/admin/security-model/#requêtes-sortantes-ssrf)) |

## Se connecter

Un propriétaire ou un administrateur du lieu :

1. **Paramètres du lieu → Paperless**.
2. **Adresse de Paperless** : l'adresse à laquelle vous ouvrez Paperless, par exemple `https://paperless.example.com` (un chemin tel que `/paperless` convient).
3. **Jeton d'API**, puis **Se connecter**. Kept se connecte d'abord et explique pourquoi dans le cas contraire : un jeton refusé, une adresse qui ne répond pas comme Paperless, une version trop ancienne.

Une fois connecté, la page affiche la version de Paperless et le nombre de documents liés. **Tester la connexion** interroge à nouveau Paperless. Pour changer le jeton, saisissez-en un nouveau et **Enregistrer** ; laissez-le vide pour conserver celui qui est enregistré.

## Lier des documents

Sur la page d'un objet, sous **Documents**, **Lier depuis Paperless** se trouve à côté de **Ajouter un fichier** (sur la page d'un lieu, à côté de **Ajouter un document**). Cela ouvre une recherche dans votre Paperless : des mots du titre ou du texte, un correspondant, un type ou une étiquette. Le début d'un mot suffit : `Camel` trouve « Camelot ». La syntaxe de recherche propre à Paperless passe telle quelle à mesure que vous tapez, par exemple `title:manual` ou `*amel*` pour le milieu d'un mot. Cochez-en un ou plusieurs et **Lier**.

Les documents liés figurent dans la même liste Documents que les fichiers. Chacun affiche sa vignette, son titre, le type et le correspondant de Paperless, ainsi que sa date, avec :

- **Type** : *Manuel*, *Garantie*, *Reçu*, *Facture* ou *Document*. Modifiez-le lorsque le type Paperless ne précise pas ce qu'est le document.
- **Ouvrir dans Paperless** : la page du document dans Paperless, dans un nouvel onglet.
- **Télécharger** : le document, via Kept. Membres et plus.
- **Copier dans Kept** : voir ci-dessous.
- **Dissocier** : il est retiré de l'objet. Paperless le conserve.

Le type provient du type Paperless du document, puis de ses étiquettes : *Reçu*, *Facture*, *Manuel* et *Garantie* (et les mêmes mots dans les autres langues de Kept) sont reconnus, tout le reste est un document. Ensuite, vous pouvez modifier le type, et **Copier dans Kept** copie le document avec ce type. Le filtre **Type** dans Documents filtre à la fois les fichiers et les documents liés.

**Depuis un [import Homebox](/fr/users/import-export/#un-export-homebox) :** un lien Homebox vers l'un de vos documents Paperless (`…/documents/123`, ou de l'API `…/api/documents/123/download/`) à l'adresse à laquelle ce lieu est connecté arrive en tant que document lié sur l'objet ou le lieu. Son titre provient de Paperless, et son type, du type de pièce jointe Homebox. Connectez Paperless avant d'importer ; tout autre lien reste un lien simple.

Kept demande les titres à Paperless lorsque l'import s'exécute, et non lorsqu'il vérifie l'export. Si Paperless est inaccessible, ne possède pas le document ou ne le montre pas à son utilisateur, l'import se termine quand même et ce lien conserve le titre de Homebox, ou son adresse si Homebox n'en a aucune. Le rapport d'import indique combien. Pour obtenir le titre de Paperless plus tard, **Dissocier** le document et utilisez **Lier depuis Paperless**, ou **Copier dans Kept**.

## Lié ou copié

| | Lié | Copié dans Kept |
|---|---|---|
| Ce que Kept stocke | Le numéro du document dans Paperless, son titre, son type, le type Paperless, son correspondant et sa date | Le fichier lui-même, en tant que pièce jointe sur l'objet |
| Si Paperless est hors service | Les titres s'affichent toujours, avec une note indiquant que Paperless est inaccessible | Rien ne change |
| Dans les sauvegardes et les exports de Kept | Non : un lien nécessite le Paperless de ce serveur | Oui, comme n'importe quel autre fichier |
| Si le document change dans Paperless | Son titre se met à jour lorsque vous le copiez | La copie reste telle quelle |

**Copier dans Kept** est par document et explicite : utilisez-le pour ce qui doit survivre sans Paperless, par exemple un reçu dont vous aurez besoin pour une réclamation de garantie. La copie est le fichier que Paperless propose au téléchargement (son PDF archivé lorsqu'il en a généré un), vérifié et dimensionné comme un téléversement.

## Qui peut faire quoi

| | Lecteur | Membre | Administrateur, propriétaire |
|---|---|---|---|
| Voir les documents liés et les vignettes | ✓ | ✓ | ✓ |
| Rechercher dans Paperless, lier, copier, télécharger | | ✓ | ✓ |
| Changer le type, dissocier | | Leurs propres | Tous |
| Connecter, modifier, déconnecter | | | ✓ |

Les reçus et les factures sont de l'argent : là où l'argent est caché pour vous dans un lieu, les reçus et factures liés le sont également, et vous ne pouvez pas masquer un document lié.

Un [jeton personnel](/fr/users/mcp-clients/#créer-un-jeton-personnel) lit les liens d'un objet ou d'un lieu (`GET /api/v1/paperless-links?thingId=…`), jamais la connexion, une recherche, une vignette ou un document. L'outil MCP `get_thing` liste les documents liés d'un objet par titre.

## Confidentialité

- Le jeton est scellé avec la clé secrète de Kept, comme un mot de passe de boîte aux lettres. Kept ne l'affiche jamais, ne le consigne pas et ne le place ni dans une entrée d'audit ni dans un export.
- Votre navigateur ne communique jamais avec Paperless en utilisant le jeton. Les recherches, les vignettes et les téléchargements passent par Kept, qui vérifie d'abord que vous pouvez voir l'objet. Les vignettes sont réencodées par Kept et conservées pendant cinq minutes.
- **Ouvrir dans Paperless** est un lien ordinaire : vous vous connectez à Paperless sous votre propre identité.
- Déplacer un objet vers un autre lieu supprime ses liens : ils désignent des documents dans le Paperless de l'ancien lieu, que les membres du nouveau lieu ne voient peut-être pas.

## Déconnecter

**Paramètres du lieu → Paperless → Déconnecter** supprime la connexion et tous les liens vers ses documents. Les documents copiés dans Kept restent.

## Pas encore fait

- Synchronisation bidirectionnelle : Kept ne modifie rien dans Paperless.
- Faire correspondre les reçus avec les objets automatiquement.
- Envoyer les fichiers de Kept à Paperless.
