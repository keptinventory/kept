---
title: IA locale avec Ollama
description: Exécutez le modèle d'IA sur votre propre machine avec le profil Ollama dans compose.full.yaml, et ce que cela coûte en mémoire.
sidebar:
  order: 10
---

Les fonctionnalités d'IA de Kept (remplir des champs à partir de photos et de reçus, l'assistant, la recherche sémantique)
fonctionnent avec le fournisseur que le propriétaire d'un lieu connecte dans **Paramètres → IA**. Ollama exécute le modèle
sur votre propre matériel, donc rien n'en sort ; Kept s'y adresse comme à un fournisseur **Compatible OpenAI**.

:::caution[Non testé]
Ollama n'a pas été mesuré avec Kept. Un modèle partage la mémoire de la machine avec Kept, donc prévoyez
plus que les [1 Go sur lesquels Kept est testé](/fr/install/hardware/), et attendez-vous à ce qu'un petit modèle soit plus lent
et moins précis qu'un modèle hébergé pour lire les reçus.
:::

## Mise en place

1. Ollama est fourni avec `compose.full.yaml`, et non `compose.yaml` : téléchargez-le et définissez
   `COMPOSE_FILE=compose.full.yaml` dans `.env` ([Caddy et Ollama](/fr/install/compose/#caddy-et-ollama)).
   Démarrez Kept avec le profil `ollama`, puis téléchargez-y un modèle avec la commande propre à Ollama :

   ```sh
   docker compose --profile ollama up -d
   docker compose exec ollama ollama pull <model>
   ```

   Les modèles se trouvent dans le volume `ollama`. Rien n'est publié sur l'hôte : seul Kept, sur
   le réseau Compose, atteint Ollama. L'image fait environ 3.8 Go (amd64) ou 2.8 Go (arm64) avant
   tout modèle.

2. **Autoriser les adresses privées.** `http://ollama:11434` se trouve sur le propre réseau de Compose, une adresse
   privée, et Kept les refuse par défaut ([requêtes sortantes](/fr/admin/security-model/#requêtes-sortantes-ssrf)).
   Un administrateur d'instance active d'abord **Administration → Paramètres → Autoriser les adresses privées** ; sans cela,
   ajouter le fournisseur affiche "Cette adresse se trouve sur un réseau privé". Cela vaut aussi pour un Ollama
   (ou LM Studio) ailleurs sur votre réseau domestique.

3. Dans **Paramètres → IA**, ajoutez un fournisseur **Compatible OpenAI** avec l'URL de base
   `http://ollama:11434/v1` et le modèle que vous avez téléchargé. Ollama ignore la clé d'API, donc n'importe quelle valeur
   fonctionne.
