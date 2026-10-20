/**
 * The shape library (#171): every shape the location map can draw, read at build time from the
 * catalogue itself (@kept/shared's MAP_MODELS, SHAPE_GROUP and SHAPE_WORDS), so the page can't go
 * stale. Names are the app's English ones (try-map/strings.ts, kept in step with the catalogues);
 * the pictures are cells of the picker's sprite (apps/web/src/map/thumbs/), and a drawn shape
 * whose catalogue entry has no height gets the height it is drawn at, measured when the sprite
 * was rendered.
 */
import {
  MAP_MODEL_KEYS,
  type MapModelKey,
  mapModel,
  SHAPE_GROUP,
  SHAPE_GROUPS,
  type ShapeGroup,
  type ShapeLang,
  shapeWordsByLang,
} from '@kept/shared';
import { THUMB_CELLS, THUMB_HEIGHTS_CM } from '../../../../web/src/map/thumbs/sprite';
import { GROUP_NAMES, MODEL_NAMES } from '../try-map/strings';

export type LibraryShape = {
  key: MapModelKey;
  name: string;
  /** The shape's cell in the sprite. */
  cell: number;
  /** Centimetres, before a turn. */
  size: { w: number; d: number; h: number };
  sizeText: string;
  /** Its words by language, only the languages that have some. */
  words: { lang: ShapeLang; label: string; words: string[] }[];
};

export type LibraryGroup = { id: ShapeGroup; label: string; shapes: LibraryShape[] };

const LANGS: readonly { lang: ShapeLang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ar', label: 'Arabic' },
  { lang: 'fr', label: 'French' },
  { lang: 'de', label: 'German' },
  { lang: 'it', label: 'Italian' },
];

/** Metres to centimetres, to the millimetre under 10 cm and to the centimetre above. */
const cm = (m: number): number => {
  const v = m * 100;
  return v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
};

export function shapeLibrary(): LibraryGroup[] {
  return SHAPE_GROUPS.map((id) => ({
    id,
    label: GROUP_NAMES[id][0],
    shapes: MAP_MODEL_KEYS.filter((k) => SHAPE_GROUP[k] === id).map((key): LibraryShape => {
      const m = mapModel(key);
      const size = {
        w: cm(m.w),
        d: cm(m.d),
        h: m.h !== undefined ? cm(m.h) : cm(THUMB_HEIGHTS_CM[key] / 100),
      };
      const byLang = shapeWordsByLang(key);
      return {
        key,
        name: MODEL_NAMES[key][0],
        cell: THUMB_CELLS[key],
        size,
        sizeText: `${size.w} × ${size.d} × ${size.h} cm`,
        words: LANGS.map((l) => ({ ...l, words: byLang[l.lang] })).filter((l) => l.words.length),
      };
    }),
  })).filter((g) => g.shapes.length > 0);
}
