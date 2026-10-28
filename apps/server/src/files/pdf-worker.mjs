// The PDF text reader's child process (D77, D157). A PDF
// is a hostile file until proven otherwise, so its parse runs here, in a process of its own that
// the parent (pdf-text.ts) kills past 20 s of wall-clock time or 256 MB of resident memory; it
// starts this file with `--max-old-space-size=256` and an empty environment. Plain JavaScript on
// purpose, as the report's child.mjs is: it is started as it is, from src/ in tests and from
// dist/ in the image (reports/render/build-assets.ts copies it), with no loader.
//
//   node --max-old-space-size=256 pdf-worker.mjs <file.pdf> <maxChars>
//   node --max-old-space-size=384 pdf-worker.mjs --render <file.pdf> <out.png> <longSide> <maxChars>
//
// Render mode (1.14.3, D266: a floor plan sent as a PDF) draws the first page only, its long
// side at `longSide` pixels, with unpdf's renderPageAsImage on @napi-rs/canvas (MIT; prebuilt
// native binaries for amd64 and arm64), writes the PNG to `out.png` and reads that page's text.
// The parent gives it a higher memory limit than text mode (pdf-text.ts PDF_RENDER_MEMORY_MB):
// drawing a page holds its raster and decoded images. Nothing else is rendered or kept.
//
// The parser is unpdf's build of PDF.js (unpdf MIT, PDF.js Apache-2.0): pure JavaScript, no
// native code, no eval, the same on amd64 and arm64. Pages are read in order and the reading
// stops once `maxChars` characters are in hand, so a long document costs no more than its first
// pages. In text mode only text is read: no images are decoded, no fonts are loaded from the
// system, and nothing is rendered; render mode (below) is the only one that draws.
//
// Exit codes, with one JSON line on stdout for 0:
//   0  {"pages", "read", "text", "truncated"}: `text` is what the pages said, maybe empty (a scan);
//      in render mode {"pages", "width", "height", "text"}
//   2  usage
//   3  the file isn't a PDF PDF.js can read (stderr: the parser's message, never the text)
//   4  the PDF is encrypted with a password
//   5  render mode: the page could not be drawn (stderr: the reason)
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocumentProxy, renderPageAsImage } from 'unpdf';

/** PDF.js's own exception names (PasswordException, InvalidPDFException…). */
const nameOf = (e) => (e && typeof e === 'object' && 'name' in e ? String(e.name) : '');

/** The document, or an exit code (3 unreadable, 4 encrypted). */
async function open(file) {
  try {
    return await getDocumentProxy(new Uint8Array(readFileSync(file)), {
      useSystemFonts: false,
      disableFontFace: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      enableXfa: false,
      stopAtErrors: false,
      verbosity: 0,
    });
  } catch (e) {
    if (nameOf(e) === 'PasswordException') return 4;
    process.stderr.write(`${nameOf(e) || 'Error'}: ${String(e?.message ?? e).slice(0, 300)}\n`);
    return 3;
  }
}

/** A page's text, as the text mode reads it. */
async function pageText(page) {
  const content = await page.getTextContent();
  let text = '';
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    text += item.str;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text.replace(/[ \t]+\n/g, '\n').trim();
}

async function render(file, out, longSide, maxChars) {
  const doc = await open(file);
  if (typeof doc === 'number') return doc;
  const page = await doc.getPage(1);
  const at1 = page.getViewport({ scale: 1 });
  const scale = longSide / Math.max(at1.width, at1.height, 1);
  const text = (await pageText(page)).slice(0, maxChars);
  let png;
  try {
    png = await renderPageAsImage(doc, 1, { canvasImport: () => import('@napi-rs/canvas'), scale });
  } catch (e) {
    process.stderr.write(`render: ${String(e?.message ?? e).slice(0, 300)}\n`);
    return 5;
  }
  writeFileSync(out, Buffer.from(png));
  const pages = doc.numPages;
  await doc.loadingTask.destroy();
  process.stdout.write(
    `${JSON.stringify({
      pages,
      width: Math.round(at1.width * scale),
      height: Math.round(at1.height * scale),
      text,
    })}\n`,
  );
  return 0;
}

async function main(file, maxChars) {
  const doc = await open(file);
  if (typeof doc === 'number') return doc;

  const parts = [];
  let length = 0;
  let read = 0;
  for (let n = 1; n <= doc.numPages && length < maxChars; n++) {
    const page = await doc.getPage(n);
    const text = await pageText(page);
    page.cleanup();
    read = n;
    if (text === '') continue;
    parts.push(text);
    length += text.length + 2;
  }
  const pages = doc.numPages;
  await doc.loadingTask.destroy();

  const all = parts.join('\n\n');
  process.stdout.write(
    `${JSON.stringify({
      pages,
      read,
      text: all.slice(0, maxChars),
      truncated: all.length > maxChars || read < pages,
    })}\n`,
  );
  return 0;
}

const args = process.argv.slice(2);
if (args[0] === '--render') {
  const [, file, out, longArg, maxArg] = args;
  const longSide = Number(longArg);
  const maxChars = Number(maxArg);
  if (
    !file ||
    !out ||
    !Number.isInteger(longSide) ||
    longSide < 16 ||
    !Number.isInteger(maxChars)
  ) {
    process.stderr.write(
      'usage: pdf-worker.mjs --render <file.pdf> <out.png> <longSide> <maxChars>\n',
    );
    process.exitCode = 2;
  } else {
    process.exitCode = await render(file, out, longSide, maxChars);
  }
} else {
  const [file, maxArg] = args;
  const maxChars = Number(maxArg);
  if (!file || !Number.isInteger(maxChars) || maxChars < 1) {
    process.stderr.write('usage: pdf-worker.mjs <file.pdf> <maxChars>\n');
    process.exitCode = 2;
  } else {
    // Set, not exit(): a pipe to the parent may still be flushing what was written.
    process.exitCode = await main(file, maxChars);
  }
}
