/**
 * The visual viewport (#130): the part of the page a person can see. On a phone it ends at the
 * top of the on-screen keyboard and the browser's form bar (iOS's ▲ ▼ ✓) while the layout
 * viewport, which `fixed` positions follow, still runs under them; a bottom sheet sized to the
 * window puts its last rows behind the keyboard. A sheet that reads this box stays above it.
 *
 * Every modal overlay follows it (#487: Android Chrome's default `resizes-visual` keyboard covered
 * "Type the code"). The overlay is given the box's own top and height, never "the window less the
 * keyboard", so it can't correct twice: where a browser shrinks the layout viewport itself, the
 * box is simply that viewport.
 */
import { type CSSProperties, useEffect, useState } from 'react';

export type VisibleBox = { top: number; height: number };

/** The visible box now, or null: no visualViewport, or the page is pinch-zoomed (the box is then
 * a small window into the page, not the space a sheet has). */
export function visibleBox(): VisibleBox | null {
  const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!vv || vv.scale > 1.01) return null;
  return { top: Math.round(vv.offsetTop), height: Math.round(vv.height) };
}

/**
 * A `fixed inset-0` overlay placed over the visible box: its top and height, and `--sheet-vh` (the
 * box's height) for what is inside to size against. None without a box: the overlay keeps
 * covering the window.
 */
export function overlayOnBox(box: VisibleBox | null): CSSProperties | undefined {
  return box
    ? ({
        top: box.top,
        height: box.height,
        bottom: 'auto',
        '--sheet-vh': `${box.height}px`,
      } as CSSProperties)
    : undefined;
}

/** A modal overlay's style while it is open: over the visible box, kept current. */
export function useOverlayOnVisibleBox(isOpen: boolean): CSSProperties | undefined {
  return overlayOnBox(useVisibleBox(isOpen));
}

/** The visible box, kept current while `enabled` (resizes and scrolls of the visual viewport). */
export function useVisibleBox(enabled = true): VisibleBox | null {
  const [box, setBox] = useState<VisibleBox | null>(() => (enabled ? visibleBox() : null));
  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) {
      setBox(null);
      return;
    }
    const update = () =>
      setBox((prev) => {
        const next = visibleBox();
        return prev && next && prev.top === next.top && prev.height === next.height ? prev : next;
      });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return box;
}
