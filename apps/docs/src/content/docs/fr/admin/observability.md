---
title: Surveillance
description: Vérifications de santé, la page d'état, les alertes, les métriques, les journaux, et le suivi et le rapport d'erreurs optionnels.
sidebar:
  order: 12
---

Kept n'envoie rien de lui-même nulle part sauf si vous le configurez : **aucune télémétrie de quelque type que ce soit**, pas
même le comptage d'installations en option.

## Vérifications de santé

| Chemin | Réponses |
|---|---|
| `/healthz` | 200 tant que le processus sert du HTTP. Pour une sonde de vivacité. |
| `/readyz` | 200 lorsque les deux connexions de base de données du web répondent, sinon 503. Pour la préparation, et le `HEALTHCHECK` propre à l'image. |
| `/version` | la version, le commit à partir duquel il a été construit, le dépôt source, et l'emplacement des avis de tiers (`/notices.txt`, dans l'image). |

Un conteneur exécutant uniquement le travailleur (`KEPT_ROLE=worker`) ne sert pas de HTTP. Le
`HEALTHCHECK` de l'image suit `KEPT_ROLE` : pour le travailleur, il vérifie que la boucle de
tâches a sondé la base de données dans les deux dernières minutes (il touche `/tmp/kept-worker-alive`
en passant), donc un déploiement séparé n'a pas besoin de remplacer le contrôle de santé.

## La page d'état et les alertes

**Administration → Statut** montre ce qui nécessite une attention : le kit de récupération, le courrier, les tâches
d'arrière-plan échouées, l'analyse des rappels, et les sauvegardes : l'âge de la sauvegarde, le dernier
exercice de restauration, la gestion des versions du compartiment, l'espace disque, la version et ses
migrations, la vérification de mise à jour, HTTPS et les connecteurs. Les alertes d'administration
atteignent les administrateurs de l'instance dans l'application, par courrier et par notification
push ; chacune est résolue lorsque sa cause disparaît.

## Métriques

Définissez `KEPT_METRICS_TOKEN` et `/metrics` sert du texte Prometheus aux requêtes qui l'envoient en tant que jeton
porteur (`Authorization: Bearer <token>`); sans cette variable, le chemin n'existe pas. Compose transmet la
variable depuis `.env`.

| Métrique | Quoi |
|---|---|
| `kept_build_info{version, revision}` | toujours 1 ; la build en cours |
| `kept_process_uptime_seconds` | secondes depuis le démarrage du processus |
| `kept_process_resident_memory_bytes` | la mémoire du processus |
| `kept_db_pool_connections{pool, state}` | connexions par pool de base de données : total, inactif, en attente |
| `kept_backup_last_success_timestamp_seconds` | quand la dernière bonne sauvegarde s'est terminée (0 avant la première) |
| `kept_backup_last_run_status{status}` | 1 pour l'état de la dernière exécution terminée, 0 pour les autres |
| `kept_disk_used_ratio{volume}` | quel est le taux d'utilisation du disque de données et d'un répertoire cible de sauvegarde |
| `kept_update_available` | 1 quand la vérification de mise à jour a détecté une version plus récente |

Aucun libellé ne contient jamais un chemin ou une cible. Une base de données qui ne peut pas répondre
omet les lignes de sauvegarde, de disque et de mise à jour ; la collecte réussit néanmoins.

## Journaux

Lignes JSON en sortie standard (`KEPT_LOG_FORMAT=json`, par défaut), ou `pretty` pour lire
`docker compose logs` à l'œil ; `KEPT_LOG_LEVEL` définit le niveau. Chaque requête possède un identifiant,
renvoyé dans l'en-tête de réponse `x-request-id`, permettant de faire correspondre un rapport à sa ligne de
journal. Les jetons dans les URL sont expurgés du journal, et les secrets et mots de passe ne sont jamais
journalisés.

## Suivi et rapport d'erreurs

Les deux sont facultatifs et désactivés par défaut.

- **Suivi :** avec `OTEL_EXPORTER_OTLP_ENDPOINT` défini, Kept envoie les traces OpenTelemetry de ses
requêtes HTTP et de ses requêtes de base de données à votre collecteur. Non défini, aucun des codes de
suivi n'est même chargé, et un collecteur qui est indisponible ne ralentit jamais une requête.
- **Rapport d'erreurs :** avec un DSN compatible Sentry dans `KEPT_ERROR_DSN`, les erreurs non gérées sont
signalées avec l'identifiant de la requête et la route, et jamais le corps de la requête, l'en-tête,
la chaîne de requête, le nom ou quoi que ce soit stocké quelque part.
