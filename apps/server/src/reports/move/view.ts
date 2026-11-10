import type { ReportLocale } from '../labels.js';
import { dirOf, intlLocaleOf, numberingOf, sepOf } from '../locale.js';
import { PDF_WORDS } from '../words/index.js';
import type { GatheredMove, MoveReportOptions } from './gather.js';

// A move's contents sheets as template/move.typ reads them (`/data.json`; 1.x, D251). As for the
// other reports, every string is final here, in the sheet's language and digits (D143), so the
// template only lays them out. A box's QR code is its label's (`/l/<short ID>`): scanning the
// sheet taped to the box opens it in Kept, where it is unpacked. The words live in
// words/<locale>.ts, one table per report language (#465).

export type MoveView = {
  lang: ReportLocale;
  /** Between a line's parts: a comma, the Arabic comma in Arabic; never the middle dot (#459). */
  sep: string;
  dir: 'ltr' | 'rtl';
  title: string;
  move: string;
  route: string;
  generatedLine: string;
  footer: string;
  none: string;
  labels: { goesTo: string; quantity: string; id: string; scan: string };
  boxes: {
    heading: string;
    name: string;
    state: string;
    room: string;
    hasRoom: boolean;
    contentsTitle: string;
    empty: string;
    qr: string;
    code: string;
    lines: { name: string; quantity: string; id: string; note: string }[];
    more: string;
  }[];
};

export type MoveViewContext = {
  /** KEPT_PUBLIC_URL's host, for the footer. */
  instance: string;
  now: Date;
  /** Which boxes' QR codes were written to the job directory (by container id). */
  withQr: ReadonlySet<string>;
};

function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Builds the template's data from what gatherMove() read. */
export function buildMoveView(
  g: GatheredMove,
  options: MoveReportOptions,
  ctx: MoveViewContext,
): MoveView {
  const w = PDF_WORDS[options.locale].move;
  const sep = sepOf(options.locale);
  const intl = intlLocaleOf(options.locale);
  const numberingSystem = numberingOf(options.locale, options.digits);
  const nf = new Intl.NumberFormat(intl, { numberingSystem, maximumFractionDigits: 3 });
  const when = new Intl.DateTimeFormat(intl, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: safeTimeZone(g.requesterTimezone),
    numberingSystem,
  }).format(ctx.now);
  return {
    lang: options.locale,
    sep,
    dir: dirOf(options.locale),
    title: w.title,
    move: g.name,
    route: g.toLocationName ? w.route(g.locationName, g.toLocationName) : g.locationName,
    generatedLine: w.generated(g.requesterName, when),
    footer: ['Kept', ctx.instance, when].filter((x) => x !== '').join(sep),
    none: w.none,
    labels: { goesTo: w.goesTo, quantity: w.quantity, id: w.id, scan: w.scan },
    boxes: g.boxes.map((b) => ({
      heading: w.box(nf.format(b.number)),
      name: b.name,
      state: w.states[b.state],
      room: b.room ?? w.noRoom,
      hasRoom: b.room !== null,
      contentsTitle: w.contents(nf.format(b.lines.length + b.moreLines)),
      empty: w.empty,
      qr: ctx.withQr.has(b.containerId) ? `/qr/${b.containerId}.svg` : '',
      code: b.shortCode ?? '',
      lines: b.lines.map((l) => ({
        name: l.name,
        quantity: nf.format(Number(l.quantity)),
        id: l.shortCode ?? '',
        note: l.inside !== null ? w.holds(nf.format(l.inside)) : '',
      })),
      more: b.moreLines > 0 ? w.more(nf.format(b.moreLines)) : '',
    })),
  };
}
