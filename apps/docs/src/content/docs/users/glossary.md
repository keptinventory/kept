---
title: Glossary
description: "The words Kept uses in its own way, in plain language."
---

Kept uses a few words in its own way. This page says what each one means and where to read more.

## A

**Admin**: a role in a location. Can invite and remove members and viewers, change settings and
modules, import and export, make share links and claim packs, and delete permanently. Only the
owner grants or removes admins. [The roles](/users/first-run/#the-roles)

**AI provider**: the service Kept calls to name things from photos, read receipts, run the
assistant and, with an embeddings model, search by meaning: Groq, OpenAI, Anthropic, Google,
OpenRouter, or an OpenAI-compatible server such as Ollama. You bring your own key.
[AI providers](/users/ai-providers/)

## B

**Backup**: a nightly restic snapshot of the database, the files and a readable copy, encrypted
with a password you choose and sent to another disk, an S3 bucket or an SFTP server.
[Backups](/admin/backups/)

**Box**: see Container.

## C

**Capture**: adding a thing by taking its photo. With an AI provider, Kept names it from the photo;
without one, it waits in the Inbox for a name.

**Claim pack**: a ZIP of the insurance report with every receipt, invoice, photo and serial for an
incident, shared with the insurer by a download link. [Reports](/users/reports/)

**Condition report**: a record of how a rented home was when you moved in and when you moved out,
for a deposit dispute. [Condition reports](/users/condition-reports/)

**Consumable**: a thing counted by quantity, such as screws, oil or batteries, with a minimum that
raises a low-stock reminder. A service can take one **From stock**.

**Container**: a thing that holds other things, such as a box or a bag. Containers nest, a box in a
box on a shelf. A container is a thing, not a place.

**Count**: counting a place, or checking a box, against what Kept expects to be there. Every count
is kept, with what was found and what was missing. Also called a stocktake.
[Counts and stocktakes](/users/counts/)

## H

**Hand-over**: lending a box with everything inside it: one record, with a line for the box and
one for each thing in it, each coming back on its own. [Kits and hand-overs](/users/kits/)

## I

**Inbox**: where things wait for you: captures without a name, what AI read that needs a look,
receipts from email-in, readings that look off, and phone changes that need a decision.

**Incident**: a burglary, fire, flood or loss, with the things it affected.
[Reports](/users/reports/#incidents-and-claim-packs)

**Instance**: one running Kept server, with its accounts and locations.

**Instance admin**: a person who runs the server: users, sign-up, backups. An instance admin can't
see inside a location unless invited to it.

**Insurance report**: a PDF and a CSV of every thing with its photo, brand, model, serial, purchase
date, price, current value and receipts, with totals per place and per currency.
[Reports](/users/reports/#insurance-report)

## K

**Kit**: a container with a parts list of what should be in it. Move a part out, lend it or lose
it, and the kit still knows. [Kits and hand-overs](/users/kits/#kits)

## L

**Lending**: recording that a thing, or part of a quantity, is with someone, with a due date, its
condition and photos.

**Location**: a home, garage, storage unit, office or any other place you keep things. Each has its
own members, roles, modules, time zone and currency.

## M

**Managed account**: an account with a username and no email, for a child or a parent, made by a
location's owner or an admin. A location holds at most 20.
[People without email](/users/first-run/#people-without-email)

**MCP** (Model Context Protocol): how an AI app such as Claude connects to Kept to find and change
things, within your role. [Connect an AI client](/users/mcp-clients/)

**Meters**: readings, services and schedules, for a thing whose type has a meter: a car, a
generator, a boiler. [Vehicles and machines](/users/vehicles/)

**Member**: a role in a location. Can add, edit, move, lend and trash things, log readings and
services, print labels, and use AI capture. Money is visible.

**Module**: a part of Kept switched on or off per location, such as Lending or Vehicles.
[Modules and presets](/users/modules/)

## N

**Needs you**: Home's counts of what wants attention: Overdue, Due, Expiring, Lent out, Uncertain
and Low stock. [Home](/users/home/)

## O

**Owner**: the role that holds a location. Everything an admin can do, plus two-factor rules,
transfer and deletion. There is one owner.

## P

**Personal location**: your own location, made with your account. It's never shared: no members,
invites or share links.

**Place**: a room or a spot inside a location: a floor, a room, a shelf, a drawer. A box is a
container, not a place.

**Preset**: the set of modules a location starts with: Essentials, Household or Complete.
[Modules and presets](/users/modules/)

## R

**Reading**: a meter's value at a moment, such as an odometer or an hour meter.

**Recovery kit**: the server's keys, the backup's repository and credentials, and the restore
steps, to print or save somewhere other than the server. Without it, a backup can't bring back AI
keys or stored passwords. [The recovery kit](/admin/recovery-kit/)

**RLS** (row-level security): the database rules that keep locations apart: every request sees
only what the signed-in person may see. [Row-level security](/developers/rls/)

## S

**Schedule**: something to do again, by date or by reading, such as an oil change.
[Reminders](/users/reminders/)

**Secret field**: a field on a thing, such as a Wi-Fi password or a door code, stored encrypted and
hidden until someone allowed to reveals it. Each reveal is logged.

**Share link**: a read-only link to what's in a box, a place or a search, for someone without an
account. [Share links](/users/sharing/#share-links)

**Short ID**: the six-character code every thing and place has, like `7KQ-4MZ`, printed on its
label. [Short IDs and labels](/users/short-ids/)

**Stocktake**: see Count.

## T

**Thing**: anything you keep track of: a drill, a car, a box of cables.

**Trash**: where trashed things wait for 30 days. Members and above restore them; admins delete
them for good.

## U

**Unplaced**: the spot every location has for things that don't have a place yet.

## V

**Vehicle**: a thing whose type is Vehicle or a type under it: a car, a motorbike, a bicycle, a
generator. Vehicles get readings, services and schedules, and fuel on Complete. A boiler has
Meters but isn't a vehicle. [Vehicles and machines](/users/vehicles/)

**Viewer**: a role in a location. Can look and search only. Money is hidden unless the location
allows viewers to see it; the assistant answers but can't change anything.

## Related

- [Your first minutes](/users/first-run/) for getting started.
- [FAQ](/users/faq/) for common questions.
