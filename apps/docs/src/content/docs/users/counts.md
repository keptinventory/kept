---
title: Counts and stocktakes
description: Every count and box check is kept, with what was found, what was missing and where each thing is now. Count a place together, plan a count every few months, compare with the last one and export a CSV.
---

A count keeps every result. **Counts** lists each count and box check of a location, newest
first, and a count's page shows what it found, what it left missing, and where each thing is now.

Open it from **More → Counts**, from a location's page (**Counts**), or from a place's page
(**Past counts**). After saving a count, **See this count** opens it.

## The Counts list

Search by what was counted, and filter by kind (counts, box checks), place, who counted, **Had
missing** and date. Group by place, person or month. The list is paged, and every filter is in
the address, so a filtered list can be bookmarked or saved as a view.

## A count's page

- **Found X of Y**, when, how long it took, who counted (everyone, in a shared count) and who
  finished it.
- **Since the previous count** of the same place or box: "1 newly missing · 0 found again · 2 new
  things", with a link to the previous one.
- Its lists, each row linking to the thing with where it is now:

| List | What it means |
|---|---|
| Found | Read during the count: marked seen |
| Missing | On the list, not read, and not marked not here |
| Found elsewhere | Read here, but Kept had it somewhere else, and you left it there |
| Moved here | Found elsewhere, and moved here |
| Marked not here | Chosen on the summary |
| Lent out, In repair, In the Trash | Never missing: away for a reason Kept knows |
| Not counted: Back shelf | In an area nobody counted (see below) |

A thing trashed since the count still shows, marked **Trashed**.

**Export CSV** saves the count as a spreadsheet: thing, short ID, where it was expected, the
result, how many were found of how many, and where it is now.

Counts saved before Kept 1.14 show their totals; they didn't record what was missing or
elsewhere.

## Never "missing" for a reason

A thing that is lent out, in repair or in the Trash is never listed as missing. The summary gives
each its own group, "With Murdock (3)", "In repair (1)", and the count keeps them that way.

## Not counted, and "I checked it"

A count of a place with places inside it (or of a whole location) has **areas**: the place and
each place inside it. An area where nothing was read is **Not counted**: its things are listed
under "Not counted: Back shelf", not under Missing. If you looked and the area really was empty of
those things, tap **I checked it**: they become Missing.

## Counting in number

A thing with a quantity (6 tins) counts as all of them when its label is read. Use **−** and
**+** on its row to say how many you found. Found short, choose **Mark the rest not here** for
it: the rest is split off as its own row, marked not here, as a box check does. Undo puts it
back together.

## Counting together

A count started online is shared. Anyone else who opens a count of the same place sees **Count
in progress by Sam: Join**. Joining adds what you read to the same count, each read with who read
it; the summary shows what the others found, and their areas count as counted. Anyone counting
there can finish it, and finishing needs a connection. A count joined over several days stays
open until someone finishes it.

## Label coverage

The count's setup says how many of the things there have labels ("62% of things here have
labels"), with **Print labels for the rest**. A thing without a label is never missing: tick it on
the summary if you saw it.

## Planned counts

On a place's page, **Count regularly** plans a count every 1 to 24 months. It is a schedule of the
place, with the usual reminder (a week before), due and overdue, and the Needs-you tile. Counting
that place (with or without the places inside it) marks it done; undoing the count undoes that
too. To count a whole location regularly, plan it on its top place.

## Who can do what

| | Owner, admin, member | Viewer |
|---|---|---|
| See Counts, a count's page, compare, export CSV | ✓ | ✓ |
| Count, join a count | ✓ | A check: nothing saved, not listed |
| Plan a count | ✓, with Schedules on | — |
