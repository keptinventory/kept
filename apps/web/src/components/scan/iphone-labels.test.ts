import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/native/bridge';
import type { InventoryCache } from '@/native/inventory';
import { approvedLabel, isTarget, resolveLabel } from '@/native/labels';

const { nativeRequest } = vi.hoisted(() => ({ nativeRequest: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ request: nativeRequest }) }));

const connection: Connection = {
  id: 'test connection',
  origin: 'https://kept.example.com',
  account: 'account',
  epoch: 'epoch',
};
const thing = (id: string): InventoryCache['things'][number] => ({
  id,
  locationId: 'home',
  shortCode: id === 'a' ? 'ABC123' : 'ABC124',
  name: `Box ${id}`,
  typeId: null,
  placeId: null,
  containerId: null,
  quantity: '1',
  aliases: {},
  lifecycle: 'in_use',
  reviewState: 'confirmed',
  locationUncertain: false,
  lastSeenAt: null,
  coverFileId: null,
  isContainer: true,
  deleted: false,
});
const cache: InventoryCache = {
  asOf: '2026-11-22T20:00:00Z',
  truncated: false,
  locations: [],
  types: [],
  places: [],
  codes: [
    {
      code: 'ABC123',
      locationId: 'home',
      thingId: 'a',
      placeId: null,
      state: 'assigned',
      isPrimary: true,
    },
    {
      code: 'ABC124',
      locationId: 'home',
      thingId: 'b',
      placeId: null,
      state: 'assigned',
      isPrimary: true,
    },
    {
      code: 'ABC125',
      locationId: 'home',
      thingId: 'a',
      placeId: null,
      state: 'assigned',
      isPrimary: false,
    },
    {
      code: 'ABC126',
      locationId: 'home',
      thingId: 'a',
      placeId: null,
      state: 'retired',
      isPrimary: false,
    },
  ],
  things: [thing('a'), thing('b')],
  legacyCodes: [],
  details: {},
};

describe('iPhone label resolution', () => {
  beforeEach(() => {
    nativeRequest.mockReset();
  });

  it('checks NFC origin and URL shape before resolving', async () => {
    expect(approvedLabel('https://kept.example.com/l/abc123', connection.origin)).toEqual({
      status: 'approved',
      code: 'ABC123',
    });
    for (const url of [
      'http://kept.example.com/l/ABC123',
      'https://person@kept.example.com/l/ABC123',
      'https://kept.example.com/l/ABC123?next=/',
    ]) {
      expect(approvedLabel(url, connection.origin)).toEqual({ status: 'malformed' });
    }
    for (const url of [
      'https://kept.example.com.other.example/l/ABC123',
      'https://kept.example.com:4433/l/ABC123',
    ]) {
      expect(await resolveLabel(connection, cache, url, 'nfc')).toEqual({ status: 'foreign' });
    }
    expect(nativeRequest).not.toHaveBeenCalled();
  });

  it('uses the authorized result for QR and NFC without reviving an online miss from cache', async () => {
    const url = 'https://kept.example.com/l/ABC123';
    nativeRequest.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({
        outcome: 'open',
        target: { kind: 'thing', id: 'a', locationId: 'home' },
      }),
    });
    expect(await resolveLabel(connection, cache, url, 'qr')).toMatchObject({
      status: 'resolved',
      target: { id: 'a' },
      cached: false,
    });
    nativeRequest.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ outcome: 'not_in_your_kept' }),
    });
    expect(await resolveLabel(connection, cache, url, 'nfc')).toEqual({
      status: 'not_in_your_kept',
    });
  });

  it('compares canonical IDs offline and distinguishes retired codes from uncached ones', async () => {
    nativeRequest.mockRejectedValue({ code: 'network' });
    const scan = (code: string) =>
      resolveLabel(connection, cache, `${connection.origin}/l/${code}`, 'nfc');
    expect(isTarget(await scan('ABC123'), 'a')).toBe(true);
    expect(isTarget(await scan('ABC125'), 'a')).toBe(true);
    expect(await scan('ABC124')).toMatchObject({ status: 'resolved', target: { id: 'b' } });
    expect(await scan('ABC126')).toEqual({ status: 'not_in_your_kept' });
    expect(await scan('ABC127')).toEqual({ status: 'unresolved' });
  });
});
