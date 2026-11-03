import { describe, expect, it } from 'vitest';
import { typeOfKey, withoutCustomised } from './type-list';

const builtin = { id: 'b', builtinKey: 'furniture', copiedFromId: null };
const copy = { id: 'c', builtinKey: 'furniture', copiedFromId: 'b' };
const other = { id: 'o', builtinKey: 'tool', copiedFromId: null };

describe('type lists (#357)', () => {
  it('drops a built-in the account has a copy of, and keeps the rest', () => {
    expect(withoutCustomised([builtin, copy, other]).map((t) => t.id)).toEqual(['c', 'o']);
    expect(withoutCustomised([builtin, other]).map((t) => t.id)).toEqual(['b', 'o']);
  });

  it('finds a built-in key on the copy first', () => {
    expect(typeOfKey([builtin, copy], 'furniture')?.id).toBe('c');
    expect(typeOfKey([builtin], 'furniture')?.id).toBe('b');
    expect(typeOfKey([builtin, copy], 'furniture', (t) => t.id !== 'c')?.id).toBe('b');
    expect(typeOfKey(undefined, 'furniture')).toBeUndefined();
  });
});
