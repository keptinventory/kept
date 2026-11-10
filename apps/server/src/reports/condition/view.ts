import type { ConditionReportKind } from '@kept/shared';
import type { ReportLocale } from '../labels.js';
import { dirOf, intlLocaleOf, numberingOf, sepOf } from '../locale.js';
import { type ConditionWords, PDF_WORDS } from '../words/index.js';
import type { ConditionReportOptions, GatheredCondition, GatheredRoom } from './gather.js';

// A condition report's data as template/condition.typ reads it (`/data.json`; 1.x, D235). As for
// the other reports, every string is final here: dates and times are formatted with Intl in the
// report's language and digits (D143), so the template only lays them out. The words live in
// words/<locale>.ts, one table per report language (#465). A photo's time is when
// Kept received it, in the location's time zone; the walk-through's day is the location's.

export type ConditionView = {
  lang: ReportLocale;
  dir: 'ltr' | 'rtl';
  digits: 'latn' | 'arab';
  sep: string;
  labels: Pick<
    ConditionWords,
    | 'title'
    | 'rooms'
    | 'photos'
    | 'notes'
    | 'page'
    | 'of'
    | 'contents'
    | 'confidential'
    | 'empty'
    | 'notInReport'
    | 'photoNote'
  >;
  location: string;
  generatedLine: string;
  footer: string;
  compare: boolean;
  sides: {
    title: string;
    started: string;
    status: string;
    draft: boolean;
    notes: string;
    counts: [string, string][];
  }[];
  rooms: {
    name: string;
    sides: {
      heading: string;
      missing: boolean;
      condition: string;
      /** The condition's key, for its colour; '' when not recorded. */
      tone: string;
      note: string;
      photos: { path: string; caption: string }[];
      more: string;
    }[];
  }[];
};

export type ConditionViewContext = {
  /** KEPT_PUBLIC_URL's host, for the footer. */
  instance: string;
  now: Date;
  /** Which photos (attachment ids) were written to the job directory. */
  withPhoto: ReadonlySet<string>;
};

function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Builds the template's data from what gatherCondition() read. */
export function buildConditionView(
  g: GatheredCondition,
  options: ConditionReportOptions,
  ctx: ConditionViewContext,
): ConditionView {
  const w = PDF_WORDS[options.locale].condition;
  const sep = sepOf(options.locale);
  const intl = intlLocaleOf(options.locale);
  const numberingSystem = numberingOf(options.locale, options.digits);
  const nf = new Intl.NumberFormat(intl, { numberingSystem });
  const dateF = new Intl.DateTimeFormat(intl, {
    dateStyle: 'medium',
    timeZone: 'UTC',
    numberingSystem,
  });
  const day = (d: string) => dateF.format(new Date(`${d}T00:00:00Z`));
  const at = new Intl.DateTimeFormat(intl, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: safeTimeZone(g.locationTimezone),
    numberingSystem,
  });
  const when = new Intl.DateTimeFormat(intl, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: safeTimeZone(g.requesterTimezone),
    numberingSystem,
  }).format(ctx.now);
  const compare = g.sides.length > 1;

  const titleOf = (s: { kind: ConditionReportKind; heldOn: string }) =>
    `${w.kinds[s.kind]}${sep}${day(s.heldOn)}`;
  const sideOf = (
    room: GatheredRoom | null,
    side: { kind: ConditionReportKind; heldOn: string },
  ) => {
    const heading = compare ? titleOf(side) : '';
    if (!room) {
      return { heading, missing: true, condition: '', tone: '', note: '', photos: [], more: '' };
    }
    const printed = room.photos.filter((p) => ctx.withPhoto.has(p.id));
    const more = room.morePhotos + (room.photos.length - printed.length);
    return {
      heading,
      missing: false,
      condition: room.condition ? w.conditions[room.condition] : w.notRecorded,
      tone: room.condition ?? '',
      note: room.note ?? '',
      photos: printed.map((p) => ({
        path: `/thumbs/${p.id}.jpg`,
        caption: [at.format(p.addedAt), p.by ?? ''].filter((x) => x !== '').join(sep),
      })),
      more: more > 0 ? w.more(nf.format(more)) : '',
    };
  };

  const [first, second] = g.sides;
  return {
    lang: options.locale,
    dir: dirOf(options.locale),
    digits: numberingSystem,
    sep,
    labels: {
      title: w.title,
      rooms: w.rooms,
      photos: w.photos,
      notes: w.notes,
      page: w.page,
      of: w.of,
      contents: w.contents,
      confidential: w.confidential,
      empty: w.empty,
      notInReport: w.notInReport,
      photoNote: w.photoNote,
    },
    location: g.locationName,
    generatedLine: w.generated(g.requesterName, when),
    footer: ['Kept', ctx.instance, when].filter((x) => x !== '').join(sep),
    compare,
    sides: g.sides.map((s) => ({
      title: titleOf(s),
      started: s.createdBy ? w.started(s.createdBy) : '',
      status: s.finishedAt ? w.finished(s.finishedBy ?? '', at.format(s.finishedAt)) : w.draft,
      draft: !s.finishedAt,
      notes: s.notes ?? '',
      counts: [
        [nf.format(s.rooms.length), w.rooms],
        [nf.format(s.rooms.reduce((n, r) => n + r.photos.length + r.morePhotos, 0)), w.photos],
      ],
    })),
    rooms: g.pairs.map((p) => {
      const names = [p.a?.name, p.b?.name].filter((n): n is string => !!n);
      const name =
        names[0] === names[1] || names.length === 1 ? (names[0] ?? '') : names.join(' / ');
      return {
        name,
        sides: [...(first ? [sideOf(p.a, first)] : []), ...(second ? [sideOf(p.b, second)] : [])],
      };
    }),
  };
}
