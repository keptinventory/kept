---
title: Common problems
description: "Signing in, sync, the camera, labels, AI and offline use: what you see, and what to do."
---

Problems you might hit while using Kept. For problems running the server, see
[Troubleshooting](/admin/troubleshooting/).

## Signing in

### I forgot my password

On the sign-in page, enter your email address and choose **Forgot your password?**. Kept mails a
link to set a new password; it works once, for an hour. Nothing arrived: check spam, or ask the
person who runs your Kept whether email is set up. Without email, an instance admin can issue a
one-time reset link on the server with `kept admin reset-password` ([the CLI](/admin/cli/)).

A managed account (a username, no email) gets a new one-time code instead, from whoever made the
account or the location's owner ([people without email](/users/first-run/#people-without-email)).

### My passkey doesn't work

- **Passkeys need HTTPS.** On a plain `http://` address the browser offers none
  ([Kept on a home network](/install/home-network/)).
- **A passkey is on the device that made it**, or in your password manager when it's synced. On
  another device, sign in another way (your password or **Email me a sign-in link**), then add a
  passkey there in **Settings → Sign-in and security**.
- **"That passkey isn't one this account signs in with"**: the browser offered something else,
  such as a device's app lock, which can't sign you in. Sign in another way.

More in [Sign-in and security](/users/sign-in-security/).

### I lost my phone, or my backup codes

A backup code is the second step after your password, in place of the authenticator app's
6-digit code. Each one works once.

- **Still signed in somewhere:** **Settings → Sign-in and security**. **New backup codes** makes
  ten new ones (the old ones stop working); **Set up again** moves two-factor to a new phone.
- **Locked out, with no backup codes:** ask an instance admin. **Reset two-factor** under
  **Instance admin → Users** stops your authenticator and backup codes, and you set two-factor up again at
  your next sign-in.

### "Your account will be deleted on …"

You asked to delete the account, and it waits 30 days; until then nothing else in Kept opens.
**Keep my account** stops the deletion and brings the account back as it was. See
[the FAQ](/users/faq/#how-do-i-delete-my-account).

## Sync

### Captures from my phone aren't showing

A capture is saved on the phone first and sent when the phone syncs.

- **On iPhone the queue moves only while Kept is open.** The line under the header says **Open to
  finish syncing** with a count: leave Kept on screen for a moment while online.
- **Without a name**, a capture waits in the **Inbox**. **Photos to review** on Home shows them.

### Search says "On this phone · as of last sync"

The answer came from the phone's own copy, because you're offline. Reconnect, then pull down to
refresh.

### A change I made offline didn't apply

If someone else trashed, moved or removed a thing while you were offline, your change to it is
dropped and the line says so, with **Restore** to try it again. Other changes that need a decision
go to the **Inbox**. See [syncing, as you see it](/users/phone-app/#syncing-as-you-see-it).

### Sync seems stuck

- Pull down to refresh, or close Kept and open it again.
- **Update Kept to finish syncing**: the server is newer than the app. Reload; the queue is kept.
- Still stuck: **Settings → Diagnostics** checks offline support and storage and copies a report.
  Send it to the person who runs your Kept.

## Camera and capture

### The camera doesn't open

Phones allow the camera only on an HTTPS address. Over plain `http://`, Capture falls back to
choosing files. Installing Kept, working offline and push notifications need HTTPS too. What works
over plain HTTP, and two ways to add HTTPS at home: [Kept on a home network](/install/home-network/).

On HTTPS and still blocked, Kept says how to allow the camera in the browser.

### AI didn't name my thing

Without AI, captures wait in the Inbox for a name: name them there, or see [AI](#ai) below.

### AI named it wrong

What AI fills in is a suggestion. Open the thing and correct the name, brand, model or type.

## Labels

### A label won't scan

Make sure the label is flat and well lit, and clean the camera lens. **Type the code** takes the six
characters printed under the QR code, with or without the dash. A worn label reprints with the same
code ([Short IDs and labels](/users/short-ids/)).

## AI

### "Waiting for an AI provider"

No provider is connected for this location. Work in a location is paid by its owner's key, so the
owner connects one in **Settings → AI**, or an instance admin sets one for the server in
**Admin → AI**. Members and viewers can't connect one for someone else's location: the line says to
ask an admin. See [AI providers](/users/ai-providers/#where-the-key-goes).

### AI is off in one location

An owner or admin turned it off: **Location settings → What to track**, under **AI in this
location**, the switch **AI capture and the assistant**. Switching it back on brings AI back there.

### "AI paused"

A monthly limit was reached, or someone chose **Pause AI**. Captures still save; naming waits and
resumes with AI. Whoever set the cap gets **Resume now**. Limits are under
**Settings → AI → Advanced → Limits** ([limits and pausing](/users/ai-providers/#limits-and-pausing)).

### AI costs too much

Set a monthly limit under **Settings → AI → Advanced → Limits**, choose a cheaper model under
**Advanced → Models**, or run a local model with [Ollama](/admin/ollama/).

## Offline

### Something doesn't work offline

Working offline needs Kept installed from an HTTPS address. Browsing, search and capture work
without a connection; editing details, the assistant, reports and anything with money need one.
The full list: [what works offline](/users/phone-app/#what-works-offline).

## Getting help

- **Questions and ideas:** [Discussions](https://github.com/keptinventory/kept/discussions)
- **A bug:** [an issue](https://github.com/keptinventory/kept/issues/new/choose), with what you did
  and what you saw
- **Chat:** [Discord](https://discord.gg/g4WCXPfuNv)
- **A security problem:** privately, never in a public issue
  ([SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md))
