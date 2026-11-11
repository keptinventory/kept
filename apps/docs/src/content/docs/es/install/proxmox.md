---
title: Instalar en Proxmox VE
description: Un comando en la terminal del host Proxmox VE crea un contenedor Debian 13 sin privilegios con Kept dentro, sin Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Aún sin probar en un host Proxmox VE real]
Los scripts se comprueban en cada cambio: shellcheck, y después la instalación, una actualización y
una vuelta atrás en un Debian 13 limpio con systemd, y el script del host frente a sustitutos de
las herramientas de Proxmox. Todavía no se han ejecutado en un host Proxmox VE real. Escritos para
Proxmox VE 8 y 9 en amd64; los hosts arm64 están sin probar. Trata la primera instalación como una
prueba.
:::

Kept se ejecuta en su propio contenedor Debian 13 sin privilegios, sin Docker, como aconseja
Proxmox: PostgreSQL, Node y Kept bajo systemd. Las copias de seguridad de Proxmox lo cubren, y nada
más cambia en el host.

## Instalar

En la terminal del host Proxmox VE, como root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default:** solo pide la confirmación, con los ajustes de abajo.
- **Advanced:** pide cada ajuste: el ID, el nombre, la CPU, la memoria, el disco, el almacenamiento,
  el bridge, una dirección fija con su puerta de enlace, una VLAN, el DNS, una clave SSH, una
  contraseña de root, la zona horaria.
- **La confirmación** muestra cada ajuste y el comando `pct create` exacto antes de crear nada.

Primero comprueba el host (root, Proxmox VE 8 o 9, el bridge, un almacenamiento con espacio, el
DNS), descarga la plantilla de Debian 13 si falta, crea el contenedor, instala Kept dentro y muestra
la dirección. Si algo falla, dice qué y elimina el contenedor a medio hacer.

### Leerlo antes

Descarga el script y el `SHA256SUMS` de la versión, comprueba, lee y después ejecútalo:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` contiene el SHA-256 de `kept.sh`, de `kept-install.sh` (lo que se ejecuta dentro del
contenedor) y de los archivos de la versión. Está firmado con la clave de las versiones: `kept.sh` y
`kept-install.sh` comprueban esa firma con openssl antes de usar nada de la versión. Para
comprobarla tú, descarga `SHA256SUMS.sigstore.json` de la misma versión y consulta
[verificar una versión](/es/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## Qué crea

- **El contenedor:** Debian 13 sin privilegios, `nesting=1` (el systemd de Debian 13 lo necesita),
  arranca con el host, etiquetado `kept`.
- **Dentro:** PostgreSQL 18 con pgvector (del repositorio de PostgreSQL), Node 24 (de nodejs.org),
  restic y el archivo de la versión de Kept, cada uno fijado y comprobado.
- **Servicios:** `kept-bootstrap` (la base de datos y sus accesos, en cada arranque) y `kept` (las
  migraciones, y luego Kept en el puerto 8080 como el usuario `kept`).
- **Archivos:** Kept en `/opt/kept`, sus ajustes en `/etc/kept/kept.env`, sus claves en
  `/etc/kept/config`, fotos y documentos en `/var/lib/kept`, y la dirección y el código de
  configuración en `/root/kept.creds`.

Sin telemetría, sin temporizadores, sin actualizaciones automáticas, sin cambios en el host aparte
del contenedor.

## Valores por defecto

| Ajuste | Por defecto | Predefinir con |
|---|---|---|
| CPU | 2 núcleos | `var_cpu` |
| Memoria | 2048 MB, swap 512 MB | `var_ram`, `var_swap` |
| Disco | 8 GB | `var_disk` |
| Almacenamiento | el primero que admite contenedores | `var_storage` |
| Red | DHCP en `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, nombre | el siguiente ID libre, `kept` | `var_ctid`, `var_hostname` |
| Zona horaria | la del host | `var_timezone` |
| Clave SSH | ninguna | `var_ssh_key` (un archivo de clave pública en el host) |

