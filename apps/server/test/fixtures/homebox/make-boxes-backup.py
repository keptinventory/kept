#!/usr/bin/env python3
"""Makes homebox-0.27.0-boxes.zip: a Homebox v0.27.0 backup (Collection -> Tools -> Backup &
Restore -> Create Backup, `homebox-export-<id>.zip`) of an invented home, shaped like the other
v0.27.0 fixtures here: entity types named by v0.27's merge migration (`global.location`,
`global.item`), Go zero times for unset item dates, items before locations in entities.json (the
order that migration inserts them in). The photos and the .docx are copied from
homebox-0.27.0-home.zip. Deterministic: the same ids every run.

usage (from this folder):
  mkdir -p /tmp/hb27 && unzip -o homebox-0.27.0-home.zip -d /tmp/hb27
  python3 -I make-boxes-backup.py /tmp/hb27 homebox-0.27.0-boxes.zip
"""
import json
import random
import sys
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

src_dir, out = sys.argv[1], sys.argv[2]
rnd = random.Random(20261023)


def uid():
    return str(uuid.UUID(int=rnd.getrandbits(128), version=4))


ZERO = "0001-01-01T00:00:00Z"
GROUP = uid()
t0 = datetime(2024, 3, 2, 9, 14, 3, tzinfo=timezone.utc)
clock = [t0]


def ts(advance_minutes=0):
    clock[0] = clock[0] + timedelta(minutes=advance_minutes, microseconds=rnd.randint(1, 999999))
    return clock[0].strftime("%Y-%m-%dT%H:%M:%S.%f") + "123Z"


def day(s):
    return f"{s}T00:00:00Z"


LOC_T, ITEM_T = uid(), uid()
entity_types = [
    {"created_at": "2026-10-04T18:20:11.40812Z", "description": "", "entity_type_default_template": None,
     "group_entity_types": GROUP, "icon": None, "id": LOC_T, "is_location": 1, "name": "global.location",
     "updated_at": "2026-10-04T18:20:11.40812Z"},
    {"created_at": "2026-10-04T18:20:11.40955Z", "description": "", "entity_type_default_template": None,
     "group_entity_types": GROUP, "icon": None, "id": ITEM_T, "is_location": 0, "name": "global.item",
     "updated_at": "2026-10-04T18:20:11.40955Z"},
]

# ---- locations, in the order they were created in Homebox ---------------------------------------
locations = []  # (key, name, parent_key, created)
loc_id = {}


def loc(key, name, parent=None, gap=1):
    created = ts(gap)
    loc_id[key] = uid()
    locations.append((key, name, parent, created))


# Homebox's eight starter rooms, made at registration (HB_SEEDED_PLACES order).
for n in ["Living Room", "Garage", "Kitchen", "Bedroom", "Bathroom", "Office", "Attic", "Basement"]:
    loc(n, n, None, gap=0)
# The garage boxes, numbered as they were labelled, entered as they were packed.
clock[0] = datetime(2024, 3, 9, 15, 2, tzinfo=timezone.utc)
for n in ["05", "01", "12", "03"]:
    loc(f"Box {n}", f"Box {n}", "Garage", gap=6)
loc("Workbench", "Workbench", "Garage", gap=40)
loc("Pegboard", "Pegboard", "Workbench", gap=3)
clock[0] = datetime(2024, 4, 20, 10, 31, tzinfo=timezone.utc)
loc("Shelf C", "Shelf C", "Basement", gap=1)
loc("Shelf A", "Shelf A", "Basement", gap=2)
loc("Bin 2", "Bin 2", "Shelf C", gap=2)
loc("Shelf B", "Shelf B", "Basement", gap=5)
loc("Bin 1", "Bin 1", "Shelf C", gap=2)
clock[0] = datetime(2024, 6, 2, 19, 5, tzinfo=timezone.utc)
for n in ["Drawer 3", "Drawer 1", "Pantry", "Drawer 4", "Drawer 2"]:
    loc(n, n, "Kitchen", gap=4)
clock[0] = datetime(2024, 9, 14, 11, 40, tzinfo=timezone.utc)
for n in ["08", "02", "10", "07"]:
    loc(f"Box {n}", f"Box {n}", "Garage", gap=9)
clock[0] = datetime(2025, 1, 5, 16, 12, tzinfo=timezone.utc)
loc("Hallway", "Hallway", None, gap=1)
loc("Coat closet", "Coat closet", "Hallway", gap=2)
loc("Shed", "Shed", None, gap=30)
clock[0] = datetime(2025, 5, 18, 9, 0, tzinfo=timezone.utc)
for n in ["04", "11", "06", "09"]:
    loc(f"Box {n}", f"Box {n}", "Garage", gap=12)

