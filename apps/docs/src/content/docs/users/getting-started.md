---
title: Getting started
description: "A short path from a fresh Kept to your first thing."
---

This is the short version. The full walkthrough is in [your first minutes](/users/first-run/),
and the install guide is [Install with Docker Compose](/install/compose/).

## 1. Configure and start Kept

You need Docker with the Compose plugin, and a machine with at least 2 GB of RAM and 2 CPU cores.

```sh
git clone https://github.com/keptinventory/kept.git && cd kept
cp compose.env.example .env
```

Edit `.env` before starting:

- **Five database passwords**: `KEPT_DB_SUPERUSER_PASSWORD`, `KEPT_DB_OWNER_PASSWORD`,
  `KEPT_DB_APP_PASSWORD`, `KEPT_DB_AUTH_PASSWORD` and `KEPT_DB_SYSTEM_PASSWORD`. Generate each one
  with `openssl rand -hex 32`.
- **`KEPT_PUBLIC_URL`**: the address your browser opens, for example `http://localhost:8080` on the
  same machine.

Then start it:

```sh
docker compose up -d
```

Compose refuses to start until those values are set. The [install guide](/install/compose/) covers
the rest, including HTTPS.

## 2. Claim the server

Kept prints a one-time setup code in its logs. Find it with:

```sh
docker compose logs kept | grep "KEPT SETUP CODE"
```

Open `KEPT_PUBLIC_URL` in your browser. Enter the six characters (the dash is optional), then create
your account: name, email, and a password of at least 8 characters. This account is the instance
admin.

## 3. Create your first home

Choose **Create your first home**. Pick a name (Home, Garage, Storage unit) and a kind. The kind's
template fills in rooms and spots, which you can rename, remove or add to. Every location also has
**Unplaced** for things without a place yet.

## 4. Add your first thing

On the location, choose **Add here**, then **Thing**. Give it a name and a place, then add a photo,
a receipt or a warranty if you have them.

## 5. Invite someone

After you create a location, Home shows **Invite people to …**. Choose a role (owner, admin, member or
viewer). Nobody needs an email address: the invite link works once, for 7 days, and can be shown as
a QR code. See [invites and roles](/users/first-run/#5-invite-people).

## 6. Put Kept on your phone

Installing Kept to a phone's home screen, and using the camera, need HTTPS. Set that up first; see
[HTTPS](/install/https/). Then follow [Kept on your phone](/users/phone-app/#install-it).

## 7. Connect AI (optional)

Kept works without AI. To name things from photos, read receipts and search by meaning, add a provider
under **Settings → AI**, with your own key. Groq is the recommended starting point. See
[AI providers](/users/ai-providers/).

## What's next

- [Everyday use](/users/everyday-use/) for the full tour.
- [Your first minutes](/users/first-run/) for the detailed walkthrough.
- [FAQ](/users/faq/) for common questions.
