# Homebox export fixtures

Two real export ZIPs from **Homebox v0.26.2** (image `ghcr.io/sysadminsmedia/homebox:0.26.2`,
commit e01dd737, SQLite, the image's default storage), made on 2026-09-30 for step 7's Task 0
(H1). Synthetic data only, with the Kept sample cast. The instance was thrown away afterwards.

| File | Collection | Currency on the server (not in the ZIP) | Members on the server (not in the ZIP) |
|---|---|---|---|
| `homebox-0.26.2-home.zip` | Home (`1d93892c-082a-4fb4-9645-b78321688b99`) | `SAR` | Ibrahim (owner), Bruce, Louis |
| `homebox-0.26.2-family.zip` | بيت العائلة (`19c07b70-405b-4503-9517-2c5d847718b2`) | `USD` (never changed) | ألفريد (owner), Ibrahim |

A re-run of the export makes new UUIDs, so tests must not hard-code ids from anywhere but these
files.

What the cases cover:

- **Home:** nested locations (Home › Kitchen, Home › Study › Top shelf); an item inside an item
  (Toolbox › Cordless drill); a location-type entity inside an item (Toolbox › Bits tray) with
  an item in it holding a **fractional quantity** (Wood screws, 2.5); an archived, **sold**
  item (Old phone, sold to Murdock); a **lifetime** warranty (Fridge) and a dated one (Espresso
  machine); one custom field of each kind (`text`, `number`, `boolean`, `time`); tags with a
  parent (Audio › Tech), hex and named colours, an Arabic tag with a description; attachments of
  every type (`photo` with a primary, a second photo, `manual`, `warranty`, `receipt`, two
  `attachment`s, one a `.docx` outside Kept's allow-list and one plain text), four generated
  `thumbnail`s, and a **link** attachment (no file); maintenance done with a cost and one only
  scheduled; a template with fields and an item made from it (Kettle); type icons from Homebox's
  set plus one unknown value; a disabled notifier (its URL is synthetic).
- **بيت العائلة:** Arabic names throughout, Arabic-Indic digits in a serial, a photo with an Arabic
  file name, an item inside an item (the remote inside the TV), maintenance with a cost.
- **Across both:** asset IDs repeat (Home numbers 1–21, بيت العائلة 1–13, so 1–13 exist in both;
  Espresso machine and ريموت are both `000-005`), and each collection carries Homebox's seeded
  places (Living Room, Garage, …) and tags (Appliances, IOT, …).

Not covered:

- a `time` field with a chosen date, and a template's number value: Homebox v0.26.2's API can't
  set either (it has no `timeValue` for entity fields, so the value is the row's creation time,
  and a template's `numberValue` is dropped on save);
- an entity with asset ID 0: the script ran Homebox's "Ensure asset IDs" action, so every row
  has one.

## Homebox v0.27.0 and older Homebox

Made on 2026-10-21 with `ghcr.io/hay-kot/homebox:v0.10.3` and `ghcr.io/sysadminsmedia/homebox:0.27.0`
(commit bae3fb4e), SQLite, the images' default storage. Invented data, made by Bruce; the instances were
thrown away afterwards.

| File | What it is |
|---|---|
| `homebox-0.10.3-items.tsv` | v0.10.3's **Export Inventory** (`GET /api/v1/items/export`): tab-separated, `HB.labels`, `HB.purchase_time`/`HB.sold_time`, no `HB.url`, `0` for an unset price |
| `homebox-0.27.0-upgraded.zip` | that v0.10.3 data folder, copied and started under v0.27.0 (`HBOX_AUTH_API_KEY_PEPPER` set): every migration ran in one start; then **Collection → Tools → Backup & Restore → Create Backup → Download** |
| `homebox-0.27.0-upgraded-entities.csv` | the same upgraded collection's CSV (`GET /api/v1/entities/export`): `HB.purchase_date`/`HB.sold_date`, `HB.parent_import_ref`, a relative `HB.url` (`/item/<uuid>`), and one row per location (`/location/<uuid>`) |
| `homebox-0.27.0-home.zip` | `homebox-0.26.2-home.zip` restored into a fresh v0.27.0 (`POST /api/v1/group/import`) and exported again. v0.27.0 refuses to restore a link attachment, so the copy restored had its one link (Manufacturer page) removed |

The v0.10.3 collection: Garage › Shelf A and Study; Cordless drill (purchase, dated warranty, custom field
Colour, a photo, one maintenance entry), Toolbox holding Drill bits (12), HD webcam (lifetime warranty,
insured), Old laptop (archived, sold to "A neighbour"), Spare router (archived). The photo was uploaded before
Homebox recorded file types, so the upgraded export lists it as `application/octet-stream`. v0.27.0's first start
also added its eight starter rooms (Living Room, Garage, …) and numbered the locations' asset IDs after the items'.


## A Homebox v0.27 upgrade with boxes

`homebox-0.27.0-boxes.zip` is made by `make-boxes-backup.py` (invented data; the photos and the
.docx are copied from `homebox-0.27.0-home.zip`, so regenerate it with that fixture's files, as the
script's header says). It has the shape of the other v0.27.0 fixtures: the two entity types the
v0.27 upgrade names `global.location` and `global.item`, Go zero times for unset item dates, and
items before locations in `entities.json`.

- **36 locations:** Homebox's eight starter rooms (four used), Garage › Box 01–Box 12 and
  Workbench › Pegboard, Basement › Shelf A/B/C with Shelf C › Bin 1 and Bin 2, Kitchen › Drawer
  1–4 and Pantry, Hallway › Coat closet, Shed, and a "Lure tray" location inside the "Tackle box"
  item. Created out of name order on purpose.
- **43 items:** eight with quantity 0 (used up), one with 2.5, twelve with a price (one without
  a date, one dated in the future), five insured, five warranties (one lifetime), two archived
  (one sold); custom fields Colour (text), Wattage (number) and an unset `time` field; one
  maintenance entry done and one scheduled; two photos and a .docx.
- **10 tags:** the six starters (four unused) and four more; one tag sits on a location (Box 12).