# ---- items, in the order they were created ------------------------------------------------------
items = []
item_id = {}


def item(name, where, qty=1, **kw):
    """`where` is a location key, or ('item', key) for an item inside an item."""
    rec = dict(name=name, where=where, qty=qty, created=ts(kw.pop("gap", 7)), **kw)
    item_id[name] = uid()
    items.append(rec)


clock[0] = datetime(2024, 3, 9, 15, 30, tzinfo=timezone.utc)
item("Christmas lights", "Box 01", 3, tags=["Christmas"], desc="Warm white, 10 m strings")
item("Tree stand", "Box 01", tags=["Christmas"])
item("Baby clothes 0-6 months", "Box 05", 1, notes="Sorted by size, vacuum bags")
item("Photo albums", "Box 12", 4, tags=["Fragile"])
item("Tent (4-person)", "Box 03", 1, tags=["Camping"], price=189.0, bought="2023-06-10",
     shop="Outdoor World", manufacturer="Trailhead", model="Dome 4", fields=[("Colour", "text", "Olive")])
item("Sleeping mat", "Box 03", 2, tags=["Camping"], fields=[("Colour", "text", "Blue")])
item("Cordless screwdriver", "Workbench", 1, tags=["Tools"], price=59.99, bought="2024-02-11",
     shop="Hardware Hub", manufacturer="Voltline", model="CS-12", serial="VL12-88130",
     warranty="2026-02-11", warranty_details="Two years, receipt in Drawer 3")
item("Spirit level", "Workbench", 1, tags=["Tools"])
item("Hammer", "Pegboard", 1, tags=["Tools"])
item("Tape measure", "Pegboard", 2, tags=["Tools"])
item("Bike pump", "Garage", 1)
item("Pressure washer", "Garage", 1, price=149.0, bought="2024-03-30", shop="Hardware Hub",
     manufacturer="Aquaforce", model="PW-1600", insured=1, warranty="2027-03-30",
     fields=[("Wattage", "number", 1600)])
clock[0] = datetime(2024, 4, 20, 11, 5, tzinfo=timezone.utc)
item("Paint, white (litres)", "Shelf A", 2.5, notes="Ceiling white, opened 2024")
item("Chest freezer", "Basement", 1, tags=["Appliances"], price=329.0, bought="2022-08-19",
     shop="Appliance Depot", manufacturer="Frostline", model="CF-200", serial="FL200-55821",
     insured=1, warranty="2027-08-19", fields=[("Last defrosted", "time", None)], photo="fridge")
item("Extension cords", "Bin 1", 3)
item("Zip ties", "Bin 2", 0, desc="Bag of 100", notes="Ran out, buy more")
item("Sewing machine", "Shelf C", 1, price=120.0, manufacturer="Stitchwell",
     notes="Gift, price is a guess")
item("Spare light bulbs", "Shelf B", 0, desc="E27, warm white")
item("Dehumidifier", "Shelf B", 1, tags=["Appliances"], price=179.0, bought="2026-11-28",
     shop="Appliance Depot", manufacturer="DryAir", model="DA-20", insured=1,
     fields=[("Wattage", "number", 240)])
clock[0] = datetime(2024, 6, 2, 19, 40, tzinfo=timezone.utc)
item("AA batteries", "Drawer 1", 0, notes="Used the last ones in the smoke alarm")
item("Spare keys", "Drawer 2", 4)
item("Instruction manuals", "Drawer 3", 1, desc="Folder with every manual and receipt")
item("Candles", "Drawer 4", 0)
item("Stand mixer", "Pantry", 1, tags=["Appliances"], price=399.0, bought="2021-12-03",
     shop="Kitchen Corner", manufacturer="Mixwell", model="SM-5", serial="MW5-310077", insured=1,
     lifetime=1, docx=True)
item("Slow cooker", "Pantry", 1)
item("Coffee grinder", "Kitchen", 1, price=45.0, bought="2023-01-15", shop="Kitchen Corner",
     photo="espresso")
clock[0] = datetime(2024, 9, 14, 12, 30, tzinfo=timezone.utc)
item("Camping stove", "Box 02", 1, tags=["Camping"], price=34.5, bought="2023-06-10",
     shop="Outdoor World")
