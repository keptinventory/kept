/**
 * Hand-overs and kits in the mock (1.14, #170), through the real fetchers: lending a box makes a
 * line for everything inside it; the checklist closes each line as chosen; the sample kit has a
 * part elsewhere, and the sample hand-over one line still out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '../../inventory/mock/fixtures';
import { ownerScenario } from '../../mock/fixtures';
import { createMockApi } from '../../mock/server';
import { householdApi as api } from '../queries';
import { KIT_IDS as K, seedKitSample } from './handovers';

beforeEach(() => {
  const state = ownerScenario();
  const mock = createMockApi(state);
  seedKitSample(state);
  vi.stubGlobal('fetch', mock.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('hand-overs and kits in the mock', () => {
  it('has the sample: a kit with a part elsewhere, a hand-over with one line still out', async () => {
    const kit = (await api.kit(K.bag)).kit;
    expect(kit?.summary).toMatchObject({ parts: 3, inKit: 2, notInKit: 1, complete: false });
    expect(kit?.parts.find((p) => p.thing.id === K.battery)?.status).toBe('elsewhere');
    const h = await api.handover(K.handover);
    expect(h.counts).toEqual({ lines: 3, open: 1, returned: 2, lost: 0 });
    expect(h.lines.find((l) => l.thingId === K.tripod)?.condition).toEqual({
      out: 'good',
      in: 'fair',
    });
    const loans = await api.thingLoans(K.head);
    expect(loans.items[0]).toMatchObject({ returnedAt: null, with: { id: K.tripodKit } });
  });

  it('lends a box with what is inside, and brings each line back as chosen', async () => {
    const { body: lent } = await api.lend(INV_IDS.thing.box3, { person: { name: 'Murdock' } });
    const h = lent.handover;
    expect(h?.counts.lines).toBe(3);
    const [box, scarves, lights] = [
      INV_IDS.thing.box3,
      INV_IDS.thing.scarves,
      INV_IDS.thing.lights,
    ].map((id) => h?.lines.find((l) => l.thingId === id));
    expect(scarves?.pathAtLend).toBe('Box 3');
    const { body: back } = await api.returnHandover(h?.id ?? '', {
      lines: [
        { loanId: box?.id ?? '', outcome: 'back', conditionIn: 'good' },
        { loanId: scarves?.id ?? '', outcome: 'back', quantityBack: '3' },
        { loanId: lights?.id ?? '', outcome: 'lost' },
      ],
    });
    expect(back.counts).toEqual({ lines: 4, open: 1, returned: 2, lost: 1 });
  });
});
