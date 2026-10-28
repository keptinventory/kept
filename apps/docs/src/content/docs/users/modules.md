---
title: Modules and presets
description: "What each location tracks: the Essentials, Household and Complete presets, the modules behind them, and what switching one off does."
---

Every location runs on a **preset**: a set of **modules** switched on together. A preset is a
starting point: an owner or an admin can switch single modules on or off afterwards, and turning
one off only hides it. Nothing is deleted.

You choose the preset when you create the location ([Your first minutes](/users/first-run/)).
A new account's **Personal** location starts on Essentials. A Homebox import into a new location
starts on Essentials too, with each module the backup has data for ticked on top
([importing from Homebox](/users/import-export/#a-homebox-export)).

## The three presets

- **Essentials**: finding things: rooms, boxes, labels and search.
- **Household**: adds receipts and warranties, reminders, lending, paperwork and vehicles.
- **Complete**: adds fuel, things you run out of, passwords and codes, moving house, and
  "Connect ChatGPT or Claude".

The time zone and currency aren't part of the preset: they're in **Location settings → General**.

## What each module adds

The names below are the switches in **What to track**.

| Module | From | What it brings |
|---|---|---|
| **Labels and QR codes** | Essentials | Printable labels for things and places; scanning a label opens what it's on. |
| **Money and spending** | Household | Prices, totals and **Insights**. Each currency on its own line, never converted. |
| **Receipts and warranties** | Household | Warranty dates; an expiring warranty shows as a reminder. |
| **Reminders** | Household | Schedules: what's due, by date or by reading. |
| **Lending** | Household | Lending things out and borrowing them in. |
| **Paperwork** | Household | The paperwork library; document dates feed reminders. |
| **Vehicles** | Household | Vehicles and machines. |
| **Fuel** | Complete | Fuel and charging. Needs **Vehicles**. |
| **Things you run out of** | Complete | **Keep at least** on a thing; low stock shows as a reminder. |
| **Moving house** | Complete | Moving mode. Needs **Labels and QR codes**. |
| **Passwords and codes** | Complete | Secret fields: hidden until someone allowed reveals one, which is logged. |
| **Connect ChatGPT or Claude** | Complete | The MCP connection, so an AI app can work with the location. |

## AI in this location

AI capture and the assistant come on in any preset once an AI provider is connected for the
location. They share one switch, **AI capture and the assistant**, under **AI in this location** on
the same page, so a location can stay out of AI while a provider is connected. Picking a preset
doesn't change it. See [AI providers](/users/ai-providers/).

## Turning a module off

A module that is off is hidden everywhere it would appear (its screens, its menu entries, its
filters) and its reminders pause. Switching it back on brings everything back, because nothing was
deleted.

- **Reminders pause with their module.** Schedules and things that expire wait with **Reminders**,
  warranty and registration dates with **Receipts and warranties**, document dates with
  **Paperwork** (a vehicle's documents also keep running while **Vehicles** is on), loans with
  **Lending**, low stock with **Things you run out of**. Reminders about meters not read lately
  always run.
- **Dependents go too.** Fuel needs Vehicles, and Moving house needs Labels and QR codes: switching
  off the one a module needs switches that module off as well. Its switch then reads
  *Needs Vehicles · off in this location*.
- **The menu follows all your locations.** Under **Tracking**, an entry (Schedules, Lending,
  Paperwork, Consumables, Vehicles, Moving, Insights) shows once its module is on in any of your
  locations. Under **Tools**, **Labels** shows while Labels is on somewhere, and **Counts** is
  always there. Activity, Trash and Notifications are always there too.

## Changing it later

An owner or an admin opens **Location settings → What to track**. The preset picker sets every
module at once; **Fine-tune** below it has one switch per module. Before you save, **When you
save** lists what turns on and what turns off.

## Related

- [Locations, rooms and boxes](/users/locations/) for the places inside a location.
- [Sharing a location](/users/sharing/) for roles.
