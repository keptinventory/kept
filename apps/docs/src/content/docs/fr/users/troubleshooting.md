---
title: Problèmes courants
description: "Se connecter, la synchronisation, l'appareil photo, les étiquettes, l'IA et l'utilisation hors ligne : ce que vous voyez et ce qu'il faut faire."
---

Problèmes que vous pourriez rencontrer en utilisant Kept. Pour les problèmes liés au serveur, voir
[Troubleshooting](/fr/admin/troubleshooting/).

## Connexion

### J'ai oublié mon mot de passe

Sur la page de connexion, saisissez votre adresse e-mail et choisissez **Mot de passe oublié ?**. Kept vous envoie un
lien pour définir un nouveau mot de passe ; il fonctionne une seule fois, pendant une heure. Rien n'est arrivé : vérifiez les spams, ou demandez à la
personne qui gère votre Kept si l'e-mail est configuré. Sans e-mail, un administrateur de l'instance peut émettre un
lien de réinitialisation à usage unique sur le serveur avec `kept admin reset-password` ([la CLI](/fr/admin/cli/)).

Un compte géré (un nom d'utilisateur, pas d'e-mail) reçoit à la place un nouveau code à usage unique, de la part de celui qui a créé le
compte ou du propriétaire du lieu ([personnes sans e-mail](/fr/users/first-run/#personnes-sans-e-mail)).

### Un lien de connexion ne fonctionne pas

Un lien provenant de **M’envoyer un lien de connexion** fonctionne une seule fois, pendant 15 minutes : demandez-en un nouveau. Un lien
envoyé avant la mise à niveau de votre Kept vers 1.14.0 ne fonctionne plus du tout, pas plus qu'une connexion Google ou OIDC
commencée avant ([mises à niveau](/fr/admin/upgrades/#liens-de-connexion-1140)).

### Ma clé d'accès ne fonctionne pas

- **Les clés d'accès nécessitent HTTPS.** À une adresse simple `http://`, le navigateur n'en propose aucune
  ([Kept sur un réseau domestique](/fr/install/home-network/)).
- **Une clé d'accès se trouve sur l'appareil qui l'a créée**, ou dans votre gestionnaire de mots de passe lorsqu'il est synchronisé. Sur
  un autre appareil, connectez-vous autrement (votre mot de passe ou **M’envoyer un lien de connexion**), puis ajoutez une clé d'accès là-bas dans **Paramètres → Connexion et sécurité**.
- **« Cette clé d'accès n'est pas celle avec laquelle ce compte se connecte »** : le navigateur a proposé autre chose,
  comme le verrouillage d'application d'un appareil, qui ne peut pas vous connecter. Connectez-vous autrement.

Plus d'informations dans [Connexion et sécurité](/fr/users/sign-in-security/).

### J'ai perdu mon téléphone, ou mes codes de secours

Un code de secours est la deuxième étape après votre mot de passe, à la place du code à 6 chiffres de l'application d'authentification. Chacun ne fonctionne qu'une fois.

- **Toujours connecté quelque part :** **Paramètres → Connexion et sécurité**. **Nouveaux codes de secours** en crée
  dix nouveaux (les anciens cessent de fonctionner) ; **Configurer à nouveau** déplace la double authentification vers un nouveau téléphone.
- **Verrouillé dehors, sans codes de secours :** demandez à un administrateur de l'instance. **Réinitialiser la double authentification** sous
  **Administrateur de l’instance → Utilisateurs** arrête votre application d'authentification et vos codes de secours, et vous configurez à nouveau la double authentification à votre prochaine connexion.

### « Votre compte sera supprimé le … »

Vous avez demandé la suppression du compte, et cela attend 30 jours ; jusque-là, rien d'autre dans Kept ne s'ouvre. **Garder mon compte** arrête la suppression et ramène le compte tel qu'il était. Voir
[la FAQ](/fr/users/faq/#comment-supprimer-mon-compte-).

## Synchronisation

### Les captures de mon téléphone ne s'affichent pas

Une capture est d'abord enregistrée sur le téléphone et envoyée lors de la synchronisation du téléphone.

- **Sur iPhone, la file d'attente n'avance que pendant que Kept est ouvert.** La ligne sous l'en-tête indique **Ouvrir pour
  terminer la synchronisation** avec un compteur : laissez Kept à l'écran un moment en étant en ligne.
- **Sans nom**, une capture attend dans la **Réception**. **Photos à vérifier** sur l'accueil les affiche.

### La recherche affiche « Sur ce téléphone, selon la dernière synchronisation »

La réponse vient de la copie propre du téléphone, parce que vous êtes hors ligne. Reconnectez-vous, puis tirez vers le bas pour actualiser.

### Une modification faite hors ligne ne s'est pas appliquée

Si quelqu'un d'autre a mis à la corbeille, déplacé ou retiré un objet pendant que vous étiez hors ligne, votre modification de cet objet est abandonnée et la ligne l'indique, avec **Restaurer** pour réessayer. Les autres modifications qui demandent une décision vont dans la **Réception**. Voir [la synchronisation, telle que vous la voyez](/fr/users/phone-app/#la-synchronisation-comme-vous-la-voyez).

### La synchronisation semble bloquée

- Tirez vers le bas pour actualiser, ou fermez Kept et rouvrez-le.
- **Mettre à jour Kept pour terminer la synchronisation** : le serveur est plus récent que l'application. Rechargez ; la file d'attente est conservée.
- Toujours bloqué : **Paramètres → Diagnostic** vérifie la prise en charge hors ligne et le stockage et copie un rapport. Envoyez-le à la personne qui gère votre Kept.

## Appareil photo et capture

### L'appareil photo ne s'ouvre pas

Les téléphones n'autorisent l'appareil photo qu'à une adresse HTTPS. En simple `http://`, Capture se rabat sur le choix de fichiers. Installer Kept, travailler hors ligne et les notifications push nécessitent aussi HTTPS. Ce qui fonctionne en HTTP simple, et deux façons d'ajouter HTTPS chez soi : [Kept sur un réseau domestique](/fr/install/home-network/).

En HTTPS et toujours bloqué, Kept indique comment autoriser l'appareil photo dans le navigateur.

### L'IA n'a pas nommé mon objet

Sans IA, les captures attendent dans la Réception un nom : nommez-les là-bas, ou voir [IA](#ia) ci-dessous.

### L'IA l'a mal nommé

Ce que l'IA remplit est une suggestion. Ouvrez l'objet et corrigez le nom, la marque, le modèle ou le type.

## Étiquettes

### Une étiquette ne se scanne pas

Assurez-vous que l'étiquette est plane et bien éclairée, et nettoyez l'objectif de l'appareil photo. **Saisir le code** prend les six caractères imprimés sous le code QR, avec ou sans le tiret. Une étiquette usée se réimprime avec le même code ([Identifiants courts et étiquettes](/fr/users/short-ids/)). Une étiquette sur du ruban étroit d'imprimante d'étiquettes n'a pas de code QR : maintenez **Scanner** sur son identifiant court imprimé, ou saisissez-le ([scanner un code sans code QR](/fr/users/short-ids/#scanner-un-code-sans-qr-code)).

Si **Scanner** affiche **Kept ne peut pas scanner ici** parce que le scanner n'a pas démarré, touchez **Réessayer** : l'appareil photo et le scanner redémarrent, sans fermer l'application.

## IA

### « En attente d'un fournisseur d'IA »

Aucun fournisseur n'est connecté pour ce lieu. Le travail dans un lieu est payé par la clé de son propriétaire, donc le propriétaire en connecte un dans **Paramètres → IA**, ou un administrateur de l'instance en définit un pour le serveur dans **Administration → IA**. Les membres et les spectateurs ne peuvent pas en connecter un pour le lieu de quelqu'un d'autre : la ligne dit de demander à un administrateur. Voir [Fournisseurs d'IA](/fr/users/ai-providers/#où-va-la-clé).

### L'IA est désactivée dans un lieu

Un propriétaire ou un administrateur l'a désactivée : **Paramètres du lieu → Ce que vous suivez**, sous **IA dans ce lieu**, l'interrupteur **Capture IA et l'assistant**. Le réactiver ramène l'IA ici.

### « IA mise en pause »

Une limite mensuelle a été atteinte, ou quelqu'un a choisi **Mettre l'IA en pause**. Les captures s'enregistrent toujours ; le nommage attend et reprend avec l'IA. Celui qui a fixé le plafond obtient **Reprendre maintenant**. Les limites sont sous **Paramètres → IA → Avancé → Limites** ([limites et mise en pause](/fr/users/ai-providers/#limites-et-mise-en-pause)).

### L'IA coûte trop cher

Fixez une limite mensuelle sous **Paramètres → IA → Avancé → Limites**, choisissez un modèle moins cher sous **Avancé → Modèles**, ou faites tourner un modèle local avec [Ollama](/fr/admin/ollama/).

## Hors ligne

### Quelque chose ne fonctionne pas hors ligne

Travailler hors ligne nécessite que Kept soit installé depuis une adresse HTTPS. La navigation, la recherche et la capture fonctionnent sans connexion ; la modification des détails, l'assistant, les rapports, la carte, le graphique et tout ce qui implique de l'argent en ont besoin. La liste complète : [ce qui fonctionne hors ligne](/fr/users/phone-app/#ce-qui-fonctionne-hors-ligne).

## Obtenir de l'aide

- **Questions et idées :** [Discussions](https://github.com/keptinventory/kept/discussions)
- **Un bug :** [un ticket](https://github.com/keptinventory/kept/issues/new/choose), avec ce que vous avez fait et ce que vous avez vu
- **Aide sur Discord :** [le serveur Kept](https://discord.gg/g4WCXPfuNv), dans #help : un problème par message, votre version de Kept et comment vous l'exécutez (Docker Compose, Kubernetes), ce qui s'est passé, et les journaux avec les secrets et les détails personnels floutés
- **Un problème de sécurité :** en privé, jamais dans un ticket public ([SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md))
