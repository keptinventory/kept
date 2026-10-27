---
title: Short IDs and labels
description: "Six-character IDs, printing labels on sheets and rolls, what the scanner does with every code it reads, and which code Kept keeps where."
---

When a new thing reaches the server it gets a short ID: six letters and digits, like `7KQ-4MZ`,
never reused. Until then it shows **ID pending**. A label carries the ID as text and in a QR code
that opens the thing. A label keeps its code for good, so a lost one reprints the same.

Lists, search results and the ⌘K palette show a thing by its name. Its code shows there as amber
label tape only once it has a printed label: a label confirmed with **Printed OK?**, or a blank
label claimed for it. Amber means "this one is labelled". On its own page a thing or place
without a printed label shows its code small and grey, after the rest; one with a label shows the
tape. A thing with more than one label (a blank label claimed for it, say) shows the code of
the one printed last. Search and the scanner find a thing by any of its codes.

## Printing

**Printing** (Labels in the menu, or **Label** on a thing): choose what to print (a selection,
**Label everything unprinted** in a location or place, or a **Blank sheet**), choose the **Label
stock**, pick where to start on a partly used sheet, and print from the browser. Stocks include A4
sheets of 24 and 65 labels, a Letter sheet in the Avery 5160 layout, and 50 × 30, 40 × 30 and
62 × 29 mm rolls for label printers. The **Sheet preview** is the print itself, smaller: the same
QR codes, names and places, broken over the same lines. A name is never cut short: a long one
wraps and its type gets smaller, and one that still doesn't fit is listed before you print, with
a link to rename it. The page is set to the sheet's paper with no margins, so the print dialog's
defaults (scale 100 %) put every label in its cell.

Afterwards, **Printed OK?** asks about the batch you just printed and records it; from then on
those things and places show the amber tape. **Recent
batches** shows what each one holds, when and where it was made and whether it printed; one not
confirmed yet can be marked **Printed OK** or **Not printed** there, and reprints with the same
codes. Printing the same things again while their sheet is unconfirmed offers that sheet
instead of a new one. Things whose ID is still pending can't be printed yet.

## Scanning

**Scan** on Home and Search opens the camera.

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

## Related

- [Scanning sessions](/users/scanning-sessions/) for scanning a whole box at once.
- [Tags](/users/tags/) for saying what else a thing is.
- [Everyday use](/users/everyday-use/) for the wider picture.
