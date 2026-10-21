/**
 * The start cell on a partly used sheet (D175), which is also the sheet preview: the printed
 * page itself, smaller. The page is laid out in millimetres exactly as the print view lays it out
 * (the same cells from `cellsFor`, the same `LabelCell` with its real QR, code, name and place,
 * wrapped and sized the same way) and scaled down as a whole to the preview's width, so every
 * line breaks where it will on paper. The cells before the start are hatched as used, the start
 * is outlined, and the die cuts are drawn dashed over the paper. A blank sheet has no codes until
 * the batch is made, so its cells show a sample label of the same layout.
 *
 * Every cell is a radio, so a tap or the arrow keys choose where printing starts. The paper runs
 * left to right in every language, like the maker's numbering ("row 4, column 1"); only the words
 * around it follow the page.
 */
import { cellsFor, type LabelStock } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import type { LabelCellContent } from '@/api/capture/types';
import { isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TextMeasure } from './fit';
import { LabelCell } from './label-cell';
import { mm, PX_PER_MM, pagesFor, perPage, rowColOf } from './layout';
import type { Encode } from './qr';

/** A blank label's stand-in before the batch gives it a code: the same layout, a sample code. */
export function blankSample(): LabelCellContent {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return { code: '000000', url: `${origin}/l/000000`, kind: 'blank' };
}

/** The preview's widest, in CSS pixels. */
const MAX_WIDTH = 380;

/** The width an element is laid out at, kept current; `fallback` until it is measured. */
function useWidth(el: HTMLElement | null, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    update();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [el]);
  return width;
}

export function StartCellPicker({
  stock,
  value,
  onChange,
  labels,
  count,
  encode,
  measure,
}: {
  stock: LabelStock;
  value: number;
  onChange: (cell: number) => void;
  /** The labels to print; a blank sheet has none until the batch is made. */
  labels: readonly LabelCellContent[];
  /** How many labels print (a blank sheet has no `labels` yet). */
  count: number;
  encode: Encode | null;
  measure: TextMeasure;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = useWidth(box, MAX_WIDTH);
  // The paper's border is outside the scaled page.
  const scale = Math.max(0, width - 2) / (stock.page.w * PX_PER_MM);
  const cells = cellsFor(stock, perPage(stock)).cells;
  const used = value - 1;
  const { row, col } = rowColOf(stock, value);
  const pages = pagesFor(stock, count, value);
  const start = fmt.num(value);
  const r = fmt.num(row);
  const c = fmt.num(col);
  const n = fmt.num(pages);
  const usedN = fmt.num(used);
  const compact = stock.content === 'compact';
  const blank = labels.length === 0 && count > 0;
  const sample = blankSample();
  return (
    <RadioGroup
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      aria-label={t`Start at label`}
      className="grid gap-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="eyebrow">
          <Trans>Sheet preview</Trans>
        </span>
        {used > 0 ? (
          <span className="text-small text-ink-3">
            <Trans>{usedN} already used</Trans>
          </span>
        ) : null}
      </div>
      <p className="m-0 text-small text-ink">
        <Trans>
          Start at label {start} (row {r}, column {c}). Tap any cell to start there.
        </Trans>
      </p>
      <div
        ref={setBox}
        dir="ltr"
        data-slot="sheet-preview"
        className="relative w-full max-w-[380px] justify-self-center overflow-hidden border border-line bg-white shadow-[0_8px_24px_rgba(0,0,0,.1)]"
        style={{ aspectRatio: `${stock.page.w} / ${stock.page.h}` }}
      >
        <div
          data-slot="preview-paper"
          className="absolute start-0 top-0 bg-white"
          style={{
            inlineSize: mm(stock.page.w),
            blockSize: mm(stock.page.h),
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {cells.map((place) => {
            const cell = place.cell + 1;
            const index = cell - value;
            const printing = index >= 0 && index < count;
            const label = printing ? (labels[index] ?? (blank ? sample : undefined)) : undefined;
            const { row: rr, col: cc } = rowColOf(stock, cell);
            const at = fmt.num(cell);
            const rn = fmt.num(rr);
            const cn2 = fmt.num(cc);
            const cd = label && label.kind !== 'blank' ? label.code : '';
            const nm = isolate(label?.name ?? '');
            const name = !cd
              ? t`Label ${at}, row ${rn}, column ${cn2}`
              : nm && !compact
                ? t`Label ${at}, row ${rn}, column ${cn2}: ${nm}, ${cd}`
                : t`Label ${at}, row ${rn}, column ${cn2}: ${cd}`;
            return (
              <Radio
                key={cell}
                value={String(cell)}
                aria-label={name}
                data-slot="preview-cell"
                className="group absolute cursor-pointer outline-none"
                style={{
                  insetInlineStart: mm(place.x),
                  insetBlockStart: mm(place.y),
                  inlineSize: mm(stock.cell.w),
                  blockSize: mm(stock.cell.h),
                }}
              >
                {label ? (
                  <LabelCell label={label} stock={stock} encode={encode} measure={measure} />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 border-[3px] border-dashed border-[#CFCBC2] group-data-focus-visible:outline-[6px] group-data-focus-visible:outline-info group-data-focus-visible:outline-solid',
                    cell < value &&
                      'border-solid border-[#E2DFD7] bg-[repeating-linear-gradient(135deg,#EEECE6_0_12px,#F8F7F3_12px_24px)]',
                    cell === value && 'border-[7px] border-solid border-[#1C1B19]',
                  )}
                />
              </Radio>
            );
          })}
        </div>
      </div>
      <p className="m-0 text-small text-ink-2">
        {compact ? (
          <Trans>Each label: QR code and short ID</Trans>
        ) : blank ? (
          <Trans>Each label: QR code and short ID. The codes are made when you print.</Trans>
        ) : (
          <Trans>Each label: QR code, name, where it is and short ID</Trans>
        )}
      </p>
      {pages > 1 ? (
        <p className="m-0 text-small text-ink-2">
          <Trans>These labels take {n} sheets; the next ones start at label 1.</Trans>
        </p>
      ) : null}
    </RadioGroup>
  );
}
