/**
 * #161: on a short window (1280×576) or a phone, the map card's details are taller than the room
 * the card has, so they scroll inside it; its Open link stays pinned to the card's bottom edge
 * until its own place scrolls into view, so it can always be reached. A browser holds the
 * measured part (the shots in the PR); this holds the rules that make it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read from disk: vitest hands CSS imports back empty, even with ?raw.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const css = read('./map.css').replace(/\/\*[\s\S]*?\*\//g, '');
const card = read('./card.tsx');
const demo = read('../../../docs/src/components/try-map/demo.ts');

/** The declarations of the first rule whose selector is exactly `sel`, after `from`. */
function rule(sel: string, from = 0): string {
  const at = css.indexOf(`${sel} {`, from);
  if (at < 0) throw new Error(`no rule ${sel}`);
  return css.slice(at, css.indexOf('}', at));
}

describe('the map card on a short screen', () => {
  it('scrolls its details inside the card, at every width', () => {
    const wide = css.indexOf('@media (min-width: 900px)');
    const narrow = css.indexOf('@media (max-width: 899px)');
    expect(rule('.kmap-panel', wide)).toMatch(/overflow: auto/);
    expect(rule('.kmap-panel', wide)).toMatch(/max-height: calc\(100% - \d+px\)/);
    expect(rule('.kmap-panel', narrow)).toMatch(/overflow: auto/);
    expect(rule('.kmap-panel', narrow)).toMatch(/max-height: \d+%/);
  });

  it('pins the Open row to the bottom of the card, on an opaque strip', () => {
    const open = rule('.kmap-panel > .kmap-open');
    expect(open).toMatch(/position: sticky/);
    expect(open).toMatch(/bottom: /);
    expect(open).toMatch(/background: var\(--surface\)/);
    expect(open).toMatch(/z-index: 1/);
  });

  it('puts every Open link of the app’s card and of Try the map in that row', () => {
    const rows = (src: string) => src.match(/kmap-row kmap-open/g)?.length ?? 0;
    expect(card.match(/<OpenLink /g)?.length).toBe(rows(card));
    expect(rows(card)).toBe(2);
    // Try the map's card has the install link where the app has Open.
    expect(rows(demo)).toBe(2);
  });
});
