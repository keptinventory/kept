#!/usr/bin/env node
// The floor plan the e2e uploads on the map (e2e/floor-plan.spec.ts, D266): an invented flat of
// three rooms, drawn from code so it is reproducible and nothing is downloaded or traced:
//
//   node apps/web/e2e/fixtures/make-floor-plan.mjs
//
// The mock provider reads every plan it doesn't know as its default plan (apps/server/src/ai/
// mock.ts `kept_plan`: a living room with "5.00 x 4.00 m" printed, a kitchen and a bedroom), so
// this drawing puts those rooms where that answer's boxes say, on a square page: the browser
// re-encodes an upload before it leaves, so its bytes (and their hash) are the browser's own.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../server/package.json', import.meta.url));
const sharp = require('sharp');

const S = 1000;
const rooms = [
  { name: 'Living room', size: '5.00 x 4.00 m', box: [0.1, 0.1, 0.5, 0.4] },
  { name: 'Kitchen', size: '3.00 x 4.00 m', box: [0.6, 0.1, 0.3, 0.4] },
  { name: 'Bedroom', size: '4.00 x 4.00 m', box: [0.1, 0.5, 0.4, 0.4] },
];
const parts = ['<rect width="100%" height="100%" fill="#fff"/>'];
for (const r of rooms) {
  const [x, y, w, h] = r.box.map((v) => v * S);
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#222" stroke-width="10"/>`,
  );
  parts.push(
    `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-family="Arial" font-size="26">${r.name}</text>`,
  );
  parts.push(
    `<text x="${x + w / 2}" y="${y + h / 2 + 32}" text-anchor="middle" font-family="Arial" font-size="20">${r.size}</text>`,
  );
}
parts.push(
  `<text x="${S - 30}" y="${S - 24}" text-anchor="end" font-family="Arial" font-size="16" fill="#666">Invented plan for Kept's tests. Not a real home.</text>`,
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${parts.join('')}</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(new URL('floor-plan-flat.png', import.meta.url), png);
console.log('floor-plan-flat.png', png.length, 'bytes');
