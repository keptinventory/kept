---
title: Vehicles and machines
description: "Log readings, services and fuel for anything metered: cars, generators, boilers. Schedules by date or by reading, starter schedules, from-stock consumables, and a history report."
---

Kept tracks anything with a meter: a car, a generator, a boiler, a lawnmower. A thing whose type
is metered gets **Meters**: readings, services and schedules. **Vehicles** (Household and Complete
presets) gathers every vehicle in one place, each with tabs for its overview, readings, services,
documents, costs and, on Complete, fuel.

This page covers logging readings and services, schedules, fuel, and the history report. For the
map shapes a vehicle can carry, see [map shapes](/users/map-shapes/).

## Logging a reading

A reading works from Home, from the vehicle, and offline. A reading that doesn't fit between its
neighbours is refused, and Kept says why. A dashboard photo joins the vehicle's proof photos.

## Logging a service

A service record holds the visit to the shop:

- **Date** and the **reading** at the time.
- **The shop** and **the invoice**. AI can fill the line items from the invoice.
- **Line items** with their costs.
- **Schedules completed**: saving restarts their count.
- **From stock** lines (below).

## From stock

When Consumables is on for the location, a service line can pick a consumable from the same
location: the oil filter on the shelf.

- Saving takes the line's quantity (1 when the quantity is empty) off the consumable's count.
- Kept refuses more than is left.
- Editing the line, removing it, deleting the service or undoing any of these puts the count
  right again.
- An invoice still being read takes nothing until you save it.

The consumable's **History** shows the use, with a link to the service.

The assistant and MCP clients can log a service the same way ("used 4.5 litres of the engine
oil"). The assistant's confirm card shows each **From stock** line before anything moves.

## Schedules

A schedule is a reminder to do something again, by date or by reading.

- **Add starter schedules** adds the usual ones: oil change, tyre rotation, brake fluid, air filter.
- **A one-off** (a date, no repeat) is done once you complete it. It leaves Due and Overdue, and
  **Schedules** lists it as **Done** with the day. Undo the completion, or delete that service,
  and it is due again.
- Due and overdue schedules appear in Home's **Needs you**, and in the calendar feed and the
  notification centre. See reminders and notifications.

## Fuel (Complete preset)

On the Complete preset, the **Fuel** tab records each fill. The form asks for the **amount** (in
your unit: litres, gallons, or a charge in kWh for an EV) and the **cost**; the price per unit is
worked out from those, not entered. It also has the date and time, **Full tank** or **Partial**,
the odometer (optional, checked against the readings before and after it), a photo of the
odometer, the pump receipt, a note, and the station — a new station is added to your vendors when
you save. **I missed a fill-up before this one** marks a gap, so consumption stays right:
consumption is measured from one full fill to the next, and shows again after two full fills with
odometer readings.

## Costs

A vehicle's **Costs** tab shows its fuel, service and fee costs. Insights
shows the same figures across your vehicles under **Vehicle costs**.

## Reading a registration card

In Label mode, **Read the card** reads a registration card: VIN, plate and licence expiry.

## History report

**History report** makes a PDF for a period: odometer history with proof photos, services with their
invoices, fuel and documents, and costs only where you can see money.

## Related

- [Everyday use](/users/everyday-use/) for the wider picture.
- [Counts and stocktakes](/users/counts/) for consumables tracked in stock.
- [AI providers](/users/ai-providers/) for reading invoices and cards.
