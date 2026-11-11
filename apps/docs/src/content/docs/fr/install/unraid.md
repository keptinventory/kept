---
title: Installer sur Unraid
description: Installer Kept depuis les Community Applications d’Unraid en un seul conteneur, Kept et sa propre base de données, tout dans le dossier appdata.
sidebar:
  order: 2
  label: Unraid
---

Kept tourne sur Unraid en un seul conteneur, depuis les **Community Applications** (l’onglet
**Apps**) : Kept et sa propre base de données PostgreSQL, tout dans `/mnt/user/appdata/kept`. Pas
de Compose, pas de mot de passe à inventer.

## Ce qu’il vous faut

| | |
|---|---|
| Unraid | Avec l’onglet **Apps** (le plugin Community Applications) |
| Mémoire | Environ 300 Mo libres pour Kept et sa base de données |
| Une adresse | Celle où vous ouvrirez Kept, comme `http://tower.local:8080`. Préférez un nom à une adresse IP : les étiquettes imprimées la portent |

## Installer

1. **Apps**, cherchez **Kept**, puis **Install**.
2. **Kept's address** : l’adresse où vous ouvrirez Kept, sans chemin. Le reste peut rester tel
   quel. **Show more settings** contient les réglages facultatifs : le courrier, la connexion OIDC
   et Google, un proxy inverse, l’inscription.
3. **Apply.** Unraid télécharge l’image et démarre le conteneur.
4. Onglet **Docker**, l’icône de Kept, **Logs** : le code de configuration.

   ```text
   app: Kept is at http://tower.local:8080
   KEPT SETUP CODE: XXX-XXX
   ```

5. L’icône de Kept, **WebUI**. Kept affiche **Saisissez le code de configuration** : tapez le
   code, puis **Créer le premier compte**. Il devient l’administrateur de l’instance.
6. **Gardez les clés.** L’icône de Kept, **Console**, puis :

   ```sh
   kept admin recovery-kit
   ```

   Copiez le texte qui commence par `KEPT RECOVERY KIT` ailleurs que sur ce serveur, par exemple
   dans un gestionnaire de mots de passe. Sans les clés, une sauvegarde ne rend pas les valeurs
   secrètes.

Le premier démarrage crée la base de données et prend environ une minute. Docker déclare le
conteneur en bonne santé dès que Kept répond.

## Ce que contient le dossier appdata

| Dossier | Quoi |
|---|---|
| `postgres/` | La base de données en service. Appartient à l’utilisateur `postgres` du conteneur |
| `kept/` | Photos et fichiers. Appartiennent à l’uid 10001, l’utilisateur sous lequel Kept tourne |
| `config/` | Les clés de Kept (`secrets.json`) et les mots de passe de la base de données. Appartiennent à l’uid 10001 |
| `owner/` | Le mot de passe du propriétaire de la base de données. À root seul : le processus de Kept ne le lit jamais |
| `backup/kept.pgdump` | Un dump de la base de données, écrit à chaque arrêt du conteneur |

Le conteneur démarre en root, donne ces dossiers à leurs propriétaires, puis lance Postgres et Kept
sous leurs propres utilisateurs. Le dossier lui-même reste à root : personne d’autre ne peut en
lister le contenu.

## Sauvegardes

- **Sauvegardez le dossier appdata** conteneur arrêté, par exemple avec le plugin Appdata Backup
  d’Unraid. Un arrêt écrit d’abord `backup/kept.pgdump` : la sauvegarde contient une copie cohérente
  de la base de données, même si les fichiers en service ne le sont pas.
- **Restaurer :** remettez le dossier en place et démarrez Kept. Sans dossier `postgres/` et avec
  un dump dans `backup/`, Kept restaure la base de données depuis le dump à son démarrage ; le
  journal indique `database restored from the backup`.
- **Les sauvegardes nocturnes propres à Kept** (Administration → Sauvegardes) ne sont pas mises en
  place dans ce conteneur : elles ont besoin de l’identifiant du propriétaire de la base de
  données, que le Kept en service n’a pas. Sauvegardez le dossier appdata.

## Mises à jour

Le modèle suit la version majeure de Kept (`kept-unraid:1`). Quand une version sort, l’onglet
**Docker** propose une mise à jour pour Kept : **apply update**. Le conteneur s’arrête (en écrivant
son dump), la nouvelle image démarre et Kept met à jour sa base de données au démarrage.

## L’adresse de Kept

Changez-la dans le modèle (l’icône de Kept, **Edit**) puis **Apply**. Pour servir Kept en https,
placez un proxy inverse devant le port 8080, réglez **Kept's address** sur son adresse https et
**Trusted reverse proxies** sur l’adresse du proxy telle que Kept la voit
([derrière un proxy inverse](/fr/install/reverse-proxy/)). L’appareil photo, l’installation de
l’application sur le téléphone, les notifications push et les passkeys ont besoin de https
([Kept sur un réseau domestique](/fr/install/home-network/)).

## Désinstaller

1. Onglet **Docker**, l’icône de Kept, **Remove**. Le dossier appdata reste.
2. Pour supprimer aussi les données, effacez `/mnt/user/appdata/kept`, depuis le terminal ou un
   gestionnaire de fichiers. C’est définitif : faites d’abord une sauvegarde si vous risquez d’en
   avoir besoin.
