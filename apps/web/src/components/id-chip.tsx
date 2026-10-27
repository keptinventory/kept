/**
 * A short ID (6 characters, split 3 + 3 with a non-breaking hyphen: 7KQ‑4MZ), always left to
 * right, even inside Arabic; its accessible name is the whole code.
 *
 * Two looks, one meaning each:
 * - `tape` (the default): Plex Mono on amber label tape, the same object as the label on the box.
 *   Amber means a printed label, so a list shows the tape only on what has one (`LabelTape`), and
 *   a scanned or claimed label is always the tape.
 * - `quiet`: small neutral mono, for a code with no printed label yet, on its own page or in a
 *   list of labels about to print.
 *
 * The tape runs out like printed tape once (only under `prefers-reduced-motion: no-preference`)
 * when it turns from quiet to tape on screen, on its next appearance after "Printed OK?" or a
 * claim (labels/just-printed.ts), or when the parent says it is `fresh`. A code that merely
 * arrives (an offline capture synced) doesn't print: no label was printed.
 *
 * `pending`: a thing captured offline has no code until it syncs. With `code` null and `pending`,
 * the chip is a dashed outline reading "ID pending", announced as "ID pending".
 */
import { printedCode } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { forgetJustPrinted, isJustPrinted } from '@/components/labels/just-printed';
import { cn } from '@/lib/utils';

// "7KQ4MZ" → "7KQ‑4MZ": the shared helper, so the chip and the printed inventory never drift.
export { printedCode };

function motionAllowed(): boolean {
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export type IdChipVariant = 'tape' | 'quiet';

export function IdChip({
  code,
  variant = 'tape',
  fresh = false,
  size = 'default',
  pending = false,
  className,
}: {
  code: string | null;
  /** `tape`: a printed label; `quiet`: a code with no printed label. */
  variant?: IdChipVariant;
  /** No code yet because the thing hasn't synced: show "ID pending" instead of nothing. */
  pending?: boolean;
  /** Print the tape on mount (the components gallery). */
  fresh?: boolean;
  size?: 'default' | 'large';
  className?: string;
}) {
  const tape = variant === 'tape';
  const wasTape = useRef(tape);
  const [printing, setPrinting] = useState(
    () => tape && code !== null && (fresh || isJustPrinted(code)) && motionAllowed(),
  );
  useEffect(() => {
    if (tape && code !== null && isJustPrinted(code)) forgetJustPrinted(code);
  }, [tape, code]);
  useEffect(() => {
    if (tape && !wasTape.current && code !== null && motionAllowed()) setPrinting(true);
    wasTape.current = tape;
  }, [tape, code]);

  if (code === null) return pending ? <PendingChip size={size} className={className} /> : null;
  return (
    <bdi
      dir="ltr"
      role="img"
      aria-label={code}
      data-variant={variant}
      data-printing={tape && printing ? 'true' : undefined}
      onAnimationEnd={() => setPrinting(false)}
      className={cn(
        tape
          ? 'inline-flex w-fit shrink-0 items-center rounded-[3px] bg-[#F0B03A] font-mono font-semibold text-[#2E2100] tracking-[0.08em] whitespace-nowrap shadow-[inset_0_-1px_0_rgba(0,0,0,.12)]'
          : 'inline-flex w-fit shrink-0 items-center font-mono text-ink-2 tracking-[0.04em] whitespace-nowrap',
        tape
          ? size === 'large'
            ? 'px-2.5 pt-[7px] pb-1.5 text-[13px] leading-none'
            : 'px-1.5 pt-1 pb-[3px] text-[11.5px] leading-none'
          : size === 'large'
            ? 'text-[13px] leading-none'
            : 'text-[12px] leading-none',
        tape &&
          printing &&
          'motion-safe:animate-[kept-tape-print_520ms_cubic-bezier(.2,.7,.2,1)_both]',
        className,
      )}
    >
      <span aria-hidden="true">{printedCode(code)}</span>
    </bdi>
  );
}

/**
 * A thing's code in a list, a search result or the palette: the amber tape when it has a printed
 * label, nothing when it hasn't (its name is enough), and "ID pending" for a thing that has no code
 * yet when `pending`.
 */
export function LabelTape({
  code,
  printed,
  pending = false,
  size,
  className,
}: {
  code: string | null;
  printed: boolean | undefined;
  pending?: boolean;
  size?: 'default' | 'large';
  className?: string;
}) {
  if (code === null)
    return pending ? (
      <IdChip
        code={null}
        pending
        {...(size ? { size } : {})}
        {...(className ? { className } : {})}
      />
    ) : null;
  if (!printed) return null;
  return <IdChip code={code} {...(size ? { size } : {})} {...(className ? { className } : {})} />;
}

/** The "ID pending" chip: same size as the tape, dashed, no amber. */
function PendingChip({
  size,
  className,
}: {
  size: 'default' | 'large';
  className?: string | undefined;
}) {
  const { t } = useLingui();
  const label = t`ID pending`;
  return (
    <span
      role="img"
      aria-label={label}
      data-pending="true"
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-[3px] border border-dashed border-ink-3 font-medium text-ink-2 whitespace-nowrap',
        size === 'large'
          ? 'px-2.5 pt-[6px] pb-[5px] text-[13px] leading-none'
          : 'px-1.5 pt-[3px] pb-[2px] text-[11.5px] leading-none',
        className,
      )}
    >
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
