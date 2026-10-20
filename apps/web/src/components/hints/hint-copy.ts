/**
 * The words of every first-use hint and of every tour, in one place. driver.js
 * writes them with `innerHTML`, so they are Kept's own translated constants only:
 * no name, place or anything a person typed ever goes into a hint. A caller names the hint by
 * its key; it can't pass text.
 */
import type { TourId } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { useFormat } from '@/lib/format';

/** The one-time hints (@kept/shared HINT_KEYS less the ones that aren't shown as hints). */
export type FirstUseHint =
  | 'capture.mode_strip'
  | 'inbox.suggested'
  | 'labels.first_print'
  | 'scan.first_open';

export type HintCopy = { title: string; description: string };

export function useHintCopy(): Record<FirstUseHint, HintCopy> & { gotIt: string } {
  const { t } = useLingui();
  return {
    gotIt: t`Got it`,
    'capture.mode_strip': {
      title: t`Pick what you're capturing`,
      description: t`Thing, receipt, label or reading. Switch any time; the camera stays open.`,
    },
    'inbox.suggested': {
      title: t`Suggested values wait for you`,
      description: t`AI wasn't sure of these. Confirm or reject each one: nothing is saved until you accept.`,
    },
    'labels.first_print': {
      title: t`Now stick one on and scan it`,
      description: t`Tap Scan on Home and point the camera at a label: what it belongs to opens, with what's inside. A label keeps its code for good, so a lost one reprints the same.`,
    },
    'scan.first_open': {
      title: t`Point at a Kept label`,
      description: t`What it belongs to opens, with what's inside. A worn label, or no camera? Type the code instead.`,
    },
  };
}

/**
 * The tours' copy: one entry per step in tours.ts, keyed `<tour>.<step>`, saying in one short
 * sentence what to do with the highlighted control, in the words on the screen. Same rule as
 * above: Kept's own translated constants only, never anything a person typed.
 */
