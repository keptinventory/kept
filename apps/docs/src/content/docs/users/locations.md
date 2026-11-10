---
title: Locations, rooms and boxes
description: "The tree everything sits in: locations, rooms and spots, boxes and containers, Unplaced, a location's layouts (List, Grid, Graph, Table, Map), and Select for many things at once."
---

Everything sits in a tree: a **location** (Home, Garage, a storage unit) holds **rooms and
spots** ("room or spot" is Kept's word for any place), which hold **things**. A thing can be a
**box or container** that holds other things, as deep as you like. Each location also has
**Unplaced**, for things that don't have a place yet.

- On a location, room or box, **Add here** adds a **Thing**, a **Box / container** or a **Room or
  spot**, or [furniture with compartments](#furniture-with-compartments).
- Lists have a search box, **+ Filter**, saved **Views**, and a **Display** button for sort order
  and grouping. Filters live in the address, so a filtered list can be bookmarked or shared.
- **Select** (beside the search box, for anyone who can edit things) ticks things in the list of a
  location, place or box, in List or Grid. **Shift-click** a row's checkbox (or **Shift+Space** on
  it) to tick every row from the one you ticked last. Then: **Move**, **Add tags…** or **Remove
  tags…**, **Set a field…**, **Pick up** (into the tray), **Print labels**, **Add to incident** and
  **Claim pack** (owners and admins, where Receipts and warranties is on), or **Move to Trash**.
  The bar is the [Table's](/users/spreadsheet/).
- **Set a field…** gives every ticked thing one value: type, brand, model, condition and the
  rest. Changes wait, marked **Not saved yet**, until **Save N changes**; one **Undo** takes the
  whole save back. It needs a connection. If someone changed one of them meanwhile, that one
  waits: **Keep mine** or **Keep theirs**.
- **Move to Trash** takes up to 200 at a time and needs a connection. It asks first what happens
  to what's inside a box (move it out, or trash it too) and about anything lent out, then one
  **Undo** brings them all back.
- **Order:** places and things read A to Z with numbers in order (Box 2 before Box 10), the same
  in the app, offline, in exports and for AI apps. Floors keep the order they were made in: the
  first is the ground floor on the map. On a place, **Display → Things: sort by** orders its
  things; its places stay A to Z.
- **Your own order:** on a place, **Manage → Order of the places here → Custom order** puts the
  places inside it in the order you choose, with **Move up** and **Move down** on each (keyboard
  too). **A to Z** comes back any time, and switching to **Custom order** again brings your order
  back. The tree, the map, exports and AI apps follow it. A location's top level stays A to Z.
- **Turn places into boxes…** on a place's **Manage** lists the places inside it: tick some, or
  **Select all**, and they become boxes in one step, each keeping its ID, label and contents. A
  place with places inside can't be ticked: a box holds things only. The toast's **Undo** turns
  them all back into places, as they were; it stays in the history for 7 days.
- **The assistant and AI apps** can do the same: rename a place, change its kind, move it, set
  its fields and the order of the places in it, and turn places into boxes (`update_place` and
  `turn_into_boxes`, [MCP clients](/users/mcp-clients/)). The assistant shows a card to confirm
  first; Undo works as in the app.
- **The place tree** (beside the page on a computer, **All places** on a phone) shows boxes under
  their place with how many things are in each, up to 50 a place, then **+N boxes**. The arrow
  beside a place folds what's under it; **Fold all** and **Open all** do every place at once.
  Kept remembers your folds for your account, on every device. The places above the page you're
  on stay open, even after **Fold all**.
- **Its width** (on a computer, from 1280 px wide): drag the line along the tree's edge, or focus it
  and use the arrow keys, Home and End. **Collapse places**, the button at the top of the tree,
  folds it to leave the page all the room; **Expand places** brings it back. This device remembers
  both.
- On a location, **Sort them** goes through Unplaced one thing at a time with a place picker.
- A box opened from its label shows a photo grid of what's inside.
- **Layouts:** a location's page switches between **List**, **Grid**, **Graph**, **Table** and
  **Map**, each with its icon. **Graph** draws the location as a graph of its floors, rooms, boxes
  and things, in 2D or 3D ([The graph](/users/graph/)). **Table** shows its things as a spreadsheet,
  on a screen 1024 px wide or more ([The spreadsheet view](/users/spreadsheet/)), so a phone shows
  List, Grid, Graph, Map. **Map** shows the location in 3D, floor by floor, with its rooms,
  shelves and boxes ([The location map](/users/location-map/)). The list's **Display** menu offers
  the same choice. A place's own page (not Unplaced) has the switch too, without Table. Kept
  remembers the layout for each location and each place on that device.
- **Grid** shows a location's or room's places and things as tiles, under the same **Places** and
  **Things** headings as List; each heading folds away. **Display → Size** picks **Small**,
  **Medium** or **Large** tiles (3, 2 or 1 a row on a phone), and Kept remembers your size on that
  device.
- On a computer or tablet, the sidebar marks the location you're in: on its page, and on its
  rooms, things, boxes and settings.

![A location in Grid with Small tiles: the Places, 9 heading over the rooms, then the Things, 20+ heading over the things, six tiles a row, each with its name only](../../../assets/screens/grid-desktop-light.webp)

![The same grid in the dark theme](../../../assets/screens/grid-desktop-dark.webp)

Links use IDs, never the path, so moving a thing never breaks a link to it.

## Furniture with compartments

A cube shelf, a bookcase or a chest of drawers is one place, and each cube, shelf or drawer is a
place inside it, with its own name, label and, if you like, its own code. A server rack is
furniture too, measured in rack units ([Racks](#racks)).

- **Add here → Room or spot → Furniture with compartments…** makes the furniture and all its
  compartments in one step. Pick a template: a cube shelf 1 × 4, 2 × 2, 2 × 4, 4 × 4 or 2 × 8,
  a bookcase (6 shelves), a chest of drawers (9) or a shelving unit (4). Change the number of
  shelves or drawers before you add it. The furniture's kind is **Furniture**; its compartments
  are **Cube**, **Shelf** or **Drawer**.
- **How it stands:** a cube shelf that isn't square can stand **Upright** or lie **On its side**.
  A 2 × 4 upright is 4 rows of 2; on its side, 2 rows of 4. The compartments are built as it
  stands.
- **Counting:** from the top left, row by row, as you see it in front of you. A 4 × 4 is Cube 1
  to Cube 16; a 2 × 4 on its side has 1 to 4 on the top row and 5 to 8 below. The sheet shows the
  numbers before you add it. **Compartment names** take `{n}` for the number, `{row}` and
  `{col}` for where it sits.
- **Codes:** **Its own code** gives the furniture a code (`KX01`), and **Compartment codes** a
  pattern for the compartments, such as `{parent}-F{col:02}{row:02}`: `{parent}` is the
  furniture's code, `{col:02}` the column with two digits. A 4 × 4 then gets `KX01-F0101` to `KX01-F0404`. Each code is checked against
  the location's format rule (**Settings → the location → General → Your own codes**) and
  against the codes already there; if one doesn't fit, nothing is made and Kept names the code.
  Scanning or searching a code finds its compartment.
- **Undo:** the toast's **Undo** puts the furniture and its compartments in the Trash and frees
  their codes, as long as nothing was put in them or changed since.
- **Labels:** on the new furniture, **Label everything here** prints a label for it and for every
  compartment, in counting order.
- **Its page** shows the compartments as it stands, numbered as their labels are. Tap one to open
  it. **Print their labels** prints all of them again, in counting order, with the names they
  have now.
- **Move to trash:** its compartments go to the trash with it and come back with it on
  **Restore**. If something is in it or in any compartment, Kept asks only about that: **Move them
  to** the room it stands in (or **Choose another place**), or **Trash them too**. A box moves as
  it is, with what is inside it. A place you added to the furniture yourself counts as something in
  it. The toast's **Undo** puts each one back in its own compartment.

### Turning furniture

**Turn it…** on the furniture's page, for a cube shelf that isn't square.

- **Its top went:** **To the right** or **To the left**, as you face it. Each compartment moves
  with the unit, with its things and its printed label.
- **Its compartments** is asked every time, because the labels are already on:
  - **Renumber:** each compartment gets the number, name and code of where it now stands, counted
    from the top left again. An old code still works: it opens the compartment now in the place it
    named. Print the labels again for the new names.
  - **Keep the codes:** only how it stands changes. Every compartment keeps its number, name and
    codes.
- The sheet shows the new grid before you turn it. A name or a code you typed yourself stays with
  its compartment either way.
- **Undo** turns it back, numbers, names and codes included, as long as nothing in it changed
  since.

### Merging and splitting compartments

A cube insert or a removed shelf makes two or more compartments one.

- **Merge or split…**, then tap compartments side by side that make a rectangle, and **Merge**.
  The top left one stays, with its number, name and code. The others go to the Trash; their codes
  and printed labels open the merged compartment, and what was in them moves into it.
- To split a merged compartment, tap it and **Split**. Each cell comes back with its code and its
  label; things stay in the top left one.
- **Undo** reverses either.
- **Your own templates:** **Settings → Account → Templates → Furniture** has the account's own
  place templates: cubes across and up (upright), shelves or drawers, the kinds, the names and
  the code pattern, shared with the locations you choose. Owners and admins make them; anyone who
  can add places uses them.
- **AI apps** can do the same: `create_place` takes a `template`, and `update_place` a `turn`
  ([MCP clients](/users/mcp-clients/#the-tools)). Merging and splitting stay in the app.

### Racks

A 19-inch or 10-inch rack is furniture measured in rack units (U). Gear is a thing in it: how many
units it takes, and the unit it starts at.

- **Add here → Room or spot → Furniture with compartments…**, then a rack template: **19-inch
  rack, 42U**, **19-inch rack, 24U**, **12U on a wall**, **6U on a wall** or **10-inch rack, 8U**.
  Change its **Units** (1 to 60) and whether it is **Numbered from** **The bottom** (U1 at the
  bottom, the usual way) or **The top**. A rack has no compartment places; **Its own code** is
  optional.
- **Its page** shows the rack **Seen from** the **Front** or the **Rear**, top to bottom: each
  piece at its units (`U11`, `U5–U6`) and the free units between them as **Empty**. Units are
  written as the rails print them, in every language.
- **Put gear in:** move a thing into the rack as into any place. It shows under **Not placed
  yet**, and **Place it** asks where: **Starts at** (its lowest unit, or its top one in a rack
  numbered from the top), **Height** in rack units (halves too, such as 1.5), **Faces** (**Front**
  or **Rear**) and **Depth**. **Full depth** takes the unit on both faces; **Half depth** only on
  its own, so a half-depth switch at the front and a shelf at the rear can share a unit.
- **Refused:** two pieces in the same unit on the same face, or a piece past the top of the rack.
  Kept names the piece that is there ("U11 is taken by Switch at the front.") and saves nothing.
- **Height 0** is gear beside the rails, such as a power strip or a cable manager: it takes no
  unit and is listed under **Beside the rails (0U)**.
- **The thing's page** shows **In the rack**: the rack, the units and the depth, with **Change**.
  **Take it off its unit** frees the unit and leaves the thing in the rack.
- **Moving gear out** of the rack frees its unit; moved back in, it is **Not placed yet** again.
- **Undo** puts a position back, unless someone has taken that unit since.
- **AI apps** can do the same: `create_place` takes a rack template with `units` and `numbering`,
  and `update_thing` takes `rack_units` and `rack_at` ([MCP clients](/users/mcp-clients/#the-tools)).

## Its position

A location's position lets Capture's **Suggest where I am** pick it when you're there
([Kept on your phone](/users/phone-app/#camera-gallery-and-scanning)).

- **Set it:** **Location settings → General → Position**, for owners and admins. **Use where I am
  now** reads the phone's position once (the browser asks first) and fills **Latitude** and
  **Longitude**; or type them in degrees, such as 30.0444 and 31.2357. Then **Save**. **Remove
  position** clears it. Personal has none: it goes wherever you do.
- **Over plain HTTP** browsers refuse to give the position: type it instead.
- **Open in maps** opens OpenStreetMap at the saved position in a new tab. Only then does the
  position leave Kept.
- **How near:** Capture suggests a location when the phone is within 150 m of its position, the
  nearer one if two are. 150 m covers a house and its garden plus a phone's usual error indoors,
  and still tells two streets apart.
- **Who sees it:** owners and admins, on this page; and the phones of those who add things there,
  for the suggestion. Viewers and share links never get it. The history says the position
  changed, who changed it and when, never where. A location export carries it, and importing
  that export brings it back.

## Hide Personal

Everyone gets a **Personal** location. If you have no use for it, turn on **Hide Personal** in
**Settings → Me → Your locations**, and turn it off to show it again any time. It's your own
preference: nobody else sees a change.

- **Gone from:** the locations in the menu, Home, lists, search and their filters. A module only
  Personal tracks (Vehicles, say) leaves the menu with it.
- **Unchanged:** everything in it. A link to Personal or to a thing in it still opens it. Hiding
  is tidying up, not protection: it locks nothing.
- **Reminders still reach you**, as notifications, in the digest and in the calendar feed. Turn
  them off in **Settings → Me → Notifications**, where Personal is still listed.
- **Capture** starts in your other location, or in Personal if you can't add things anywhere else.
- **Import** offers the other locations you own or administer, or Personal if there are none. A
  past import still opens from Activity, wherever it went.
- **Keep available offline** in **Settings → This device** keeps Personal's row while its copy is
  on the device, so you can turn it off.
- **Export my data** carries the first other location you own, and Personal stays on **Export a
  location**. If you own no other location, it carries Personal.
- **Your personal AI key** also pays for a location you own and use alone, when that location's
  account has no key of its own. It never pays for a shared location.
- **The assistant** leaves Personal out, unless you open it from Personal. **Connections** (personal
  tokens and connected apps) keep the locations you gave them, hidden or not.

You can't hide it while it's your only location. If it becomes your only location later (you
leave, you're removed, the other location is deleted), it shows again by itself, and hides again
when you have another.

## Related

- [Everyday use](/users/everyday-use/) for the wider picture.
- [Tags](/users/tags/) for what a thing is besides where it is.
- [Sharing a location](/users/everyday-use/#sharing-a-location) for letting people into one.
