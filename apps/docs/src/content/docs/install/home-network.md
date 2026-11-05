---
title: Kept on a home network
description: Run Kept on your home network over plain HTTP - what works, what needs HTTPS and why, and the two ways to add HTTPS without a public domain - Tailscale, or Caddy with its own certificate authority.
sidebar:
  order: 3
---

Kept works on your home network at a plain `http://` address, such as `http://192.0.2.20:8080`
or `http://kept.home.arpa:8080`. Your own data works there: adding, finding and moving things,
photos and files, labels, reports, imports, and exports without secret values.

A few things need HTTPS. Some because Kept refuses to hand out a key or show a secret over a
connection anyone on the network can read; others because browsers only allow them on a secure
address, which Kept can't change.

## What works over plain HTTP

| | Over plain HTTP | Why |
|---|---|---|
| Things, places, search, moves, labels, reports | Works | |
| Photos and files, picked from the device | Works | |
| Import (Homebox, CSV, a Kept export) | Works | |
| Opening an export's secrets when importing it | Needs HTTPS. Over plain HTTP the rest of the export imports without them | Kept: the passphrase and the secret values |
| Export without secret values | Works. Each secret value is left out and marked as left out; the export imports as usual | Your own data |
| Setting a secret value | Works | |
| Showing a secret value | Needs HTTPS | Kept: a secret is never sent over plain HTTP |
| Export with secret values | Needs HTTPS | Kept: the secrets and their passphrase |
| Tokens for AI apps (MCP) and Home Assistant | Not from the browser. Make one on the server: `kept admin token create` ([CLI](/admin/cli/#a-token-from-the-server)) | Kept: a token is a key |
| Connecting an app with OAuth (a connector) | Needs HTTPS | Kept: OAuth needs a secure address |
| Downloading the recovery kit | Not from the browser. On the server: `kept admin recovery-kit` ([CLI](/admin/cli/)) | Kept: it holds the server's keys |
| Backup settings and their test | Needs HTTPS, or set them in the server's environment ([configuration](/reference/configuration/)) | Kept: the backup password |
| Passkeys | Needs HTTPS | The browser: no passkeys on a plain-HTTP address |
| The camera, installing Kept, working offline, push notifications, location | Needs HTTPS | The browser |

Over plain HTTP a sign-in also lasts 12 hours and isn't renewed; over HTTPS it lasts 30 days. To
change the 12 hours, see [Staying on your network](#staying-on-your-network).

Get started on Home asks an instance admin to put Kept on HTTPS. If you're staying on your home
network, choose **Staying on my home network** and the step counts as done. The HTTPS line at the
top of each page can be dismissed too.

`localhost` counts as a secure address in browsers, but Kept goes by `KEPT_PUBLIC_URL`: while it is
`http:`, Kept's own refusals above apply on `localhost` too.

## Staying on your network

Whoever runs Kept can change two things on the server: how long a sign-in lasts over plain HTTP,
and which addresses Kept answers on. Neither can be changed from the app, and Admin → Status shows
what is in force.

### Longer sign-ins over plain HTTP

Over plain HTTP you sign in again every 12 hours. `KEPT_HTTP_SIGN_IN_DAYS` in `.env` makes it that
many days, 1 to 30, renewed as you use it. 7 suits a home network or Tailscale:

```sh
KEPT_HTTP_SIGN_IN_DAYS=7
```

Then `docker compose up -d`. In the Home Assistant app it's the **Sign-in length over http** option.

**The cost:** over plain HTTP a sign-in cookie can be copied by anyone who can see the traffic.
With the setting on, a copied one keeps working for as long as it's used, until that device signs out or your other devices are signed out. So keep it to a network you
trust, and sign out on a device you lose.

| | Unset | Set |
|---|---|---|
| A sign-in over plain HTTP lasts | 12 hours | That many days |
| Renewed | No | Once a day of use (at 1 day, after half a day) |
| Over HTTPS | 30 days, renewed | 30 days, renewed: the setting does nothing |
| Secrets and keys over plain HTTP | Refused | Refused |
| Sensitive actions | Password, or a sign-in in the last ten minutes | The same; a renewal doesn't count as a sign-in |
| Sign out everywhere | Ends every sign-in | Ends every sign-in |

Any other value (0, 31, `7d`) stops Kept at startup with a message saying what it takes. Leaving it
empty is the same as leaving it out.

Turned on, a sign-in already made takes the longer length the next time it's used. Turned off, one
runs out in its own time, up to the length it had; to end them sooner, use **Sign out everywhere**
in Admin → Users.

### More than one address

Kept accepts sign-ins and saves from `KEPT_PUBLIC_URL` only, so a second way to reach the same Kept,
a Tailscale name next to a LAN name, or an IP next to a name, says "This Kept is set up for …".
`KEPT_EXTRA_ADDRESSES` lists the others, comma-separated, exactly as the browser shows them:

```sh
KEPT_PUBLIC_URL=http://kept.lan:8080
KEPT_EXTRA_ADDRESSES=http://192.0.2.20:8080,http://<machine>.<tailnet>.ts.net:8080
```

Then `docker compose up -d`. In the Home Assistant app it's the **Extra addresses** option. It works
the same over HTTPS.

| | `KEPT_PUBLIC_URL` | An extra address |
|---|---|---|
| Using Kept, signing in with a password or a one-time code | Yes | Yes |
| An email link or password reset | Opens here | Opens at `KEPT_PUBLIC_URL` |
| Passkeys | Yes, over HTTPS | No; a passkey belongs to one address |
| Google and OIDC sign-in | Yes | The button opens `KEPT_PUBLIC_URL` |
| AI apps (MCP, OAuth) | Yes | Connect them at `KEPT_PUBLIC_URL`: `/mcp` refuses this address, and OAuth's consent is refused here |
| Links, labels, QR codes, mail, calendar feeds | Point here | Still point at `KEPT_PUBLIC_URL` |

- **Each address signs in separately and installs as its own app,** because browsers keep cookies
  and offline data per address. Signing out on one leaves the other signed in; **Sign out
  everywhere** ends both. Push notifications, where HTTPS allows them, open on the address the
  device turned them on at. Two ports on one host name share their cookies: browsers don't keep
  those per port.
- **An email link** asked for on an extra address opens at `KEPT_PUBLIC_URL` and signs you in there,
  not where you asked. A password reset sets the password there; then sign in on the address you
  were on. If `KEPT_PUBLIC_URL` can't be reached from where you are, use your password.
- **Passkeys:** add and use them at `KEPT_PUBLIC_URL`. An extra address offers your password or an
  email link and says why.
- **Exact addresses:** scheme, host and port, compared whole. `http://kept.lan` isn't
  `http://kept.lan:8080`, and `kept.lan.example.com` isn't `kept.lan`. A wildcard, a path, a login or
  a mix of `http` and `https` stops Kept at startup with a message saying which. Leaving it empty is
  the same as leaving it out.
- **Forwarded headers:** `Host` and `X-Forwarded-*` play no part, so your proxy can't add an address
  by accident, or take one away. Point it at Kept for each address you list.

**The cost:** a page served at a listed address counts as Kept itself, and can use the sign-in of
whoever opens it there. So list only addresses that reach this Kept, on names and IPs you control.

## Add HTTPS: Tailscale first

The least work for a household: install Tailscale on the machine running Kept and on each phone
and computer that uses it, turn on HTTPS certificates for your tailnet, and serve Kept with

```sh
tailscale serve --bg 8080
```

Kept is then at `https://<machine>.<tailnet>.ts.net`, with a certificate every device already
trusts, from home or away. Set `KEPT_PUBLIC_URL` to that address and restart Kept. More in
[Put Kept on HTTPS](/install/https/#tailscale).

## Add HTTPS: Caddy with its own certificate authority

Without Tailscale and without a public domain, Caddy can sign a certificate for a home-network name
itself (`tls internal`). It works, but it isn't quick: **every device that opens Kept must be told
to trust Caddy's root certificate**, one by one, for every person in the house. Until a device
trusts it, its browser shows a security warning.

1. Pick a name every device can resolve to the machine, for example `kept.home.arpa` (a DNS entry
   on your router, or an entry in each device's hosts file).
2. Set it in `.env`:

   ```sh
   KEPT_DOMAIN=kept.home.arpa
   KEPT_PUBLIC_URL=https://kept.home.arpa
   ```

3. Caddy comes with `compose.full.yaml`: download it and `docker/caddy/Caddyfile`, and set
   `COMPOSE_FILE=compose.full.yaml` in `.env`, as in
   [Put Kept on HTTPS](/install/https/#composes-caddy-profile). Then add `tls internal` to the
   Caddyfile:

   ```caddy
   {$KEPT_DOMAIN} {
   	tls internal
   	encode zstd gzip
   	reverse_proxy kept:8080
   }
   ```

4. Start Caddy and copy its root certificate out of its data volume:

   ```sh
   docker compose --profile https up -d
   docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./kept-root.crt
   ```

5. Install `kept-root.crt` on every device and trust it:
   - **iPhone and iPad:** send it to the device (AirDrop or mail), install the profile in
     Settings → General → VPN & Device Management, then turn on full trust for it in Settings →
     General → About → Certificate Trust Settings.
   - **Android:** in the security settings, install it as a CA certificate (the menu's name varies
     by maker). Some apps ignore user-installed certificates.
   - **Computers:** add it to the system's trusted certificates (Keychain Access on a Mac, the
     certificate manager on Windows, the distribution's CA store on Linux). Firefox may keep its
     own list.

Caddy's root lasts ten years; the certificates it signs with it renew on their own. The root's
private key stays in the `caddy-data` volume: anyone who copies it can sign for any name your
devices now trust, so guard that volume like a password. [mkcert](/install/https/#a-certificate-only-your-devices-trust) is the same idea with
another tool.

## Opening Kept at the right address

Open Kept at the address in `KEPT_PUBLIC_URL`. Opened at another one (the machine's IP address
while the URL names `kept.home.arpa`, say), sign-in says which address this Kept is set up for,
with a link to it.
