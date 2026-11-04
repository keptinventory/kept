/**
 * The column beside a page (#427): its edge drags its width, and it folds to a rail with the main
 * navigation's control. Every `aside` today is the place tree (the location, place and thing pages
 * pass PlacesPanel), so it lives here once rather than in three pages, and its words say "places".
 *
 * The width and the fold are on the document's root (`--place-tree-width`, `data-place-tree`), as
 * the sidebar's are: the pre-paint script sets them, so the first frame is already right, and CSS
 * alone lays out the column. Nothing above this component renders when they change, which is what
 * keeps a selection, a typed search or an open sheet in the page (#336).
 *
 * The width in `PAGE_WITH_ASIDE` is the real limit: 40% of the area, however the sidebar, the
 * assistant or Full width change it. `limit` measures the same thing for the separator's value.
 */
import { useLingui } from '@lingui/react/macro';
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useMove } from 'react-aria/useMove';
import { useLocale } from 'react-aria-components';
import { PanelCollapseIcon, PanelExpandIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import {
  clampPlaceTreeWidth,
  PLACE_TREE_MAX,
  PLACE_TREE_MIN,
  setPlaceTreeCollapsed,
  setPlaceTreeWidth,
  showPlaceTreeWidth,
  usePrefs,
} from '@/lib/prefs';

/** Of the area beside the sidebar. Keep in step with the class below. */
const MOST_OF_AREA = 0.4;
/** One arrow key, and one with Shift held. */
const STEP = 16;
const BIG_STEP = 48;

/**
 * The grid around the column and the page. The track's limits are prefs.ts's; a drag sets no
 * transition (`data-resizing`), or the column would trail the pointer. A folded column is as wide
 * as its button.
 */
export const PAGE_WITH_ASIDE =
  'grid min-w-0 grid-cols-[max(208px,min(var(--place-tree-width,240px),40%))_minmax(0,1fr)] items-start gap-6 transition-[grid-template-columns] duration-200 ease-out tree-folded:grid-cols-[40px_minmax(0,1fr)] pointer-coarse:tree-folded:grid-cols-[44px_minmax(0,1fr)] motion-reduce:transition-none has-[[data-resizing]]:transition-none';

export function PageAside({ children }: { children: ReactNode }) {
  const { t } = useLingui();
  const { placeTreeCollapsed: collapsed, placeTreeWidth } = usePrefs();
  const { direction } = useLocale();
  const panelId = useId();
  const column = useRef<HTMLDivElement>(null);

  // What fits now: 40% of the area, measured as the area changes.
  const [limit, setLimit] = useState(PLACE_TREE_MAX);
  useLayoutEffect(() => {
    const area = column.current?.parentElement;
    if (!area) return;
    const measure = () => {
      const width = area.clientWidth;
      if (width > 0) setLimit(clampPlaceTreeWidth(width * MOST_OF_AREA));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // While the pointer is down the width lives here and on the root; it's kept when it lets go.
  const [dragged, setDragged] = useState<number | null>(null);
  const width = clampPlaceTreeWidth(dragged ?? placeTreeWidth, limit);
  /** Where the pointer asks for, past the bounds: coming back, the edge waits for it. */
  const wanted = useRef(width);
  const latest = useRef<number | null>(null);

  const show = (px: number) => {
    latest.current = px;
    setDragged(px);
    showPlaceTreeWidth(px);
  };
  const keep = () => {
    const px = latest.current;
    latest.current = null;
    setDragged(null);
    if (px !== null) setPlaceTreeWidth(px);
  };

  const { moveProps } = useMove({
    onMoveStart: () => {
      wanted.current = width;
    },
    onMove: ({ deltaX, pointerType, shiftKey }) => {
      if (deltaX === 0) return;
      const step = pointerType === 'keyboard' ? (shiftKey ? BIG_STEP : STEP) : 1;
      // The edge is at the tree's inline end: to the left in Arabic, where left is wider. The
      // arrows move it the way they point, as the pointer does.
      wanted.current += deltaX * step * (direction === 'rtl' ? -1 : 1);
      show(clampPlaceTreeWidth(wanted.current, limit));
    },
    onMoveEnd: keep,
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setPlaceTreeWidth(e.key === 'Home' ? PLACE_TREE_MIN : limit);
      return;
    }
    moveProps.onKeyDown?.(e);
  };

  const label = collapsed ? t`Expand places` : t`Collapse places`;
  return (
    // Not an <aside>: beside the sidebar's, a second complementary landmark fails axe's
    // landmark-unique; the panel's own <nav> names it. Stretched, so the edge runs the page's
    // whole height and can be grabbed wherever you are in it.
    <div ref={column} className="relative min-w-0 self-stretch">
      <div className="sticky top-20">
        {/* One button in both forms, in one place: folding moves nothing under the pointer, and
            focus stays on it. */}
        <Tip content={label}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-expanded={!collapsed}
            aria-controls={panelId}
            onPress={() => setPlaceTreeCollapsed(!collapsed)}
            className="absolute start-0 top-0.5 z-10 size-9 rounded-lg pointer-coarse:top-0 pointer-coarse:size-10 [&_svg]:size-[18px]"
          >
            {collapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
          </Button>
        </Tip>
        {/* Laid out at its final width while the column's width animates, so the rows don't
            rewrap, as the sidebar does. Kept mounted when folded: its folds and scroll stay. */}
        <div className="overflow-x-clip tree-folded:hidden">
          <div
            id={panelId}
            style={{ inlineSize: `${width}px` }}
            className="max-h-[calc(100dvh-6rem)] scroll-pt-11 overflow-y-auto"
          >
            {children}
          </div>
        </div>
      </div>
      {collapsed ? null : (
        // A separator with a value is a widget (WAI-ARIA window splitter), and <hr> can't hold focus.
        // Scroll margins as tall as the sticky top: focusing something taller than the window
        // would otherwise scroll the page to line up its top.
        // biome-ignore lint/a11y/useSemanticElements: see above
        <div
          {...moveProps}
          onKeyDown={onKeyDown}
          role="separator"
          tabIndex={0}
          aria-label={t`Resize places`}
          aria-orientation="vertical"
          aria-controls={panelId}
          aria-valuemin={PLACE_TREE_MIN}
          aria-valuemax={limit}
          aria-valuenow={width}
          data-place-tree-edge=""
          data-resizing={dragged === null ? undefined : ''}
          className="group absolute inset-y-0 -end-6 w-6 scroll-my-24 cursor-col-resize touch-none outline-none"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 start-1/2 w-px -translate-x-1/2 bg-line group-hover:w-0.5 group-hover:bg-info group-focus-visible:w-0.5 group-focus-visible:bg-info group-data-[resizing]:w-0.5 group-data-[resizing]:bg-info rtl:translate-x-1/2"
          />
        </div>
      )}
    </div>
  );
}
