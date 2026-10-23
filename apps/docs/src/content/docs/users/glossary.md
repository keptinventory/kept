---
title: Glossary
description: "Terms used throughout Kept, explained in plain language."
---

Kept uses a few words in specific ways. This page defines them.

## A

**Admin** (instance) — The person who runs the server: users, sign-up, backups. An instance admin
can't see inside anyone's home unless they're invited.

**AI provider** — A service (Groq, OpenAI, Anthropic, Google, OpenRouter, or a local Ollama server)
that Kept calls to name things from photos, read receipts, search by meaning, and run the assistant.
You bring your own key.

## B

**Backup** — A nightly encrypted restic snapshot of the database, files and a readable copy of
every location, to another disk, an S3 bucket or an SFTP server.

**Box / container** — A thing that holds other things. Boxes can nest: a box inside a box inside a
room.

## C

**Capture** — Taking a photo of a thing so Kept can identify it. Captured things wait in the Inbox
until they're named.

**Claim pack** — A ZIP of the insurance report with every receipt, invoice, photo and serial for
an incident, shared with the insurer by a download link.

**Condition report** — A record of how a rented home was when you moved in and when you moved out,
for a deposit dispute.

**Consumable** — A thing tracked by quantity (screws, oil, batteries). Used in services via
**From stock**.

## E

**Everyday use** — The main user guide covering Home, places, boxes, the spreadsheet view, things,
labels, paperwork, search, moving, vehicles, reminders, sharing, insurance and insights.

## H

**Home** — The first screen: what needs you, where things are, shortcuts, recent activity,
insights.

## I

**Incident** — A record of a burglary, fire, flood or loss, with the things affected.

**Insurance report** — A PDF and CSV of every thing with its photo, brand, model, serial, purchase
date, price, current value and receipts, with totals per place and per currency.

**Instance** — One running Kept server. An instance can hold many locations (homes, garages,
storage units).

## K

**Kit** — A box lent out with everything inside it, each thing on its own line. A kit remembers
what should be in it.

## L

**Location** — A home, garage, storage unit, office or other place you track. Each location has
its own members, roles, modules and settings.

**Lending** — Giving a thing (or part of a quantity) to a member or a contact, with a due date
and condition photos.

## M

**Managed account** — An account for someone without email (like a child), created by an admin.
Up to 20 per location.

**MCP (Model Context Protocol)** — A way to connect an AI client (Claude Desktop, ChatGPT) to
Kept's data.

**Meters** — Readings, services and schedules for anything with a meter: a car, a generator, a
boiler.

## N

**Needs you** — Home's six counts: Overdue, Due, Expiring, Lent out, Uncertain and Low stock.

## P

**Personal location** — Your private location, created automatically. Never shared, no members,
no invites, no share links.

**Place / room or spot** — Any place inside a location: a room, a shelf, a box, a drawer.

**Preset** — A set of modules turned on for a location: Essentials, Household or Complete.

## R

**Reading** — A meter reading (odometer, hour meter) logged for a vehicle or machine.

**Recovery kit** — A file needed to restore Kept on a new machine after a disaster.

**RLS (row-level security)** — The database mechanism that keeps households apart: every query
is scoped to the signed-in person.

**Room or spot** — Kept's word for any place inside a location.

## S

**Schedule** — A reminder to do something again, by date or by reading (oil change, tyre
rotation).

**Secret field** — A field on a thing, such as a password or a code, that's encrypted and hidden until someone allowed to reveal it does. Each reveal is logged.

**Share link** — A read-only link showing what's in a box, place or search, without an account.

**Short ID** — The six-character identifier on every thing and place, used for labels and search.

**Stocktake / count** — Counting what's in a place and comparing with what Kept thinks is there.

## T

**Thing** — Anything you track: a tool, a document, a vehicle, a box.

**Trash** — Where deleted things go. They're kept for 30 days; members and above can restore them, and admins can delete them for good.

## U

**Unplaced** — The place inside a location for things that don't have a place yet.

## V

**Vehicle** — A thing whose type is metered (car, generator, boiler). Has readings, services,
schedules, and on Complete, fuel tracking.

## Related

- [Everyday use](/users/everyday-use/) for how things work.
- [First run](/users/first-run/) for getting started.
- [FAQ](/users/faq/) for common questions.
