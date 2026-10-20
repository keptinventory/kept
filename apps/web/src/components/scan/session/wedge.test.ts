/**
 * A USB or Bluetooth barcode scanner types the code and Enter, much faster than a person: fast
 * keys ending in Enter are a read; slow typing, or typing into a field, is not.
 */
import { describe, expect, it, vi } from 'vitest';
import { WEDGE_GAP_MS, wedgeReader } from './wedge';

const key = (k: string, target: EventTarget = document.body) =>
  ({ key: k, target, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

function typed(text: string, gap: number, target?: EventTarget) {
  let clock = 1000;
  const onRead = vi.fn();
  const handle = wedgeReader(onRead, () => clock);
  for (const ch of text) {
    handle(key(ch, target));
    clock += gap;
  }
  handle(key('Enter', target));
  return onRead;
}

describe('wedgeReader', () => {
  it('reads fast keys ending in Enter as a code', () => {
    expect(typed('7KQ4MZ', 10)).toHaveBeenCalledWith('7KQ4MZ');
    expect(typed('https://kept.example/l/7KQ4MZ', 5)).toHaveBeenCalledWith(
      'https://kept.example/l/7KQ4MZ',
    );
  });

  it('ignores a person typing, and very short bursts', () => {
    expect(typed('7KQ4MZ', WEDGE_GAP_MS + 40)).not.toHaveBeenCalled();
    expect(typed('ab', 5)).not.toHaveBeenCalled();
  });

  it('leaves keys typed into a field alone', () => {
    const input = document.createElement('input');
    expect(typed('7KQ4MZ', 5, input)).not.toHaveBeenCalled();
  });
});
