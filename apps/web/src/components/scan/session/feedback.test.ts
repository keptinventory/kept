/**
 * Each read is heard and felt: a tone per kind (a new find, a repeat, amber, grey), a buzz where
 * the phone can (Android; iPhones have no vibration on the web), and the counter read aloud at
 * most every 2 seconds. Without audio or vibration nothing fails.
 */
import { describe, expect, it, vi } from 'vitest';
import { announceEvery, feel, signalOf } from './feedback';

describe('feedback', () => {
  it('signals each kind of read in its own colour', () => {
    expect(signalOf('found')).toBe('ok');
    expect(signalOf('already')).toBe('soft');
    expect(signalOf('elsewhere')).toBe('amber');
    expect(signalOf('other_location')).toBe('amber');
    expect(signalOf('view_only')).toBe('grey');
    expect(signalOf('unmatched')).toBe('grey');
    expect(signalOf('ignored')).toBe(null);
  });

  it('plays a tone and buzzes where it can, and does nothing where it can’t', () => {
    const start = vi.fn();
    const osc = { connect: vi.fn(), start, stop: vi.fn(), frequency: { value: 0 } };
    const gain = {
      connect: vi.fn(),
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };
    const audio = {
      currentTime: 0,
      destination: {},
      createOscillator: () => osc,
      createGain: () => gain,
    } as unknown as AudioContext;
    const vibrate = vi.fn();
    feel('ok', { audio, vibrate });
    expect(start).toHaveBeenCalled();
    expect(osc.frequency.value).toBeGreaterThan(0);
    expect(vibrate).toHaveBeenCalled();
    expect(() => feel('grey', { audio: null, vibrate: null })).not.toThrow();
  });

  it('says the counter at most every 2 seconds, and the last one in the end', () => {
    vi.useFakeTimers();
    const say = vi.fn();
    const announce = announceEvery(2000, say);
    announce('1 of 40');
    announce('2 of 40');
    announce('3 of 40');
    expect(say.mock.calls.map((c) => c[0])).toEqual(['1 of 40']);
    vi.advanceTimersByTime(2000);
    expect(say.mock.calls.map((c) => c[0])).toEqual(['1 of 40', '3 of 40']);
    vi.useRealTimers();
  });

  it('says nothing more once cancelled (the screen has closed)', () => {
    vi.useFakeTimers();
    const say = vi.fn();
    const announce = announceEvery(2000, say);
    announce('1 of 40');
    announce('2 of 40');
    announce.cancel();
    vi.advanceTimersByTime(2000);
    expect(say.mock.calls.map((c) => c[0])).toEqual(['1 of 40']);
    vi.useRealTimers();
  });
});
