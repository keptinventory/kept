---
title: Fournisseurs d’IA
description: Avec quels fournisseurs d’IA Kept fonctionne, où vont les clés, ce que chaque fonctionnalité envoie et coûte, les limites de dépense, les modèles locaux et la désactivation de l’IA.
---

Kept fonctionne sans IA. Connecter un fournisseur ajoute trois choses : nommer les objets à partir des photos et lire les reçus, étiquettes et relevés de compteur ; l'assistant, qui répond à vos questions sur votre inventaire ; et, avec un modèle d'embeddings, la recherche par sens. Vous apportez votre propre clé ; Kept n'a pas de service d'IA propre.

## Fournisseurs

| Fournisseur | Photos et reçus | Assistant | Recherche par sens |
|---|---|---|---|
| **Groq** (recommandé) | oui | oui | aucun modèle d’embeddings |
| **OpenAI** | oui | oui | oui |
| **Anthropic** | oui | oui | aucun modèle d’embeddings |
| **Google** (Gemini) | oui | oui | oui |
| **OpenRouter** | oui | oui | oui (ses modèles d’embeddings) |
| **Compatible OpenAI** (Ollama, LM Studio, …) | les modèles que vous nommez | les modèles que vous nommez | si le serveur en propose un |

**Groq avec `qwen/qwen3.8-27b`** est la recommandation : le résultat fiable le moins cher mesuré par Kept, environ 0,004 USD par reçu (sur des images de test synthétiques, 2026-09-26). Coller une clé Groq le sélectionne, et **Pourquoi ?** sur la page donne les chiffres. Kept suggère un modèle pour chaque fournisseur et tâche ; vous pouvez en choisir un autre dans la liste du fournisseur sous **Avancé**, ou saisir n’importe quel identifiant de modèle.

## Où va la clé

