---
title: Installer sur Proxmox VE
description: Une commande dans le shell de l’hôte Proxmox VE crée un conteneur Debian 13 non privilégié avec Kept dedans, sans Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Pas encore testé sur un vrai hôte Proxmox VE]
Les scripts sont vérifiés à chaque changement : shellcheck, puis l’installation, une mise à jour et
un retour arrière sur un Debian 13 neuf avec systemd, et le script de l’hôte face à des substituts
des outils de Proxmox. Ils n’ont pas encore tourné sur un vrai hôte Proxmox VE. Écrits pour
Proxmox VE 8 et 9 sur amd64 ; les hôtes arm64 ne sont pas testés. Traitez une première
installation comme un essai.
:::

Kept tourne dans son propre conteneur Debian 13 non privilégié, sans Docker, comme Proxmox le
conseille : PostgreSQL, Node et Kept sous systemd. Les sauvegardes de Proxmox le couvrent, et rien
d’autre ne change sur l’hôte.

## Installer

Dans le shell de l’hôte Proxmox VE, en root :

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default :** ne demande que la confirmation, avec les réglages ci-dessous.
- **Advanced :** demande chaque réglage : l’ID, le nom, le CPU, la mémoire, le disque, le stockage,
  le bridge, une adresse fixe avec sa passerelle, un VLAN, le DNS, une clé SSH, un mot de passe
  root, le fuseau horaire.
- **La confirmation** affiche chaque réglage et la commande `pct create` exacte avant que rien ne
  soit créé.

Il vérifie d’abord l’hôte (root, Proxmox VE 8 ou 9, le bridge, un stockage avec de la place, le
DNS), télécharge le modèle Debian 13 s’il manque, crée le conteneur, y installe Kept et affiche
l’adresse. Si quelque chose échoue, il dit quoi et supprime le conteneur inachevé.

### Le lire d’abord

Téléchargez le script et le `SHA256SUMS` de la version, vérifiez, lisez, puis lancez-le :

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` contient le SHA-256 de `kept.sh`, de `kept-install.sh` (ce qui tourne dans le
conteneur) et des archives de la version. Il est signé avec la clé de publication : `kept.sh` et
`kept-install.sh` vérifient cette signature avec openssl avant d’utiliser quoi que ce soit de la
version. Pour la vérifier vous-même, téléchargez `SHA256SUMS.sigstore.json` de la même version et
voyez [vérifier une version](/fr/admin/verify-release/) :

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## Ce qu’il crée

- **Le conteneur :** Debian 13 non privilégié, `nesting=1` (le systemd de Debian 13 en a besoin),
  démarré avec l’hôte, étiqueté `kept`.
- **Dedans :** PostgreSQL 18 avec pgvector (du dépôt de PostgreSQL), Node 24 (de nodejs.org),
  restic et l’archive de Kept, chacun épinglé et vérifié.
- **Services :** `kept-bootstrap` (la base et ses connexions, à chaque démarrage) et `kept` (les
  migrations, puis Kept sur le port 8080 sous l’utilisateur `kept`).
- **Fichiers :** Kept dans `/opt/kept`, ses réglages dans `/etc/kept/kept.env`, ses clés dans
  `/etc/kept/config`, photos et documents dans `/var/lib/kept`, l’adresse et le code de
  configuration dans `/root/kept.creds`.

Pas de télémétrie, pas de minuteurs, pas de mises à jour automatiques, aucun changement sur l’hôte
en dehors du conteneur.

## Valeurs par défaut

| Réglage | Par défaut | À prérégler avec |
|---|---|---|
| CPU | 2 cœurs | `var_cpu` |
| Mémoire | 2048 Mo, swap 512 Mo | `var_ram`, `var_swap` |
| Disque | 8 Go | `var_disk` |
| Stockage | le premier qui accueille des conteneurs | `var_storage` |
| Réseau | DHCP sur `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, nom | le prochain ID libre, `kept` | `var_ctid`, `var_hostname` |
| Fuseau horaire | celui de l’hôte | `var_timezone` |
| Clé SSH | aucune | `var_ssh_key` (un fichier de clé publique sur l’hôte) |

