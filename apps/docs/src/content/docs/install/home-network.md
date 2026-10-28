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

Over plain HTTP a sign-in also lasts 12 hours and isn't renewed; over HTTPS it lasts 30 days.

Get started on Home asks an instance admin to put Kept on HTTPS. If you're staying on your home
network, choose **Staying on my home network** and the step counts as done. The HTTPS line at the
top of each page can be dismissed too.

`localhost` counts as a secure address in browsers, but Kept goes by `KEPT_PUBLIC_URL`: while it is
`http:`, Kept's own refusals above apply on `localhost` too.

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

3. Add `tls internal` to `docker/caddy/Caddyfile` (download it first as in
   [Put Kept on HTTPS](/install/https/#composes-caddy-profile)):

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
