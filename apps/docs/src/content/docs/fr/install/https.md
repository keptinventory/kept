---
title: Activez le protocole HTTPS pour Kept
description: Pourquoi Kept veut le HTTPS, et comment l'obtenir - Caddy à partir de compose.full.yaml, Tailscale, NetBird, Twingate, Cloudflare Tunnel ou votre propre proxy.
sidebar:
  order: 2
---

Kept fonctionne en HTTP simple, mais un téléphone considère une adresse HTTP simple comme non sécurisée, et plusieurs éléments cessent de fonctionner :
- **la caméra** (Kept revient à un sélecteur de fichiers),
- **l'installation de Kept** sur l'écran d'accueil, et son utilisation hors ligne depuis celui-ci,
- **les notifications push**,
- **la localisation**.

`localhost` est considéré comme sûr ; une adresse LAN en HTTP ne l'est pas. Avec une variable `KEPT_PUBLIC_URL` en `https:`, Kept marque également ses cookies comme `Secure` et envoie l'en-tête HSTS ; `KEPT_HSTS=off` le désactive lorsque des services en HTTP simple partagent le même nom d'hôte ([HSTS](/fr/install/reverse-proxy/#hsts)).

Certaines fonctions Kept les refuse catégoriquement tant que la variable `KEPT_PUBLIC_URL` est réglée sur `http:`, même sur `localhost`, car elles divulguent ou modifient un secret : afficher une valeur secrète, une exportation contenant des valeurs secrètes, ouvrir les secrets d'une exportation lors de son importation, créer un jeton d'accès dans le navigateur, connecter une application via OAuth, télécharger le kit de récupération, et modifier ou tester les paramètres de sauvegarde. Une exportation sans valeurs secrètes fonctionne, ainsi qu'une importation sans celles-ci. Les sessions sont également plus courtes en HTTP. Tant que Kept est servi en HTTP, la liste de vérification « Mise en route » sur la page d'accueil place « Activez le protocole HTTPS pour Kept » en premier, jusqu'à ce qu'un administrateur choisisse « Restez sur mon réseau domestique ». Tout ce qui fonctionne en HTTP simple est récapitulé dans un tableau : [Kept sur un réseau domestique](/fr/install/home-network/).

## Profil Caddy de Compose
Pour un nom de domaine qui pointe vers cette machine, avec les ports 80 et 443 accessibles depuis Internet (Caddy prouve le domaine auprès de Let's Encrypt ou ZeroSSL via ceux-ci). Caddy est fourni avec `compose.full.yaml`, pas avec `compose.yaml` ([Caddy et Ollama](/fr/install/compose/#caddy-et-ollama)) :

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

Caddy lit le fichier `docker/caddy/Caddyfile` situé à côté du fichier Compose. Un extraction du dépôt possède les deux fichiers ; une installation sans celui-ci le télécharge une fois :

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/docker/caddy/Caddyfile
docker compose --profile https up -d
```

Sans ce fichier, la commande `docker compose --profile https up -d` s'arrête avec l'erreur « bind source path does not exist ». Tout autre proxy fonctionne à la place ; il redirige vers le port de Kept, comme dans les sections suivantes.

Caddy obtient et renouvelle le certificat, puis transmet tout le trafic à Kept. Compose attribue à Caddy une adresse fixe sur son propre réseau et transmet cette adresse à Kept sous la forme de la variable `KEPT_TRUSTED_PROXIES` ; ainsi, Kept fait confiance uniquement à l'en-tête `X-Forwarded-For` de Caddy et à aucun autre. Vous pouvez ensuite limiter le HTTP simple à l'interface de bouclage uniquement, en définissant `KEPT_HTTP_PORT=127.0.0.1:8080`.

Si le sous-réseau `172.29.72.0/24` entre en conflit avec votre réseau local, modifiez le sous-réseau du réseau, son paramètre `ip_range`, l'adresse `ipv4_address` de Caddy et la variable `KEPT_TRUSTED_PROXIES` dans le fichier `compose.full.yaml`.

## Tailscale
Pour une instance de Kept accessible uniquement par vos propres appareils, sans aucun port ouvert sur Internet : sur la machine exécutant Kept, avec les certificats HTTPS activés pour votre réseau privé (tailnet),

```sh
tailscale serve --bg 8080
```

fait tourner Kept à l'adresse `https://<machine>.<tailnet>.ts.net` avec un certificat valide, accessible depuis n'importe quel appareil du tailnet. Définissez la variable `KEPT_PUBLIC_URL` sur cette adresse.

Le proxy de Tailscale s'exécute sur la même machine et se connecte à Kept depuis `127.0.0.1` ; Kept considère que chaque requête provient de cette adresse, sauf si vous lui faites confiance. Sur une instance destinée à un seul foyer, cela n'a d'importance que pour [le blocage de la configuration](/fr/install/reverse-proxy/#le-verrouillage-de-configuration).

## NetBird
Le proxy inverse de NetBird attribue au port d'un pair une adresse publique `https://` accompagnée d'un certificat :

```sh
netbird expose 8080
```

Il affiche cette adresse. Définissez la variable `KEPT_PUBLIC_URL` sur celle-ci (ou sur votre propre domaine, avec l'option `--with-custom-domain kept.example.org`, à configurer préalablement dans NetBird). L'adresse est publique sauf si vous sélectionnez **Accès NetBird exclusif** pour le service dans le tableau de bord, ce qui la restreint à vos pairs. Un administrateur de compte active d'abord l'option **Exposer les pairs** dans Paramètres → Clients.

## Twingate
Twingate rend Kept accessible à vos appareils sans ouvrir de port, mais le certificat vous appartient : attribuez à Kept un nom d'hôte sur un domaine que vous possédez (`kept.example.org`), obtenez un certificat pour celui-ci grâce à un défi DNS (Caddy, Traefik ou cert-manager peuvent le faire), puis ajoutez ce nom d'hôte en tant que ressource Twingate. Définissez la variable `KEPT_PUBLIC_URL` sur `https://kept.example.org`.

## Cloudflare Tunnel
Pour une adresse publique sans port ouvert. Cloudflare sert le nom d'hôte en HTTPS et le transmet à Kept via `cloudflared` :

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

avec `~/.cloudflared/config.yml` :

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

Définissez la variable `KEPT_PUBLIC_URL` sur `https://kept.example.org`. Cloudflare Access peut placer une étape d'authentification devant celui-ci. Une adresse publique est également nécessaire à une application web telle que claude.ai pour [se connecter au serveur MCP de Kept](/fr/users/mcp-clients/#se-connecter-comme-connecteur-oauth).

`cloudflared`, comme les autres tunnels présentés ici, accède à Kept depuis la même machine ; accordez-lui votre confiance comme indiqué dans la section [Proxy inverses](/fr/install/reverse-proxy/#faites-confiance-au-proxy-et-seulement-au-proxy).

## Votre propre proxy inverse
Tout proxy qui termine le TLS et transmet vers le port 8080 fonctionne. Consultez la section [Proxy inverses](/fr/install/reverse-proxy/) pour les trois paramètres importants.

## Un certificat uniquement approuvé par vos appareils
Sur un réseau local sans domaine, mkcert peut générer un certificat pour l'adresse de la machine, à servir via n'importe quel proxy TLS. Chaque téléphone doit ensuite faire confiance au certificat racine de mkcert ; sur un iPhone, cela revient à l'installer en tant que profil et à activer la confiance totale dans Réglages → Général → À propos → Paramètres de confiance des certificats. Tailscale est généralement moins contraignant.
