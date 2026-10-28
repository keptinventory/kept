/**
 * What a tour step's `$id` opens (tours.ts `needs`), found when the step is reached:
 *
 * - a **location**: the request's own (its context), else the first shared one, else Personal;
 * - a **thing**: the request's own, else the first in that location, else ONE sample made in its
 *   Unplaced ("Sample: Cordless drill") where the person can add things;
 * - a **vehicle**: the request's own, else the first one. None means the step is skipped (the tour's step before it
 *   points at Add a vehicle);
 * - a **kit** (1.14): the first kit in that location; none means the step is skipped;
 * - a **move**: the request's own, else the first, else ONE sample move with no boxes
 *   ("Sample: Move") in a location with Moving on where the person can add;
 * - a **location you manage** (owner or admin, not Personal): its UUID, as location settings take.
 *
 * Samples go in the tour's ledger, so the end of the tour offers them for Keep or Discard
 * (tour.ts `tourDeleter`). Nothing the person already had is ever touched.
 */
import { api } from '@/api/client';
import { qs } from '@/api/inventory/paths';
import { inventoryApi } from '@/api/inventory/queries';
import { movingApi } from '@/api/moving/queries';
import type { LocationDetail } from '@/api/types';
import { vehiclePaths } from '@/api/vehicles/paths';
import type { VehiclesPage } from '@/api/vehicles/types';
import { addressOf, locationAddress } from '@/lib/address';
import { tourLedger } from './tour-ledger';
import type { TourSubject } from './tours';

/**
 * What a tour request is about. Page headers passed it until 1.14.3, when their Show me went;
 * Help and a scan session's Show me pass none, so a chapter opens the first shared location.
 */
export type TourContext = { locationId?: string; thing?: string; move?: string };

/** The names a sample gets, in the person's language. */
export type SampleNames = { thing: string; move: string };

export type SubjectDeps = {
  locations: readonly LocationDetail[];
  context: TourContext;
  names: SampleNames;
};

/** The location a tour opens: the first one that isn't Personal, else the first. */
export function tourLocation<L extends { kind: string }>(locations: readonly L[]): L | null {
  return locations.find((l) => l.kind !== 'personal') ?? locations[0] ?? null;
}

const canAdd = (l: LocationDetail) => l.role !== 'viewer';
const modulesOf = (l: LocationDetail) => l.effectiveModules ?? l.modules;

function baseLocation({ locations, context }: SubjectDeps): LocationDetail | null {
  const here = context.locationId ? locations.find((l) => l.id === context.locationId) : undefined;
  return here ?? tourLocation(locations);
}

/** The route param for `kind`, or null when there is nothing to open. */
export async function resolveSubject(kind: TourSubject, deps: SubjectDeps): Promise<string | null> {
  switch (kind) {
    case 'location': {
      const l = baseLocation(deps);
      return l ? locationAddress({ id: l.id, name: l.name, kind: l.kind }) : null;
    }
    case 'adminLocation': {
      const l = deps.locations.find(
        (x) => x.kind !== 'personal' && (x.role === 'owner' || x.role === 'admin'),
      );
      return l?.id ?? null;
    }
    case 'thing':
      return deps.context.thing ?? (await firstThing(deps));
    case 'vehicle': {
      if (deps.context.thing) return deps.context.thing;
      // The vehicles list's own endpoint, read directly: the vehicles screens load on demand.
      const page = await api.get<VehiclesPage>(vehiclePaths.vehicles + qs({ limit: 1 }));
      const row = page.items[0];
      return row ? addressOf(row.thing) : null;
    }
    case 'move':
      return deps.context.move ?? (await firstMove(deps));
    case 'kit': {
      const l = baseLocation(deps);
      if (!l) return null;
      const found = await inventoryApi
        .search({ locationId: l.id, state: 'kit', limit: 1 })
        .catch(() => null);
      const row = found?.things.items[0];
      return row ? addressOf(row) : null;
    }
  }
}

async function firstThing(deps: SubjectDeps): Promise<string | null> {
  const l = baseLocation(deps);
  if (!l) return null;
  const page = await inventoryApi.things({ locationId: l.id, limit: 1 });
  const row = page.items[0];
  if (row) return addressOf(row);
  if (!canAdd(l)) return null;
  const { places } = await inventoryApi.places(l.id);
  const unplaced = places.find((p) => p.isUnplaced);
  if (!unplaced) return null;
  const made = await inventoryApi.createThing({
    locationId: l.id,
    placeId: unplaced.id,
    name: deps.names.thing,
  });
  tourLedger.record('thing', made.id);
  return addressOf(made);
}

async function firstMove(deps: SubjectDeps): Promise<string | null> {
  const page = await movingApi.list({ limit: 1 });
  const row = page.items[0];
  if (row) return row.id;
  const where = deps.locations.find((l) => canAdd(l) && modulesOf(l).includes('moving'));
  if (!where) return null;
  const made = await movingApi.start(where.id, { name: deps.names.move });
  tourLedger.record('move', made.id);
  return made.id;
}
