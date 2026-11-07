---
title: Courriel, push et le flux calendrier
description: Configurer l'envoi de courriel et le web push pour un serveur Kept, et ce que les opérateurs doivent savoir sur les liens calendrier privés que les personnes créent.
---

Kept contacte les personnes en dehors de l'application par **courriel**, **web push** vers un navigateur ou l'application installée, **ntfy**, **Telegram** et **Apprise**, et un **flux calendrier** auquel leur application calendrier s'abonne. Tout arrive aussi au centre de notifications de l'application, qui ne nécessite aucune configuration. Les personnes choisissent ce qui les atteint dans **Paramètres → Notifications** (Rappels et alertes → **Ouvrir**). Cette page est le côté opérateur. Toutes les variables sont listées dans la [référence de configuration](/fr/reference/configuration/).

## Courriel

| Variable | Ce que ça fait |
|---|---|
| `KEPT_SMTP_URL` | Le serveur SMTP, sous forme `smtp://` ou `smtps://`, avec identifiants si nécessaire : `smtps://user:password@mail.example.org:465`. |
| `KEPT_SMTP_FROM` | L'expéditeur de chaque courriel. Valeur par défaut : `Kept <no-reply@<your KEPT_PUBLIC_URL host>>`. La plupart des fournisseurs n'envoient qu'à partir d'une adresse qu'ils ont vérifiée, donc définissez-la. |

Avec Compose, mettez les deux dans `.env` ; `compose.yaml` les transmet à `kept` et `migrate`. Avec le chart Helm, `smtp.existingSecret` nomme un Secret contenant `KEPT_SMTP_URL`, et `smtp.from` définit l'expéditeur. Kept ouvre une connexion par courriel ; les options d'URL propres à nodemailer (comme `?pool=true`) passent à travers l'URL.

### Si KEPT_SMTP_URL n'est pas défini

Le courriel n'est consigné qu'en tant qu'échu : un avertissement par courriel, `mail not sent: no mail transport is configured`, nommant le type de courriel et jamais l'adresse, le lien ni le jeton. **Administration → Statut** affiche **Courriel : Non configuré** et l'avis **La messagerie n'est pas configurée**. Sans courriel, il n'y a pas de liens de connexion, de réinitialisations de mot de passe, d'invitations par courriel, d'alertes par courriel ni de rapports par courriel. Les invitations par lien et les mots de passe fonctionnent sans, et les rappels atteignent toujours les personnes par push et dans l'application. **Me l’envoyer par e-mail** et **Le renvoyer** dans l'inventaire d'impression sont verrouillés, et les propriétaires et administrateurs obtiennent un lien **Configurer l'e-mail** vers cette page ; l'API refuse `email: true` et les planifications de rapport avec une erreur 409 `mail_not_configured`.

Quand le courriel est configuré, un compte dont l'adresse n'est pas vérifiée ne peut pas ajouter de clé d'accès ni d'application d'authentification avant de l'être.

### Ce que Kept envoie

Chaque courriel part en texte et en HTML dans la langue du destinataire (anglais lorsque Kept ne la connaît pas). Les liens portent leur jeton après `#`, de sorte qu'un scanner de courriel ou un journal serveur ne détient jamais un lien utilisable.

