import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';

// A file's SHA-256 and size, read through one reused buffer. A read stream allocates a fresh
// 64 KiB chunk for every read; over a backup's thousands of files glibc keeps that churn as
// resident memory the process never gives back (measured on 1.14.2, 1,244 blobs: +44 MiB RSS
// through a stream, +5 MiB through this).

export const HASH_CHUNK_BYTES = 1024 * 1024;

/** The buffer the last hash finished with; a hash running at the same time takes its own. */
let spare: Buffer | null = null;

/** What hashFileBytes needs of an open file (fs/promises' FileHandle; tests pass their own). */
export type HashableFile = {
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: null,
  ): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
};

export async function hashFileBytes(
  file: string,
  openFile: (file: string, flags: 'r') => Promise<HashableFile> = open,
): Promise<{ sha256: string; bytes: number }> {
  const fh = await openFile(file, 'r');
  const buf = spare ?? Buffer.allocUnsafeSlow(HASH_CHUNK_BYTES);
  spare = null;
  try {
    const hash = createHash('sha256');
    let bytes = 0;
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, HASH_CHUNK_BYTES, null);
      if (bytesRead === 0) break;
      hash.update(buf.subarray(0, bytesRead));
      bytes += bytesRead;
    }
    return { sha256: hash.digest('hex'), bytes };
  } finally {
    spare = buf;
    await fh.close();
  }
}
