---
title: Webhooks
description: "Signed, value-free POSTs to your own server when things change: which events, how deliveries are signed, what a delivery shows, and how to rotate the secret."
---

A **webhook** is Kept posting to a URL you choose when something happens in a location: a thing
is added, moved or trashed, a reading is logged, a reminder comes due. The POST is signed, so
your server can tell it came from Kept, and it carries ids and the names of the fields that
changed — never the values. To see the thing itself, your server fetches it from the API with
its own token.

Owners and admins add a location's webhooks in **Location settings → Webhooks**. Everyone else
doesn't see the tab.

## What it sends

Each webhook picks the events it listens to; Kept sends only those. The events, in plain words:

| Event | Fires |
|---|---|
| `thing.created` | A thing is added |
| `thing.updated` | A thing is changed (including its codes) |
| `thing.moved` | A thing is moved |
| `thing.trashed` | A thing goes to Trash |
| `thing.restored` | A thing comes back from Trash |
| `thing.lifecycle_changed` | A thing's state changes, such as lost or sold |
| `reading.logged` | A meter reading is logged |
| `reminder.due` | A reminder is due |

Every payload has the same shape: an event id, the event name, when it happened, the location,
the entity (its type and id), the list of changed field names, and who caused it (a person, a
token, or the system). There is also a **Test** ping, which sends a `ping` event with nothing
behind it — use it to check your endpoint accepts Kept.

## How your server checks it came from Kept

Every delivery carries a **`Kept-Signature`** header:

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`v1` is an HMAC-SHA256 of `"<t>.<body>"` — the timestamp, a dot, then the exact request body —
signed with the webhook's secret. Check that the timestamp is fresh, compute the same HMAC with
the secret, and compare it to `v1` in constant time. The dialog that shows the secret also has a
ready-made **Check a delivery (Node.js)** snippet that does exactly this.

The secret is shown once, when the webhook is created: **copy it then**. It is stored so even
Kept's own app cannot read it back. If it is lost, **rotate the secret** — the old one stops
working immediately and the new one is signed on every delivery from then on.

## What a delivery shows

The webhook's **Deliveries** list keeps every attempt: when it was sent, the status, and what
the receiver answered. A row shows the receiver's HTTP status (or *no answer*) and how many
attempts it took.

A delivery is one of four states:

- **Waiting to send** — queued.
- **Delivered** — your server answered.
- **Failed, trying again** — the send failed or came back wrong; Kept retries it.
- **Gave up** — after 10 attempts spread over 24 hours, Kept stops trying.

At most 10 deliveries go out per second for a location, so a burst of changes won't flood your
server. A webhook whose every delivery fails for a day switches itself off with *Off: every
delivery failed for a day*; fix the endpoint and turn it back on. A later success clears the
failing mark on its own.

A webhook also switches off when the person who made it is no longer an admin in the location,
or when an admin turns it off. Deleting one is final: Kept stops posting to it and its
deliveries are forgotten.

## Your own webhook, for reminders

A location's webhooks are one thing; a **personal webhook** is another. In **Settings → Me →
Notifications** you can add a webhook as one of your own channels, next to email, push, ntfy,
Telegram or Apprise. It gets one POST per reminder — the kind, the due date and a link back to
Kept, nothing else — signed the same way, with a secret that is shown once and kept encrypted.
A failed send is retried up to 10 times over about 24 hours; if none get through, the channel is
marked **Failing since** and Kept emails you once. **Test** sends one now. A person can have up
to five.

## Addresses on your network

By default Kept refuses to post to private addresses (`192.168.x.x` and friends), so a webhook
cannot be aimed at your router or another service on the server's network. An instance admin
can allow this in **Admin → Settings** (**Allow private addresses**), which is meant for a
server you host yourself — the same switch also lets an AI provider, the Homebox import and
OIDC sign-in reach that network, so turn it on knowing who can add those.

A webhook's **test** shows the status your endpoint answered with, which is the quickest way to
check a new URL before trusting it.
