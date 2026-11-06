---
title: Iniciar sesión y seguridad
description: Passkeys y la app de autenticación en Configuración, códigos de respaldo, configurar la app de nuevo, desactivarla, lo que Kept rechaza y por qué, y por qué el bloqueo de la app no es un passkey.
---

**Configuración → Iniciar sesión y seguridad** tiene las formas en que tu cuenta inicia sesión además de una contraseña: passkeys y la autenticación de dos factores con una app de autenticación.

## Confirma que eres tú

Todo cambio en esta página pide primero:

- una cuenta con contraseña: **tu contraseña**;
- una cuenta sin una (solo con passkey, enlace por correo o Google): **un inicio de sesión en los últimos diez minutos**. Si es más antiguo, el panel ofrece **Iniciar sesión de nuevo**.

Agregar un passkey pide también la contraseña en una cuenta que tiene una y siempre necesita un inicio de sesión en los últimos diez minutos, sea la cuenta que sea: después el navegador muestra su propio diálogo de passkey. Activar o desactivar la autenticación de dos factores no cuenta como volver a iniciar sesión.

Desvincular Google o tu inicio de sesión con OIDC en **Métodos de inicio de sesión** pide lo mismo.

Cada cambio cierra la sesión en todos los demás dispositivos, excepto renombrar un passkey. Kept te envía un correo cuando se agrega o elimina un passkey, cuando se desvincula un inicio de sesión externo, cuando se activa, configura de nuevo o desactiva la autenticación de dos factores, y cuando se crean nuevos códigos de respaldo. Las cuentas administradas (con nombre de usuario, sin correo) no reciben correo.

## Passkeys

Un passkey te permite iniciar sesión con Face ID, una huella digital o el bloqueo de pantalla de tu teléfono, sin tener que escribir una contraseña. Kept nunca lo ve: se queda en el dispositivo o en tu gestor de contraseñas. Pertenece a una sola dirección: en un Kept con [más de una](/es/install/home-network/#más-de-una-dirección), agrégalo y úsalo en la principal.

| | |
|---|---|
| **Agrega un passkey** | Nómbralo (Kept sugiere el dispositivo: "Mac", "iPhone"), luego responde al diálogo del navegador. Cerrar ese diálogo no cambia nada. |
| **Sincronizado** | Tu gestor de contraseñas o la plataforma también lo mantiene en tus otros dispositivos. |
| **Solo este dispositivo** | Vive en este único dispositivo o llave de seguridad. |
| **Renombrar** | El nombre es tuyo, hasta 64 caracteres. |
| **Eliminar** | Deja de hacer que puedas iniciar sesión. Elimínalo también en el dispositivo si ya no lo quieres ahí. |

Todo passkey que agrega Kept comprueba que seas tú (Face ID, una huella digital o un PIN), así que iniciar sesión con un passkey cuenta como autenticación de dos factores por sí solo, incluidas las ubicaciones que la piden.

## La app de autenticación

Autenticación de dos factores con una app como 1Password, Google Authenticator o Aegis: después de tu contraseña, el enlace por correo o Google, iniciar sesión pide su código de 6 dígitos.

- **Activar**: confirmas que eres tú, escaneas el código QR (o escribes la clave), ingresas un código y luego guardas los diez códigos de respaldo. Se activa solo cuando ese código coincide.
- **8 de 10 códigos de respaldo restantes**: cada código de respaldo te permite iniciar sesión una vez, para cuando no tengas el teléfono.
- **Nuevos códigos de respaldo**: diez códigos nuevos, mostrados una sola vez. Los antiguos dejan de funcionar.
- **Configurar nuevamente**: para un teléfono nuevo o otra app. Escanea el nuevo código QR e ingresa un código de la nueva app. Hasta que lo hagas, la app actual sigue funcionando; si cierras el panel a la mitad, no cambia nada. Cuando termine, los códigos de la app anterior y los códigos de respaldo anteriores dejan de funcionar.
- **Desactivar**: iniciar sesión deja de pedir un código.

## Lo que Kept rechaza

El servidor rechaza estas acciones, sin importar lo que muestre la pantalla:

- **Eliminar tu última forma de entrar.** No se puede eliminar un passkey ni desvincular Google o tu inicio de sesión con OIDC cuando no quedaría nada más para iniciar sesión: una contraseña, otro passkey, Google o el inicio de sesión con OIDC (mientras este Kept siga ofreciéndolo), o un enlace por correo (cuando este Kept envía correo y tu dirección está confirmada).
- **Desactivar la autenticación de dos factores donde una ubicación la necesita.** Mientras una ubicación a la que perteneces pide la autenticación de dos factores y no tienes un passkey, la app de autenticación sigue activa. Agrega primero un passkey. De la misma manera, tu último passkey se mantiene mientras esa ubicación dependa de él y la app esté desactivada.
- **Agregar un passkey o la app antes de confirmar tu dirección**, cuando este Kept envía correo. Inicia sesión una vez con un enlace enviado a la dirección y luego inténtalo de nuevo.

## El bloqueo de la app no es un passkey

**Configuración → Este dispositivo → Desbloquear con Face ID o huella digital** desbloquea Kept en ese único dispositivo, después de que ya hayas iniciado sesión ([el bloqueo de la app](/es/users/phone-app/#el-bloqueo-de-la-aplicación)). No puede iniciar tu sesión. Si el navegador lo ofrece al iniciar sesión y Kept responde *Ese passkey no es uno con el que esta cuenta inicia sesión*, inicia sesión de otra manera y luego agrega aquí un passkey real.