Kept a été testé avec 1 Go ([ce qu’il lui faut](/fr/install/hardware/)) ; 2 Go laissent de la place
aux imports et aux sauvegardes. Les photos prennent l’essentiel du disque.

Chaque valeur peut être préréglée, et `var_unattended=yes` le lance sans questions :

```sh
var_unattended=yes var_ram=4096 var_ip=192.0.2.50/24 var_gateway=192.0.2.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## Premier lancement

1. Ouvrez l’adresse affichée, `http://<address>:8080`. Kept affiche
   **Saisissez le code de configuration**.
2. Le code est dans le conteneur : `pct exec <CTID> -- cat /root/kept.creds`. Saisissez-le, puis
   **Créer le premier compte** : il devient l’admin de l’instance.
3. Gardez les clés ailleurs que sur ce serveur : `pct exec <CTID> -- kept admin recovery-kit`
   affiche le kit de récupération.

Les étiquettes imprimées portent l’adresse. Donnez au conteneur une adresse fixe (une réservation
DHCP dans votre routeur, ou `var_ip`) avant d’en imprimer. Pour la changer plus tard, réglez
`KEPT_PUBLIC_URL` dans `/etc/kept/kept.env`, puis `systemctl restart kept`. HTTPS :
[derrière un proxy inverse](/fr/install/reverse-proxy/).

## Mettre à jour

Dans la console du conteneur (`pct enter <CTID>`, ou **Console** du conteneur dans l’interface
web) :

```sh
update
```

`update` nomme la version en cours et la plus récente et demande d’abord. Il affiche la commande
de sauvegarde à lancer sur l’hôte avant votre réponse. Puis il télécharge la nouvelle version et la
vérifie avec le `SHA256SUMS` signé de la version, arrête Kept, passe à la nouvelle version à côté
de l’ancienne et la démarre (les migrations passent d’abord). Si Kept ne répond pas à `/readyz`
avec la nouvelle version, il revient en arrière et redémarre la précédente. `update 1.15.0`
installe une version donnée. Les versions plus anciennes demandent `KEPT_ALLOW_DOWNGRADE=1`, pour
une restauration ([revenir d’une version](/fr/admin/upgrades/)). Rien ne se met à jour tout seul.

Les mises à jour de Debian lui-même sont `apt update && apt upgrade` dans le conteneur, comme sur
tout Debian.

## Sauvegardes

Tout est sur le disque du conteneur, donc une sauvegarde Proxmox contient Kept en entier : ajoutez
le conteneur à une tâche de sauvegarde (**Datacenter → Backup**) en mode snapshot, ou une fois :

```sh
vzdump <CTID> --mode snapshot
```

Le mode snapshot demande un stockage qui fait des snapshots (LVM-thin, ZFS, Ceph) ; sur un autre
stockage, utilisez `--mode stop`. Restaurez avec **Restore** dans l’interface web, ou
`pct restore`.

Pour une seconde copie hors de la machine, activez les sauvegardes nocturnes de Kept
([sauvegardes](/fr/admin/backups/)). Elles tournent en tant que propriétaire de la base, donc
donnez d’abord cette connexion à Kept, dans le conteneur :

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

Les cibles S3 et SFTP fonctionnent telles quelles. Un dossier comme cible doit être accessible en
écriture au service : ajoutez-le avec `systemctl edit kept` (`[Service]` puis
`ReadWritePaths=/votre/dossier/de/sauvegarde`), appartenant à l’utilisateur `kept`.

## Supprimer

Cela supprime le conteneur et tout ce qu’il contient, données de Kept comprises. Sauvegardez
d’abord si vous pourriez en avoir besoin :

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## Quelque chose ne marche pas ?

- **L’installation s’est arrêtée :** le script a nommé l’étape et supprimé le conteneur. Relancez-le
  avec `var_keep_failed=yes` pour garder le conteneur, puis `pct enter <CTID>` et
  `journalctl -u kept`.
- **Kept ne démarre pas :** `journalctl -u kept-bootstrap -u kept` dans le conteneur nomme le
  problème, comme `kept: invalid environment:` pour un réglage de `/etc/kept/kept.env`.
- **La console reste noire :** Debian 13 a besoin de `nesting=1`, que le script règle ; un
  conteneur créé à la main sans lui montre cela.
