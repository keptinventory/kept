/**
 * Tags' colours and limits. A tag's colour is one of a fixed palette that reads in light and dark
 * (never a free hex picker); the server accepts a palette colour or none. A colour stored before the
 * palette (a Homebox import) is shown, and counted, as its nearest palette colour.
 */

/** The palette's keys, in the order new tags take them. */
export const TAG_COLOUR_KEYS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'brown',
  'grey',
] as const;
export type TagColourKey = (typeof TAG_COLOUR_KEYS)[number];

/** Each palette colour as the hex a tag stores (upper case). */
export const TAG_COLOURS: Readonly<Record<TagColourKey, string>> = Object.freeze({
  red: '#E5484D',
  orange: '#F76B15',
  amber: '#FFB224',
  green: '#30A46C',
  teal: '#12A594',
  cyan: '#00A2C7',
  blue: '#0090FF',
  indigo: '#3E63DD',
  violet: '#8E4EC6',
  pink: '#D6409F',
  brown: '#AD7F58',
  grey: '#8D8D8D',
});

export const TAG_LIMITS = Object.freeze({
  /** Tags on one thing. */
  perThing: 50,
  /** Tags in one account. */
  perAccount: 1000,
  /** Things one bulk add or remove changes. */
  bulkThings: 200,
});

const HEX = /^#[0-9A-Fa-f]{6}$/;
const BY_HEX = new Map(TAG_COLOUR_KEYS.map((k) => [TAG_COLOURS[k], k] as const));

/** The palette key of a hex, in any case, or null when it isn't one of the palette. */
export function tagColourKey(hex: string | null | undefined): TagColourKey | null {
  if (!hex || !HEX.test(hex)) return null;
  return BY_HEX.get(hex.toUpperCase()) ?? null;
}

/** Whether a hex is one of the palette's colours (in any case). */
export const isTagColour = (hex: string | null | undefined): boolean => tagColourKey(hex) !== null;

/** sRGB hex to OKLab, so "nearest" is what a person would call nearest. */
function oklab(hex: string): [number, number, number] {
  const lin = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(1);
  const g = lin(3);
  const b = lin(5);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const PALETTE_LAB = TAG_COLOUR_KEYS.map((k) => [TAG_COLOURS[k], oklab(TAG_COLOURS[k])] as const);

/** The palette colour closest to `hex`, or null when `hex` isn't a `#RRGGBB` colour. */
export function nearestTagColour(hex: string | null | undefined): string | null {
  if (!hex || !HEX.test(hex)) return null;
  const exact = tagColourKey(hex);
  if (exact) return TAG_COLOURS[exact];
  const [l, a, b] = oklab(hex);
  let best = TAG_COLOURS.grey;
  let bestD = Number.POSITIVE_INFINITY;
  for (const [h, [pl, pa, pb]] of PALETTE_LAB) {
    const d = (l - pl) ** 2 + (a - pa) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/**
 * The colour a new tag gets: the palette colour the account's tags use least, ties in palette
 * order. `used` is every tag's stored colour; none counts for nothing, an older free colour as its
 * nearest.
 */
export function nextTagColour(used: readonly (string | null | undefined)[]): string {
  const counts = new Map<string, number>(TAG_COLOUR_KEYS.map((k) => [TAG_COLOURS[k], 0]));
  for (const c of used) {
    const near = nearestTagColour(c);
    if (near) counts.set(near, (counts.get(near) ?? 0) + 1);
  }
  let best: string = TAG_COLOURS.red;
  let bestN = Number.POSITIVE_INFINITY;
  for (const k of TAG_COLOUR_KEYS) {
    const n = counts.get(TAG_COLOURS[k]) ?? 0;
    if (n < bestN) {
      bestN = n;
      best = TAG_COLOURS[k];
    }
  }
  return best;
}
