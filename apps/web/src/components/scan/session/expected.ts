/**
 * What a count expects to find (#168), from the phone's snapshot so it works offline: everything
 * in the place (and, by default, the places inside it), in the box, or in the whole location,
 * boxes' contents included, so a box's things can be counted one by one or with the box. Only
 * things in use and confirmed: a sold thing or a draft isn't expected anywhere.
 */
import type { SnapThing } from '@kept/shared';
import type { OfflineStore } from '@/offline/store';
import type { ExpectedThing, SessionTarget } from './model';

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
});

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
  const places = (await store.placesOf(target.locationId)).filter((p) => !p.deleted);
  let scope: string[];
  if (target.kind === 'location') {
    scope = places.map((p) => p.id);
  } else if (target.inside === false) {
    scope = [target.id];
  } else {
    scope = [target.id];
    for (let i = 0; i < scope.length; i++) {
      for (const p of places) if (p.parentId === scope[i]) scope.push(p.id);
    }
  }
  for (const placeId of scope) {
    await add(
      (await store.contentsOf({ placeId })).filter((t) => t.locationId === target.locationId),
    );
  }
  return [...out.values()];
}