Kept se probó con 1 GB ([lo que necesita](/es/install/hardware/)); 2 GB dejan sitio para
importaciones y copias. Las fotos ocupan casi todo el disco.

Cada valor se puede predefinir, y `var_unattended=yes` lo ejecuta sin preguntas:

```sh
var_unattended=yes var_ram=4096 var_ip=192.0.2.50/24 var_gateway=192.0.2.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## Primer uso

1. Abre la dirección que mostró, `http://<address>:8080`. Kept muestra
   **Ingresa el código de configuración**.
2. El código está en el contenedor: `pct exec <CTID> -- cat /root/kept.creds`. Introdúcelo y luego
   **Crear la primera cuenta**: será la administradora de la instancia.
3. Guarda las claves fuera de este servidor: `pct exec <CTID> -- kept admin recovery-kit` imprime el
   kit de recuperación.

Las etiquetas impresas llevan la dirección. Da al contenedor una fija (una reserva DHCP en tu
router, o `var_ip`) antes de imprimir ninguna. Para cambiarla después, ajusta `KEPT_PUBLIC_URL` en
`/etc/kept/kept.env` y luego `systemctl restart kept`. HTTPS:
[detrás de un proxy inverso](/es/install/reverse-proxy/).

## Actualizar

En la consola del contenedor (`pct enter <CTID>`, o la **Console** del contenedor en la interfaz
web):

```sh
update
```

`update` nombra la versión en marcha y la más reciente y pregunta antes. Muestra el comando de copia
para ejecutar en el host antes de que respondas. Después descarga la nueva versión y la comprueba
con el `SHA256SUMS` firmado de la versión, detiene Kept, cambia a la nueva versión junto a la
anterior y la arranca (primero van las migraciones). Si Kept no responde en `/readyz` con la nueva
versión, vuelve atrás y arranca la anterior. `update 1.15.0` instala una versión concreta. Las
versiones más antiguas necesitan `KEPT_ALLOW_DOWNGRADE=1`, para una restauración
([volver una versión atrás](/es/admin/upgrades/)). Nada se actualiza solo.

Las actualizaciones del propio Debian son `apt update && apt upgrade` en el contenedor, como en
cualquier Debian.

## Copias de seguridad

Todo está en el disco del contenedor, así que una copia de Proxmox contiene Kept entero: añade el
contenedor a una tarea de copia (**Datacenter → Backup**) en modo snapshot, o una vez:

```sh
vzdump <CTID> --mode snapshot
```

El modo snapshot necesita un almacenamiento que haga snapshots (LVM-thin, ZFS, Ceph); en otro usa
`--mode stop`. Restaura con **Restore** en la interfaz web, o `pct restore`.

Para una segunda copia fuera de la máquina, activa las copias nocturnas de Kept
([copias de seguridad](/es/admin/backups/)). Se ejecutan como propietario de la base de datos, así
que primero da a Kept ese acceso, dentro del contenedor:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

Los destinos S3 y SFTP funcionan tal cual. Una carpeta como destino debe poder escribirla el
servicio: añádela con `systemctl edit kept` (`[Service]` y luego `ReadWritePaths=/tu/carpeta/de/copias`),
propiedad del usuario `kept`.

## Quitar

Esto borra el contenedor y todo lo que hay dentro, datos de Kept incluidos. Haz una copia antes si
puedes necesitarlos:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## ¿Algo no funciona?

- **La instalación se detuvo:** el script dijo el paso y eliminó el contenedor. Vuelve a ejecutarlo
  con `var_keep_failed=yes` para conservar el contenedor, y luego `pct enter <CTID>` y
  `journalctl -u kept`.
- **Kept no arranca:** `journalctl -u kept-bootstrap -u kept` dentro del contenedor dice el
  problema, como `kept: invalid environment:` para un ajuste de `/etc/kept/kept.env`.
- **La consola se queda en negro:** Debian 13 necesita `nesting=1`, que el script activa; un
  contenedor hecho a mano sin él muestra esto.
