import { describe, expect, it } from 'vitest';
import {
  HINT_KEYS,
  isHintKey,
  isTourId,
  TOUR_IDS,
  TOUR_SECTION_IDS,
  tourKey,
  tourProgressKey,
  WHATS_NEW_PREFIX,
  whatsNewKey,
} from './hints.js';

describe('HINT_KEYS', () => {
  it('fit the user_hints key CHECK', () => {
    for (const key of HINT_KEYS) expect(key).toMatch(/^[a-z0-9_.:-]{1,64}$/);
    expect(new Set(HINT_KEYS).size).toBe(HINT_KEYS.length);
  });

  it('include the key Home reads', () => {
    expect(isHintKey('installed_standalone')).toBe(true);
    expect(isHintKey('capture.mode_strip')).toBe(true);
    expect(isHintKey('http_banner')).toBe(true);
    expect(isHintKey('nope')).toBe(false);
  });

  it('hold one key per tour', () => {
    for (const id of TOUR_IDS) expect(isHintKey(tourKey(id))).toBe(true);
    expect(tourKey('import-export')).toBe('help.tours.import-export');
    expect(isHintKey('help.tours.nope')).toBe(false);
    expect(isTourId('vehicles')).toBe(true);
    expect(isTourId('home')).toBe(false);
  });

  it('still accept the older walk’s keys', () => {
    expect(isHintKey('help.tour_seen')).toBe(true);
    for (const id of TOUR_SECTION_IDS) expect(isHintKey(tourProgressKey(id))).toBe(true);
    expect(isHintKey('help.tour.vehicles')).toBe(false);
  });
});

describe('whatsNewKey', () => {
  it('names one key per version, within the user_hints key CHECK', () => {
    expect(whatsNewKey('1.14.1')).toBe('whats_new.1.14.1');
    expect(whatsNewKey('1.14.1').startsWith(WHATS_NEW_PREFIX)).toBe(true);
    expect(whatsNewKey('0.0.0-dev')).toMatch(/^[a-z0-9_.:-]{1,64}$/);
    // Not a fixed key: the server takes only its own version's (home/service.ts).
    expect(isHintKey(whatsNewKey('1.14.1'))).toBe(false);
  });
});
