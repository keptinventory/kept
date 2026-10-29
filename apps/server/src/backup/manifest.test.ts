import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { BlobStore } from '../storage/blob-store.js';
import { hashBlob } from './manifest.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function store(over: Partial<BlobStore>): BlobStore {
  return {
    put: async () => {},
    stream: async () => Readable.from([Buffer.from('streamed')]),
    delete: async () => {},
    exists: async () => true,
    signedUrl: async () => '',
    ...over,
  };
}

describe('hashBlob', () => {
  it('asks a store that can hash its own files (local storage), and never opens a stream', async () => {
    const got = await hashBlob(
      store({
        hash: async (key) => ({ sha256: `of ${key}`, bytes: 3 }),
        stream: async () => {
          throw new Error('streamed instead');
        },
      }),
      'o/k',
    );
    expect(got).toEqual({ sha256: 'of o/k', bytes: 3 });
  });

  it('streams from a store without one (S3)', async () => {
    expect(await hashBlob(store({}), 'o/k')).toEqual({ sha256: sha('streamed'), bytes: 8 });
  });
});