- **Connexion et compte** : liens de connexion, réinitialisations de mot de passe, confirmation et vérification d'une nouvelle adresse courriel et une note à l'ancienne, une note lorsqu'une personne tente de s'inscrire avec une adresse qui possède déjà un compte, et un avis lorsqu'un identifiant change : le mot de passe, une clé d'accès ajoutée ou supprimée, une connexion externe dissociée, la double authentification activée, reconfigurée ou désactivée, et de nouveaux codes de secours.
- **Personnes et lieux** : invitations par courriel ; au propriétaire d'un lieu, chaque nouveau membre ou compte géré et chaque appartenance arrivant à sa date de fin.
- **Transparence** : lorsqu'un administrateur d'instance (ou `kept admin`) agit sur le compte d'une personne ; et à chaque utilisateur actif lorsque la connexion OIDC de l'instance, son courriel sortant ou son fournisseur d'IA par défaut change.
- **Rappels** : un élément en retard immédiatement, le résumé quotidien, un test de canal, et une note lorsqu'un webhook propre à une personne continue d'échouer.
- **IA** : un plafond mensuel atteignant 80 % ou 100 %, et le résumé mensuel d'IA optionnel.
- **Aux administrateurs d'instance** : alertes d'administration, au plus une fois par jour par alerte ([la page de statut et les alertes](/fr/admin/observability/#la-page-détat-et-les-alertes)).

### Changer le serveur de courriel

Kept compare le serveur SMTP et l'expéditeur avec ce qu'il a vu la dernière fois à chaque démarrage, jamais le mot de passe. Si l'un ou l'autre a changé, le changement est audité et chaque utilisateur actif en est informé, par la nouvelle route. Le premier démarrage avec le courriel configuré ne fait qu'enregistrer.

## Web push

Le push n'a besoin d'**aucune clé de votre part**. Au premier démarrage, Kept génère une paire de clés VAPID et la conserve dans la base de données, la clé privée scellée avec `KEPT_SECRET_KEY`. Pour utiliser votre propre paire, définissez les deux :

| Variable | Ce que ça fait |
|---|---|
| `KEPT_VAPID_PUBLIC_KEY` | La clé publique : base64url sans remplissage de 65 octets, tel que l'écrit `generateVAPIDKeys()` de web-push. |
| `KEPT_VAPID_PRIVATE_KEY` | Sa moitié privée (32 octets, même encodage). Jamais consignée. Définir l'une sans l'autre arrête Kept au démarrage. |
| `KEPT_VAPID_SUBJECT` | Qui les services de push peuvent contacter : une URL `https:` ou une adresse `mailto:`. Valeur par défaut : `KEPT_PUBLIC_URL` lorsqu'il est en `https`, sinon `mailto:` l'adresse `KEPT_SMTP_FROM`. |

Le push est **indisponible** quand :

- `KEPT_PUBLIC_URL` est du `http` simple sur autre chose que localhost : les navigateurs ne s'abonnent que sur une page sécurisée. Les personnes voient "Push needs HTTPS." ([HTTPS](/fr/install/https/))
- il n'y a pas de sujet : ni `KEPT_VAPID_SUBJECT`, ni URL publique en `https`, ni `KEPT_SMTP_FROM`. Les personnes voient "Le push n’est pas configuré sur ce serveur."

Le courriel et le centre de notifications fonctionnent malgré tout dans les deux cas.

Les personnes activent le push par appareil avec **Activer** sous **Comment Kept vous prévient**, après la demande du navigateur. **Sur iPhone et iPad, les notifications fonctionnent uniquement depuis l'application installée** : Kept l'indique et propose **Comment installer** ([l'application téléphone](/fr/users/phone-app/)).

Ce qui quitte le serveur : Kept envoie chaque push en HTTPS au service de push auquel le navigateur s'est abonné, donc il a besoin d'accès à internet sortant ; les adresses privées et locales sont refusées. Un push porte un titre, une ligne de texte et un lien, moins de 3 Ko, jamais d'argent ni de coordonnées. Le service de push le conserve jusqu'à un jour pendant qu'un appareil est hors ligne. Un abonnement que le service signale comme disparu est supprimé.

:::caution[Perte de la clé]
Si la clé privée stockée ne peut pas être ouverte, parce que la clé secrète qui l'a scellée a disparu, Kept crée une nouvelle paire et supprime tous les abonnements push. Rien d'autre n'est perdu : les personnes réactivent le push sur chaque appareil. Conservez [la trousse de récupération](/fr/admin/recovery-kit/) et cela n'arrive jamais lors d'une restauration ni d'un [déplacement](/fr/admin/move-server/).
:::

## ntfy et Telegram

Les personnes ajoutent ces canaux elles-mêmes dans Paramètres → Moi → Notifications ; il n'y a rien à configurer sur le serveur. Kept publie vers le point de terminaison JSON d'un serveur ntfy et vers l'API Bot de Telegram (`api.telegram.org`), tous les deux à la fois et sous la même garde que les webhooks : un serveur ntfy sur une adresse privée fonctionne uniquement quand **Autoriser les adresses privées** est activé (Administration → Paramètres), et les redirections sont refusées. Leurs réglages (un sujet et un jeton ntfy, un jeton de bot Telegram) sont chiffrés comme le secret d'un webhook et couverts par la [rotation de clé](/fr/admin/recovery-kit/). Un envoi échoué est réessayé avec le rappel et marque le canal « En échec depuis » ; le prochain envoi qui passe l'efface. Les alertes d'administration ne leur sont pas envoyées.

## Apprise

[Apprise](https://github.com/caronc/apprise) atteint Discord, Slack, Matrix, Signal, Pushover et plus de 100 autres services. Kept communique avec un serveur **Apprise API** que vous exécutez à côté, et propose **Ajouter Apprise** aux personnes uniquement lorsque `KEPT_APPRISE_URL` pointe vers un :

```yaml
# compose.yaml, beside the kept service
  apprise:
    image: caronc/apprise:2.0.0
    restart: unless-stopped

# and in the kept service's environment
KEPT_APPRISE_URL: http://apprise:8000
```

- Chaque personne ajoute ses propres **URL Apprise** (une ou plusieurs, comme `discord://…` ou `mailto://…`). Elles sont chiffrées comme le secret d'un webhook, jamais affichées de nouveau, et couvertes par la [rotation de clé](/fr/admin/recovery-kit/).
- Kept utilise le `POST /notify/` sans état de l'API Apprise et envoie les URL avec chaque message, donc le serveur Apprise ne conserve rien. On l'atteint sur votre réseau privé à dessein, les redirections étant refusées.
- Les URL génériques d'Apprise `json://`, `xml://` et `form://` (et leurs formes en `s`) peuvent pointer vers n'importe quel hôte, y compris des machines de votre réseau, donc Kept les refuse sauf si **Autoriser les adresses privées** est activé (Administration → Paramètres).
- Un envoi échoué (Apprise répond 424 lorsqu'un service a refusé) est réessayé avec le rappel et marque le canal « En échec depuis ». Les alertes d'administration ne vont pas à Apprise.

## Le flux calendrier

Chaque personne peut créer un lien iCal privé de ce qui est dû et de ce qui expire, dans **Paramètres → Notifications → Flux calendrier → Créer un lien**. Il n'y a rien à configurer sur le serveur.

- **Ce qu'il contient** : des événements sur la journée entière, d'un mois en arrière à 13 mois en avant, dans tous les lieux de la personne : titres, chemins de place, noms de lieu et un lien vers Kept. Jamais d'argent, de secrets, de notes ni de coordonnées de qui que ce soit. Uniquement les types que la personne reçoit sur un canal, et rien provenant d'une partie de Kept qu'un lieu a désactivée. Les lieux qui exigent la double authentification sont laissés de côté.
- **Le lien** : `https://kept.example.org/cal/<token>.ics`, affiché une seule fois. Kept ne conserve que le SHA-256 du jeton et le masque dans les journaux de requête. Il est construit à partir de `KEPT_PUBLIC_URL` lors de sa création, donc un lien créé avant un changement d'adresse pointe toujours vers l'ancienne adresse.
- **Qui peut le lire** : quiconque possède le lien, sans connexion. Un lien inconnu ou révoqué, ou appartenant à un compte désactivé, répond 404 sans dire lequel. Chaque lien peut être récupéré 60 fois par minute.
- **Révocation** : **Révoquer** sur le lien y met fin pour de bon ; les calendriers abonnés cessent de se mettre à jour. La liste conserve la ligne révoquée et indique quand chaque lien actif a été récupéré pour la dernière fois. Une personne peut détenir au plus 3 liens actifs.

Google Calendar récupère le lien depuis les serveurs de Google, donc là cela fonctionne uniquement lorsque Kept est accessible depuis internet.
