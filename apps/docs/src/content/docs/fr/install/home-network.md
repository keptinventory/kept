---
title: Kept sur un réseau domestique
description: "Exécuter Kept sur votre réseau domestique en HTTP simple : ce qui fonctionne, ce qui nécessite HTTPS et pourquoi, et les deux façons d'ajouter HTTPS sans domaine public : Tailscale, ou Caddy avec sa propre autorité de certification."
sidebar:
  order: 3
---

Kept fonctionne sur votre réseau domestique à une adresse `http://` simple, comme `http://192.0.2.20:8080`
ou `http://kept.home.arpa:8080`. Vos propres données y fonctionnent : ajouter, trouver et déplacer des objets,
photos et fichiers, étiquettes, rapports, imports et exports sans valeurs secrètes.

Quelques éléments nécessitent HTTPS. Parfois parce que Kept refuse de remettre une clé ou d'afficher un secret sur une
connexion que n'importe qui sur le réseau peut lire ; parfois parce que les navigateurs ne les autorisent que sur une adresse
sécurisée, ce que Kept ne peut pas changer.

## Ce qui fonctionne en HTTP simple

| | En HTTP simple | Pourquoi |
|---|---|---|
| Objets, lieux, recherche, déplacements, étiquettes, rapports | Fonctionne | |
| Photos et fichiers, choisis sur l'appareil | Fonctionne | |
| Import (Homebox, CSV, un export Kept) | Fonctionne | |
| Ouverture des secrets d'un export lors de l'import | Nécessite HTTPS. En HTTP simple le reste de l'export s'importe sans eux | Kept : la phrase secrète et les valeurs secrètes |
| Export sans valeurs secrètes | Fonctionne. Chaque valeur secrète est omise et marquée comme omise ; l'export s'importe comme d'habitude | Vos propres données |
| Définition d'une valeur secrète | Fonctionne | |
| Affichage d'une valeur secrète | Nécessite HTTPS | Kept : un secret n'est jamais envoyé en HTTP simple |
| Export avec valeurs secrètes | Nécessite HTTPS | Kept : les secrets et leur phrase secrète |
| Jetons pour apps IA (MCP) et Home Assistant | Pas depuis le navigateur. Créez-en un sur le serveur : `kept admin token create` ([CLI](/fr/admin/cli/#un-jeton-depuis-le-serveur)) | Kept : un jeton est une clé |
| Connexion d'une app avec OAuth (un connecteur) | Nécessite HTTPS | Kept : OAuth a besoin d'une adresse sécurisée |
| Téléchargement du kit de récupération | Pas depuis le navigateur. Sur le serveur : `kept admin recovery-kit` ([CLI](/fr/admin/cli/)) | Kept : il contient les clés du serveur |
| Réglages de sauvegarde et leur test | Nécessite HTTPS, ou définissez-les dans l'environnement du serveur ([configuration](/fr/reference/configuration/)) | Kept : le mot de passe de sauvegarde |
| Clés d'accès | Nécessite HTTPS | Le navigateur : pas de clés d'accès sur une adresse en HTTP simple |
| L'appareil photo, l'installation de Kept, le fonctionnement hors ligne, les notifications push, la localisation | Nécessite HTTPS | Le navigateur |

En HTTP simple, une session dure aussi 12 heures et n'est pas renouvelée ; en HTTPS, elle dure 30 jours. Pour
changer les 12 heures, voir [Rester sur votre réseau](#rester-sur-votre-réseau).

La mise en route sur l'accueil demande à un administrateur d'instance de mettre Kept en HTTPS. Si vous restez sur votre
réseau domestique, choisissez **Je reste sur mon réseau domestique** et l'étape compte comme faite. La ligne HTTPS en haut
de chaque page peut aussi être ignorée.

`localhost` compte comme une adresse sécurisée dans les navigateurs, mais Kept se base sur `KEPT_PUBLIC_URL` : tant que
celle-ci est `http:`, les refus propres à Kept ci-dessus s'appliquent aussi sur `localhost`.

## Rester sur votre réseau

Celui qui exécute Kept peut changer deux objets sur le serveur : la durée d'une session en HTTP simple,
et les adresses auxquelles Kept répond. Aucune ne peut être changée depuis l'app, et Admin → Status montre
ce qui est en vigueur.

### Sessions plus longues en HTTP simple

En HTTP simple, vous vous reconnectez toutes les 12 heures. `KEPT_HTTP_SIGN_IN_DAYS` dans `.env` fixe ce nombre de
jours, de 1 à 30, renouvelé à l'usage. 7 convient à un réseau domestique ou à Tailscale :

```sh
KEPT_HTTP_SIGN_IN_DAYS=7
```

Puis `docker compose up -d`. Dans l'app Home Assistant, c'est l'option **Durée de connexion en http**.

Une installation mise à niveau depuis la 1.14.4 en changeant seulement `KEPT_IMAGE` a encore l'ancien `compose.yaml`,
qui ne transmet pas ce réglage : [téléchargez le nouveau](/fr/admin/upgrades/#paramètres-nécessitant-le-nouveau-composeyaml)
d'abord.

**Le coût :** en HTTP simple, un cookie de session peut être copié par quiconque voit le trafic.
Avec le réglage activé, une copie continue de fonctionner tant qu'elle est utilisée, jusqu'à ce que cet appareil se déconnecte ou que vos autres appareils soient déconnectés. Réservez-le donc à un réseau
de confiance, et déconnectez-vous sur un appareil perdu.

| | Non défini | Défini |
|---|---|---|
| Une session en HTTP simple dure | 12 heures | Autant de jours |
| Renouvelée | Non | Une fois par jour d'utilisation (à 1 jour, après une demi-journée) |
| En HTTPS | 30 jours, renouvelés | 30 jours, renouvelés : le réglage ne fait rien |
| Secrets et clés en HTTP simple | Refusés | Refusés |
| Actions sensibles | Mot de passe, ou une connexion au cours des dix dernières minutes | Idem ; un renouvellement ne compte pas comme une connexion |
| Déconnecter partout | Met fin à toutes les sessions | Met fin à toutes les sessions |

Toute autre valeur (0, 31, `7d`) arrête Kept au démarrage avec un message indiquant ce qu'il faut. Laisser vide
revient à ne pas le définir.

Activé, une session déjà créée prend la durée la plus longue la prochaine fois qu'elle est utilisée. Désactivé, elle
expire selon son propre rythme, jusqu'à la durée qu'elle avait ; pour les terminer plus tôt, utilisez **Déconnecter partout**
dans Admin → Utilisateurs.

### Plusieurs adresses

Kept n'accepte les connexions et les enregistrements que depuis `KEPT_PUBLIC_URL`, donc une deuxième façon d'atteindre le même Kept,
un nom Tailscale à côté d'un nom LAN, ou une IP à côté d'un nom, affiche « Ce Kept est configuré pour … ».
`KEPT_EXTRA_ADDRESSES` liste les autres, séparées par des virgules, exactement comme le navigateur les affiche :

```sh
KEPT_PUBLIC_URL=http://kept.lan:8080
KEPT_EXTRA_ADDRESSES=http://192.0.2.20:8080,http://<machine>.<tailnet>.ts.net:8080
```

Puis `docker compose up -d`. Dans l'app Home Assistant, c'est l'option **Adresses supplémentaires**. Cela fonctionne
de la même façon en HTTPS.

Une installation mise à niveau depuis la 1.14.4 en changeant seulement `KEPT_IMAGE` a encore l'ancien `compose.yaml`,
qui ne transmet pas ce réglage : [téléchargez le nouveau](/fr/admin/upgrades/#paramètres-nécessitant-le-nouveau-composeyaml)
d'abord.

| | `KEPT_PUBLIC_URL` | Une adresse supplémentaire |
|---|---|---|
| Utilisation de Kept, connexion avec un mot de passe ou un code à usage unique | Oui | Oui |
| Un lien par e-mail ou une réinitialisation de mot de passe | S'ouvre ici | S'ouvre à `KEPT_PUBLIC_URL` |
| Clés d'accès | Oui, en HTTPS | Non ; une clé d'accès appartient à une seule adresse |
| Connexion Google et OIDC | Oui | Le bouton ouvre `KEPT_PUBLIC_URL` |
| Apps IA (MCP, OAuth) | Oui | Connectez-les à `KEPT_PUBLIC_URL` : `/mcp` refuse cette adresse, et le consentement OAuth est refusé ici |
| Liens, étiquettes, codes QR, e-mails, flux de calendrier | Pointent ici | Pointent toujours vers `KEPT_PUBLIC_URL` |

- **Chaque adresse se connecte séparément et s'installe comme sa propre app,** car les navigateurs conservent les cookies
  et les données hors ligne par adresse. Se déconnecter sur l'une laisse l'autre connectée ; **Déconnecter partout**
  met fin aux deux. Les notifications push, là où HTTPS les autorise, s'ouvrent à l'adresse où l'appareil
  les a activées. Deux ports sur un même nom d'hôte partagent leurs cookies : les navigateurs ne les conservent pas
  par port.
- **Un lien par e-mail** demandé sur une adresse supplémentaire s'ouvre à `KEPT_PUBLIC_URL` et vous connecte là-bas,
  pas là où vous l'avez demandé. Une réinitialisation de mot de passe définit le mot de passe là-bas ; puis connectez-vous sur l'adresse
  où vous étiez. Si `KEPT_PUBLIC_URL` n'est pas joignable depuis là où vous êtes, utilisez votre mot de passe.
- **Clés d'accès :** ajoutez-les et utilisez-les à `KEPT_PUBLIC_URL`. Une adresse supplémentaire propose votre mot de passe ou
  un lien par e-mail et explique pourquoi.
- **Adresses exactes :** schéma, hôte et port, comparés dans leur ensemble. `http://kept.lan` n'est pas
  `http://kept.lan:8080`, et `kept.lan.example.com` n'est pas `kept.lan`. Un caractère générique, un chemin, une connexion ou
  un mélange de `http` et `https` arrête Kept au démarrage avec un message indiquant lequel. Laisser vide revient à
  ne pas le définir.
- **En-têtes transmis :** `Host` et `X-Forwarded-*` ne jouent aucun rôle, ce qui empêche votre proxy d'ajouter une adresse
  par accident, ou d'en retirer une. Pointez-le vers Kept pour chaque adresse listée.

**Le coût :** une page servie à une adresse listée compte comme Kept lui-même, et peut utiliser la session de
celui qui l'ouvre là-bas. Ne listez donc que les adresses qui atteignent ce Kept, sur des noms et des IP que vous contrôlez.

## Ajouter HTTPS : Tailscale d'abord

Le moins de travail pour un foyer : installez Tailscale sur la machine qui exécute Kept et sur chaque téléphone
et ordinateur qui l'utilise, activez les certificats HTTPS pour votre tailnet, et servez Kept avec

```sh
tailscale serve --bg 8080
```

Kept est alors à `https://<machine>.<tailnet>.ts.net`, avec un certificat que tous les appareils
font déjà confiance, depuis chez vous ou ailleurs. Définissez `KEPT_PUBLIC_URL` sur cette adresse et redémarrez Kept. Plus d'informations dans
[Mettre Kept en HTTPS](/fr/install/https/#tailscale).

## Ajouter HTTPS : Caddy avec sa propre autorité de certification

Sans Tailscale ni domaine public, Caddy peut signer un certificat pour un nom de réseau domestique
lui-même (`tls internal`). Cela fonctionne, mais ce n'est pas rapide : **chaque appareil qui ouvre Kept doit être informé
de faire confiance au certificat racine de Caddy**, un par un, pour chaque personne de la maison. Tant qu'un appareil
ne lui fait pas confiance, son navigateur affiche un avertissement de sécurité.

1. Choisissez un nom que chaque appareil peut résoudre vers la machine, par exemple `kept.home.arpa` (une entrée DNS
   sur votre routeur, ou une entrée dans le fichier hosts de chaque appareil).
2. Définissez-le dans `.env` :

   ```sh
   KEPT_DOMAIN=kept.home.arpa
   KEPT_PUBLIC_URL=https://kept.home.arpa
   ```

3. Caddy est fourni avec `compose.full.yaml` : téléchargez-le ainsi que `docker/caddy/Caddyfile`, et définissez
   `COMPOSE_FILE=compose.full.yaml` dans `.env`, comme dans
   [Mettre Kept en HTTPS](/fr/install/https/#profil-caddy-de-compose). Puis ajoutez `tls internal` au
   Caddyfile :

   ```caddy
   {$KEPT_DOMAIN} {
   	tls internal
   	encode zstd gzip
   	reverse_proxy kept:8080
   }
   ```

4. Démarrez Caddy et copiez son certificat racine hors de son volume de données :

   ```sh
   docker compose --profile https up -d
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./kept-root.crt
   ```

5. Installez `kept-root.crt` sur chaque appareil et faites-lui confiance :
   - **iPhone et iPad :** envoyez-le à l'appareil (AirDrop ou e-mail), installez le profil dans
     Réglages → Général → VPN et gestion des appareils, puis activez la confiance totale dans Réglages →
     Général → À propos → Réglages de confiance des certificats.
   - **Android :** dans les réglages de sécurité, installez-le comme certificat d'AC (le nom du menu varie
     selon le fabricant). Certaines apps ignorent les certificats installés par l'utilisateur.
   - **Ordinateurs :** ajoutez-le aux certificats de confiance du système (Trousseau d'accès sur un Mac, le
     gestionnaire de certificats sous Windows, le magasin d'AC de la distribution sous Linux). Firefox peut conserver sa
     propre liste.

La racine de Caddy dure dix ans ; les certificats qu'elle signe se renouvellent d'eux-mêmes. La clé privée
de la racine reste dans le volume `caddy-data` : quiconque la copie peut signer pour n'importe quel nom auquel vos
appareils font désormais confiance, protégez donc ce volume comme un mot de passe. [mkcert](/fr/install/https/#un-certificat-uniquement-approuvé-par-vos-appareils) est la même idée avec
un autre outil.

## Ouvrir Kept à la bonne adresse

Ouvrez Kept à l'adresse indiquée dans `KEPT_PUBLIC_URL`. Ouvert à une autre (l'adresse IP de la machine
tandis que l'URL nomme `kept.home.arpa`, par exemple), la connexion indique pour quelle adresse ce Kept est configuré,
avec un lien vers celle-ci.
