---
title: Tags
description: Tags say what else a thing is, beyond where it is. Add them anywhere, filter by several, open a tag's page, and tag on a phone with no signal.
---

**Places** say where a thing is. **Tags** say what else it is: *camping*, *winter*, *kids*,
*fragile*. A thing can have up to 50 tags; an account up to 1,000.

Tags belong to the account, so every location of it shares them. Only things have tags (boxes
are things); places, documents and people don't.

## Adding tags

- **A thing's page:** **Tags → Add tag**. Pick one, or type a new name and **Create**. A name
  close to an existing tag is listed first under **Did you mean**, so *Campng* doesn't become a
  second *Camping*.
- **Adding a thing:** the **Tags** field in **Add a thing**.
- **Capture:** **Add tags** under the name. The tags stay for the next photos, as the place does.
- **Many at once:** **Select** in a place's contents, a tag's page or the Inbox, then
  **Add tags…** or **Remove tags…**. Other tags stay as they are.
- **Spreadsheet view:** the **Tags** column and **Tags…** for a selection.

Every change has **Undo**.

## Who can do what

| | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| See tags, filter by them | ✓ | ✓ | ✓ | ✓ |
| Tag things, make a new tag | ✓ | ✓ | ✓ | |
| Rename, recolour, merge, delete a tag | ✓ | ✓ | | |

## Colours

Each tag has a colour from a fixed set of twelve, chosen to read in light and dark. A new tag
takes the colour used least. Change it in **Settings → Account → Tags → Edit**. Colours from a
Homebox import become the nearest of the twelve.

## A tag's page

Click a tag on a thing's page, or a row in **Settings → Account → Tags**. It lists everything with
the tag across your locations, with how many in each, and the list's usual search, filters and
grouping. Owners and admins rename, recolour, merge and delete it here.

- **Merge** folds one tag into another: its things get the other tag.
- **Delete** works only for a tag no thing has, including things in the Trash. Merge instead.
- Rename, recolour, merge and delete can be undone for 7 days.

## Finding by tag

- **Filter → Tag:** **is any of**, **has all of** (things with every chosen tag) or **is none of**.
- **Display → Group: Tag** lists each thing under its first tag, A to Z; untagged things last.
- Search finds tag names, and searching by meaning knows them too.

## Offline

The phone keeps your tags: chips show, and the tag filter works in offline search. Tags you add
or take off, and tags you make, are saved on the phone and sync when you're back online.

## AI and MCP

- **Capture:** with AI on, a photo suggests tags from your own list, never new ones. Confirm or
  reject them in the Inbox.
- **MCP and the assistant:** `get_thing` returns tags; `list_tags` lists them; `tag_things` adds
  or takes them off; `search_things` takes several tags, any or all; `add_thing` and
  `update_thing` take tag names.

## Imports

- **Homebox:** tags come across with their colours; nested tags are flattened. Tags on Homebox
  locations aren't kept, and the import report says so.
- **CSV:** a `tags` column makes the tags it names.
