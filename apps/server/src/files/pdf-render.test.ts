import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encryptedPdf, textPdf } from '../../test/pdf.js';
import { PDF_RENDER_MEMORY_MB, PDF_RENDER_PX, renderPdfPage } from './pdf-text.js';

// A floor plan sent as a PDF (D266): its first page drawn in the PDF worker's render mode, in a
// child limited to 20 s and 384 MB, with that page's text. Nothing is stored here; the extract job
// re-encodes the PNG like any image (extraction/image.ts).

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'kept-pdf-render-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const fileOf = async (name: string, bytes: Buffer) => {
  const p = path.join(dir, name);
  await writeFile(p, bytes);
  return p;
};

describe('renderPdfPage', () => {
  it('draws only the first page, its long side at 2,560 px, and reads that page’s text', async () => {
    const file = await fileOf(
      'two.pdf',
      textPdf([['Ground floor', 'Kitchen 3.40 x 2.80 m'], ['Notes on the second page']]),
    );
    const r = await renderPdfPage(file);
    expect(r.status).toBe('rendered');
    if (r.status !== 'rendered') return;
    expect(r.pages).toBe(2);
    expect(Math.max(r.width, r.height)).toBe(PDF_RENDER_PX);
    const m = await sharp(r.png).metadata();
    expect(m.format).toBe('png');
    expect(Math.max(m.width ?? 0, m.height ?? 0)).toBe(PDF_RENDER_PX);
    expect(r.text).toContain('Kitchen 3.40 x 2.80 m');
    expect(r.text).not.toContain('second page');
  });

  it('runs with more memory than reading text, and is killed past its limit', async () => {
    expect(PDF_RENDER_MEMORY_MB).toBe(384);
    const file = await fileOf('one.pdf', textPdf([['Plan']]));
    const r = await renderPdfPage(file, { memoryMb: 24 });
    expect(r.status).toBe('memory');
  });

  it('says so for an encrypted PDF and for one that isn’t a PDF', async () => {
    expect((await renderPdfPage(await fileOf('locked.pdf', encryptedPdf()))).status).toBe(
      'encrypted',
    );
    const junk = await renderPdfPage(await fileOf('junk.pdf', Buffer.from('not a pdf at all')));
    expect(junk.status).toBe('unreadable');
  });
});
