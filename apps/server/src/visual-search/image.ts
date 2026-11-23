import { createHash } from 'node:crypto';
import { VISUAL_IMAGE_MAX_BYTES, VISUAL_IMAGE_MAX_PIXELS } from '@kept/shared';
import sharp from 'sharp';
import type { BlobStore } from '../storage/blob-store.js';

const MAX_EDGE = 1024;

export class InvalidVisualImage extends Error {}

/** Strip metadata before inference and apply the same orientation and rendition to both inputs. */
export async function prepareVisualImage(bytes: Buffer): Promise<Buffer> {
  if (bytes.byteLength === 0 || bytes.byteLength > VISUAL_IMAGE_MAX_BYTES) {
    throw new InvalidVisualImage();
  }
  try {
    const image = sharp(bytes, { limitInputPixels: VISUAL_IMAGE_MAX_PIXELS, animated: false });
    const meta = await image.metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > VISUAL_IMAGE_MAX_PIXELS ||
      !['jpeg', 'png', 'webp'].includes(meta.format ?? '')
    ) {
      throw new InvalidVisualImage();
    }
    return await image
      .autoOrient()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new InvalidVisualImage();
  }
}

export async function readVisualSource(
  blobs: BlobStore,
  key: string,
  bytes: number,
  hash: string,
): Promise<Buffer> {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > VISUAL_IMAGE_MAX_BYTES) {
    throw new InvalidVisualImage();
  }
  const stream = await blobs.stream(key);
  const chunks: Buffer[] = [];
  const digest = createHash('sha256');
  let length = 0;
  for await (const data of stream) {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
    length += chunk.length;
    if (length > bytes) {
      stream.destroy();
      throw new InvalidVisualImage();
    }
    chunks.push(chunk);
    digest.update(chunk);
  }
  if (length !== bytes || digest.digest('hex') !== hash) throw new InvalidVisualImage();
  return Buffer.concat(chunks, length);
}