export function useTourStepCopy(): Record<string, HintCopy> {
  const { t } = useLingui();
  const e = (title: string, description: string): HintCopy => ({ title, description });
  return {
    'basics.needs': e(
      t`Needs you`,
      t`What's due, lent out or running low, counted. Tap a tile for its list.`,
    ),
    'basics.locations': e(
      t`Your locations`,
      t`Each home, garage or office you keep. Open one to see what's in it.`,
    ),
    'basics.scan': e(
      t`Scan`,
      t`Tap Scan and point the camera at a Kept label. What it's on opens.`,
    ),
    'basics.search': e(
      t`Search`,
      t`Type part of a name, a brand, a serial or a short ID. Each result says where it is.`,
    ),
    'basics.more': e(
      t`More`,
      t`Every other section: your modules, Activity, Trash, Settings and Help.`,
    ),
    'basics.more-wide': e(
      t`Everything else`,
      t`Every section, one click away. A module shows here once it's on in one of your locations.`,
    ),
    'basics.tours': e(
      t`Tours`,
      t`One short tour per section. Replay any of them here, or tap Show me on its page.`,
    ),

    'things.add': e(t`Add here`, t`Add a thing, a box or a room to this location.`),
    'things.contents': e(t`What's here`, t`Everything in this location. Tap a thing to open it.`),
    'things.where': e(t`Where it is`, t`The place it's in. Tap to go back there.`),
    'things.actions': e(t`Actions`, t`Move it, lend it, print its label or put it in Trash.`),
    'things.tabs': e(
      t`Its sections`,
      t`Details, paperwork, history and the rest, each in its own tab.`,
    ),

    'map.layout': e(
      t`List, Grid or Map`,
      t`Pick how this location is shown. Map draws it floor by floor.`,
    ),
    'map.view': e(t`3D or plan`, t`Turn the map in 3D, or look straight down at the plan.`),
    'map.pins': e(t`Pins`, t`Mark what's running low, lent out or due, on the map.`),
    'map.floors': e(t`Floors`, t`Pick a floor, or All for the whole building.`),
    'map.arrange': e(t`Arrange`, t`Draw rooms, add a floor and put things where they really are.`),

    'capture.mode': e(
      t`What you're capturing`,
      t`Thing, receipt, label, reading or room. Pick one before the photo.`,
    ),
    'capture.room': e(
      t`A whole room`,
      t`Up to five photos of a room. AI lists what's in them as drafts, skipping what Kept already has.`,
    ),
    'capture.shutter': e(
      t`Take the photo`,
      t`Take a photo, or pick one with Gallery. It waits in your Inbox.`,
    ),
    'capture.whose': e(
      t`Yours or everyone's`,
      t`Switch between what you captured and what everyone in your locations did.`,
    ),
    'capture.review': e(t`Review`, t`Check what Kept read, fix anything wrong, then tap Accept.`),

    'search.field': e(
      t`Search`,
      t`Type part of a name, a brand, a serial or a short ID. Filters narrow it down.`,
    ),
    'search.views': e(t`Views`, t`Save a search with its filters, and open it again in one tap.`),
    'search.labels': e(t`Print labels`, t`Print a sheet for everything still without a label.`),
    'search.scan': e(
      t`Scan a label`,
      t`Tap Scan and point the camera at a label to open what it's on.`,
    ),

    'moving.start': e(t`Start a move`, t`Name the move and say where it's going.`),
    'moving.list': e(t`Your moves`, t`Every move, open or done. Tap one to see its boxes.`),
    'moving.pack': e(
      t`Pack`,
      t`Add a box and print its label. Scan it at the other end to unpack.`,
    ),
    'moving.counts': e(t`Where the boxes are`, t`Packed, on the way and unpacked, counted.`),

    'lending.list': e(
      t`Loans`,
      t`Everything lent out or borrowed: who has it and when it's due back.`,
    ),
    'lending.return': e(t`Mark returned`, t`Tap Mark returned when it comes back.`),
    'lending.lend': e(t`Lend`, t`Tap Lend to hand it to someone and set when it's due back.`),

    'schedules.new': e(
      t`New schedule`,
      t`Set something to repeat: every few months, or by the odometer.`,
    ),
    'schedules.list': e(t`What's due`, t`Every schedule, soonest first. Overdue ones lead.`),
    'schedules.complete': e(t`Complete`, t`Tap Complete when it's done. The next date moves on.`),
    'schedules.reminders': e(
      t`Reminders`,
      t`Choose how reminders reach you: in Kept, by email, push or a channel.`,
    ),

    'paperwork.list': e(
      t`Paperwork`,
      t`Receipts, manuals and warranty cards from every thing and room.`,
    ),
    'paperwork.expiring': e(t`Expiring`, t`What runs out soon: warranties, insurance, a passport.`),
    'paperwork.add': e(
      t`Add a file`,
      t`Pick what it is, then add the file to the thing it belongs to.`,
    ),
    'paperwork.claim': e(
      t`Claims`,
      t`Open a claim when it breaks under warranty, and follow the repair.`,
    ),

    'vehicles.list': e(t`Vehicles`, t`Each vehicle with its last reading and what's due next.`),
    'vehicles.add': e(t`Add a vehicle`, t`Add a car, a motorbike or a generator.`),
    'vehicles.log': e(t`Log it`, t`Log a reading, a service or fuel from here.`),
    'vehicles.fuel': e(t`Fuel`, t`Every fill or charge, with what it cost and how far it went.`),

    'import-export.source': e(
      t`Import`,
      t`Pick where it comes from: a spreadsheet, Homebox or another Kept.`,
    ),
    'import-export.file': e(
      t`The file`,
      t`Drop the file here, or choose it. Nothing is saved until you check it.`,
    ),
    'import-export.export': e(
      t`Export`,
      t`Download a location or all your data, with its photos and documents.`,
    ),

    'settings.notifications': e(
      t`Notifications`,
      t`Choose what reaches you, and how: in Kept, by email, push or a channel.`,
    ),
    'settings.locations': e(
      t`Your locations`,
      t`Every location you're in. Open one to change who's in it and what it tracks.`,
    ),
    'settings.invite': e(t`Invite`, t`Invite someone by link or email, and pick their role.`),
    'settings.track': e(
      t`What to track`,
      t`Turn modules on or off here: lending, vehicles, schedules and the rest.`,
    ),
  };
}

/** Each tour's name, as Help lists it. */
export function useTourTitles(): Record<TourId, string> {
  const { t } = useLingui();
  return {
    basics: t`Basics`,
    things: t`Things & places`,
    map: t`The 3D map`,
    capture: t`Capture & Inbox`,
    search: t`Search & labels`,
    moving: t`Moving`,
    lending: t`Lending`,
    schedules: t`Schedules & reminders`,
    paperwork: t`Paperwork & warranties`,
    vehicles: t`Vehicles & fuel`,
    'import-export': t`Import & export`,
    settings: t`Settings & sharing`,
  };
}

/** The tour popover's own buttons and progress, shared by the tour engine. */
export function useTourCopy() {
  const { t } = useLingui();
  const f = useFormat();
  return {
    labels: {
      next: t`Next`,
      previous: t`Previous`,
      done: t`Done`,
      close: t`Close`,
      progress: (current: number, all: number) => {
        const done = f.num(current);
        const total = f.num(all);
        return t`${done} of ${total}`;
      },
    },
  };
}
