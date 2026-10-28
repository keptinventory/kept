---
title: Common problems
description: "Common problems and how to fix them: sign-in, sync, photos, labels, AI, offline, and where to get help."
---

This page covers problems you might hit while using Kept. For problems running the server, see
[admin troubleshooting](/admin/troubleshooting/).

## Sign-in problems

### I forgot my password

On the sign-in screen, choose **Forgot your password?** and enter your email address. Kept sends
a reset link by email. If it doesn't arrive, check your spam folder. An admin can also run
`kept admin reset-password <email>` on the server. That prints a one-time code, which you enter on
the reset page.

### My passkey doesn't work

Passkeys sync through a password manager, so the one you made on your phone can also be on your
computer. Make sure you're signing in with the same browser profile or password manager that
holds it. A backup code is the second step after your password, not a way in on its own. Passkeys
need HTTPS, as does installing Kept, offline use and push; see
[Kept on a home network](/install/home-network/) and
[sign-in and security](/users/sign-in-security/).

### I lost my backup codes

Signed in? Make new ones under **Settings → Sign-in and security**: **New backup codes** replaces
the old set, which stops working. Locked out, without a passkey or authenticator. An instance
admin can use **Reset two-factor** under **Instance admin → Users**: your authenticator and
backup codes stop working, and you set two-factor up again at your next sign-in.

### "This account is scheduled for deletion"

The account is in its 30-day deletion window. The screen says **Your account will be deleted on
{date}**; signing in shows it too. Choose **Keep my account** to stop the deletion. See also
[the FAQ](/users/faq/#how-do-i-delete-my-account).

## Sync problems

### Things I captured on my phone aren't showing up

Captured things wait in the Inbox until they're named. **Photos to review** on Home opens the Inbox.
If a capture still hasn't arrived after syncing, check your connection and pull to refresh.

### My phone says "On this phone · as of last sync"

You're offline, or the phone hasn't synced yet. Reconnect and pull to refresh. Search and capture
work offline; see [Kept on your phone](/users/phone-app/#what-works-offline).

### Changes I made offline didn't sync

Make sure you're connected, then open Kept and wait for the sync to finish. For how syncing and
conflicts appear, see [Kept on your phone](/users/phone-app/).

## Photo and capture problems

### The camera doesn't open

Kept needs HTTPS for the camera, and installing Kept, offline use and push need it too. On a home
network you can add it without a public domain; see
[Kept on a home network](/install/home-network/) and [HTTPS](/install/https/).

### AI didn't name my thing

Without an AI provider, captured things wait in the Inbox for a name. Connect a provider under
**Settings → AI**, or name the thing by hand. See [AI providers](/users/ai-providers/).

### AI named it wrong

AI suggestions are drafts. Open the thing and correct the name, brand, model or type.

## Label problems

### A label won't scan

Make sure the label is flat, well lit and undamaged, and clean the camera lens. A faded label is
best reprinted. Labels print the short ID, six characters such as `K7D-2QX`, and typing it works
with or without the hyphen.

## AI problems

### AI isn't naming photos or answering

Kept shows **Waiting for an AI provider** until one is connected. Two other things pause it: AI
can be off for the location (**What to track → AI in this location**), and a monthly cap can
pause it (**Settings → AI → Advanced → Limits**). Who connects the provider depends on your role:
work in a location is paid by the location's owner, and a member can't connect one. Ask an admin
of the location. See [AI providers](/users/ai-providers/).

### AI costs too much

AI spending caps are under **Settings → AI → Advanced → Limits**. Choose a cheaper model, or a
local provider such as Ollama. See [AI providers](/users/ai-providers/).

## Offline problems

### I can't do something offline

Capture, browse, search, moving things, readings, box checks and scanning labels work offline.
Editing details, reports, imports and exports need a connection, and offline use needs HTTPS like
the camera and push; see [Kept on a home network](/install/home-network/) and
[Kept on your phone](/users/phone-app/#what-works-offline).

### Sync is stuck

Pull to refresh. If it stays stuck, close and reopen Kept. If that doesn't help, ask the person
who runs your Kept to look at it; see [admin troubleshooting](/admin/troubleshooting/).

## Where to get help

- **Questions and ideas**: [Discussions](https://github.com/keptinventory/kept/discussions)
- **Bugs**: [Issues](https://github.com/keptinventory/kept/issues/new/choose)
- **Chat**: [Discord](https://discord.gg/g4WCXPfuNv)

## Related

- [Everyday use](/users/everyday-use/) for how things work.
- [Admin troubleshooting](/admin/troubleshooting/) for server problems.
- [Kept on your phone](/users/phone-app/) for offline and sync details.
