---
title: Ce dont il a besoin
description: Ce sur quoi Kept a été testé, la mémoire qu'il a utilisée et ce qui le pousse à en avoir besoin de plus.
sidebar:
  order: 6
---

**Testé : 1 Go de RAM, un ou deux cœurs de CPU**, avec un fournisseur d'IA externe ou aucun. Tout
a réussi là-bas, y compris une sauvegarde pendant le téléchargement des photos. 2 Go laisse de la place en réserve.

## Ce qui a été testé

- **Version :** modifications de Kept 1.14.3 (une version avant la sortie), `compose.yaml` tel que publié
  (Kept, Postgres 18 avec pgvector). 1.14.2 avait besoin de 2 Go pour sa sauvegarde.
- **Machine :** émulée dans Docker sur un Mac arm64. Docker, Kept et Postgres partagent un même budget de mémoire et
  de CPU, comme sur une petite VM, avec 128 Mo réservés au système d'exploitation. Pas de swap.
- **Données :** un foyer, plus un emplacement avec 3 000 objets dans 206 lieux et 200 conteneurs, ainsi que
  300 vraies photos.
- **Travail :** 20 photos de 12 mégapixels, deux PDFs, 120 chargements de la carte et du graphe de cet emplacement, 120
  lectures de listes et de recherches, `kept admin backup` pendant le téléchargement des photos, la sauvegarde planifiée, puis
  10 minutes d'inactivité.

| Machine | Photos, carte, recherche, PDFs | Sauvegarde pendant les téléchargements | Sauvegarde planifiée | Pic |
|---|---|---|---|---|
| 1 Go, 2 cœurs (3 exécutions) | réussi | réussi | réussi | 730–745 Mo |
| 1 Go, 1 cœur | réussi | réussi | réussi | 740 Mo |
| 768 Mo, 1 cœur | réussi jusqu'à épuisement de la mémoire lors de la sauvegarde ; 9 téléchargements et les deux PDFs ont échoué alors que Kept redémarrait | épuisement de la mémoire | réussi en soi (une exécution) | — |

Les pics représentent la mémoire qui ne peut pas être restituée (cache de page non comptabilisé), pour l'ensemble de la machine, Docker inclus. En cas d'épuisement de la mémoire, le système tue le processus de Kept et Docker le redémarre.

- **Au repos :** après un démarrage, Kept utilise environ 160 Mo et Postgres entre 30 et 70 Mo. Une fois les photos redimensionnées, Kept reste autour de 300 Mo.
- **Données réelles :** sur un serveur domestique amd64, Kept utilise 206 Mo et Postgres 119 Mo (une lecture).
- **Vitesse** (médianes) : une page de liste 30–40 ms, une recherche 50–70 ms, un téléchargement de photo 0,3–0,4 s, la carte de l'emplacement de 3 000 objets 0,4–0,5 s.
- **Non testé encore :** une vraie VM, amd64 à ces tailles, 512 Mo, IA locale. Les tests de performance se poursuivent : [#379](https://github.com/keptinventory/kept/issues/379).

## Ce que cela signifie

- **1 Go, 1 ou 2 cœurs :** testé, chaque exécution réussie, avec environ 150 Mo de marge au pic.
- **2 Go :** marge disponible, pour d'autres services en plus de Kept.
- **768 Mo :** Kept a fonctionné, et donc aussi Sauvegarder maintenant (le chemin de la sauvegarde planifiée) ; `kept admin backup` pendant le téléchargement des photos a épuisé la mémoire. Non recommandé.

## Raspberry Pi

Non testé sur un. L'image arm64 est celle utilisée pour ces tests, donc un Pi avec 1 Go ou plus pourrait convenir comme les lignes de 1 Go ; attendez-vous à ce qu'il soit plus lent. Aucune version n'a été testée sur un Pi.

## Ce qui est lourd

- **Sauvegardes.** `kept admin backup` ajoute environ 300–400 Mo pendant son exécution, la sauvegarde planifiée environ 150 Mo ; restic représente lui-même environ 100 Mo de cela. Non présent dans
  [l'application Home Assistant](/fr/install/home-assistant/) : les sauvegardes de Home Assistant sont utilisées à la place.
- **Redimensionnement des photos.** Chaque téléchargement est redimensionné à son arrivée. Avec moins de 3 Go de RAM, ou une limite de conteneur inférieure à 3 Go, Kept redimensionne une photo à la fois, sinon deux (`KEPT_IMAGE_CONCURRENCY` le remplace). La mémoire augmente d'environ 150 Mo au cours des premières photos et reste à ce niveau.
- **La carte et le graphe d'un emplacement très volumineux.** Le serveur lit l'intégralité de l'emplacement pour chaque chargement : environ 670 Ko pour 3 000 objets.
- **Pas sur le serveur :** la carte, le graphe et la grille sont dessinés par votre navigateur et ajoutent aucune mémoire serveur au repos ; la carte et le graphe sont téléchargés uniquement lorsqu'ils sont ouverts.
- **IA locale avec Ollama.** Un modèle sur la même machine partage sa mémoire avec Kept et nécessite bien plus que Kept ne fait ; voir [Ollama](/fr/admin/ollama/).
- **Disque.** La base de données est petite ; ce sont les fichiers qui augmentent. Laissez de la place pour les sauvegardes sur un autre disque, et Administration → État avertit, et les administrateurs sont alertés, lorsque le disque dépasse 85 % plein.

## Postgres

Kept a besoin de PostgreSQL 18 avec pgvector. Compose exécute l'image `pgvector/pgvector`, épinglée par
résumé ; pour une base de données auprès d'un fournisseur, voir [Postgres géré](/fr/install/managed-postgres/).
