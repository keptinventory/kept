/**
 * A scan session's reads, resolved in batches: the phone first for each, then the rest in one
 * `POST /scan/resolve-batch` of at most 100 codes; offline, the phone's answer or "not on this
 * phone". A product barcode the server finds on several things asks which, under its barcode.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ScanOutcome } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { MemoryStore } from '@/offline/store';
import { firstPage } from '@/test/store-contract';
import { fromServer, resolveBatch } from './resolve';

const LOC = '01926f00-0000-7000-8000-00000000b002';

async function store() {
  const s = new MemoryStore();
  await s.applySnapshot(firstPage());
  return s;
}

describe('resolveBatch', () => {
  it('answers what the phone knows itself, and asks the server for the rest, in order', async () => {
    const server = vi.fn(async (body: { items: { text: string }[] }) => ({
      results: body.items.map((i): ScanOutcome => ({ outcome: 'not_kept', text: i.text })),
    }));
    const out = await resolveBatch(
      [
        { text: 'https://kept.example/l/7KQ4MZ', format: 'qr_code' },
        { text: 'hello' },
        { text: 'world' },
      ],
      { store: await store(), online: true, batch: server },
    );
    expect(out.map((r) => r.outcome)).toEqual(['open', 'not_kept', 'not_kept']);
    expect(server).toHaveBeenCalledTimes(1);
    expect(server.mock.calls[0]?.[0].items.map((i) => i.text)).toEqual(['hello', 'world']);
  });

  it('asks at most 100 codes at a time', async () => {
    const server = vi.fn(async (body: { items: { text: string }[] }) => ({
      results: body.items.map((i): ScanOutcome => ({ outcome: 'not_kept', text: i.text })),
    }));
    const reads = Array.from({ length: 230 }, (_, i) => ({ text: `X-${i}` }));
    const out = await resolveBatch(reads, { store: null, online: true, batch: server });
    expect(out).toHaveLength(230);
    expect(server.mock.calls.map((c) => c[0].items.length)).toEqual([100, 100, 30]);
  });

  it('offline, or when the server can’t be reached: not on this phone', async () => {
    const offline = vi.fn(async () => {
      throw new ApiError(0, 'offline', 'offline');
    });
    for (const deps of [
      { store: await store(), online: false },
      { store: await store(), online: true, batch: offline },
    ]) {
      const out = await resolveBatch([{ text: 'ZZ9ZZ9' }, { text: 'B0X3QF' }], deps);
      expect(out.map((r) => r.outcome)).toEqual(['not_on_phone', 'open']);
    }
  });

  it('names a barcode on several things by the barcode', () => {
    const res = fromServer(
      { kind: 'barcode', code: '5901234123457', symbology: 'ean_13' },
      {
        outcome: 'legacy_ambiguous',
        candidates: [
          { kind: 'thing', id: LOC, name: 'Kettle', locationName: 'Home', locationId: LOC },
        ],
      },
    );
    expect(res).toMatchObject({ outcome: 'legacy_ambiguous', legacy: '5901234123457' });
  });
});
