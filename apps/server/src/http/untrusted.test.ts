import { describe, expect, it } from 'vitest';
import { withoutBidiControls } from './untrusted.js';

describe('withoutBidiControls', () => {
  it('takes out overrides, embeddings, isolates and marks, and nothing else', () => {
    expect(withoutBidiControls('Claude ‮evil‬ Desktop')).toBe('Claude evil Desktop');
    expect(withoutBidiControls('⁦a⁩‎‏؜b‪‫‭')).toBe('ab');
    expect(withoutBidiControls('بيت العائلة · Claude')).toBe('بيت العائلة · Claude');
  });
});
