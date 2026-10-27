/**
 * An archive's SHA-256, read in chunks, in a worker (sha256.worker.ts) so the page stays
 * responsive. The function itself is lib/sha256.ts, shared with every other upload.
 */
import { hashBlob } from '@/lib/sha256';

export { HASH_CHUNK, hashBlob, Sha256 } from '@/lib/sha256';

export type HashMessage =
  | { kind: 'progress'; fraction: number }
  | { kind: 'done'; sha256: string }
  | { kind: 'error' };

/**
 * The file's SHA-256, in a worker where there is one (sha256.worker.ts), else here. Rejects when
 * the file can't be read (it was moved or deleted after it was chosen).
 */
export function hashFile(file: Blob, onProgress: (fraction: number) => void): Promise<string> {
  if (typeof Worker === 'undefined') return hashBlob(file, onProgress);
  const worker = new Worker(new URL('./sha256.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<string>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<HashMessage>) => {
      if (e.data.kind === 'progress') onProgress(e.data.fraction);
      else {
        worker.terminate();
        if (e.data.kind === 'done') resolve(e.data.sha256);
        else reject(new Error('unreadable'));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('unreadable'));
    };
    worker.postMessage(file);
  });
}
