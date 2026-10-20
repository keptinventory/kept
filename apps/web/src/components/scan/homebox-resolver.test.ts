/**
 * An old Homebox label on the phone: the server stores every legacy code upper-cased, a
 * Homebox item UUID included, so a `/item/<uuid>` link (read lower-cased) opens its thing offline
 * from the snapshot, as an asset ID label (`/a/000-001`) does.
 */
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/offline/store';
import { firstPage } from '@/test/store-contract';
import { resolveScan } from './resolve';

const LOC = '01926f00-0000-7000-8000-00000000b002';
const DRILL = '01926f00-0000-7000-8000-0000000d0005';
const UUID = '5af0d9a2-bbb4-44ea-8cd0-acea90d00025';

async function store() {
  const s = new MemoryStore();
  const page = firstPage();
  await s.applySnapshot({
    ...page,
    changes: {
      ...page.changes,
      legacyCodes: [
        ...page.changes.legacyCodes,
        {
          locationId: LOC,
          source: 'homebox',
          sourceCollection: '',
          code: UUID.toUpperCase(),
          thingId: DRILL,
          placeId: null,
        },
      ],
    },
  });
  return s;
}

describe('old Homebox labels on the phone', () => {
  it('opens a thing by its Homebox item link offline', async () => {
    const s = await store();
    const r = await resolveScan(
      { text: `https://homebox.example/item/${UUID}` },
      { store: s, online: false },
    );
    expect(r).toMatchObject({
      outcome: 'open',
      target: { kind: 'thing', id: DRILL, locationId: LOC },
      from: 'phone',
    });
  });
});
