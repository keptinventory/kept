---
title: Scan sessions
description: Count a room, pack boxes or move things by walking past their labels with the camera open. Every label in view is read, each once, online or offline, and nothing changes until you finish.
---

A **scan session** keeps the camera open while you walk. Every Kept label in view is read,
several at a time, and counted once. Use it to:

- **Count** a room, a shelf, a box or a whole location: what you scan is marked seen, and the
  summary shows what's missing and what turned up somewhere else.
- **Pack into** boxes: everything you scan goes into the current box. Scan the next box to switch.
- **Move to** a place or a box: everything you scan moves there.

A session holds up to 5,000 labels and works with no signal once the phone has opened a session
online: the screen is fetched the first time it's used, then kept on the phone.

## Start a session

- **Scan → Start a session**, then choose what to do and where.
- From a place's page: **Count here**.
- From a box's menu: **Count this box** or **Pack into this box**.
- From a move's page: **Pack boxes**.
- From a room's card on the map: **Count this room**.

Where isn't picked yet, choose it from the list or tap **Scan its label**.

For a count of a place, **Include the places inside it** is on by default. Turn on **A box you
scan counts what's inside it** when you count boxes without opening them.

## While you scan

| You scan | Count | Pack into, Move to |
|---|---|---|
| A thing on the list | Found, green, the counter goes up | Added, green |
| The same label again | A soft tick, no count | The same |
| A thing from another place here | Amber: **Found elsewhere**, with where it should be | Added |
| A thing from another location | Amber, with the location | Added if you can edit both |
| A thing in a location you only view | Grey: **View only here** | Grey, not added |
| A place's label | Kept suggests counting it from its own page | Refused: a room can't be moved |
| A blank label, or a code on several things | Kept for the summary | The same |
| A product barcode | Matched to the thing that carries it | The same |
| A serial number or asset tag (Data Matrix, Code 39…) | Matched to the thing that has it, online | The same |
| A code this phone doesn't know, offline | **Check later** | The same |

The counter reads "312 of 340" for a count. Each read plays a short tone and draws a box on the
label: green for a new find, amber for elsewhere, grey for anything else.

- **Undo last read** takes the last one back.
- **Pause** stops the camera. A minute with no reads pauses it too.
- **Target** (Pack into, Move to): tap it, then scan the next box or place.
- **USB or Bluetooth barcode scanners** work on the same screen: what they type is read like a
  label.
- **Torch** shows on phones that have one (Android).

Close the app, reload or lose battery: the session stays on the phone. **Scan → Resume session**
picks it up.

## Finish and save

**Finish** shows the summary. Nothing has changed yet.

- **Found**: marked seen, at the time each label was read.
- **Missing**: left alone by default. Choose **Mark not here** for each, or **Mark all not here**.
- **No label**: things on the list without a label. Tick the ones you saw.
- **Found elsewhere** and **In another location**: left alone, or **Move here**.
- **Unmatched**: blank labels and codes that match several things. Claim blank labels from Scan,
  one at a time.

A count also lists what is lent out or in repair (never missing), and what is in a place inside it
that nobody counted (**Not counted**, until you tap **I checked it**). A thing counted in number
has **−** and **+** on its row. Every result is kept: see [Counts and stocktakes](/users/counts/).

**Save** sends the session. Offline, it waits on the phone and saves once you're back online.
The session is one entry in **Activity**, "Counted Garage: 312 of 340", with **Undo** for 7 days.
Undo puts back every seen date, every "not here" and every move, unless something has changed
since.

A thing trashed while you walked is left out of the save, and the summary after saving says how
many were.

## Who can do what

| | Owner, admin, member | Viewer |
|---|---|---|
| Count | Saved | A check: the same screen and totals, nothing saved |
| Pack into, Move to | Where you can edit both the thing and where it goes | Not offered |

If your role changes while you walk and you can no longer edit there, the save is refused and
the session stays on the phone with its summary.

## iPhone limits

- No vibration: web apps can't vibrate on iPhone. The tone and the coloured box carry each read.
- The screen may still dim in the installed app: keep it awake in **Settings → Display &
  Brightness → Auto-Lock** while you walk a big count.
- Reading can be slower on older iPhones. Hold the phone a little further from close-packed
  labels so several fit in view.
- No torch control from the web.
