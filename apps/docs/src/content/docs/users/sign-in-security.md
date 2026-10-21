---
title: Sign-in and security
description: Passkeys and the authenticator app in Settings, backup codes, setting the app up again, turning it off, what Kept refuses and why, and why the app lock is not a passkey.
---

**Settings → Sign-in and security** holds the ways your account signs in beyond a password:
passkeys, and two-factor with an authenticator app.

## Confirm it's you

Every change on this page asks first:

- an account with a password: **your password**;
- an account without one (passkey, email link or Google only): **a sign-in in the last ten
  minutes**. Older than that, the sheet offers **Sign in again**.

Adding a passkey asks for the password too on an account with one, and always needs a sign-in in
the last ten minutes, whatever the account: the browser runs its own passkey dialog then.
Turning two-factor on or off doesn't count as signing in again.

Unlinking Google or your OIDC sign-in in **Sign-in methods** asks the same way.

Each change signs out every other device, except renaming a passkey. Kept mails you when a passkey
is added or removed, when an outside sign-in is unlinked, when two-factor is turned on, set up again
or turned off, and when new backup codes are made. Managed accounts (a username, no email) get no mail.

## Passkeys

A passkey signs you in with Face ID, a fingerprint or your phone's screen lock, with no password
to type. Kept never sees it: it stays on the device or in your password manager.

| | |
|---|---|
| **Add a passkey** | Name it (Kept suggests the device: "Mac", "iPhone"), then answer the browser's dialog. Closing that dialog changes nothing. |
| **Synced** | Your password manager or the platform keeps it on your other devices too. |
| **This device only** | It lives on this one device or security key. |
| **Rename** | The name is yours, up to 64 characters. |
| **Remove** | It stops signing you in. Delete it on the device too if you no longer want it there. |

Every passkey Kept adds checks it's you (Face ID, a fingerprint or a PIN), so a passkey sign-in
counts as two-factor on its own, including in locations that ask for it.

## The authenticator app

Two-factor with an app such as 1Password, Google Authenticator or Aegis: after your password,
email link or Google, signing in asks for its 6-digit code.

- **Turn on**: confirm it's you, scan the QR code (or type the key), enter one code, then save the
  ten backup codes. It is on only once that code matches.
- **8 of 10 backup codes left**: each backup code signs you in once, for when your phone is gone.
- **New backup codes**: ten new codes, shown once. The old ones stop working.
- **Set up again**: for a new phone or another app. Scan the new QR code and enter a code from the
  new app. Until you do, the current app keeps working; close the sheet half-way and nothing
  changes. Once it's done, the old app's codes and the old backup codes stop working.
- **Turn off**: signing in stops asking for a code.

## What Kept refuses

These are refused by the server, whatever the screen shows:

- **Removing your last way in.** A passkey can't be removed, and Google or your OIDC sign-in
  can't be unlinked, when nothing else would sign you in: a password, another passkey, Google or
  the OIDC sign-in (while this Kept still offers it), or an email link (when this Kept sends mail
  and your address is confirmed).
- **Turning two-factor off where a location needs it.** While a location you belong to asks for
  two-factor and you have no passkey, the authenticator app stays on. Add a passkey first. The
  same way, your last passkey stays while such a location relies on it and the app is off.
- **Adding a passkey or the app before your address is confirmed**, when this Kept sends mail.
  Sign in once with a link sent to the address, then try again.

## The app lock is not a passkey

**Settings → This device → Unlock with Face ID or fingerprint** unlocks Kept on that one device,
after it is already signed in ([the app lock](/users/phone-app/#the-app-lock)). It can't sign you
in. If the browser offers it at sign-in and Kept answers *That passkey isn't one this account
signs in with*, sign in another way, then add a real passkey here.
