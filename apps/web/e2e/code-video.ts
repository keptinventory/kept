/**
 * A fake camera video of one code in any format the scanner reads (e2e/step3.spec.ts): drawn with
 * zxing-wasm's own writer at test time, black on white, as big as fits, so the codes are the test's
 * own and nothing is downloaded. Chromium plays the .y4m file as the camera
 * (`--use-file-for-fake-video-capture`, e2e/camera.ts) and loops its one frame. 320×320, 4:2:0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));

const W = 320;
const H = 320;

/** Writes `path`: `text` encoded as `format` (zxing-wasm's names: `DataMatrix`, `Code39`…). */
export async function writeCodeVideo(
  path: string,
  text: string,
  format: string,
  options = '',
): Promise<void> {
  const writer = (await import('zxing-wasm/writer')) as typeof import('zxing-wasm/writer');
  const wasm = readFileSync(require.resolve('zxing-wasm/writer/zxing_writer.wasm'));
  await writer.prepareZXingModule({
    overrides: {
      wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    },
    fireImmediately: true,
  });
  const { symbol, error } = await writer.writeBarcode(text, {
    format: format as never,
    options,
    scale: 1,
  });
  if (error) throw new Error(`writeCodeVideo: ${error}`);
  const scale = Math.floor(Math.min((W - 32) / symbol.width, (H - 32) / symbol.height));
  const offX = Math.floor((W - symbol.width * scale) / 2);
  const offY = Math.floor((H - symbol.height * scale) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let row = 0; row < H; row++)
    for (let col = 0; col < W; col++) {
      const sx = Math.floor((col - offX) / scale);
      const sy = Math.floor((row - offY) / scale);
      if (sx < 0 || sy < 0 || sx >= symbol.width || sy >= symbol.height) continue;
      if (symbol.data[sy * symbol.width + sx] === 0) y[row * W + col] = 16;
    }
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F5:1 Ip A1:1 C420jpeg\nFRAME\n`, 'ascii');
  writeFileSync(path, Buffer.concat([header, y, chroma]));
}
