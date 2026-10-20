import { describe, expect, it } from 'vitest';
import {
  CAPTURE_MODES,
  INBOX_KEYMAP,
  INBOX_KINDS,
  INBOX_RESOLUTIONS,
  PHOTO_POLICY,
  ROOM_CAPTURE_STATUSES,
  ROOM_LIMITS,
} from './capture.js';

describe('capture vocabulary', () => {
  it('has the five modes of the mode strip, in order', () => {
    expect(CAPTURE_MODES).toEqual(['thing', 'receipt', 'label', 'reading', 'room']);
  });

  it('keeps originals only for the evidence modes (D34)', () => {
    expect(PHOTO_POLICY.thing).toEqual({ shrinkTo: 2048, keepOriginal: false });
    expect(PHOTO_POLICY.room).toEqual({ shrinkTo: 2048, keepOriginal: false });
    for (const mode of ['receipt', 'label', 'reading'] as const) {
      expect(PHOTO_POLICY[mode]).toEqual({ keepOriginal: true, displayTo: 2048 });
    }
    expect(Object.keys(PHOTO_POLICY).sort()).toEqual([...CAPTURE_MODES].sort());
  });

  it('matches the inbox CHECKs (§7.8, plan T5)', () => {
    expect(INBOX_KINDS).toEqual([
      'draft',
      'reading',
      'label_claim',
      'currency',
      'duplicate',
      'receipt',
      'sync_drop',
      'room',
    ]);
    expect(INBOX_RESOLUTIONS).toEqual([
      'accepted',
      'edited',
      'discarded',
      'merged',
      'linked',
      'restored',
      'dismissed',
    ]);
  });

  it('caps a room capture at five photos and sixty objects a photo', () => {
    expect(ROOM_LIMITS).toEqual({ photos: 5, objects: 60, codes: 60 });
    expect(ROOM_CAPTURE_STATUSES).toEqual(['reading', 'merging', 'ready', 'failed', 'off']);
  });

  it('maps every key of the fixed keyboard map once (screens §5, §8)', () => {
    expect(Object.keys(INBOX_KEYMAP).sort()).toEqual(
      ['a', 'd', 'e', 'g', 'j', 'k', 'l', 'm', 'n', 's', 'shift+a', 't', 'x', 'y'].sort(),
    );
    const actions = Object.values(INBOX_KEYMAP);
    expect(new Set(actions).size).toBe(actions.length);
    expect(Object.isFrozen(INBOX_KEYMAP)).toBe(true);
  });
});
