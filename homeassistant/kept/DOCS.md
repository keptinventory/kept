# Kept

> **Not available yet.** The app is in testing and isn't listed in the repository yet.

Kept and its own database (Postgres 18) in one app. Everything it keeps is in the app's data,
which Home Assistant backs up. Guide: <https://keptinventory.info/install/home-assistant/>.
Needs Home Assistant OS with Supervisor 2026.10.4 or later.

## The app or a normal install?

Same Kept, same version, same features: things, places, the map and graph, scan, labels, AI, MCP,
imports, Paperless, several people.

| | This app | Compose or Kubernetes |
|---|---|---|
| Opens | Home Assistant's sidebar, and Kept's own address (port 8080) | Kept's own address |
| Install, update | Home Assistant's app store | `docker compose`, `helm` |
| First account | A Home Assistant admin sets up without the code | The setup code from Kept's log |
| Settings | This app's **Configuration** tab | `.env` or the chart's values |
| Offline, installing the phone app, push | Kept's own address over https; not in the sidebar | Over https |
| Passkeys, OIDC, Google | Kept's own address (https for passkeys; https and a public domain name for Google) | Kept's address |
| Backups | Home Assistant's backups; off the box through its backup locations | Kept's own nightly backups: restic to a folder, S3 or SFTP |
| Photos and files | In this app's data | On disk, or S3 |

- **This app:** you already run Home Assistant OS.
- **Compose or Kubernetes:** anything else; or photos and files on S3; or Kept's own off-box
  backups. Guide: <https://keptinventory.info/install/compose/>.

## First start

1. **Start**, then wait for the **Log** tab to show `KEPT SETUP CODE: XXX-XXX` and
   `Kept is at http://…`.
2. **Open Web UI**. Kept opens inside Home Assistant.
3. A Home Assistant administrator who opens Kept from Home Assistant sets it up without the code
   (Supervisor 2026.10.4 or later: earlier ones can't vouch for who is an administrator, so the
   code is needed). Anyone else types the code from the Log tab.
4. Create Kept's first account. Kept has its own accounts: people sign in to Kept once, also inside
   Home Assistant.

## Two ways in

| Where | Address | For |
|---|---|---|
| Inside Home Assistant | the sidebar, **Open Web UI** | browsing and editing at home |
| Kept's own address | `http://homeassistant.local:8080` (the **Log** tab names it) | phones, printed labels, mail links, the integration, AI apps (MCP) |

A QR label or a mail link must work outside a Home Assistant session, so they use Kept's own
address. Turning the port off in **Configuration → Network** leaves only the sidebar: labels and the
phone app then don't open.

## Options

| Option | Default | What |
|---|---|---|
| Kept's address | empty: Home Assistant's host name and this app's port | The address links and labels use. Set it when `homeassistant.local` doesn't resolve on your network, or when the port changed. `http(s)://host[:port]`, no path. |
| Log detail | `info` | How much Kept writes to the Log tab. |
| Outgoing mail | empty | `smtps://user:password@mail.example.org`: sign-in links, invites, reminders. Empty: no mail. |
| Mail sender | `Kept <no-reply@your host>` | The From of Kept's mail. |
| https on Kept's port | off | Serve the port over https with a certificate in `/ssl` (the DuckDNS or Let's Encrypt apps put one there). Restart the app after the certificate renews. |
| Certificate file, Private key file | `fullchain.pem`, `privkey.pem` | File names in `/ssl`. |
| OIDC issuer, client id, client secret | empty: off | Sign-in with your own identity provider. Issuer and client id turn it on; the secret is for a confidential client. |
| OIDC button name, sign-up by email domain or group, groups claim, scopes | `OIDC`, invite only, `groups`, `openid email profile` | As Kept's `KEPT_OIDC_*` settings. Domains and groups are comma-separated. |
| Google client id, Google client secret | empty: off | Sign-in with Google, both set. Existing accounts and invited people only. Needs Kept's address on https with a public domain name. |
| Apprise server | empty: no Apprise channels | The Apprise API server Apprise notification channels go through, like `http://apprise:8000`. |
| Sign-up | unset: an admin decides (Admin → Sign-up) | `true` or `false` locks sign-up open or closed. |
| Upload limit (MB) | `25` | The largest file one upload may be, 1 to 2048. |

