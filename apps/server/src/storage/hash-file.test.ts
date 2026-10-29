import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HASH_CHUNK_BYTES, hashFileBytes } from './hash-file.js';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'kept-hash-file-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('hashFileBytes', () => {
  it.each([
    ['empty', 0],
    ['small', 11],
    ['one chunk exactly', HASH_CHUNK_BYTES],
    ['several chunks', HASH_CHUNK_BYTES * 2 + 17],
  ])('hashes a %s file and counts its bytes', async (name, size) => {
    const bytes = randomBytes(size);
    const file = path.join(dir, `${name}.bin`);
    await writeFile(file, bytes);
    expect(await hashFileBytes(file)).toEqual({ sha256: sha(bytes), bytes: size });
  });

  it("keeps files apart when several are hashed at once: a read finishing late never sees another file's bytes", async () => {
    // Stand-in files whose reads interleave by design: each read writes its bytes into the buffer
    // it was given at once, but resolves only when the test says so. A starts reading, then B
    // starts and writes into its buffer, then A's read resolves. Were the buffer shared, A would
    // hash B's bytes.
    const contents: Record<string, Buffer> = { a: Buffer.from('aaaa'), b: Buffer.from('bbbb') };
    const pending: (() => void)[] = [];
    const openFile = async (name: string) => {
      let done = false;
      return {
        read: (buf: Buffer) => {
          if (done) return Promise.resolve({ bytesRead: 0, buffer: buf });
          done = true;
          const bytes = contents[name] as Buffer;
          bytes.copy(buf);
          return new Promise<{ bytesRead: number; buffer: Buffer }>((resolve) =>
            pending.push(() => resolve({ bytesRead: bytes.length, buffer: buf })),
          );
        },
        close: async () => {},
      };
    };
    const tick = () => new Promise((r) => setImmediate(r));
    const a = hashFileBytes('a', openFile);
    await tick();
    const b = hashFileBytes('b', openFile);
    await tick();
    expect(pending).toHaveLength(2);
    pending.shift()?.(); // A's read resolves after B wrote
    await tick();
    pending.shift()?.();
    expect(await a).toEqual({ sha256: sha(contents.a as Buffer), bytes: 4 });
    expect(await b).toEqual({ sha256: sha(contents.b as Buffer), bytes: 4 });
  });

  it('hashes real files at once correctly', async () => {
    const files = await Promise.all(
      [3, 2, 1].map(async (n) => {
        const bytes = randomBytes(HASH_CHUNK_BYTES * n + n);
        const file = path.join(dir, `at-once-${n}.bin`);
        await writeFile(file, bytes);
        return { file, bytes };
      }),
    );
    const got = await Promise.all(files.map((f) => hashFileBytes(f.file)));
    expect(got).toEqual(files.map((f) => ({ sha256: sha(f.bytes), bytes: f.bytes.length })));
  });

  it('rejects with ENOENT for a missing file', async () => {
    await expect(hashFileBytes(path.join(dir, 'none'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
