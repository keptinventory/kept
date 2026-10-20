/**
 * The fake camera's video for the scan session e2e (e2e/scan-session.spec.ts): several Kept
 * labels in every frame, as a phone sees a shelf. Chromium plays a .y4m file as the camera
 * (`--use-file-for-fake-video-capture`, e2e/camera.ts) and loops it. Written at test time, since
 * the codes are the ones the test's things were given; nothing is downloaded.
 *
 * Each group of codes is one scene, held for `holdFrames` frames (5 a second), so the decoder
 * sees it several times before the next one. 640×480, 4:2:0, about 460 KB a frame.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { encode } = require('uqr') as {
  encode: (
    text: string,
    opts: { ecc: string; border: number },
  ) => {
    size: number;
    data: boolean[][];
  };
};

const W = 640;
const H = 480;

/** One scene's luma: the codes' QR labels side by side, black on white. */
function scene(texts: readonly string[]): Buffer {
  const y = Buffer.alloc(W * H, 235);
  const cell = Math.floor(W / Math.max(1, texts.length));
  texts.forEach((text, i) => {
    const { size, data } = encode(text, { ecc: 'M', border: 4 });
    const scale = Math.floor(Math.min(cell - 8, H - 8) / size);
    const offX = i * cell + Math.floor((cell - size * scale) / 2);
    const offY = Math.floor((H - size * scale) / 2);
    for (let my = 0; my < size; my++)
      for (let mx = 0; mx < size; mx++) {
        if (!data[my]?.[mx]) continue;
        for (let dy = 0; dy < scale; dy++) {
          const row = (offY + my * scale + dy) * W;
          y.fill(16, row + offX + mx * scale, row + offX + (mx + 1) * scale);
        }
      }
  });
  return y;
}

/** Writes `path`: each group of `texts` held for `holdFrames` frames, in order, looped. */
export function writeSessionVideo(
  path: string,
  groups: readonly (readonly string[])[],
  holdFrames = 10,
): void {
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const parts: Buffer[] = [Buffer.from(`YUV4MPEG2 W${W} H${H} F5:1 Ip A1:1 C420jpeg\n`, 'ascii')];
  for (const g of groups) {
    const luma = scene(g);
    for (let i = 0; i < holdFrames; i++) parts.push(Buffer.from('FRAME\n', 'ascii'), luma, chroma);
  }
  writeFileSync(path, Buffer.concat(parts));
}
