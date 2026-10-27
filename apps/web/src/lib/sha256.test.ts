/**
 * One SHA-256 for every upload: `crypto.subtle` where the page has it, else the same function in
 * plain JavaScript, because a page served over plain HTTP from a network address (not localhost)
 * has no `crypto.subtle` at all, and uploads must still work there.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HASH_CHUNK, sha256Hex } from './sha256';

const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const abc = () => new TextEncoder().encode('abc');
const bytes = (n: number) => new Uint8Array(n).map((_, i) => (i * 7 + 3) % 251);
const nodeHex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe.each(['with crypto.subtle', 'without crypto.subtle'])('sha256Hex %s', (mode) => {
  beforeEach(() => {
    if (mode === 'without crypto.subtle') {
      // What an insecure page has: getRandomValues, no subtle.
      vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
      expect(globalThis.crypto.subtle).toBeUndefined();
    }
  });
  afterEach(() => vi.unstubAllGlobals());

  it('hashes the empty input', async () => {
    expect(await sha256Hex(new Blob([]))).toBe(EMPTY);
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(EMPTY);
  });

  it('hashes "abc" from a blob, bytes or a buffer', async () => {
    expect(await sha256Hex(new Blob([abc()]))).toBe(ABC);
    expect(await sha256Hex(abc())).toBe(ABC);
    expect(await sha256Hex(abc().buffer as ArrayBuffer)).toBe(ABC);
  });

  it('hashes 1 MiB as node does', async () => {
    const mib = bytes(1024 * 1024);
    expect(await sha256Hex(new Blob([mib]))).toBe(nodeHex(mib));
  });

  it('hashes a blob longer than one read', async () => {
    const big = bytes(HASH_CHUNK + 1);
    expect(await sha256Hex(new Blob([big]))).toBe(nodeHex(big));
  });
});
