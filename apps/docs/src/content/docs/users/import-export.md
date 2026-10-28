---
title: Import and export
description: Bring things in from a spreadsheet, Homebox or another Kept, and take a location out as a full export with a copy you can read without Kept.
---

Imports and exports live in **Settings → Import** and **Settings → Export**. Both are for a
location's **owners and admins**, run in the background on the server, and need a connection.
For moving a whole server, or a household between servers, see also
[moving to a new server](/admin/move-server/).

## Importing

**Settings → Import** asks where it comes from:

| Source | What it is |
|---|---|
| **A spreadsheet (CSV)** | One thing per row, with a header row naming the columns; also Homebox's own spreadsheet export |
| **A Homebox export** | The ZIP from Homebox v0.26.1 or newer, v0.27.0 recommended (Collection → Tools → Backup & Restore → Create Backup → Download) |
| **A Kept export** | A location exported from this Kept or another one |

Every import is checked before anything is written: **Check the import** shows **What the import
will do**, row by row, with the reason for anything it skips. Then it runs with a progress bar.
You can leave the page; the import carries on, and Settings → Import shows how far it got. If it
stops, **Resume** carries on from the last row. **Cancel the import** keeps what it already
imported.

Running the same import again skips what it already brought in, so a re-run never makes
duplicates. An archive (a ZIP) can be up to 5 GB. Imported things arrive confirmed, not in the Inbox.

### A spreadsheet (CSV)

1. **Choose the file**, and the location it goes into: one you own or administer. A file takes at
   most 10,000 rows (8 MB); split a bigger one.
2. **Match the columns.** For each column, choose the field it goes to, including **A type's
   field…** for your own type fields. One column must be the name: every thing needs one.
3. **A few choices:**
   - A place column like `Garage > Shelf A` makes the rooms and spots: choose the separator, and
     whether to **Make the places the file names that don't exist yet**.
   - Where rows without a place go (Unplaced by default).
   - How dates are written (worked out from the file where it can), and the currency for rows
     with none.
   - **Match the type column to your types by name**, in any of Kept's languages; off, the type
     is kept in the notes.
4. **Check the import**, read the report, and import.

#### Homebox's spreadsheet

Every Homebox can export a spreadsheet (up to v0.25: **Tools → Import/Export → Export
Inventory**). Homebox v0.10.3 and v0.11.0 write it tab-separated
(`homebox-items.tsv`); Kept reads both. When the columns are Homebox's (`HB.name`,
`HB.location`, …), Kept says so, matches the columns itself and reads what a plain spreadsheet
import would drop:

| Homebox column | Kept |
|---|---|
| `HB.asset_id`, and the item's link in `HB.url` (v0.13 and later) | Old labels: a printed Homebox label opens the thing |
| `HB.sold_*` | With a buyer or a price: the thing ended as sold, with its date, buyer, notes and price. A sold date alone stays in the notes |
| `HB.archived` | Your choice: **Archived** (the default), **In use**, or **Leave out**. One with a sale ends sold |
| `HB.warranty_expires`, `HB.lifetime_warranty` | A warranty from the purchase date, where Warranties is on |
| `HB.warranty_details`, `HB.insured` | Lines in the notes |

A price of 0 is read as no price (Homebox writes 0 when none was set). The location rows a
v0.26 or later spreadsheet lists are left out; places come from each item's location path. A
spreadsheet can't carry photos, files, maintenance or items inside items, and custom fields
are only imported if you match them to a type's field. For all of that, use the export ZIP.

### A Homebox export

