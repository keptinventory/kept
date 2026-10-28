---
title: Webhooks
description: "Signed POSTs to your own server when things change: the events, the payload, checking the signature, deliveries and retries, and the secret."
---

A **webhook** is Kept posting to an address you choose when something happens in a location: a
thing is added, moved or trashed, a reading is logged, a reminder comes due. Each POST is signed,
so your server can tell it came from Kept. It carries ids and the names of the fields that
changed, never their values: to see the thing itself, your server fetches it from the
[API](/api/) with its own token.

Owners and admins manage a location's webhooks in **Location settings → Webhooks**: **Add
webhook**, the address, and the events it takes. **Settings → Connections** lists the webhooks you
manage across your locations.

## The events

| Event | Sent when |
|---|---|
| `thing.created` | A thing is added |
| `thing.updated` | A thing is changed |
| `thing.moved` | A thing is moved |
| `thing.trashed` | A thing goes to Trash |
| `thing.restored` | A thing comes back from Trash |
| `thing.lifecycle_changed` | A thing's state changes, such as lost or sold |
| `reading.logged` | A meter reading is logged |
| `reminder.due` | A reminder is due |

Every payload has the same fields:

```json
{
  "id": "evt_…",
  "event": "thing.updated",
  "occurred_at": "2026-10-03T09:12:44.000Z",
  "location_id": "…",
  "entity": { "type": "thing", "id": "…" },
  "changed_fields": ["…"],
  "actor": { "type": "user", "id": "…" }
}
```

`entity.type` is `thing`, `reading` or `reminder` (`webhook` for a test); `changed_fields` names
the fields a write changed, and is empty for a reminder; `actor.type` is `user`, `token` or
`system`.

**Send a test** posts a `ping` event, sent once and not retried, and shows the status your server
answered with: the quickest way to check a new address.

## Checking the signature

Every delivery carries a `Kept-Signature` header:

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`t` is when it was signed (Unix seconds). `v1` is an HMAC-SHA256, with the webhook's secret, of
`<t>.<body>`: the timestamp, a dot, then the exact request body. Your server computes the same
HMAC, compares it with `v1` in constant time, and refuses an old `t` (more than five minutes,
say). The secret's dialog has a ready-made **Check a delivery (Node.js)** snippet.

## The secret

The signing secret is shown once, when the webhook is made: copy it then. Kept keeps it sealed to
sign with, and never shows it again. Lost it? **New secret** makes another; the current one stops
working at once, so deliveries fail to verify until your server has the new one.

## Deliveries

Each webhook's **Deliveries** lists the last 30 days, newest first: one row per delivery, with its
state, the status your server answered (or none) and how many attempts it took.

- **Waiting to send**: queued.
- **Delivered**: your server answered with a 2xx status.
- **Failed, trying again**: any other answer, no answer within 10 seconds, or a redirect (Kept
  doesn't follow redirects). Kept tries again.
- **Gave up**: 10 attempts over about 24 hours all failed.

At most 10 deliveries a second go out per location, so a burst of changes doesn't flood your
server.

When a delivery gives up, the webhook is marked **Failing since** that date and instance admins get
an alert. It keeps sending; the next delivery that gets through clears the mark.

A webhook is switched **Off** when an owner or admin turns it off, or when the person who made it
is no longer an admin of the location. Deleting one is final: Kept stops sending to it and its
deliveries are forgotten.

## Your own webhook, for reminders

Separate from a location's webhooks, **Settings → Me → Notifications** can add a webhook as one of
your own channels, next to email, push, ntfy, Telegram and Apprise ([reminders](/users/reminders/)).
It gets one POST per reminder (`reminder.due`) with ids, the reminder's kind, its source type and
due date, the thing, place or location it's about, and a link back to Kept: no names or values.
It is signed the same way, with a secret shown once.

A failed send is retried up to 10 times over about 24 hours; if none gets through, the channel is
marked **Failing since** and Kept emails you once. **Test** sends one now. You can have up to five.

## Addresses on your own network

Kept refuses to post to private addresses (such as `192.168.x.x`), so a webhook can't be aimed at a
router or another service on the server's network. An instance admin can allow them in
**Admin → Sign-up** (**Allow private addresses**), for a receiver you host yourself, such as Home
Assistant. The same switch lets an AI provider, a Homebox import and an OIDC sign-in reach that
network, so turn it on knowing who can add those. See the
[security model](/admin/security-model/#outbound-requests-ssrf).
