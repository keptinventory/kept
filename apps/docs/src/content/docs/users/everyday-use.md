---
title: Everyday use
description: Home, places and boxes, the spreadsheet view, things and labels, paperwork, search, moving things, vehicles, reminders, sharing and the insurance report.
---

Kept answers three questions about everything you own: where it is, what paperwork it has, and
what it needs next. This page walks through the screens that do that. Which of them you see
depends on your role and on what each location tracks
([presets and roles](/users/first-run/#3-create-your-first-home)). To click through them before
installing, [try Kept](/try/kept/) with a sample household in your browser.

## Home

Full detail: [home](/users/home/).

Home is what needs you, then where things are. On a phone it is one column in this order; on a
computer, locations and recent activity sit on the left, shortcuts and Insights on the right.
## Locations, rooms and boxes

Full detail: [locations, rooms and boxes](/users/locations/).

Everything sits in a tree: a **location** (Home, Garage, a storage unit) holds **rooms and
spots** ("room or spot" is Kept's word for any place), which hold **things**. A thing can be a
**box or container** that holds other things, as deep as you like. Each location also has
**Unplaced**, for things that don't have a place yet.
## The spreadsheet view

Full detail: [the spreadsheet view](/users/spreadsheet/).

On a computer (a window 1024 pixels wide or more), a location's **Table** shows every thing in it
as a row, for tidying up many things at once. Phones keep the lists.
## Things

A thing's page has its photos, its name and **ID**, its full path, and sections for what it
tracks: **Details**, **Paperwork and warranties**, **Value**, **Meters**, **Loans**, **Claims**,
**Links**, **Schedules** and **History**. Sections whose module is off in the location don't show.

- **Edit** opens the fields in place. If someone else changed the same field since you opened it,
  Kept shows both values and asks: **Keep mine**, **Keep theirs** or **Edit**. Fields only one of
  you changed merge without asking.
- **Actions** has Move, Lend, Label, Split, Duplicate, Save as template, Mark seen, Not here,
  Change lifecycle (sold, given away, thrown out), Archive, Re-type, Convert to a room or spot,
  and Move to Trash.
- **Archive** is for a thing that's still yours but put away: the winter tyres, the old phone in
  a drawer. Like a sold thing it leaves the lists of things in use and stops its reminders, and
  its page shows **Archived** with **Unarchive** beside it, one tap back into use. Filter lists
  and search by **Archived** to find them. Both can be undone.
- **History** lists every change with who made it; most changes can be undone from there or from
  the toast that follows them. **Activity** in the menu is the same across your locations.
  Each change is one sentence: "Put Galaxy S23 on the map in Office", "Captured Bosch drill, 18 V
  from a photo", "Made an insurance report for Home". A field set for the first time shows its value; a
  map arrangement with more than five changes says how many, and **Show** lists them.

  ![Activity in Home: Arranged the map with four changes listed under it, a capture showing the name and model it got, and an insurance report with 8 things and photos](../../../assets/screens/activity-desktop-light.webp)

  ![The same activity in the dark theme](../../../assets/screens/activity-desktop-dark.webp)
- **Trash** keeps trashed things for 30 days; members and above restore, admins delete for good.
- **Passwords and codes** (the Complete preset) are secret fields: hidden until someone allowed
  to reveals one, which is logged.

Viewers see the same page with no actions except **Copy link**.

## Short IDs and labels

When a new thing reaches the server it gets a short ID: six letters and digits, like `7KQ-4MZ`,
never reused. Until then it shows **ID pending**. A label carries the ID as text and in a QR code
that opens the thing. A label keeps its code for good, so a lost one reprints the same.

**Printing** (Labels in the menu, or **Label** on a thing): choose what to print (a selection,
**Label everything unprinted** in a location or place, or a **Blank sheet**), choose the **Label
stock**, pick where to start on a partly used sheet, and print from the browser. Stocks include A4
sheets of 24 and 65 labels, a Letter sheet in the Avery 5160 layout, and 50 × 30, 40 × 30 and
62 × 29 mm rolls for label printers. The **Sheet preview** is the print itself, smaller: the same
QR codes, names and places, broken over the same lines. A name is never cut short: a long one
wraps and its type gets smaller, and one that still doesn't fit is listed before you print, with
a link to rename it. The page is set to the sheet's paper with no margins, so the print dialog's
defaults (scale 100 %) put every label in its cell.

Afterwards, **Printed OK?** asks about the batch you just printed and records it. **Recent
batches** shows what each one holds, when and where it was made and whether it printed; one not
confirmed yet can be marked **Printed OK** or **Not printed** there, and reprints with the same
codes. Printing the same things again while their sheet is unconfirmed offers that sheet
instead of a new one. Things whose ID is still pending can't be printed yet.

**Scanning**: **Scan** on Home and Search opens the camera.

| You scan | Kept |
|---|---|
| A Kept label for something you can see | Opens it and marks it seen just now |
| A blank label | Offers **New box here** or **Attach to an existing thing** |
| A product barcode | Offers to add it as a new thing; with barcode lookup turned on by the admin, it's named from Open Food Facts, Open Products Facts or Open Beauty Facts |
| A serial number or asset tag that a thing has | Opens that thing |
| A barcode a thing has | Opens that thing; several things ask which |
| A code nothing has yet | Names its type and offers to add it as a new thing, keeping the code as its barcode or its serial number |
| A Homebox label, after a [Homebox import](/users/import-export/) | Opens the imported thing |
| Anything else | Says it isn't a Kept label |

The codes Kept reads, and where a new thing keeps them:

| Code | Usually on | Kept keeps it as |
|---|---|---|
| QR code | Kept labels, Homebox labels | The label |
| EAN-13, EAN-8, UPC-A, UPC-E | Products | Barcode |
| Code 128, Codabar | Shop, asset and library labels | Barcode |
| ITF-14 | Cartons | Barcode, when its check digit is right; otherwise you pick |
| Code 39, Code 93 | Asset tags, IT stickers | Serial number, or Barcode if you pick it |
| Data Matrix | Electronics, chargers, parts | A GS1 code: its GTIN as the barcode and its serial as the serial number. Plain text: you pick |
| PDF417, Aztec | Shipping labels, warranty cards, tickets | You pick; text too long for either field (64 characters for a barcode, 100 for a serial number) isn't kept |

A Kept label wins in any of these. A serial number matches exactly as it was stored, and only
online: the phone's offline copy holds no serial numbers. GS1 codes typed with brackets, like
`(01)04006381333931(21)K7Q2X9`, are read the same way.

A worn label, or no camera: **Type the code**. The Capture camera recognises Kept labels too, and
offers to open that box or capture into it.

## Photos, receipts, manuals and warranties

Photos go on the thing; everything else goes under **Paperwork**, kept as the original file:
**Add a file**, then say what it is (Receipt, Invoice, Manual, Warranty, Registration, Proof,
Document). A file Kept can't preview yet is kept anyway and marked **Preview unavailable**.

- **Capture's modes** (Thing, Receipt, Label, Reading): with AI connected, a receipt fills in the
  purchase, a label fills in brand, model and serial, and suggested values wait in the **Inbox**
  for you to accept. Prices, dates and serials are never accepted for you.
- **Email-in** (Location settings → Email-in, owners and admins): Kept checks one folder of a
  mailbox you already have, over IMAP, every 10 minutes. Each message's photos and PDFs, or its
  text when it has none, become a draft receipt in the **Inbox**. Only mail that arrives after you
  connect is read, and nothing in the mailbox is changed: no message is marked read, moved or
  deleted. Filter receipts into a folder such as `Kept`; **Only from these senders** keeps out
  noise, but a From address can be forged, so it isn't a security check. A wrong password, or the
  person who connected it no longer administering the location, turns it off until it is saved
  again.
- **Warranties** (Household and Complete) show a coverage bar from purchase to the end date. A
  **claim** records a repair or replacement, and a claim that cost nothing shows "Warranty saved
  you".
- **Paperwork** in the menu is the location's own documents (the lease, the home insurance), and
  **Expiring** lists things, documents and warranties by date. Text in PDFs is searchable.

## Search

Full detail: [search](/users/search/).

**Search** finds things by name, brand, serial, ID, place, or the words AI added as aliases, and
groups results into things, places, people, shops and documents (with a snippet of the receipt
text). Filters narrow by location, place, type, tag and state; **Saved searches** keep a filter
set for you or a whole location. On a computer, ⌘K or Ctrl+K opens the same search from anywhere.
## Moving things

- **Move** on a thing picks the new place. Moving into another location you belong to warns who
  will lose sight of it.
- **The tray**: **Pick up** several things (from their menu, or by scanning), then open the
  destination and **Move here**, or **Scan destination**. The tray stays with you offline.
- **Box check** on a box: tick what's there (with a count for "found 4 of 6"), add **Found
  something else**, and anything left unticked becomes *not here*.
- **Mark seen** and **Not here** keep "last seen" honest, so a thing nobody has seen for a while
  shows up on Home.
- **Moving house**: pack into numbered boxes, track them in the van, and scan each one at the
  other end to unpack it into its room ([moving house](/users/moving/)).

## Vehicles and machines

Any thing whose type is metered (a car, a generator, a boiler) has **Meters**: log a reading, log
a service, set schedules by date or by reading, and record fuel. **Vehicles** (Household and
Complete) gathers the vehicles in one place, each with tabs for its overview, readings, services,
documents, costs and, on Complete, fuel.

Full detail: [vehicles and machines](/users/vehicles/).

## Reminders and notifications

Kept reminds you of schedules due, warranties running out, registration deadlines, documents and
things that expire, overdue loans, meters not read lately, low stock, members joining and
leaving, and AI spending caps. Home's **Needs you** shows what's due or overdue; the bell opens
the notification centre, where **Complete**, **Snooze**, **Renew** and **Mark returned** act in
place. **Settings → Me → Notifications** chooses what reaches you and how, including a **Daily
digest**, **Quiet hours** and a private **Calendar feed** link.

Full detail: [reminders and notifications](/users/reminders/).

## Sharing a location

A location is shared by inviting people to it, each with a role and an optional end date
([invites and roles](/users/first-run/#5-invite-people)). Owners and admins manage the
**Members** page in Location settings; anyone but the owner can **Leave this location**. Your
Personal location is never shared. **Share links** show someone without an account what's in a
box, a place or a search, read-only.

Full detail: [sharing a location](/users/sharing/).

## Reports: the inventory, insurance and claims

A location prints three documents: the inventory PDF, an insurance report with totals, and a
claim pack for an incident.

Full detail: [reports, insurance and claims](/users/reports/).

## Condition reports (renting)

Full detail: [condition reports](/users/condition-reports/).

**Condition reports** on a location's page record how a rented home was when you moved in, and
when you moved out, for a deposit dispute.
## Insights

Full detail: [insights](/users/insights/).

**Insights** (in the sidebar, and under More on a phone) shows, across your locations with Money
on, or one location picked with the **Location** chip:
