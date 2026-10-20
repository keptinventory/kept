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
| **A Homebox export** | The ZIP from Homebox v0.26.1 or newer, v0.27.0 recommended (Collection settings → Export) |
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
| `HB.sold_*` | The thing ended as sold, with its date, buyer, notes and price |
| `HB.archived` | Your choice: **Thrown away, no longer in use**, **In use, tagged "Archived in Homebox"**, or **Leave out** |
| `HB.warranty_expires`, `HB.lifetime_warranty` | A warranty from the purchase date, where Warranties is on |
| `HB.warranty_details`, `HB.insured` | Lines in the notes |

A price of 0 is read as no price (Homebox writes 0 when none was set). The location rows a
v0.26 or later spreadsheet lists are left out; places come from each item's location path. A
spreadsheet can't carry photos, files, maintenance or items inside items, and custom fields
are only imported if you match them to a type's field. For all of that, use the export ZIP.

### A Homebox export

Kept reads Homebox's own export ZIP, which holds everything, including the files. In Homebox,
open **Collection settings → Export** and download the ZIP. It exists from Homebox v0.26: use
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
re-run adds only what's new. **Connect to Homebox
(optional)** reads the collection's currency, which the ZIP doesn't carry: give Homebox's address
and an API key, or an email and password. They're used once and never stored. Then choose:

- **Prices are in**: the currency. Choosing one relabels the amounts; it doesn't convert them.
- **Archived items**: **Leave out**, or **Import, tagged "Archived in Homebox"**.
- **Add an "Insured" yes/no field**, and **Leave out Homebox's starter places and tags** (the
  eight rooms and six tags every new Homebox collection starts with, when they're unused).
- **Custom fields**: for each, **Add to the type** or **Keep in notes**.
- **Types**: match each Homebox type to a Kept type, or create it.

What comes over:

| Homebox | Kept |
|---|---|
| Collection | One location |
| Locations (nested) | Rooms and spots, keeping the tree |
| Items | Things; an item holding others becomes a box |
| Manufacturer, model, serial | Brand, model, serial |
| Purchase date, shop and price | A purchase with its shop |
| Warranty, lifetime warranty | A warranty |
| Sold details | The thing ended as sold, with its date, price, buyer and notes |
| Tags | Tags with their colours (nested tags flattened) |
| Photos, manuals, receipts, warranty files | Photos, manuals, the purchase's receipt, the warranty's document |
| Completed maintenance | Service records |
| Scheduled maintenance | One-off schedules |
| Templates | Account templates, as far as they map |

Notifiers, members and roles aren't imported. Where a module is off in the location, that
record's text is kept in the thing's notes.

**Old labels keep working.** Each Homebox asset ID (`000-001`) is remembered. Kept's scanner
recognises a Homebox label and opens the imported thing; if you point the old Homebox hostname at
Kept, scanning with the phone's own camera works too.

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
3. **Sign in** with your usual account and open **Collection settings → Export**. Download the
   ZIP.
4. **Import it into Kept** as [a Homebox export](#a-homebox-export).
5. Stop the copy and delete it once the import is done.

Photos added before Homebox recorded file types come through too: Kept checks each file itself.

### A Kept export

A Kept export always comes in as **a new location**, with its things, places, files, condition
reports, moves and history. If it holds secret values, **Open the secrets** with the passphrase chosen when it was exported;
without it, everything else is imported. **People to invite** lists who shared the location;
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

**What goes in** besides: ended things (sold, given away, thrown out), the Trash, the history, the
AI calls, and **A copy you can read without Kept**: web pages, spreadsheets, thumbnails and
receipts that open in any browser, optionally with the inventory PDF, in a language of its own.

**Include secrets** is for the location's owner. Secret values are encrypted with a passphrase of
at least 12 characters, typed twice. Anyone with the file and the passphrase can read every secret
in it, and Kept can't recover a forgotten passphrase. The readable copy never holds secrets.

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
