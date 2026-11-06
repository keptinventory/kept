---
title: Instalar en Kubernetes con Helm
description: El chart de Helm de Kept para k3s y otros clústeres de Kubernetes.
sidebar:
  order: 4
---

:::caution[Aún no probado en un clúster real]
El chart (`charts/kept/` en el repositorio) se renderiza y valida (`helm lint`, `helm template` y `kubeconform` se ejecutan en cada comprobación), y cada lanzamiento lo publica con la imagen, pero aún no se ha instalado en un clúster real. Trata la primera instalación como una prueba. Su README contiene los valores, los secretos que hay que crear y los comandos; esta página explica qué hace.
:::

El chart ejecuta la misma imagen que Compose, con las mismas [variables de entorno](/es/reference/configuration/).

- **Secretos primero.** El chart nunca escribe un secreto: creas el secreto de los accesos a la base de datos (y, con el Postgres incluido, el de su superusuario) antes de instalar, y referencias los opcionales (las claves, S3, las credenciales del backup, SMTP, el token de métricas) por nombre en los valores.
- **Postgres:** un StatefulSet incluido sobre la misma imagen pgvector fijada que Compose, para empezar rápido, o tu propio PostgreSQL 18. Con el secreto de un superusuario de la base de datos (o de un administrador del proveedor), un Job crea los roles y las extensiones de Kept; sin él, ejecuta tú mismo el [SQL de Postgres gestionado](/es/install/managed-postgres/#el-sql).
- **Migraciones** se ejecutan en un hook Job con el login del propietario, por lo que la nueva versión nunca sirve antes de que se apliquen sus migraciones. Con un destino de backup configurado, ese Job toma primero una [instantánea previa a la actualización](/es/admin/upgrades/). Con el Postgres incluido, el Job de la primera instalación se ejecuta después de la instalación, así que no pases `--wait` a ese primer `helm install`.
- **Los archivos almacenados localmente** se guardan en un volumen ReadWriteOnce, por lo que el Deployment usa la estrategia `Recreate`: una actualización detiene el pod antiguo antes de que arranque el nuevo. Las actualizaciones progresivas solo llegan con el almacenamiento de archivos en S3 y las claves en un secreto.
- **Los respaldos se ejecutan en el worker**, nunca en un CronJob: el mismo trabajo nocturno que en Compose, configurado en Admin → Backups o bloqueado por los valores del chart.
- **Web y worker separados** es una opción; el worker es una sola réplica.
- **Los volúmenes se conservan** en `helm uninstall`; elimina los claims tú mismo para borrar los datos.
- `helm test` consulta al Kept en ejecución `/readyz` y `/version`.

La versión del chart es la versión de Kept: el lanzamiento 1.0.1 publica el chart 1.0.1. Se publica como un artefacto OCI firmado junto a la imagen en cada lanzamiento; consulta [verificar un lanzamiento](/es/admin/verify-release/).
