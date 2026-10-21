import { describe, expect, it } from 'vitest';
import {
  isTagColour,
  nearestTagColour,
  nextTagColour,
  TAG_COLOUR_KEYS,
  TAG_COLOURS,
  TAG_LIMITS,
  tagColourKey,
} from './tags.js';

describe('TAG_COLOURS', () => {
  it('are twelve distinct upper-case hex colours, one per key', () => {
    const hex = Object.values(TAG_COLOURS);
    expect(hex).toHaveLength(12);
    expect(new Set(hex).size).toBe(12);
    for (const h of hex) expect(h).toMatch(/^#[0-9A-F]{6}$/);
    expect(Object.keys(TAG_COLOURS)).toEqual([...TAG_COLOUR_KEYS]);
  });

  it('tell a palette colour, in any case, from another hex', () => {
    expect(isTagColour(TAG_COLOURS.red)).toBe(true);
    expect(isTagColour(TAG_COLOURS.red.toLowerCase())).toBe(true);
    expect(isTagColour('#123456')).toBe(false);
    expect(isTagColour('red')).toBe(false);
    expect(tagColourKey(TAG_COLOURS.blue.toLowerCase())).toBe('blue');
    expect(tagColourKey('#123456')).toBeNull();
  });
});

describe('nearestTagColour', () => {
  it('maps any hex to the closest palette colour', () => {
    expect(nearestTagColour('#ff0000')).toBe(TAG_COLOURS.red);
    expect(nearestTagColour('#1e90ff')).toBe(TAG_COLOURS.blue);
    expect(nearestTagColour('#228b22')).toBe(TAG_COLOURS.green);
    expect(nearestTagColour('#808080')).toBe(TAG_COLOURS.grey);
    expect(Object.values(TAG_COLOURS)).toContain(nearestTagColour('#123456'));
  });

  it('keeps a palette colour as it is, upper case', () => {
    expect(nearestTagColour(TAG_COLOURS.teal.toLowerCase())).toBe(TAG_COLOURS.teal);
  });

  it('is null for something that is not a colour', () => {
    expect(nearestTagColour(null)).toBeNull();
    expect(nearestTagColour('')).toBeNull();
    expect(nearestTagColour('#12')).toBeNull();
    expect(nearestTagColour('teal')).toBeNull();
  });
});

describe('nextTagColour', () => {
  it('starts with the first colour', () => {
    expect(nextTagColour([])).toBe(TAG_COLOURS.red);
  });

  it('takes the least used colour, ties in palette order', () => {
    expect(nextTagColour([TAG_COLOURS.red])).toBe(TAG_COLOURS.orange);
    const all = Object.values(TAG_COLOURS);
    expect(nextTagColour([...all, TAG_COLOURS.red])).toBe(TAG_COLOURS.orange);
    expect(nextTagColour([...all, ...all.slice(0, 11)])).toBe(TAG_COLOURS.grey);
  });

  it('counts an older free colour as its nearest palette colour, and ignores no colour', () => {
    expect(nextTagColour(['#ff0000', null])).toBe(TAG_COLOURS.orange);
  });
});

describe('TAG_LIMITS', () => {
  it('caps tags per thing and per account', () => {
    expect(TAG_LIMITS.perThing).toBe(50);
    expect(TAG_LIMITS.perAccount).toBe(1000);
    expect(TAG_LIMITS.bulkThings).toBe(200);
  });
});
