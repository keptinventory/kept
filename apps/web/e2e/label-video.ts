/**
 * A fake camera video of a printed label (e2e/scan-printed-code.spec.ts): a screenshot of the label
 * as the print view draws it, lying on a grey table, turned a few degrees and a little soft, as a
 * phone held over it sees it. Chromium plays the .y4m file as the camera
 * (`--use-file-for-fake-video-capture`, e2e/camera.ts) and loops its one frame. 640×480, 4:2:0.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const W = 640;
const H = 480;
const TABLE = { r: 118, g: 114, b: 108 };

/** Writes `path`: `labelPng` `width` px wide in the frame, turned `angle` degrees. */
export async function writeLabelVideo(
  path: string,
  labelPng: Buffer,
  { width = 440, angle = 3 } = {},
): Promise<void> {
  const label = await sharp(labelPng)
    .flatten({ background: '#ffffff' })
    .resize({ width })
    .rotate(angle, { background: TABLE })
    .png()
    .toBuffer();
  const { width: lw = 0, height: lh = 0 } = await sharp(label).metadata();
  const luma = await sharp({ create: { width: W, height: H, channels: 3, background: TABLE } })
    .composite([{ input: label, left: Math.round((W - lw) / 2), top: Math.round((H - lh) / 2) }])
    .blur(0.8)
    .greyscale()
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  // Video range: 16 (black) to 235 (white).
  const y = Buffer.alloc(W * H);
  for (let i = 0; i < y.length; i++) y[i] = 16 + Math.round(((luma[i] as number) * 219) / 255);
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F5:1 Ip A1:1 C420jpeg\nFRAME\n`, 'ascii');
  writeFileSync(path, Buffer.concat([header, y, chroma]));
}
