/**
 * Tag colours (#209): the fixed palette (@kept/shared TAG_COLOURS) and its names. A chip mixes its
 * colour into the surface, so it reads in light and dark alike; an older free colour (a Homebox
 * import) shows as its nearest palette colour.
 */
import { nearestTagColour, TAG_COLOUR_KEYS, TAG_COLOURS, type TagColourKey } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import type { CSSProperties } from 'react';

/** The palette colour a stored colour shows as, or null for none. */
export const shownColour = (colour: string | null | undefined): string | null =>
  nearestTagColour(colour);

/** The CSS variable a chip, dot or row reads its colour from. */
export function tagStyle(colour: string | null | undefined): CSSProperties | undefined {
  const c = shownColour(colour);
  return c ? ({ '--tag': c } as CSSProperties) : undefined;
}

/** Each palette colour's name, for the colour menu and screen readers. */
export function useTagColourNames(): Record<TagColourKey, string> {
  const { t } = useLingui();
  return {
    red: t`Red`,
    orange: t`Orange`,
    amber: t`Amber`,
    green: t`Green`,
    teal: t`Teal`,
    cyan: t`Cyan`,
    blue: t`Blue`,
    indigo: t`Indigo`,
    violet: t`Violet`,
    pink: t`Pink`,
    brown: t`Brown`,
    grey: t`Grey`,
  };
}

/** The palette, in its order, as `{key, hex}`. */
export const PALETTE = TAG_COLOUR_KEYS.map((key) => ({ key, hex: TAG_COLOURS[key] }));
