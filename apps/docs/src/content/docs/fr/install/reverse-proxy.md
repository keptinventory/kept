---
title: Derrière un proxy inverse
description: "Les réglages qui comptent lorsque Kept se trouve derrière nginx, Traefik, Caddy ou un autre proxy : adresses de confiance, tailles d'envoi, quel nom d'hôte utiliser, l'erreur d'adresse et HSTS."
sidebar:
  order: 3
---

Kept écoute sur le port 8080 et parle en HTTP brut ; le proxy devant lui termine le TLS. Pointez le proxy vers le port 8080, définissez `KEPT_PUBLIC_URL` sur l'adresse que les gens ouvrent, et vérifiez les points ci-dessous. Le [profil Caddy](/fr/install/https/#profil-caddy-de-compose) de Compose fait déjà les trois premiers.

## Faites confiance au proxy, et seulement au proxy

Kept limite le débit des requêtes de connexion, des codes de configuration et d'autres requêtes sensibles **par adresse du client**. Derrière un proxy, l'adresse du client arrive dans `X-Forwarded-For`, que n'importe qui peut écrire. Kept ne la croit que lorsqu'elle vient des adresses de `KEPT_TRUSTED_PROXIES` :

```sh
KEPT_TRUSTED_PROXIES=10.0.0.5            # one proxy
KEPT_TRUSTED_PROXIES=10.0.0.5,10.0.1.0/24  # several, or a range
```

Kept parcourt `X-Forwarded-For` de droite à gauche et s'arrête à la première adresse en laquelle il n'a pas confiance : c'est le client. Vide (par défaut), c'est l'adresse de la socket qui est le client. Indiquez l'adresse du proxy telle que Kept la voit (sur le réseau Docker, l'adresse du conteneur proxy, pas celle de l'hôte), et rien d'où un inconnu pourrait envoyer des requêtes.

