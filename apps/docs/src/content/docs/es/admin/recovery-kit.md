---
title: El kit de recuperación
description: Las claves y las credenciales de copia de seguridad que convierten una copia de seguridad en un Kept que funcione. Guárdalas en cualquier sitio menos en el servidor.
sidebar:
  order: 4
---

Kept sella cada valor secreto que almacena (claves de IA, y los secretos que guardas en objetos, como la contraseña Wi-Fi de un router) con `KEPT_SECRET_KEY`, y firma las sesiones con `KEPT_AUTH_SECRET`. Ninguno está en la base de datos ni en la copia de seguridad, a propósito: quien consiga tu copia de seguridad no debería conseguir tus secretos con ella. El otro lado de eso: **sin la clave, una restauración devuelve todo excepto los valores secretos y las claves de IA, que permanecen ilegibles para siempre.**

El kit de recuperación es todo lo que necesitarías para reconstruir Kept desde su copia de seguridad. Guárdalo en un gestor de contraseñas o en papel, en algún sitio que no se perdería con el servidor.

## Lo que contiene

- `KEPT_SECRET_KEY` y `KEPT_AUTH_SECRET`;
- después de una rotación de clave, la versión de la clave (`KEPT_SECRET_KEY_VERSION`) y cada clave retirada (`KEPT_SECRET_KEYS_RETIRED`), que las copias de seguridad antiguas aún necesitan;
- el repositorio restic de la copia de seguridad, **su contraseña y sus credenciales de almacenamiento** (las claves de S3 y la región, o la clave SFTP y la clave de host fijada del servidor como una línea de `known_hosts`), o "Copia de seguridad no configurada";
- la dirección de la instancia, la versión y la revisión de Kept, y cuándo se hizo el kit;
- los pasos de restauración en palabras llanas, y los comandos para [leer tu inventario solo con restic](/es/admin/read-with-restic/), con el repositorio rellenado.

Es texto plano, o una página imprimible hecha con las mismas líneas (sin script, nada cargado desde ningún sitio).

## Conseguirlo

Desde el servidor, en cualquier momento:

```sh
docker compose exec kept kept admin recovery-kit
```

Imprime en la terminal; no se escribe nada en ninguna parte. `--format html` da la página imprimible, y `--out <file>` la escribe en un archivo legible solo por ti. Las claves se imprimen incluso cuando la base de datos está caída; la mitad de la copia de seguridad necesita el inicio de sesión del propietario de la base de datos (`KEPT_OWNER_DATABASE_URL`, el `compose.override.yaml` que [las copias de seguridad](/es/admin/backups/#activarlo) usan lo da), y sin él el kit dice que falta. Con ese inicio de sesión, la impresión cuenta como una descarga (más abajo) y se audita.

Desde la web: **Administrador → Estado → Kit de recuperación → Descargar kit de recuperación**, como administrador de la instancia, solo por HTTPS, después de volver a escribir tu contraseña (o, para una cuenta sin una, dentro de los diez minutos siguientes al inicio de sesión: un inicio de sesión con llave de acceso cuenta; de lo contrario "Vuelve a iniciar sesión"). Elige un archivo de texto o una página imprimible. Cada descarga se audita, y nada del kit se guarda en ningún sitio que un visitante posterior pueda abrir.

## Cuando Kept lo pide

La configuración no espera al kit, pero Kept te pide que lo reconozcas antes de lo primero de: guardar un valor secreto, añadir una clave de IA o configurar copias de seguridad. Hasta entonces, Administrador → Estado lo pide; una descarga cuenta como ese reconocimiento. La página de estado vuelve a preguntar cuando el kit que descargaste está desactualizado: después de que cambien los ajustes de copia de seguridad o se rote la clave (`kept admin rotate-key`).

## Si configuras las claves tú mismo

Con `KEPT_SECRET_KEY` y `KEPT_AUTH_SECRET` en tu propio entorno (genera cada una con `kept admin gen-key`), Kept los usa tal cual y el volumen `kept-config` queda vacío. El kit sigue imprimiéndolos; guardar una copia sigue siendo tu trabajo.

## Rotando la clave

```sh
docker compose exec kept kept admin rotate-key
```

hace que una nueva clave sea la actual y reenvuelve cada secreto almacenado bajo ella. Necesita el inicio de sesión del propietario de la base de datos, por lo que el servicio `kept` debe tener `KEPT_OWNER_DATABASE_URL` (el `compose.override.yaml` que [las copias de seguridad](/es/admin/backups/#activarlo) usan lo da). Dice qué configurar si gestionas las claves tú mismo. La clave antigua pasa a la lista retirada, así que las copias de seguridad hechas antes de la rotación siguen abriéndose: descarga un kit nuevo después.