Kept reads Homebox's own export ZIP, which holds everything, including the files. In Homebox,
open **Collection → Tools → Backup & Restore**, choose **Create Backup**, and **Download** the
backup once it is listed. It exists from Homebox v0.26: use
v0.26.1 or newer (v0.26.0's Docker image loses attachments), and v0.27.0 if you can. A Homebox
older than v0.26 has no export: see
[coming from an older Homebox](#coming-from-an-older-homebox). A ZIP without Homebox's
`manifest.json` is refused with that advice.

:::tip[If Homebox says "Topic has been Shutdown"]
Homebox v0.26 makes one export each time it starts. Restart Homebox and export again, or update
to v0.27.0, which doesn't have this limit.
:::

After the upload, Kept shows the collection and its export date. It goes into **A new location**
or **A location you run**, where things already there stay and a
re-run adds only what's new. A new location is made when you press **Import**, not before: an
import you leave at its check leaves nothing behind. **Connect to Homebox
(optional)** reads the collection's currency, which the ZIP doesn't carry: give Homebox's address
and an API key, or an email and password. They're used once and never stored.

For a new location, **What to track** comes next: **Essentials** (rooms, boxes, labels and search),
and on top of it, ticked, what the backup uses: **Prices on 10 things** turns on Money, **5
warranties** turns on Warranties, **2 maintenance entries** turns on Schedules. Untick one and
that data stays in the things' notes as text, which can't become records later. A backup without
any of it starts with Essentials alone. **Also for Personal** gives your Personal location the
same, so the menu only shows what you track. Change either any time in **Location settings → What
to track**; turning something off never deletes anything.

Then choose:

- **Prices are in**: the currency, asked only when the backup has prices. Choosing one relabels the
  amounts; it doesn't convert them.
- **Archived items**: **Archived** (the default: archived in Kept too, still yours, put away),
  **In use**, or **Leave out**. An archived item with sale details ends sold.
- **Items with quantity 0**: **Keep 0 or archive** (the default: a type you run out of keeps 0,
  anything else comes in archived), **Set to 1**, or **Leave out**. Each one that comes in has
  "Quantity in Homebox: 0" in its notes. An item that holds other items is never archived or left
  out for its 0, and a location that becomes a box has no quantity to check.
- **Add an "Insured" yes/no field**, and **Leave out Homebox's starter places and tags** (the
  eight rooms and six tags every new Homebox collection starts with, when they're unused).
- **These look like boxes**: locations named like a box or bin (Box 01, Bin 2, Kiste 3…) that hold
  no other location. Tick them, or **Choose all**, and they come in as boxes: things that hold
  things, with their tags and what's in them. The rest come in as places.
- **Custom fields**: for each, **Add to the type** or **Keep in notes**.
- **Types**: for each Homebox type, a Kept type, **New type…** with a name you type, or **No
  type**. Homebox 0.27's own types, `global.item` and `global.location`, read as **Item** and
  **Location**, as in Homebox; the catch-all **Item** starts as **No type**.

The check lists every entry that needs a look, each with what happened to it in words, and the
import's page keeps that list after the import: open it from **Activity** (Ran an import).

What comes over:

| Homebox | Kept |
|---|---|
| Collection | One location |
| Locations (nested) | Rooms and spots, keeping the tree |
| Items | Things; an item holding others becomes a box, never its whole type |
| Manufacturer, model, serial | Brand, model, serial |
| Purchase date, shop and price | A purchase with its shop |
| Warranty, lifetime warranty | A warranty |
| Sold details | With a buyer or a price (more than 0): the thing ended as sold, with its date, price, buyer and notes. A sold date alone isn't a sale: the thing stays in use, the date in its notes |
| Tags | Tags with their colours (nested tags flattened) |
| Photos, manuals, receipts, warranty files | Photos, manuals, the purchase's receipt, the warranty's document |
| Links | Links. A link to a document of the [Paperless-ngx](/users/paperless/) the location is connected to (the same address) comes in as a Paperless link, as **Link from Paperless** makes; connect Paperless before you import |
| Completed maintenance | Service records |
| Scheduled maintenance | One-off schedules |
| Templates | Account templates, as far as they map |

Notifiers, members and roles aren't imported. Where a module is off in the location, that
record's text is kept in the thing's notes. A location's description isn't kept (places have no
notes); the check names each one.

Homebox writes dates nobody typed: some upgrades fill empty date fields, and a backup can carry
an empty date as the last day of year 0. Kept reads a date before the year 1000 as no date, and a
sale needs a buyer or a price.

#### Repairing an earlier import

Imports before Kept 1.13.0 turned a quantity of 0 into 1, made a whole type a box type when one of
its items held another (so every thing of it opened on an empty Contents tab), and could create a
type named `global.item`. Imports before 1.14.2 ended a thing sold when Homebox had only a sold
date. Open the import from **Activity** (Ran an import): **Repair this import** lists what it can
put right, by name:

- **Archive the things that had quantity 0 in Homebox** (still in use, with quantity 1);
- **Make the type an ordinary type again** (a thing that holds things stays a box);
- **Rename `global.item` to Item**;
- **Put the things marked sold on a date alone back in use**: sold with no buyer and no price, and
  not changed since. An item archived in Homebox comes back in use too: archive it again by hand.

Tick what you want and press **Repair**. One **Undo** takes it all back.

**Old labels keep working.** Each Homebox asset ID (`000-001`) is remembered and listed under
**Your codes** on the thing. Kept's scanner recognises a Homebox label and opens the imported
thing; if you point the old Homebox hostname at Kept, scanning with the phone's own camera works
too. Homebox's long item and location IDs (the ones in its label links) are remembered for
scanning but not listed. Imported things get Kept codes of their own, which stay out of lists until
you print their labels.

### Coming from an older Homebox

A Homebox older than v0.26 can't make the export ZIP. Two ways in:

- **Everything, photos and maintenance included:** update a copy of Homebox to v0.27.0 and
  export the ZIP from the copy. Tested from Homebox v0.10.3 (the last release of the original
  `hay-kot/homebox`) straight to v0.27.0.
- **Quicker, with less:** import its [spreadsheet](#homeboxs-spreadsheet).

The upgrade can't be undone (from v0.23, Homebox's own notes say so), so it runs on a copy and
your Homebox stays as it is:

1. **Stop Homebox and copy its data folder**, the one mounted at `/data` (`homebox.db` with its
   `-wal` and `-shm` files, and the attachments). Keep the original as your backup.
2. **Start Homebox v0.27.0 on the copy.** Homebox now lives at
   `ghcr.io/sysadminsmedia/homebox`; v0.26 and later need `HBOX_AUTH_API_KEY_PEPPER`, 32 or
   more random characters:

   ```sh
   docker run --rm -p 7745:7745      -e HBOX_AUTH_API_KEY_PEPPER="$(openssl rand -hex 24)"      -v /path/to/homebox-copy:/data      ghcr.io/sysadminsmedia/homebox:0.27.0
   ```

   The first start updates the database in one go. It also adds Homebox's eight starter rooms,
   which Kept leaves out by default when they're empty.
3. **Sign in** with your usual account and open **Collection → Tools → Backup & Restore**.
   Choose **Create Backup**, then **Download** the backup once it is listed.
4. **Import it into Kept** as [a Homebox export](#a-homebox-export).
5. Stop the copy and delete it once the import is done.

Photos added before Homebox recorded file types come through too: Kept checks each file itself.

### A Kept export

A Kept export always comes in as **a new location**, with its things, places, files, condition
reports, moves and history. If it holds secret values, **Open the secrets** with the passphrase chosen when it was exported;
without it, everything else is imported. Opening them needs HTTPS: over plain HTTP the import
screen says so and imports the rest. **People to invite** lists who shared the location;
nobody is invited by the import, so invite each person yourself.

**Condition reports** come back with their days, notes, rooms and photos, and each photo keeps the
time Kept first received it. A finished report comes back finished at the same time, and stays
locked. On the new server, the photos and the finish are under the name of the person who imported
them; the history still shows who did each thing before the import.

**Moves** come back with their boxes: each box's number, state and the room it goes to, and a
move that was done is done again. A move to another location comes in as a move within the new
one, with its rooms to choose again.

An export made by a newer Kept than the server you import into may be refused: update that server
first.

### A vehicle's LubeLogger history

On a vehicle's Overview, **Import from LubeLogger** takes the CSV that LubeLogger exports for one
vehicle: its fuel, its service records (repairs and upgrades too) or its odometer readings, one
file at a time. Kept reads the file, says which kind it is and guesses how dates and decimals are
written (LubeLogger writes them in its server's language); change either if the guess is wrong,
and say whether fuel is in litres or gallons. **Check** shows what would be added and which rows
can't be, and why; **Import** adds them, oldest first, with their odometer readings. Importing the
same file again adds nothing. Owners and admins of the location can import.

### Search words after an import

When an AI provider is connected, the end of an import can offer **Add search words with AI?**,
with an estimate of the tokens it takes. It runs in the background and adds aliases in the
location's languages, the way captured things get them ([AI providers](/users/ai-providers/)).

## Exporting

**Settings → Export** has two kinds:

- **Export a location**, one you own or administer: every thing, place, photo, document,
  condition report and move is always in it.
- **Export my data**: your Personal location with its files, your profile and preferences, and
  your own AI calls.

**What goes in** besides: archived and ended things (sold, given away, thrown out), the Trash, the history, the
AI calls, and **A copy you can read without Kept**: web pages, spreadsheets, thumbnails and
receipts that open in any browser, optionally with the inventory PDF, in a language of its own.

**Include secrets** is for the location's owner. Secret values are encrypted with a passphrase of
at least 12 characters, typed twice. Anyone with the file and the passphrase can read every secret
in it, and Kept can't recover a forgotten passphrase. The readable copy never holds secrets.

An export without secrets leaves every secret value out and says so: each thing or place that had
one names the field in `secretsWithheld`, the manifest counts them, and the readable copy has a
line about it. It imports like any other export; the fields come in empty. Over plain HTTP this is
the only kind (**Include secrets** needs HTTPS, [Kept on a home network](/install/home-network/)).

The export is built in the background; you're notified when it's ready. Each export stays in the
list, ready to **Download**, for seven days.

### Exports and backups

An export is something you take away: one location, readable anywhere, importable into any Kept.
The server's own nightly backup is separate and covers the whole instance; it also holds a readable
copy of every location ([backups](/admin/backups/)). Deleting a location offers **Export first**.

## Moving between instances

To move one household to another Kept server: export the location (with secrets if you need them),
then import the ZIP there as a Kept export. Printed labels keep working: a label keeps its code
when that code is free on the new server, and when it isn't, the old label still opens the thing.
To move a whole server with every account, use a backup instead. Both ways are in
[moving to a new server](/admin/move-server/).
