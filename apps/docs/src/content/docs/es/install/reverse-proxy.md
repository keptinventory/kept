---
title: Detrás de un proxy inverso
description: "La configuración que importa cuando Kept está detrás de nginx, Traefik, Caddy u otro proxy: direcciones de confianza, tamaños de carga, qué hostname usar, el error de dirección y HSTS."
sidebar:
  order: 3
---

Kept escucha en el puerto 8080 y habla HTTP sin cifrar; el proxy que tiene delante termina TLS. Apunta el proxy al puerto 8080, pon `KEPT_PUBLIC_URL` en la dirección que abren las personas y revisa lo siguiente. El [perfil de Caddy](/es/install/https/#el-perfil-de-caddy-de-compose) de Compose ya hace las tres primeras cosas.

## Confía en el proxy, y solo en el proxy

Kept limita la tasa de inicio de sesión, los códigos de configuración y otras solicitudes sensibles **por dirección del cliente**. Detrás de un proxy, la dirección del cliente llega en `X-Forwarded-For`, que cualquiera puede escribir. Kept la cree solo desde las direcciones en `KEPT_TRUSTED_PROXIES`:

```sh
KEPT_TRUSTED_PROXIES=10.0.0.5            # one proxy
KEPT_TRUSTED_PROXIES=10.0.0.5,10.0.1.0/24  # several, or a range
```

Kept recorre `X-Forwarded-For` desde la derecha y se detiene en la primera dirección en la que no confía: esa es la dirección del cliente. Si está vacío (el valor predeterminado), la dirección del socket es el cliente. Pon la dirección del proxy tal como la ve Kept (en la red de Docker, la dirección del contenedor del proxy, no la del host) y nada desde lo que un desconocido pudiera enviar solicitudes.

Con Compose, ponlo en `.env` junto a `compose.yaml`. Antes de 1.14.5, `compose.yaml` tenía su propio valor y una línea en `.env` nunca llegaba a Kept; en esas versiones ponlo para el servicio `kept` en un `compose.override.yaml`. Con el Caddy de `compose.full.yaml`, déjalo vacío (la dirección de Caddy es la predeterminada) o mantén `172.29.72.200` en la lista.

### El bloqueo de la configuración

Los códigos de configuración incorrectos bloquean por un tiempo la dirección que los envió, y muchos códigos incorrectos bloquean toda la instancia. Si el proxy no está en `KEPT_TRUSTED_PROXIES`, todos los visitantes comparten la dirección del proxy, así que los intentos de una persona bloquean a todos. `kept admin setup-code` genera un código nuevo y levanta el bloqueo de toda la instancia, pero no uno por dirección: ese termina por sí solo.

## Deja pasar las subidas

El proxy debe aceptar un cuerpo de solicitud al menos tan grande como el de Kept y no debe guardar en búfer las subidas que no necesita:

| Subida | Límite de Kept |
|---|---|
| Una foto, recibo o documento | `KEPT_MAX_FILE_MB`, 25 MB por defecto; se transmite en streaming, se rechaza con un 413 antes de leerla cuando es demasiado grande |
| Una importación de CSV | 8 MB |

El valor predeterminado de la mayoría de los proxies es menor (por ejemplo, el `client_max_body_size` de nginx); súbelo al menos hasta `KEPT_MAX_FILE_MB`. Los tiempos de espera deben permitir una subida grande en una conexión lenta de teléfono.

## Dale a Kept su propio nombre de host

Sirve Kept en un nombre de host cuyo dominio principal no tenga sitios que no controles, o en un dominio propio. Con HTTPS, la cookie de sesión de Kept lleva el prefijo `__Secure-`, lo que todavía permite que una página en un subdominio **hermano** (`other.example.org` junto a `kept.example.org`) ponga una cookie para `example.org` que los navegadores también envían a Kept. Un hermano controlado por otra persona podría usar eso para fijar una sesión. Tus propios otros servicios en subdominios hermanos están bien.

## "Este Kept está configurado para …"

La app dice "Este Kept está configurado para *address*. Ábrelo ahí." cuando se abre en otra dirección distinta de `KEPT_PUBLIC_URL`.

- **Por qué:** Kept acepta escrituras solo desde la dirección que está en `KEPT_PUBLIC_URL`, según el `Origin` del navegador: esquema, host y puerto, exactamente. El proxy no interviene; ni su propia dirección ni las cabeceras `X-Forwarded-*` la cambian.
- **Solución:** pon `KEPT_PUBLIC_URL` exactamente en la dirección que abren las personas (`https://kept.example.org`, no el upstream del proxy `http://kept:8080`) y reinicia Kept.
- **Más de una dirección:** `KEPT_EXTRA_ADDRESSES` lista las demás, y cada una también debe llegar a Kept a través de tu proxy ([Más de una dirección](/es/install/home-network/#más-de-una-dirección)).

Más en [Solución de problemas](/es/admin/troubleshooting/#este-kept-está-configurado-para--o-la-solicitud-no-provino-de-este-sitio).

## HSTS

Con un `KEPT_PUBLIC_URL` con `https:`, Kept envía `Strict-Transport-Security: max-age=31536000`: entonces los navegadores abren este nombre de host solo por https, durante un año. Con `http:` no envía nada.

- **Todo el nombre de host, todos los puertos:** un navegador aplica la política al nombre de host, no al puerto de Kept. Un servicio HTTP sin cifrar en el mismo nombre, como `http://server.lan:8081` junto a Kept en `https://server.lan`, se fuerza entonces a https y deja de cargar. Los navegadores ignoran HSTS que venga de una dirección IP.
- **Desactívalo:** pon `KEPT_HSTS=off` cuando otros servicios HTTP sin cifrar compartan el nombre de host de Kept y reinicia. Entonces Kept envía `max-age=0`, así que un navegador que guardó la política la olvida en su próxima visita https a Kept. Dejar la cabecera fuera no la borraría.
- **Tu proxy:** si añade su propia cabecera `Strict-Transport-Security`, desactívala también ahí.
- **Dominios precargados:** bajo un dominio de primer nivel de la lista de precarga HSTS de los navegadores, como `.dev` o `.app`, todos los nombres son solo https, sea cual sea lo que envíe Kept.

### Limpiar a mano una política almacenada

Cuando Kept ya no es accesible por https, `max-age=0` no puede llegar al navegador. Limpia el nombre de host en cada navegador que lo visitó:

- **Chrome, Edge y otros navegadores Chromium:** abre `chrome://net-internals/#hsts` (en Edge, `edge://net-internals/#hsts`), introduce el nombre de host en **Eliminar políticas de seguridad del dominio** y elige **Eliminar**.
- **Firefox:** Historial → Administrar historial, busca el sitio, haz clic derecho sobre él y elige **Olvidar este sitio**. Esto también elimina su historial, cookies e inicios de sesión guardados.
- **Safari en un Mac:** no tiene página para HSTS. Elimina los datos del sitio (Ajustes → Privacidad → Gestionar datos de sitios web, selecciónalo, **Eliminar**); si el http sin cifrar sigue convirtiéndose en https, borra también el historial (Historial → Borrar historial).
- **Safari en un iPhone o iPad:** Ajustes → Apps → Safari (Ajustes → Safari antes de iOS 18) → Avanzado → Datos de sitios web, busca el sitio y elimínalo; si no basta, **Borrar historial y datos de sitios web** en la página de Safari.