item("Gas canister", "Box 02", 0, tags=["Camping"])
item("Wrapping paper", "Box 08", 0, tags=["Christmas"])
item("Ski goggles", "Box 10", 1)
item("Board games", "Box 07", 7)
item("Suitcase, large", "Attic", 2)
item("Winter duvet", "Attic", 1)
item("Old monitor", "Attic", 1, tags=["Electronics"], archived=1, notes="Dead pixel, keep for parts")
item("Rowing machine", "Attic", 1, archived=1, price=210.0, bought="2020-01-04", sold="2025-03-02",
     sold_to="A neighbour", sold_price=90.0)
clock[0] = datetime(2025, 1, 5, 16, 30, tzinfo=timezone.utc)
item("Umbrella", "Coat closet", 3)
item("Vacuum cleaner", "Coat closet", 1, price=229.0, bought="2024-11-29", shop="Appliance Depot",
     manufacturer="Dustoff", model="V8", warranty="2026-11-29")
item("Lawn mower", "Shed", 1, price=279.0, bought="2023-04-08", shop="Garden Centre",
     manufacturer="Greenblade", model="GB-42", insured=1, maint=True)
item("Tackle box", "Shed", 1)
item("Fishing rod", "Shed", 2)
clock[0] = datetime(2025, 5, 18, 10, 30, tzinfo=timezone.utc)
item("Spare tiles", "Box 04", 14, desc="Bathroom wall tiles, 20x20")
item("Grout", "Box 04", 0)
item("Lures", ("loc-in-item", "Lure tray"), 0)

# A location inside an item (Homebox lets a location sit in an item): the Tackle box's lure tray.
lure_tray_id = uid()
lure_tray_created = ts(3)

# ---- tags ---------------------------------------------------------------------------------------
tag_id = {}
tags = []
for n in ["Appliances", "IOT", "Electronics", "Servers", "General", "Important"]:
    tag_id[n] = uid()
    tags.append({"color": "", "created_at": t0.strftime("%Y-%m-%dT%H:%M:%S.%f") + "001Z",
                 "description": "", "group_tags": GROUP, "icon": None, "id": tag_id[n], "name": n,
                 "tag_children": None, "updated_at": t0.strftime("%Y-%m-%dT%H:%M:%S.%f") + "001Z"})
for n, colour in [("Christmas", "red"), ("Fragile", "#e53935"), ("Camping", "#43a047"), ("Tools", "")]:
    tag_id[n] = uid()
    stamp = "2024-03-09T15:20:00.000000123Z"
    tags.append({"color": colour, "created_at": stamp, "description": "", "group_tags": GROUP,
                 "icon": None, "id": tag_id[n], "name": n, "tag_children": None, "updated_at": stamp})

# ---- rows ---------------------------------------------------------------------------------------
asset = [0]


def next_asset():
    asset[0] += 1
    return asset[0]


def entity_row(eid, name, type_id, parent, created, **kw):
    is_loc = type_id == LOC_T
    unset = None if is_loc else ZERO
    blank = None if is_loc else ""
    return {
        "archived": kw.get("archived", 0), "asset_id": kw["asset_id"], "created_at": created,
        "description": kw.get("desc", ""), "entity_children": parent,
        "entity_location_entities": None, "entity_type_entities": type_id, "group_entities": GROUP,
        "id": eid, "import_ref": blank, "insured": kw.get("insured", 0),
        "lifetime_warranty": kw.get("lifetime", 0), "manufacturer": kw.get("manufacturer", blank),
        "model_number": kw.get("model", blank), "name": name, "notes": kw.get("notes", blank),
        "purchase_date": day(kw["bought"]) if kw.get("bought") else unset,
        "purchase_from": kw.get("shop", blank), "purchase_price": kw.get("price", 0),
        "quantity": kw.get("qty", 1), "serial_number": kw.get("serial", blank),
        "sold_date": day(kw["sold"]) if kw.get("sold") else unset, "sold_notes": blank,
        "sold_price": kw.get("sold_price", 0), "sold_to": kw.get("sold_to", blank),
        "sync_child_entity_locations": 0, "updated_at": kw.get("updated", created),
        "warranty_details": kw.get("warranty_details", blank),
        "warranty_expires": day(kw["warranty"]) if kw.get("warranty") else unset,
    }


entities, entity_fields, tag_entities, attachments, maintenance = [], [], [], [], []
files = {}
fixture_att = {a["title"]: a for a in json.load(open(f"{src_dir}/attachments.json"))}