| Clé | Définie dans | Paye pour |
|---|---|---|
| **La clé du compte** | **Paramètres → IA**, par le propriétaire du compte | Chaque lieu dont ce compte est propriétaire |
| **Votre clé personnelle** | **Paramètres → IA → Clé d’IA personnelle** | Votre lieu personnel, vos fils de discussion privés avec l’assistant et les questions qui touchent plusieurs propriétaires. Avec [Personnel caché](/fr/users/locations/#masquer-personnel), aussi un lieu que vous possédez et utilisez seul, lorsque son compte n’a pas de clé |
| **La clé de ce serveur** | **Administration → IA**, par un administrateur d’instance | Toute personne dont le compte n’a pas de clé propre |

Le travail dans un lieu (nommer une photo, une réponse de l’assistant à son sujet) est payé par le **propriétaire du lieu**, donc les membres de la « Family house » d’Alfred utilisent la clé d’Alfred, pas la leur. Les membres et les utilisateurs en lecture seule voient une ligne en lecture seule indiquant qui paye.

**Connexion :** collez la clé dans **Collez votre clé**. Kept reconnaît le fournisseur à partir de la clé quand c’est possible (sinon choisissez-le sous **Avancé**), puis **Enregistrer et tester** vérifie que le modèle lit les photos et donne des réponses structurées, et indique le coût du test. Les clés sont en écriture seule : Kept ne montre jamais une clé enregistrée à nouveau, et **Remplacer la clé** la remplace. Avant la première clé sur un serveur, l’administrateur d’instance doit enregistrer le [kit de récupération](/fr/admin/recovery-kit/) : la clé est un secret que Kept doit pouvoir récupérer depuis une sauvegarde.

**Avancé** contient le fournisseur et l’URL de base, le modèle pour chaque tâche (**Modèles**), **l’effort de raisonnement** (faible par défaut), les limites et les prix.

**Modèles :** la liste est celle du fournisseur, demandée chaque fois que le sélecteur s’ouvre (Kept la réutilise pendant dix minutes ; **Actualiser la liste** la redemande). Les modèles `:free` d’OpenRouter y figurent, marqués "free: shared, may be busy" : un pool partagé qui répond souvent "busy". Sous chaque sélecteur, **Identifiant de modèle personnalisé** accepte n’importe quel identifiant, pour tous les fournisseurs, y compris un que la liste n’affiche pas ; **Enregistrer et tester** le vérifie ensuite. Quand le fournisseur ne répond pas à la liste, il ne reste plus qu’à saisir l’identifiant.

## Ce qui utilise l’IA, et ce que cela coûte

Les paramètres d’IA s’ouvrent avec **Ce qui utilise l’IA dans Kept** : une ligne par action (une photo capturée, un reçu, une étiquette, un relevé, une question à l’assistant, une recherche, le test), avec le nombre d’appels qu’elle fait, les jetons qu’elle prend et le coût tiré du tableau des prix, à partir de votre utilisation des 30 derniers jours une fois qu’il y en a. Sous **Ce mois-ci**, une barre par limite montre le montant dépensé jusqu’ici.

- **Capture** (modes Objet, Reçu, Étiquette, Relevé) : un appel par photo. Les noms, marques, modèles et types sont remplis ; les prix, dates, numéros de série et relevés attendent dans la boîte de réception comme valeurs suggérées pour vous à accepter. Chaque brouillon rempli par l’IA porte une ligne comme "Read by qwen/qwen3.8-27b (Groq), 2,502 tokens", avec son coût et qui a payé.
- **Plusieurs objets sur une photo** (mode Objet ; Administration → Paramètres, désactivé par défaut) : le même appel nomme jusqu’à 12 objets dans la photo. Le premier remplit le brouillon de la capture elle-même et conserve la photo ; chacun des autres devient un brouillon à côté, au même endroit et dans le même lot, avec sa propre image découpée de la photo, à confirmer, fusionner ou écarter dans la boîte de réception. La qualité du découpage dépend des cadres du fournisseur, vérifiez donc quelques brouillons après l’avoir activé.
- **Photos de la pièce** (mode Pièce) : un appel par photo listant jusqu’à 60 objets, et pour plusieurs photos un court appel uniquement texte qui les fusionne. Les objets deviennent des brouillons dans la pièce, chacun avec sa propre image ([Photos de la pièce](/fr/users/room-photos/)).
- **Plans d’étage** (**Partir d’un plan d’étage** de la carte du lieu) : un appel par plan, lisant ses pièces, leurs étiquettes et tailles imprimées ; Kept calcule les tailles et se place lui-même, et vous les vérifiez avant que tout soit ajouté ([la carte du lieu](/fr/users/location-map/#partir-dun-plan-détage)). La feuille indique le maximum qu’une lecture peut prendre avant envoi : environ 11,000 jetons sur Groq, une estimation.
- **L’assistant** répond à partir de votre inventaire selon votre rôle, et chaque outil qu’il utilise ajoute un appel. Les modifications qu’il propose s’affichent sous forme de carte de confirmation que vous approuvez ; pour les utilisateurs en lecture seule, il est en lecture seule.
- **Mots de recherche après une importation** : une importation peut proposer **Ajouter des mots de recherche avec l’IA ?**, avec l’estimation des jetons d’abord ([importation](/fr/users/import-export/)).

Les pages **Utilisation de l’IA** listent chaque appel : **Mon utilisation de l’IA** pour tous, l’utilisation d’un lieu pour ses administrateurs et son propriétaire, celle du compte pour son propriétaire, et celle de l’instance sous Administration → IA. Chacune montre les totaux, les jetons par jour empilés par tâche, les ventilations par tâche, personne et lieu lorsqu’elles s’appliquent, et la liste des appels avec **Exporter en CSV**. Un appel enregistre son modèle, ses jetons, son résultat et son coût, jamais l’invite, la photo, la réponse ni la clé.

Les prix viennent du **tableau des prix**, que les administrateurs d’instance modifient dans Administration → IA (avec **Remplir depuis … la liste** pour les fournisseurs qui publient des prix). Le prix du modèle Groq recommandé est rempli pour vous. Un appel sans prix est compté en jetons et s’affiche comme coût inconnu.

## Limites et mise en pause

Rien n’est plafonné par l’argent à moins que quelqu’un ne le choisisse : après la première clé, Kept propose **Définir une limite mensuelle ?** avec un montant suggéré, et **Sans limite**. Sous **Avancé**, **Limites** contient :

- **Montant par mois** (dans une devise que le serveur a activée) et **Jetons par mois**, pour le compte ; un plafond propre au lieu dans celui du compte, défini par le propriétaire ; et une limite par personne.
- La lecture des photos et des reçus dispose d’un budget de 60,000 jetons par minute, 2,000,000 par jour et 20,000,000 par mois par compte payant, sauf modification.
- **Mettre l’IA en pause** arrête tous les appels à la main jusqu’à ce que vous repreniez.

Quand une limite est atteinte, l’IA se met en pause pour cette portée seulement, avec une bannière comme "IA en pause jusqu’au 1er oct., plafond mensuel de Home atteint". **Les captures sont toujours enregistrées ; la dénomination attend**, et elle reprend quand l’IA reprend. Celui qui a défini le plafond obtient **Reprendre maintenant**, pour l’augmenter, le supprimer ou garder la pause. La limite de débit propre à un fournisseur n’est pas une pause : les lignes de progression disent "En attente de Groq, environ 20 s" et poursuivent.

**Une requête d’assistant est maintenue sous la limite par minute du fournisseur** une fois que le fournisseur l’a nommée (niveau gratuit de Groq : 8,000 jetons par minute). Chaque requête embarque les outils concernés par la question : la recherche d’objets et les modifications courantes toujours, et les prêts, les plannings, les garanties, les documents, les véhicules, le stock, l’historique ou les lieux lorsque la question (ou les dernières du fil) les nomme, dans n’importe quelle langue de Kept ; un outil demandé par le modèle qui n’avait pas été envoyé est envoyé à l’étape suivante. Une première question avec tous les modules activés représente environ 3,100 jetons avant la réserve pour la réponse. Si une requête est encore trop grosse, Kept envoie moins d’outils, puis demande une réponse plus courte, puis laisse de côté les résultats d’outils les plus anciens parmi ceux qu’il envoie ; le fil les conserve. Une question qui ne peut toujours pas tenir échoue avec "trop grand" : un modèle ou un forfait à limite plus haute y répond.

## Ce qui est envoyé au fournisseur

Le résumé propre à Kept, affiché à côté de chaque fournisseur :

> Seulement une copie de la photo avec les données de lieu et d’appareil photo retirées, jamais l’original. Les consignes fixes et les langues de votre lieu. Pour l’assistant, votre question et l’inventaire qu’il consulte, selon votre rôle. Jamais les champs secrets.

Un plan d’étage envoie le même type de copie (la première page d’un PDF dessinée comme image, avec le texte de cette page) et aucun de vos noms de lieu, de pièce ou d’étage ; le texte propre du plan est envoyé comme données, et rien que Kept conserve de la réponse n’est un nom, une adresse ou un numéro du plan autre que les étiquettes et tailles des pièces.

Sous ce résumé, Kept résume ce que le fournisseur dit faire avec les données de l’API (entraînement, conservation) et renvoie à sa politique. Un serveur que vous exécutez vous-même conserve ce que vous lui laissez conserver.

## Recherche et embeddings

La recherche par mots-clés fonctionne toujours, y compris les mots de recherche que l’IA ajoute aux objets dans chacune des langues du lieu. La recherche par sens a besoin d’un modèle d’embeddings, qui vient de l’un de trois endroits, défini par l’administrateur du serveur avec `KEPT_EMBEDDINGS` ([configuration](/fr/reference/configuration/)) :

- `provider` (par défaut) : le fournisseur du lieu, quand il a un modèle d’embeddings (OpenAI, Google, OpenRouter ou un serveur compatible OpenAI). Choisissez-en un sous **Avancé → Modèles → Recherche** ; OpenRouter n’a pas de valeur par défaut et liste les gratuits. Groq et Anthropic n’en ont aucun, donc avec eux la recherche reste uniquement par mots-clés et le dit. Une clé plus haut dans la chaîne avec un modèle de recherche (celle de ce serveur) couvre un lieu dont la clé propre n’en a pas.
- `local` : un petit modèle dans Kept, sans clé et sans coût par appel. Kept refuse ce réglage sauf si le moteur d’exécution du modèle local est installé.
- `off` : recherche par mots-clés seulement.

Quand une clé a un modèle d’assistant mais pas de modèle de recherche, et que rien plus haut n’en fournit, **Paramètres → IA** affiche **La recherche ne trouve que par nom**, avec l’étape : **Choisir un modèle de recherche**, ou pour Groq et Anthropic **Choisir un autre fournisseur**. Administration → État → Embeddings de recherche compte les lieux qui cherchent par nom seulement, sans les nommer.

Kept demande à OpenAI et Google des vecteurs de 768 nombres. Les autres modèles répondent avec leur propre longueur, qui doit être de 2,000 ou moins : un modèle avec des vecteurs plus longs ne peut pas servir à la recherche. Une requête qui revient avec des vecteurs d’une longueur autre que demandée, ou de deux longueurs, est refusée et rien n’est stocké.

## Modèles locaux avec Ollama

Pour garder tout sur votre propre matériel, exécutez un modèle avec Ollama et ajoutez-le comme fournisseur **Compatible OpenAI** avec son URL de base ; Kept ne remplit rien pour ce type, vous nommez donc les modèles. Une adresse sur votre réseau privé doit d’abord être autorisée par un administrateur d’instance dans Administration → Paramètres. Installation, mémoire et profil Compose : [Ollama](/fr/admin/ollama/).

## Désactiver l’IA

- **Pour un lieu :** **Paramètres du lieu → Ce que vous suivez**, sous **IA dans ce lieu**, désactivez **Capture par IA et assistant**. La capture fonctionne toujours ; les objets attendent dans la boîte de réception pour être nommés.
- **Pour un moment :** **Mettre l’IA en pause**, sous **Avancé**.
- **Sans se connecter du tout :** sans clé à aucun niveau rien n’est envoyé, et l’étape **Connecter un fournisseur d’IA** de la liste de contrôle peut être ignorée.

La page de l’IA n’a pas de bouton pour supprimer une clé enregistrée ; remplacez-la, mettez-la en pause ou désactivez l’IA par lieu.

:::note[ChatGPT ou Claude comme client]
"Connect ChatGPT or Claude" (le préréglage Complete) fonctionne dans l’autre sens : votre application d’IA lit et met à jour Kept via MCP, en utilisant son propre modèle et son abonnement, avec un jeton que vous créez dans **Paramètres → Connexions**. Voir [connecter des applications d’IA](/fr/users/mcp-clients/) et, pour les détails, [MCP](/fr/developers/mcp/).
:::
