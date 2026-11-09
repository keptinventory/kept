/**
 * The scan flows' Where picker (a product from its barcode, a blank label, the carrying tray) with a
 * hidden Personal (#392): left out while there is somewhere else to write, offered when it is the
 * only place you can write (#459), as Capture does (capture/target.ts `shownLocations`).
 */
import type { Role, SnapLocation, SnapPlace } from '@kept/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { inventoryKeys } from '@/api/inventory/queries';
import type { PlaceNode } from '@/api/inventory/types';
import { keys } from '@/api/queries';
import type { LocationDetail } from '@/api/types';
import { MemoryStore } from '@/offline/store';
import { renderUI } from '@/test/render';
import { WherePicker } from './where-picker';

const HOME = '01926f00-0000-7000-8000-00000000f001';
const HOME_UNPLACED = '01926f00-0000-7000-8000-00000000f0ff';
const KITCHEN = '01926f00-0000-7000-8000-00000000f011';
const PERSONAL = '01926f00-0000-7000-8000-00000000f0c1';
const PERSONAL_UNPLACED = '01926f00-0000-7000-8000-00000000f0c2';
const DESK = '01926f00-0000-7000-8000-00000000f0c3';

const location = (id: string, name: string, kind: string, role: Role, unplaced: string) =>
  ({
    id,
    name,
    kind,
    timezone: 'Africa/Cairo',
    languages: ['en'],
    role,
    effectiveModules: ['labels'],
    unplacedPlaceId: unplaced,
    suggestRadiusM: 150,
  }) satisfies SnapLocation;

const place = (id: string, locationId: string, name: string, isUnplaced = false): SnapPlace => ({
  id,
  locationId,
  parentId: null,
  name,
  kindKey: isUnplaced ? 'unplaced' : 'room',
  icon: null,
  isUnplaced,
  sort: 1,
  deleted: false,
});

/** Home, where the person has `homeRole`, and their Personal, which they own. */
async function phone(homeRole: Role) {
  const store = new MemoryStore();
  await store.applySnapshot({
    asOf: '2026-11-08T10:00:00.000Z',
    payloadVersion: 1,
    minPayloadVersion: 1,
    locations: [
      location(HOME, 'Home', 'house', homeRole, HOME_UNPLACED),
      location(PERSONAL, 'Personal', 'personal', 'owner', PERSONAL_UNPLACED),
    ],
    types: { hash: 'h', items: [] },
    changes: {
      places: [
        place(HOME_UNPLACED, HOME, '', true),
        place(KITCHEN, HOME, 'Kitchen'),
        place(PERSONAL_UNPLACED, PERSONAL, '', true),
        place(DESK, PERSONAL, 'Desk'),
      ],
      things: [],
      codes: [],
      legacyCodes: [],
    },
    removed: [],
    revokedLocationIds: [],
    nextCursor: 'c1',
    complete: true,
  });
  return store;
}

async function render(store: MemoryStore, seed?: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed?.(qc);
  qc.setQueryData(keys.me, {
    user: { id: 'u-me' },
    personalHidden: true,
    personalLocationId: PERSONAL,
  });
  const onChange = vi.fn();
  await renderUI(
    <QueryClientProvider client={qc}>
      <WherePicker store={store} label="Where it is" value={null} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe('the scan Where picker with Personal hidden', () => {
  it('leaves Personal out while you can write somewhere else', async () => {
    await render(await phone('member'));
    expect(await screen.findByRole('radio', { name: 'Kitchen' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Desk' })).not.toBeInTheDocument();
  });

  it('offers Personal, and starts in it, when it is the only place you can write', async () => {
    const onChange = await render(await phone('viewer'));
    expect(await screen.findByRole('radio', { name: 'Desk' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Kitchen' })).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: PERSONAL, placeId: PERSONAL_UNPLACED }),
    );
  });

  it('offers it from the server too, before the phone has anything (#459)', async () => {
    const node = (id: string, name: string, isUnplaced = false) =>
      ({
        ...place(id, PERSONAL, name, isUnplaced),
        shortCode: null,
        thingCount: 0,
        childCount: 0,
        createdAt: '2026-11-01T00:00:00.000Z',
        boxCount: 0,
        childOrder: 'name',
      }) as unknown as PlaceNode;
    await render(new MemoryStore(), (qc) => {
      qc.setQueryData(keys.locations, [
        { id: HOME, name: 'Home', kind: 'house', role: 'viewer' },
        { id: PERSONAL, name: 'Personal', kind: 'personal', role: 'owner', hidden: true },
      ] as unknown as LocationDetail[]);
      qc.setQueryData(inventoryKeys.places.tree(HOME), { places: [], boxes: [] });
      qc.setQueryData(inventoryKeys.places.tree(PERSONAL), {
        places: [node(PERSONAL_UNPLACED, '', true), node(DESK, 'Desk')],
        boxes: [],
      });
    });
    expect(await screen.findByRole('radio', { name: /Desk/ })).toBeInTheDocument();
  });
});
