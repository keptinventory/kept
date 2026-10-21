/**
 * What a label batch holds, in a line a person can tell batches apart by: "16 labels: 4K webcam,
 * Ergonomic wireless mouse, Flip 5 speaker and 13 more", or "24 blank labels". The names are
 * isolated (lib/bidi.ts), listed the language's way (Intl.ListFormat), and never shortened.
 */
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import type { LabelBatch } from '@/api/capture/types';
import { isolate } from '@/lib/bidi';
import { usePrefs } from '@/lib/prefs';

/** How many names the line spells out before "and N more". */
const SHOWN = 3;

export function useBatchSummary(): (b: Pick<LabelBatch, 'kind' | 'labels'>) => string {
  const { t } = useLingui();
  const { locale } = usePrefs();
  return (b) => {
    const n = b.labels.length;
    if (b.kind === 'blank') return plural(n, { one: '# blank label', other: '# blank labels' });
    const count = plural(n, { one: '# label', other: '# labels' });
    const names = b.labels.flatMap((l) => (l.name ? [l.name] : [])).slice(0, SHOWN);
    if (names.length === 0) return count;
    const more = n - names.length;
    const parts = [
      ...names.map(isolate),
      ...(more > 0 ? [plural(more, { one: '# more', other: '# more' })] : []),
    ];
    const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts);
    return t`${count}: ${list}`;
  };
}
