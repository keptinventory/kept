---
title: Troubleshooting
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

Passkeys belong to the device and browser that created them. Sign in with your password or a backup
code instead. Passkeys and two-factor are managed under **Settings → Sign-in and security**; see
[sign-in and security](/users/sign-in-security/).

### I lost my backup codes

Backup codes are made when you set up two-factor. [Sign-in and security](/users/sign-in-security/)
explains how new ones are made.

### "This account is scheduled for deletion"

The account is in its 30-day deletion window. Signing in shows the date. To stop the deletion, see
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

Kept needs HTTPS for the camera. Over plain HTTP the camera won't work. See [HTTPS](/install/https/).

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

### "No AI provider configured"

Go to **Settings → AI** and add a provider with your own key. See [AI providers](/users/ai-providers/).

### AI costs too much

AI spending caps are set in the AI settings. Choose a cheaper model, or a local provider such as
Ollama. See [AI providers](/users/ai-providers/).

## Offline problems

### I can't do something offline

Capture, browse, search, moving things, readings, box checks and scanning labels work offline.
Editing details, reports, imports and exports need a connection. See
[Kept on your phone](/users/phone-app/#what-works-offline).

### Sync is stuck

Pull to refresh. If it stays stuck, close and reopen Kept. If that doesn't help, check the server's
logs for errors; see [admin troubleshooting](/admin/troubleshooting/).

## Where to get help

- **Questions and ideas**: [Discussions](https://github.com/keptinventory/kept/discussions)
- **Bugs**: [Issues](https://github.com/keptinventory/kept/issues/new/choose)
- **Chat**: [Discord](https://discord.gg/g4WCXPfuNv)

## Related

- [Everyday use](/users/everyday-use/) for how things work.
- [Admin troubleshooting](/admin/troubleshooting/) for server problems.
- [Kept on your phone](/users/phone-app/) for offline and sync details.
