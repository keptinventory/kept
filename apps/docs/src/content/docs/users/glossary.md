---
title: Glossary
description: "Terms used throughout Kept, explained in plain language."
---

Kept uses a few words in specific ways. This page defines them.

## A

**Admin:** a role in a location. Can invite and remove members and viewers, change settings and
modules, import and export, make share links and claim packs, and delete permanently. Only the
owner grants or removes admins.

**AI provider:** a service (Groq, OpenAI, Anthropic, Google, OpenRouter, or a local Ollama server)
that Kept calls to name things from photos, read receipts, search by meaning, and run the
assistant. You bring your own key.

## B

**Backup:** a nightly encrypted restic snapshot of the database, files and a readable copy of
every location, to another disk, an S3 bucket or an SFTP server.

**Box / container:** a thing that holds other things. Boxes can nest: a box inside a box inside a
room.

## C

**Capture:** taking a photo of a thing so Kept can identify it. Captured things wait in the Inbox
until they're named.

**Claim pack:** a ZIP of the insurance report with every receipt, invoice, photo and serial for an
incident, shared with the insurer by a download link.

**Condition report:** a record of how a rented home was when you moved in and when you moved out,
for a deposit dispute.

**Consumable:** a thing tracked by quantity (screws, oil, batteries). Used in services via
**From stock**.

## H

**Hand-over:** lending a box with everything inside it, each thing on its own line. The box keeps
a parts list of what should be in it.

## I

**Incident:** a record of a burglary, fire, flood or loss, with the things affected.

**Inbox:** the review queue. Captured things wait here to be named, AI-suggested values wait to
be accepted, and anything Kept isn't sure about lands here for a look.

**Insurance report:** a PDF and CSV of every thing with its photo, brand, model, serial, purchase
date, price, current value and receipts, with totals per place and per currency.

**Instance:** one running Kept server. An instance can hold many locations (homes, garages,
storage units).

**Instance admin:** the person who runs the server: users, sign-up, backups. An instance admin
can't see inside anyone's home unless they're invited.

## K

**Kit:** a container with a parts list of what should be in it. Lending one out is a hand-over.

## L

**Location:** a home, garage, storage unit, office or other place you track. Each location has
its own members, roles, modules and settings.

**Lending:** giving a thing (or part of a quantity) to a member or a contact, with a due date and
condition photos.

## M

**Managed account:** an account for someone without email (like a child), made by the location's
owner or an admin.

**MCP (Model Context Protocol):** a way to connect an AI client (Claude Desktop, ChatGPT) to
Kept's data.

**Member:** a role in a location. Can add, edit, move, lend and trash things, log readings and
services, print labels, and use AI capture. Money is visible.

**Meters:** readings, services and schedules for anything with a meter: a car, a generator, a
boiler.

## N

**Needs you:** Home's six counts: Overdue, Due, Expiring, Lent out, Uncertain and Low stock.

## O

**Owner:** the role that holds a location. Everything an admin can do, plus two-factor rules,
transfer and deletion. There is one owner.

## P

**Personal location:** your private location, created automatically. Never shared, no members, no
invites, no share links.

**Place:** a room or spot inside a location — a room, a shelf, a drawer, a floor. A box is a
thing, not a place.

**Preset:** a set of modules turned on for a location: Essentials, Household or Complete.

## R

**Reading:** a meter reading (odometer, hour meter) logged for a vehicle or machine.

**Recovery kit:** everything needed to bring Kept back on a new server: the secret keys, the
backup's location, its password and storage keys, and the restore steps. To print or save.

**RLS (row-level security):** the database mechanism that keeps households apart: every query is
scoped to the signed-in person.

## S

**Schedule:** a reminder to do something again, by date or by reading (oil change, tyre rotation).

**Secret field:** a field on a thing, such as a password or a code, that's encrypted and hidden
until someone allowed to reveal it does. Each reveal is logged.

**Share link:** a read-only link showing what's in a box, place or search, without an account.

**Short ID:** the six-character identifier on every thing and place, used for labels and search.

**Stocktake / count:** counting what's in a place and comparing with what Kept thinks is there.
See [counts and stocktakes](/users/counts/).

## T

**Thing:** anything you track: a tool, a document, a vehicle, a box.

**Trash:** where deleted things go. They're kept for 30 days; members and above can restore them,
and admins can delete them for good.

## U

**Unplaced:** the place inside a location for things that don't have a place yet.

## V

**Vehicle:** a thing whose type is Vehicle or under it — a car, motorbike, bicycle or generator.
Readings, services and schedules; on Complete, fuel tracking. A boiler has Meters but isn't a
vehicle.

**Viewer:** a role in a location. Can look and search only. Money is hidden unless the location
allows viewers to see it; the assistant answers but can't change anything.

## Related

- [Everyday use](/users/everyday-use/) for how things work.
- [First run](/users/first-run/) for getting started.
- [FAQ](/users/faq/) for common questions.
