import type { SnapCode } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { shownCodes } from './store';

const T = '01a1b2c3-0000-7000-8000-000000000001';
const code = (c: Partial<SnapCode> & { code: string }): SnapCode => ({
  locationId: '01a1b2c3-0000-7000-8000-0000000000aa',
  thingId: T,
  placeId: null,
  state: 'assigned',
  isPrimary: false,
  ...c,
});

describe('shownCodes', () => {
  it('shows the newest printed code', () => {
    const out = shownCodes([
      code({ code: 'AAA111', isPrimary: true, printedAt: '2026-10-01T00:00:00.000Z' }),
      code({ code: 'BBB222', printedAt: '2026-10-02T00:00:00.000Z' }),
    ]);
    expect(out.get(T)?.code).toBe('BBB222');
  });

  it('breaks a tie on the print time as the server does: the primary, then the lowest code', () => {
    const at = '2026-10-02T00:00:00.000Z';
    expect(
      shownCodes([
        code({ code: 'CCC333', printedAt: at }),
        code({ code: 'DDD444', isPrimary: true, printedAt: at }),
      ]).get(T)?.code,
    ).toBe('DDD444');
    expect(
      shownCodes([
        code({ code: 'FFF666', printedAt: at }),
        code({ code: 'EEE555', printedAt: at }),
      ]).get(T)?.code,
    ).toBe('EEE555');
  });

  it('falls back to the primary code when nothing was printed', () => {
    const out = shownCodes([code({ code: 'GGG777' }), code({ code: 'HHH888', isPrimary: true })]);
    expect(out.get(T)?.code).toBe('HHH888');
  });
});
