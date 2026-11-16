/**
 * What a label's QR holds (qr.ts): the link by default, or the code alone, remembered on this
 * browser; the code alone is the smallest QR there is, and the app's scanner reads it as a label.
 */
import { parseScan } from '@kept/shared';
import { act, renderHook } from '@testing-library/react';
import { encode } from 'uqr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentQrContent, QUIET_ZONE, qrMatrix, qrValue, setQrContent, useQrContent } from './qr';

const label = { code: '7KQ4MZ', url: 'https://kept.example.org/l/7KQ4MZ' };

afterEach(() => {
  setQrContent('link');
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('qrValue', () => {
  it('is the link, or the code alone', () => {
    expect(qrValue(label, 'link')).toBe(label.url);
    expect(qrValue(label, 'code')).toBe('7KQ4MZ');
  });

  it('the code alone is the smallest QR (version 1), the link a larger one', () => {
    const side = (value: string) => qrMatrix(encode, value).length - 2 * QUIET_ZONE;
    expect(side(qrValue(label, 'code'))).toBe(21);
    expect(side(qrValue(label, 'link'))).toBeGreaterThan(21);
  });

  it('the scanner reads the code alone as a Kept label', () => {
    expect(parseScan(qrValue(label, 'code'), 'qr_code')).toEqual({ kind: 'kept', code: '7KQ4MZ' });
  });
});

describe('the choice', () => {
  it('is the link until another is picked, then remembered on this browser', () => {
    expect(currentQrContent()).toBe('link');
    setQrContent('code');
    expect(currentQrContent()).toBe('code');
    expect(localStorage.getItem('kept.labels.qr')).toBe('code');
  });

  it('redraws every label using it when it changes', () => {
    const { result } = renderHook(() => useQrContent());
    expect(result.current).toBe('link');
    act(() => setQrContent('code'));
    expect(result.current).toBe('code');
  });

  it('is still followed on this page when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setQrContent('code');
    expect(currentQrContent()).toBe('code');
  });
});
