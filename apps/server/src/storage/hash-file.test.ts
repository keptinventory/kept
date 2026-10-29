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

  it('keeps files apart when several are hashed at once (the reused buffer is never shared)', async () => {
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
