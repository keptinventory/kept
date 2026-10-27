/**
 * Which of the graph's labels show (#207): nothing is cut off with … or written over another
 * label. The most important go first (the focus, the picked node, the nearer ring); a label that
 * would overlap one already placed, or not fit inside the canvas, waits: its node's accessible
 * name, the card's list and the text list still say it. Pure; sizes are estimated from the text,
 * so it runs before anything is drawn.
 */

export type LabelBox = {
  id: string;
  /** The label's top-left corner on the canvas. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lower goes first. */
  priority: number;
};

/** The widest a label grows before it wraps (the CSS max-width). */
export const LABEL_MAX = 150;

/** About how big `text` draws at `size` px: Plex Sans averages a little over half an em. */
export function labelSize(text: string, size: number): { w: number; h: number } {
  const one = [...text].length * size * 0.56 + 16;
  const lines = Math.max(1, Math.ceil(one / LABEL_MAX));
  return { w: Math.min(LABEL_MAX, one), h: lines * Math.round(size * 1.3) + 6 };
}

export function declutter(
  boxes: readonly LabelBox[],
  bounds: { w: number; h: number },
  gap = 2,
): Set<string> {
  const shown = new Set<string>();
  const kept: LabelBox[] = [];
  const order = [...boxes].sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1));
  for (const b of order) {
    if (b.x < 0 || b.y < 0 || b.x + b.w > bounds.w || b.y + b.h > bounds.h) continue;
    const hit = kept.some(
      (k) =>
        b.x < k.x + k.w + gap &&
        k.x < b.x + b.w + gap &&
        b.y < k.y + k.h + gap &&
        k.y < b.y + b.h + gap,
    );
    if (hit) continue;
    kept.push(b);
    shown.add(b.id);
  }
  return shown;
}
