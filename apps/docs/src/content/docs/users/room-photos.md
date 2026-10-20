---
title: Room photos
description: Photograph a room, a cupboard or a shelf, and Kept lists what is in it as drafts in the Inbox, each with its own picture, skipping what Kept already has.
---

**Room** is a capture mode for filling Kept quickly: take up to five photos of a room, a
cupboard or a shelf, and AI lists every object it sees. Kept merges the same object seen in two
photos, leaves out what is already in Kept, and puts the rest in the Inbox as drafts already in
that room, each with its own picture cut from the photo.

## Before you start

Room mode reads photos with AI, so it needs what other AI capture needs:

- **AI capture** on in the location (an owner or admin turns it on, in **Location settings → What
  to track**), and an AI provider that reads photos ([AI providers](/users/ai-providers/)).
- You can edit things in the location: members, admins and owners. Viewers don't see the mode.

When Room can't run, the mode says why instead of hiding: AI capture is off in the location, no
provider that reads photos is set up, or the AI budget is used up for now.

## Take the photos

1. Open **Capture**, then **Room** on the mode strip. From a place's page, **Fill from photos**
   opens it on that place; on the [location map](/users/location-map/), a room's card has
   **Photograph this room**.
2. Check where the photos go: the place chip at the top. A room capture goes into a room, a spot
   or a box, never the Unplaced area.
3. Take 1 to 5 photos, or pick them with **Gallery**. Stand in the doorway and take one photo
   per wall. Each photo waits in the tray, where you can remove it.
4. **Send**. Offline, the photos wait on the phone and go when it is back online, like any capture.

Kept labels in the photos are read on the phone before they are sent. A thing whose label shows
is known for certain, wherever it is in the location.

## Review the room

The Inbox shows one **Room** card at the head of the capture's batch, with the drafts it made
under it:

- **New things**: each a draft in the room, with its own picture, name, brand, model, colour and
  type filled in where the photo showed them. Accept, edit or discard them as any draft, or
  **Accept names** for the whole batch. A draft that looks like a thing you already have is
  flagged as a likely duplicate.
- **Furniture that holds things** (shelves, bookcases, cabinets, wardrobes, chests of drawers):
  **Add as a place** makes each a place inside the room, so things can go in it. Other furniture
  (a sofa, a bed, a table) is a draft like any thing.
- **Already in Kept**: things the photos showed that the room already has, by the same label, the
  same brand and model, or the same name. Tick them and **Mark seen**. A thing whose label was
  read starts ticked.
- Each photo says what it gave. "Couldn't read photo 3" means that photo failed and the others
  still count; "This photo had more; take a closer one" means it showed more than one photo can
  list (60 objects).

People, pets and the room itself (walls, floors, windows, doors, fixtures) are never listed, and
no picture is ever cut of a person.

**Done** closes the card. **Discard** drops the photos. When no photo could be read, **Retry**
reads them again.

### On the map

When the room is drawn on the [location map](/users/location-map/), each accepted thing is put on
the room's floor with a shape guessed from its type and name, in a free spot. The next time you
**Arrange**, the map lists what Kept placed, so you can move each where it really stands. Kept
placing things never interrupts someone arranging the map at the same time.

## What it costs

Each photo is one AI read, and a capture of more than one photo adds one short text-only call
that merges what the photos have in common. Before you send, the tray shows an upper bound, such
as "About 3 photos · up to ~31,000 tokens · Groq": the photo, the instructions and the longest
answer Kept allows, for each photo; a shorter answer costs less. A model that thinks before it
answers bills its thinking on top.

Room reading counts against the same budgets and caps as other photo reading. When a cap is
reached, the card says "Waiting for the AI budget", and the photos are read when AI resumes. Each
call shows in **AI usage** as **Room photo** or **Room photos merged**.

## Privacy

- What the provider receives is the same as for any capture: a copy of each photo with location
  and camera data removed, and the fixed instructions.
- **The full room photos are deleted when you close the room card** (Done or Discard). Each
  draft keeps only its own cut-out picture.
- To keep the full photos instead, an owner or admin turns on **Keep room photos after review** in
  **Location settings → General**. They then stay on the room's page after Done.
- While a room is being reviewed, its photos are on the room's page, visible to everyone who
  sees the location.

## In Try Kept

[Try Kept](/try/kept/) has no camera and runs no AI: Room mode offers **Use a sample room photo**,
an illustrated room, and every room photo gives the same sample results, so you can see the Room
card, the drafts and the furniture without a provider.
