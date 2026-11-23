import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  localVisualProvider,
  openClipEncoder,
  VISUAL_DIMENSIONS,
  VISUAL_GENERATION,
} from './provider.js';

const profile = { generation: VISUAL_GENERATION, dimensions: VISUAL_DIMENSIONS };
const unitVector = Array.from({ length: VISUAL_DIMENSIONS }, (_value, i) => (i === 0 ? 1 : 0));
const servers: ReturnType<typeof createServer>[] = [];

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a loopback address.');
  return `http://127.0.0.1:${address.port}`;
}

function sendJson(res: ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});

describe('local visual encoder transport', () => {
  it('is disabled by default and accepts only an explicit loopback origin', async () => {
    vi.stubEnv('KEPT_VISUAL_ENCODER_URL', undefined);
    expect(localVisualProvider()).toBeNull();
    vi.stubEnv('KEPT_VISUAL_ENCODER_URL', 'https://example.com');
    expect(localVisualProvider()).toBeNull();
    expect(() => openClipEncoder('http://127.0.0.1:8798/other')).toThrow(TypeError);
    expect(() => openClipEncoder('http://localhost:8798')).toThrow(TypeError);
    vi.stubEnv('KEPT_VISUAL_ENCODER_URL', 'http://127.0.0.1:8798');
    expect(localVisualProvider()).toMatchObject(profile);
  });

  it('checks generation, then sends text and JPEG separately in the same model space', async () => {
    const requests: {
      path: string | undefined;
      mime: string | undefined;
      generation: string | string[] | undefined;
      body: Buffer;
    }[] = [];
    const endpoint = await listen((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        requests.push({
          path: req.url,
          mime: req.headers['content-type'],
          generation: req.headers['x-kept-visual-generation'],
          body: Buffer.concat(chunks),
        });
        sendJson(res, req.url === '/v1/status' ? profile : { ...profile, vector: unitVector });
      });
    });
    const encoder = openClipEncoder(endpoint);
    const photo = Buffer.from([255, 216, 255, 217]);
    await expect(encoder.encodeText('a mug')).resolves.toEqual(unitVector);
    await expect(encoder.encodeImage(photo)).resolves.toEqual(unitVector);
    expect(requests.map(({ path }) => path)).toEqual([
      '/v1/status',
      '/v1/encode/text',
      '/v1/status',
      '/v1/encode/image',
    ]);
    expect(requests[1]).toMatchObject({
      mime: 'application/json',
      generation: VISUAL_GENERATION,
      body: Buffer.from('{"text":"a mug"}'),
    });
    expect(requests[3]).toMatchObject({
      mime: 'image/jpeg',
      generation: VISUAL_GENERATION,
      body: photo,
    });
  });

  it('does not send private input to a service returning the wrong generation or a redirect', async () => {
    const paths: (string | undefined)[] = [];
    const endpoint = await listen((req, res) => {
      paths.push(req.url);
      if (paths.length === 1) {
        sendJson(res, { ...profile, generation: 'another-generation' });
      } else {
        res.writeHead(302, { Location: '/unexpected' });
        res.end();
      }
    });
    const encoder = openClipEncoder(endpoint);
    await expect(encoder.encodeImage(Buffer.from('private bytes'))).rejects.toThrow('unavailable');
    await expect(encoder.encodeText('private text')).rejects.toThrow('unavailable');
    expect(paths).toEqual(['/v1/status', '/v1/status']);
  });

  it('rejects oversized inputs locally and rejects malformed or unnormalized provider output', async () => {
    const vectorReplies = [unitVector.slice(1), unitVector.map((value) => value * 2), null];
    let calls = 0;
    const endpoint = await listen((req, res) => {
      calls += 1;
      sendJson(
        res,
        req.url === '/v1/status' ? profile : { ...profile, vector: vectorReplies.shift() },
      );
    });
    const encoder = openClipEncoder(endpoint);
    await expect(encoder.encodeText('ض'.repeat(2_049))).rejects.toThrow('outside encoder limits');
    await expect(encoder.encodeImage(Buffer.alloc(4 * 1024 * 1024 + 1))).rejects.toThrow(
      'outside encoder limits',
    );
    expect(calls).toBe(0);
    await expect(encoder.encodeText('one')).rejects.toThrow('unavailable');
    await expect(encoder.encodeText('two')).rejects.toThrow('unavailable');
    await expect(encoder.encodeText('three')).rejects.toThrow('unavailable');
    expect(calls).toBe(6);
  });
});
