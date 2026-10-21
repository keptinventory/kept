/**
 * A count as CSV (#172), made on the page from its result (so it works offline once loaded, and
 * in Try Kept): thing, short ID, where it was expected, the result, how many were found of how
 * many, and where it is now. The same columns as `GET /api/v1/scan-sessions/:id/result.csv`.
 */
import type { CountResult } from '@/api/counts/types';

const cell = (v: string | null | undefined) => {
  const s = v ?? '';
  // A cell a spreadsheet would run as a formula starts with a quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function countCsv(r: CountResult): string {
  const head = ['thing', 'short_id', 'where_expected', 'result', 'found', 'of', 'where_now'];
  const rows = r.lines.map((l) =>
    [
      l.thing.name,
      l.thing.shortCode,
      l.was?.name,
      l.thing.trashed && l.result !== 'trashed' ? `${l.result} (trashed)` : l.result,
      l.foundQty,
      l.expectedQty,
      l.now?.name,
    ]
      .map(cell)
      .join(','),
  );
  return `﻿${[head.join(','), ...rows].join('\r\n')}\r\n`;
}

export const csvName = (r: CountResult) =>
  `kept-count-${(r.session.finishedAt ?? r.session.startedAt).slice(0, 10)}.csv`;