An option Kept would refuse (an OIDC issuer without its client id, Google with only one of its
two) is left out, and the **Log** tab says why: Kept still starts, with that sign-in off.

### OIDC and Google sign-in

The provider sends people back to Kept's own address, never to Home Assistant. Register this
redirect URL at the provider; the **Log** tab prints it once the sign-in is configured:

| Sign-in | Redirect URL |
|---|---|
| OIDC | `<Kept's address>/api/v1/auth/callback/oidc` |
| Google | `<Kept's address>/api/v1/auth/callback/google` |

For example `https://kept.example.org/api/v1/auth/callback/oidc`. Inside Home Assistant, the
**Sign in with …** button opens Kept's own address in a new tab: sign in there.

**Google** refuses a redirect URL on http, on a `.local` name or on an IP address
([Google's rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)). Set **Kept's address** to https with a public domain name,
for example a DuckDNS name with **https on Kept's port**. The **Log** tab warns when the address
won't do.

## What needs https

On plain http, Kept works for everything people do every day. A few things need https, on the
port or on Home Assistant itself:

| Feature | Plain http | https |
|---|---|---|
| Things, places, search, labels, photos from a file | yes | yes |
| Personal tokens (the integration, scripts), showing secrets, exports | no | yes |
| Passkeys, the camera, installing the phone app, push | no | yes |

Inside Home Assistant, Kept counts as https only when Home Assistant itself is served over https.
With a proxy in front of Home Assistant that ends TLS, that proxy must send
`X-Forwarded-Proto: https`, or Kept sees plain http. Passkeys belong to Kept's own address: sign in
with one there.

## The Kept integration

Install the Kept integration (HACS: `keptinventory/kept-homeassistant`) and give it
`http://<this app's host name>:8080` and a personal token made in Kept (Settings → Connections)
over https. Automatic setup of the integration from the app comes later.

## Backups and restore

- Home Assistant's backups include Kept: the database as a dump, photos and files, and Kept's keys.
  Keep Home Assistant's backup encryption on: the backup holds the keys.
- The dump is taken when the backup starts while Kept runs. Home Assistant doesn't ask a stopped app
  for one, so a backup taken while Kept is stopped holds the dump Kept wrote when it last stopped
  cleanly. If Kept crashed instead, that is the dump of the last backup or clean stop: start Kept
  before backing up when you can.
- Restoring the app's backup brings Kept back as it was; the app restores the database on its
  first start, which takes a little longer. A restore that is cut short is started again on the next
  start.
- Kept's own backups need the database owner's login, which the app keeps from the running
  server. Home Assistant's backups are the backup here: Admin → Backups says so and links to
  **Settings → System → Backups**.
- Off the box: add a network share or a cloud location in Home Assistant's backup settings
  (<https://www.home-assistant.io/common-tasks/general/backups/>).

## Updates

Turn on **Keep backup of the last version** in Home Assistant's update dialog: Kept's own
pre-upgrade snapshot is off in the app, so that backup is the way back. An update replaces the
app's image; Kept's data stays and its database is upgraded on start. Kept refuses to start on a
database a newer Kept made: restore the backup Home Assistant took before the update instead. A
future Postgres major version will come as its own update, which stops automatic updates until you
start it.

## Limits

- Home Assistant OS on `aarch64` (Raspberry Pi 4 and 5, 64-bit) or `amd64`. 4 GB of memory is
  recommended; 2 GB works with few other apps. Kept with its database uses about 250–320 MB idle.
- Cookies don't separate ports: on plain http, Kept's sign-in on port 8080 is sent to every other
  web page on the same host name. Use https with a name of its own if other apps on that host
  aren't trusted.

## Licence and help

Kept is AGPL-3.0. Source and issues: <https://github.com/keptinventory/kept>. The image is signed
with Kept's cosign key (`cosign.pub` in the repository):

```sh
cosign verify --key cosign.pub ghcr.io/keptinventory/kept-ha:<version>
```