# Items first, then locations: the order v0.27's merge migration inserts them in.
for it in items:
    eid = item_id[it["name"]]
    where = it["where"]
    if isinstance(where, tuple):
        parent = lure_tray_id
    else:
        parent = loc_id[where]
    kw = {k: v for k, v in it.items() if k not in ("name", "where", "created")}
    kw["asset_id"] = next_asset()
    entities.append(entity_row(eid, it["name"], ITEM_T, parent, it["created"], **kw))
    for t in it.get("tags", []):
        tag_entities.append({"entity_id": eid, "tag_id": tag_id[t]})
    for fname, kind, value in it.get("fields", []):
        fid = uid()
        entity_fields.append({
            "boolean_value": 0, "created_at": it["created"], "description": None, "entity_fields": eid,
            "id": fid, "name": fname, "number_value": value if kind == "number" else 0,
            "text_value": value if kind == "text" else "",
            # A `time` field nobody set: Homebox fills in the row's creation time.
            "time_value": it["created"], "type": kind, "updated_at": it["created"],
        })
    if it.get("photo"):
        title = {"fridge": "fridge.jpg", "espresso": "espresso-front.jpg"}[it["photo"]]
        src = fixture_att[title]
        aid = uid()
        attachments.append({
            "attachment_thumbnail": None, "created_at": it["created"], "entity_attachments": eid,
            "id": aid, "mime_type": "image/jpeg",
            "path": f"{GROUP}/documents/{uid()}.jpg", "primary": 1,
            "title": it["name"].lower().replace(" ", "-") + ".jpg", "type": "photo",
            "updated_at": it["created"],
        })
        files[aid] = f"{src_dir}/attachments/{src['id']}"
    if it.get("docx"):
        src = fixture_att["espresso-quickstart.docx"]
        aid = uid()
        attachments.append({
            "attachment_thumbnail": None, "created_at": it["created"], "entity_attachments": eid,
            "id": aid, "mime_type": "application/zip",
            "path": f"{GROUP}/documents/{uid()}.docx", "primary": 0,
            "title": "mixer-recipes.docx", "type": "attachment", "updated_at": it["created"],
        })
        files[aid] = f"{src_dir}/attachments/{src['id']}"
    if it.get("maint"):
        maintenance.append({"cost": 25, "created_at": it["created"], "date": "2025-04-12T00:00:00Z",
                            "description": "Blade sharpened at the garden centre", "entity_id": eid,
                            "id": uid(), "name": "Blade sharpened", "scheduled_date": ZERO,
                            "updated_at": it["created"]})
        maintenance.append({"cost": 0, "created_at": it["created"], "date": ZERO,
                            "description": "", "entity_id": eid, "id": uid(), "name": "Spring service",
                            "scheduled_date": "2027-03-15T00:00:00Z", "updated_at": it["created"]})

for key, name, parent, created in locations:
    entities.append(entity_row(loc_id[key], name, LOC_T, loc_id[parent] if parent else None, created,
                               asset_id=next_asset()))
entities.append(entity_row(lure_tray_id, "Lure tray", LOC_T, item_id["Tackle box"], lure_tray_created,
                           asset_id=next_asset()))
# A tag on a location (Box 12 is fragile): Kept only tags things.
tag_entities.append({"entity_id": loc_id["Box 12"], "tag_id": tag_id["Fragile"]})

tables = {
    "entity_types": entity_types, "entity_templates": [], "template_fields": [], "tags": tags,
    "entities": entities, "entity_fields": entity_fields, "maintenance_entries": maintenance,
    "attachments": attachments, "tag_entities": tag_entities, "notifiers": [],
}
manifest = {
    "schemaVersion": 1, "exportedAt": "2026-10-23T07:41:52.118204331Z", "groupId": GROUP,
    "counts": {k: len(v) for k, v in sorted(tables.items())},
}

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in ["entity_types", "entity_templates", "template_fields", "tags", "entities",
                 "entity_fields", "maintenance_entries", "attachments", "tag_entities", "notifiers"]:
        z.writestr(f"{name}.json", json.dumps(tables[name], separators=(",", ":")) + "\n")
    for aid, path in files.items():
        z.write(path, f"attachments/{aid}")
    z.writestr("manifest.json", json.dumps(manifest, separators=(",", ":")) + "\n")

n_items = sum(1 for e in entities if e["entity_type_entities"] == ITEM_T)
n_locs = len(entities) - n_items
print(f"{out}: {n_items} items, {n_locs} locations, {len(tags)} tags, {len(attachments)} attachments")
print("location creation order:", ", ".join(n for _, n, _, _ in locations), "+ Lure tray")
