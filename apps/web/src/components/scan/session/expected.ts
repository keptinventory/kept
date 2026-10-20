/**
 * What a count expects to find (#168), from the phone's snapshot so it works offline: everything
 * in the place (and, by default, the places inside it), in the box, or in the whole location,
 * boxes' contents included, so a box's things can be counted one by one or with the box. Only
 * things in use and confirmed: a sold thing or a draft isn't expected anywhere.
 */
import type { SnapThing } from '@kept/shared';
import type { OfflineStore } from '@/offline/store';
import type { CountArea, ExpectedThing, SessionTarget } from './model';

const counts = (t: SnapThing) =>
  !t.deleted && t.lifecycle === 'in_use' && t.reviewState === 'confirmed';

const asExpected = (t: SnapThing): ExpectedThing => ({
  id: t.id,
  locationId: t.locationId,
  name: t.name,
  shortCode: t.shortCode,
  placeId: t.placeId,
  containerId: t.containerId,
  isContainer: t.isContainer,
  ...(t.barcode ? { barcode: t.barcode } : {}),
  ...(Number(t.quantity) > 1 ? { quantity: t.quantity } : {}),
  ...(t.derived?.length ? { derived: t.derived } : {}),
  ...(t.loan ? { loan: t.loan } : {}),
});

/** The places a count covers: the place and those inside it, or all of a location's. */
async function scopeOf(store: OfflineStore, target: SessionTarget) {
  const places = (await store.placesOf(target.locationId)).filter((p) => !p.deleted);
  if (target.kind === 'location') return places;
  if (target.kind !== 'place') return [];
  if (target.inside === false) return places.filter((p) => p.id === target.id);
  const scope = places.filter((p) => p.id === target.id);
  for (let i = 0; i < scope.length; i++) {
    for (const p of places) if (p.parentId === scope[i]?.id) scope.push(p);
  }
  return scope;
}

/** A count's areas (#172): the places it covers, each counted by a read or "I checked it". */
export async function areasFor(store: OfflineStore, target: SessionTarget): Promise<CountArea[]> {
  return (await scopeOf(store, target)).map((p) => ({
    id: p.id,
    name: p.isUnplaced ? null : p.name,
  }));
}

export async function expectedFor(
  store: OfflineStore,
  target: SessionTarget,
): Promise<ExpectedThing[]> {
  const out = new Map<string, ExpectedThing>();
  const add = async (rows: SnapThing[]) => {
    for (const t of rows) {
      if (!counts(t) || out.has(t.id)) continue;
      out.set(t.id, asExpected(t));
      // What is inside it, all the way down.
      if (t.isContainer) await add(await store.contentsOf({ containerId: t.id }));
    }
  };
  if (target.kind === 'container') {
    await add(await store.contentsOf({ containerId: target.id }));
    return [...out.values()];
  }
  const scope = (await scopeOf(store, target)).map((p) => p.id);
  for (const placeId of scope) {
    await add(
      (await store.contentsOf({ placeId })).filter((t) => t.locationId === target.locationId),
    );
  }
  return [...out.values()];
}
