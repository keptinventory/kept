---
title: Webhooks
description: "POST signés vers votre propre serveur quand les choses changent : les événements, la charge utile, la vérification de la signature, les livraisons et les tentatives, et le secret."
---

Un **webhook** est Kept postant vers une adresse que vous choisissez lorsqu’il se passe quelque chose dans un lieu : un
objet est ajouté, déplacé ou mis à la corbeille, une lecture est enregistrée, un rappel arrive à échéance. Chaque POST est signé,
pour que votre serveur puisse savoir qu’il vient de Kept. Il contient les identifiants et les noms des champs qui
ont changé, jamais leurs valeurs : pour voir l’objet lui-même, votre serveur le récupère depuis
l’[API](/api/) avec son propre jeton.

Les propriétaires et les administrateurs gèrent les webhooks d’un lieu dans **Paramètres du lieu → Webhooks** : **Ajouter
un webhook**, l’adresse et les événements qu’il reçoit. **Paramètres → Connexions** répertorie les webhooks que vous
gérez dans vos lieux.

## Les événements

| Événement | Envoyé quand |
|---|---|
| `thing.created` | Un objet est ajouté |
| `thing.updated` | Un objet est modifié |
| `thing.moved` | Un objet est déplacé |
| `thing.trashed` | Un objet va à la corbeille |
| `thing.restored` | Un objet revient de la corbeille |
| `thing.lifecycle_changed` | L’état d’un objet change, comme perdu ou vendu |
| `reading.logged` | Un relevé de compteur est enregistré |
| `reminder.due` | Un rappel arrive à échéance |

Chaque charge utile contient les mêmes champs :

```json
{
  "id": "evt_…",
  "event": "thing.updated",
  "occurred_at": "2026-10-03T09:12:44.000Z",
  "location_id": "…",
  "entity": { "type": "thing", "id": "…" },
  "changed_fields": ["…"],
  "actor": { "type": "user", "id": "…" }
}
```

`entity.type` vaut `thing`, `reading` ou `reminder` (`webhook` pour un test) ; `changed_fields` nomme
les champs qu’une écriture a modifiés et est vide pour un rappel ; `actor.type` vaut `user`, `token` ou
`system`.

**Envoyer un test** envoie un événement `ping`, une seule fois et sans réessai, et affiche le statut renvoyé par votre serveur :
le moyen le plus rapide de vérifier une nouvelle adresse.

## Vérification de la signature

Chaque livraison comporte un en-tête `Kept-Signature` :

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`t` correspond à l’instant de la signature (secondes Unix). `v1` est un HMAC-SHA256, avec le secret du webhook, de
`<t>.<body>` : l’horodatage, un point, puis le corps exact de la requête. Votre serveur calcule le même
HMAC, le compare à `v1` en temps constant et refuse un `t` trop ancien (plus de cinq minutes,
par exemple). La boîte de dialogue du secret propose un extrait prêt à l’emploi **Vérifier une livraison (Node.js)**.

## Le secret

Le secret de signature n’est affiché qu’une fois, lors de la création du webhook : copiez-le alors. Kept le garde scellé pour signer
et ne l’affiche plus jamais. Vous l’avez perdu ? **Nouveau secret** en crée un autre ; l’actuel cesse aussitôt de fonctionner, si
bien que les livraisons échouent jusqu’à ce que votre serveur dispose du nouveau.

## Livraisons

Les **Livraisons** de chaque webhook répertorient les 30 derniers jours, du plus récent au plus ancien : une ligne par livraison, avec son
état, le statut renvoyé par votre serveur (ou aucun) et le nombre de tentatives effectuées.

- **En attente d’envoi** : en file d’attente.
- **Livrée** : votre serveur a répondu avec un statut 2xx.
- **Échec, nouvelle tentative** : toute autre réponse, aucune réponse dans les 10 secondes ou une redirection (Kept
  ne suit pas les redirections). Kept réessaie.
- **Abandonnée** : 10 tentatives sur environ 24 heures ont toutes échoué.

Au maximum 10 livraisons par seconde partent pour un lieu, afin qu’un pic de changements ne sature pas votre
serveur.

Quand une livraison est abandonnée, le webhook est marqué **En échec depuis** cette date et les administrateurs d’instance reçoivent
une alerte. Il continue d’envoyer ; la livraison suivante qui aboutit efface cette marque.

Un webhook est passé à **Désactivé** lorsqu’un propriétaire ou un administrateur le désactive, ou lorsque la personne qui l’a créé
n’est plus administratrice du lieu. Supprimer un webhook est définitif : Kept cesse de lui envoyer des données et ses livraisons sont
oubliées.

## Votre propre webhook, pour les rappels

Indépendamment des webhooks d’un lieu, **Paramètres → Moi → Notifications** peut ajouter un webhook parmi vos canaux personnels, à côté
de l’e-mail, du push, de ntfy, de Telegram et d’Apprise ([rappels](/fr/users/reminders/)).
Il reçoit un POST par rappel (`reminder.due`) avec les identifiants, le type du rappel, son type de source et sa date d’échéance, l’objet,
l’emplacement ou le lieu concerné, ainsi qu’un lien vers Kept : aucun nom ni aucune valeur.
Il est signé de la même manière, avec un secret affiché une seule fois.

Un envoi échoué est réessayé jusqu’à 10 fois sur environ 24 heures ; si aucun ne passe, le canal est marqué
**En échec depuis** et Kept vous envoie un e-mail une fois. **Tester** en envoie un maintenant. Vous pouvez en avoir jusqu’à cinq.

## Adresses sur votre propre réseau

Kept refuse d’envoyer vers des adresses privées (comme `192.168.x.x`), si bien qu’un webhook ne peut pas viser un routeur ou un autre service
sur le réseau du serveur. Un administrateur d’instance peut les autoriser dans
**Administration → Inscription** (**Autoriser les adresses privées**), pour un récepteur que vous hébergez vous-même, comme Home
Assistant. Le même interrupteur permet à un fournisseur d’IA, à une importation Homebox et à une connexion OIDC d’atteindre ce réseau : activez-le
en sachant qui peut les ajouter. Voir le
[modèle de sécurité](/fr/admin/security-model/#requêtes-sortantes-ssrf).