Avec Compose, mettez-le dans `.env` à côté de `compose.yaml`. Avant la 1.14.5, `compose.yaml` définissait sa propre valeur et une ligne dans `.env` n'arrivait jamais jusqu'à Kept ; sur ces versions, définissez-le pour le service `kept` dans un `compose.override.yaml`. Avec le Caddy de `compose.full.yaml`, laissez-le vide (l'adresse de Caddy est la valeur par défaut) ou gardez `172.29.72.200` dans la liste.

### Le verrouillage de configuration

Des codes de configuration erronés bloquent pendant un moment l'adresse qui les a envoyés, et de nombreux codes erronés bloquent toute l'instance. Si le proxy n'est pas dans `KEPT_TRUSTED_PROXIES`, tous les visiteurs partagent l'adresse du proxy, donc les tentatives d'une personne bloquent tout le monde. `kept admin setup-code` génère un nouveau code et lève le blocage à l'échelle de l'instance, mais pas celui par adresse : celui-ci se termine de lui-même.

## Laisser passer les téléversements

Le proxy doit accepter un corps de requête au moins aussi grand que celui de Kept, et ne devrait pas mettre en tampon les téléversements dont il n'a pas besoin :

| Téléversement | Limite de Kept |
|---|---|
| Une photo, un reçu ou un document | `KEPT_MAX_FILE_MB`, 25 Mo par défaut ; transmis en flux, refusé avec 413 avant d'être lu s'il est trop volumineux |
| Un import CSV | 8 Mo |

La valeur par défaut de la plupart des proxys est plus petite (par exemple `client_max_body_size` de nginx) ; augmentez-la à au moins `KEPT_MAX_FILE_MB`. Les délais d'expiration doivent permettre un gros téléversement sur une connexion téléphonique lente.

## Donnez à Kept son propre nom d'hôte

Servez Kept sur un nom d'hôte dont le domaine parent ne comporte aucun site que vous ne contrôlez pas, ou sur un domaine qui lui est propre. En HTTPS, le cookie de session de Kept est préfixé par `__Secure-`, ce qui permet encore à une page sur un sous-domaine **frère** (`other.example.org` à côté de `kept.example.org`) de définir un cookie pour `example.org` que les navigateurs envoient aussi à Kept. Un frère géré par quelqu'un d'autre pourrait s'en servir pour fixer une session. Vos propres autres services sur des sous-domaines frères ne posent pas de problème.

## "Ce Kept est configuré pour …"

- **Pourquoi :** Kept n'accepte les écritures qu'à partir de l'adresse présente dans `KEPT_PUBLIC_URL`, selon l'`Origin` du navigateur : schéma, hôte et port, exactement. Le proxy n'y est pour rien ; sa propre adresse et ses en-têtes `X-Forwarded-*` ne la changent pas.
- **Correction :** définissez `KEPT_PUBLIC_URL` exactement sur l'adresse que les gens ouvrent (`https://kept.example.org`, pas l'amont du proxy `http://kept:8080`), et redémarrez Kept.
- **Plus d'une adresse :** `KEPT_EXTRA_ADDRESSES` répertorie les autres, et chacune doit aussi atteindre Kept à travers votre proxy ([Plus d'une adresse](/fr/install/home-network/#plusieurs-adresses)).

Plus dans [Dépannage](/fr/admin/troubleshooting/#-ce-kept-est-configuré-pour---ou--la-requête-ne-provient-pas-de-ce-site-).

## HSTS

Avec un `KEPT_PUBLIC_URL` en `https:`, Kept envoie `Strict-Transport-Security: max-age=31536000` : les navigateurs n'ouvrent alors ce nom d'hôte qu'en https, pendant un an. En `http:`, il n'envoie rien.

- **Tout le nom d'hôte, tous les ports :** un navigateur applique la politique au nom d'hôte, pas au port de Kept. Un service en http brut sur le même nom, comme `http://server.lan:8081` à côté de Kept sur `https://server.lan`, est alors forcé en https et cesse de se charger. Les navigateurs ignorent le HSTS venant d'une adresse IP.
- **Le désactiver :** définissez `KEPT_HSTS=off` lorsque d'autres services en http brut partagent le nom d'hôte de Kept, et redémarrez. Kept envoie alors `max-age=0`, donc un navigateur qui a stocké la politique l'oublie lors de sa prochaine visite https de Kept. Ne pas envoyer l'en-tête ne l'effacerait pas.
- **Votre proxy :** s'il ajoute son propre en-tête `Strict-Transport-Security`, désactivez-le aussi là-bas.
- **Domaines préchargés :** sous un domaine de premier niveau de la liste de préchargement HSTS des navigateurs, comme `.dev` ou `.app`, tous les noms sont uniquement en https, quel que soit ce que Kept envoie.

### Effacer manuellement une politique stockée

Lorsque Kept n'est plus joignable en https, `max-age=0` ne peut pas atteindre le navigateur. Effacez le nom d'hôte dans chaque navigateur qui l'a visité :

- **Chrome, Edge et autres navigateurs Chromium :** ouvrez `chrome://net-internals/#hsts` (dans Edge, `edge://net-internals/#hsts`), saisissez le nom d'hôte sous **Supprimer les politiques de sécurité des domaines**, et choisissez **Supprimer**.
- **Firefox :** Historique → Gérer l'historique, trouvez le site, faites un clic droit dessus et choisissez **Oublier ce site**. Cela supprime aussi son historique, ses cookies et ses connexions enregistrées.
- **Safari sur un Mac :** n'a aucune page pour le HSTS. Supprimez les données du site (Réglages → Confidentialité → Gérer les données de sites web, sélectionnez-le, **Retirer**) ; si le http brut se transforme encore en https, effacez aussi l'historique (Historique → Effacer l'historique).
- **Safari sur un iPhone ou un iPad :** Réglages → Apps → Safari (Réglages → Safari avant iOS 18) → Avancé → Données de sites web, trouvez le site et supprimez-le ; si cela ne suffit pas, **Effacer l'historique et les données de sites web** sur la page Safari.
