import { request } from 'node:http';

export const VISUAL_GENERATION = 'openclip-vit-b-32-laion2b-s34b-b79k-1a25a446-224-v1';
export const VISUAL_DIMENSIONS = 512;

const MAX_TEXT_BYTES = 4_096;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 30_000;

export type VisualProvider = {
  generation: string;
  dimensions: number;
  encodeText(text: string): Promise<number[]>;
  /** A bounded JPEG prepared by Kept's visual source pipeline. */
  encodeImage(image: Buffer): Promise<number[]>;
};

function unavailable(): Error {
  return new Error('The local visual encoder is unavailable.');
}

function encoderOrigin(value: URL | string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new TypeError('Use a local encoder origin with the 127.0.0.1 address.');
  }
  return url.origin;
}

/** Direct loopback HTTP keeps provider traffic out of proxies and ignores redirects. */
function exchange(
  url: URL,
  payload?: { body: Buffer; contentType: 'application/json' | 'image/jpeg' },
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        agent: false,
        method: payload ? 'POST' : 'GET',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
          ...(payload && {
            'Content-Type': payload.contentType,
            'Content-Length': payload.body.length,
            'X-Kept-Visual-Generation': VISUAL_GENERATION,
          }),
        },
      },
      (response) => {
        if (
          response.statusCode !== 200 ||
          response.headers['content-type'] !== 'application/json'
        ) {
          response.destroy();
          reject(unavailable());
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        response.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > MAX_RESPONSE_BYTES) {
            response.destroy();
            reject(unavailable());
          } else {
            chunks.push(chunk);
          }
        });
        response.on('error', () => reject(unavailable()));
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(unavailable());
          }
        });
      },
    );
    req.on('error', () => reject(unavailable()));
    req.end(payload?.body);
  });
}

function matchingGeneration(value: unknown): value is { vector?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'generation' in value &&
    value.generation === VISUAL_GENERATION &&
    'dimensions' in value &&
    value.dimensions === VISUAL_DIMENSIONS
  );
}

function normalizedVector(value: unknown): value is number[] {
  if (
    !Array.isArray(value) ||
    value.length !== VISUAL_DIMENSIONS ||
    !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  ) {
    return false;
  }
  const norm = value.reduce((sum, entry) => sum + entry * entry, 0);
  return Math.abs(norm - 1) <= 0.01;
}

export function openClipEncoder(url: URL | string): VisualProvider {
  const origin = encoderOrigin(url);
  async function encode(
    kind: 'text' | 'image',
    body: Buffer,
    contentType: 'application/json' | 'image/jpeg',
  ): Promise<number[]> {
    // Check the configured service before passing private encoder inputs to it.
    if (!matchingGeneration(await exchange(new URL('/v1/status', origin)))) throw unavailable();
    const result = await exchange(new URL(`/v1/encode/${kind}`, origin), { body, contentType });
    if (!matchingGeneration(result) || !normalizedVector(result.vector)) throw unavailable();
    return result.vector;
  }

  return {
    generation: VISUAL_GENERATION,
    dimensions: VISUAL_DIMENSIONS,
    encodeText(text) {
      if (!text.trim() || Buffer.byteLength(text) > MAX_TEXT_BYTES) {
        return Promise.reject(new Error('The visual text query is outside encoder limits.'));
      }
      return encode('text', Buffer.from(JSON.stringify({ text })), 'application/json');
    },
    encodeImage(image) {
      if (image.length === 0 || image.length > MAX_IMAGE_BYTES) {
        return Promise.reject(new Error('The visual image is outside encoder limits.'));
      }
      return encode('image', image, 'image/jpeg');
    },
  };
}

/** Activation is explicit. A configuration error leaves ordinary Kept search available. */
export function localVisualProvider(): VisualProvider | null {
  const origin = process.env.KEPT_VISUAL_ENCODER_URL;
  if (!origin) return null;
  try {
    return openClipEncoder(origin);
  } catch {
    return null;
  }
}
