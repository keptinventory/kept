/**
 * What the 2D and the 3D graph share (#207): the canvas's size, its gestures (drag, wheel, pinch:
 * a drag that starts on a node or a control is a press, not a drag), the nodes' glyphs, and the
 * control icons, as the map draws them.
 */
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { BoxIcon, HomeIcon, PinIcon } from '@/components/icons';
import type { GNode } from './tree';

export function useSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export type Gestures = {
  /** A drag on the empty canvas, in px since the last move. */
  onDrag: (dx: number, dy: number) => void;
  /** Zoom by `factor` around the canvas point (x, y). */
  onZoom: (factor: number, x: number, y: number) => void;
  /** Any touch, click or wheel on the canvas (the 3D stops turning by itself). */
  onInteract?: () => void;
};

const passThrough = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('button, a, input, .kgraph-card, .kgraph-ctl');

/** Pointer handlers for the canvas, and whether a drag is under way. */
export function useGestures(
  ref: RefObject<HTMLElement | null>,
  g: Gestures,
): {
  dragging: boolean;
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
  };
} {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(g);
  latest.current = g;

  // Wheel needs a non-passive listener to keep the page from scrolling under the graph.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (passThrough(e.target) && !(e.target as Element).closest('.kgraph-layer')) return;
      e.preventDefault();
      latest.current.onInteract?.();
      const r = el.getBoundingClientRect();
      latest.current.onZoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);

  const at = (e: ReactPointerEvent) => {
    const r = (ref.current as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const end = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };
  return {
    dragging,
    handlers: {
      onPointerDown: (e) => {
        latest.current.onInteract?.();
        if (passThrough(e.target)) return;
        pointers.current.set(e.pointerId, at(e));
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        setDragging(true);
      },
      onPointerMove: (e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        const now = at(e);
        pointers.current.set(e.pointerId, now);
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()] as [
            { x: number; y: number },
            { x: number; y: number },
          ];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch.current)
            latest.current.onZoom(d / pinch.current, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinch.current = d;
          return;
        }
        latest.current.onDrag(now.x - prev.x, now.y - prev.y);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}

/** Whether the person asked for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** A door: a room. */
function DoorGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 20V4h12v16M4 20h16" />
      <path d="M14.5 12h.01" />
    </svg>
  );
}

/** What a node shows inside it: the location's house, a floor's short name, a room's door, a
 * spot's pin, a box's box. Things are dots (CSS). */
export function Glyph({
  node,
  short,
  small = false,
}: {
  node: GNode;
  short: string;
  small?: boolean;
}) {
  if (small) return null;
  if (node.kind === 'location') return <HomeIcon />;
  if (node.kind === 'floor') return <span>{short}</span>;
  if (node.kind === 'room') return <DoorGlyph />;
  if (node.kind === 'spot') return <PinIcon />;
  if (node.kind === 'box') return <BoxIcon />;
  return null;
}

const ctl = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const HouseCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="M4 11l8-7 8 7v9H4z" />
  </svg>
);
export const TurnLeftCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
  </svg>
);
export const TurnRightCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v4h-4" />
  </svg>
);
export const UpCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
export const DownCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const PlayCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const PauseCtl = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...ctl}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);
