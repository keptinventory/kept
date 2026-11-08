import { describe, expect, it } from 'vitest';
import { dayOf, endOfDay, tomorrowIn } from './day-end';

describe('membership end dates', () => {
  it('ends a day at its last second where the location is', () => {
    // Cairo is UTC+3 in July (summer time) and UTC+2 in December; New York is UTC-4 in July.
    expect(endOfDay('2026-07-31', 'Africa/Cairo')).toBe('2026-07-31T20:59:59.000Z');
    expect(endOfDay('2026-12-31', 'Africa/Cairo')).toBe('2026-12-31T21:59:59.000Z');
    expect(endOfDay('2026-07-31', 'America/New_York')).toBe('2026-08-01T03:59:59.000Z');
    expect(endOfDay('2026-07-31', 'UTC')).toBe('2026-07-31T23:59:59.000Z');
  });

  it('reads the day back in the same zone', () => {
    for (const tz of ['Africa/Cairo', 'America/New_York', 'Asia/Tokyo', 'UTC']) {
      expect(dayOf(endOfDay('2026-10-31', tz), tz)).toBe('2026-10-31');
    }
  });
});

describe('the first last day', () => {
  it('is the day after today where the location is, not after the UTC day', () => {
    const late = new Date('2026-10-31T23:00:00Z');
    expect(tomorrowIn('Africa/Cairo', late)).toBe('2026-11-02');
    expect(tomorrowIn('UTC', late)).toBe('2026-11-01');
    expect(tomorrowIn('America/New_York', new Date('2026-11-01T02:00:00Z'))).toBe('2026-11-01');
  });
});
