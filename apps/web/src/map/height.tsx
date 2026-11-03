/**
 * Height (#138): how high a thing on a wall hangs, on its card while arranging. Its middle above
 * the floor, in metres: arrow keys, typing and the − and + buttons (44 px on a phone) work. Steps
 * of 5 cm, kept to where the thing can hang (its bottom on the floor at the lowest, its top under
 * HANG_TOP). Digits follow the person's setting (D143); what is typed is read by @kept/shared's
 * `readLength`, so Western and Eastern Arabic digits both, "." or "," as the decimal mark in any
 * language, and what isn't a number is said so rather than turned into another height (the 1.14.4
 * review: React Aria's NumberField dropped the digits of the other set, and "0,8" in English was
 * 8 m).
 */
import { formatLength, formatRoomSide, hangRange, readLength } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button, FieldError, Group, Input, Label, Text, TextField } from 'react-aria-components';
import { useTypedNumber } from '@/components/ui/typed-number';
import { formatLocale, usePrefs } from '@/lib/prefs';
import type { Item } from './layout';

/** The field's step, in metres. */
export const HEIGHT_STEP = 0.05;

const onGrid = (v: number, up: boolean) => {
  const n = v / HEIGHT_STEP;
  return Math.round((up ? Math.ceil(n - 1e-9) : Math.floor(n + 1e-9)) * HEIGHT_STEP * 100) / 100;
};

const EPS = 1e-9;

export function HeightField({
  item,
  onHeight,
}: {
  item: Pick<Item, 'model' | 'hang'>;
  onHeight: (h: number) => void;
}) {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  const tag = formatLocale(locale, digits);
  const range = hangRange(item.model);
  // The ends on the 5 cm grid, so stepping and typing land on it.
  const min = onGrid(range.min, true);
  const max = onGrid(range.max, false);
  /** On the 5 cm grid, between the ends. */
  const snap = (v: number) => {
    const on = Math.round((min + Math.round((v - min) / HEIGHT_STEP) * HEIGHT_STEP) * 100) / 100;
    return Math.min(max, Math.max(min, on));
  };
  const [notANumber, setNotANumber] = useState(false);
  const field = useTypedNumber({
    value: item.hang ?? null,
    // Not Intl's unit style: Arabic writes 1 m and 2 m as a word alone ("متران"), no digits.
    show: (v) => formatLength(v, tag, 'meter', { max: 2 }),
    read: (text) => readLength(text, tag),
    onCommit: (v) => {
      setNotANumber(v === false);
      if (typeof v === 'number') onHeight(snap(v));
    },
    // As NumberField stepped: to the grid first, then a step at a time, never past the ends.
    step: (from, dir) => {
      if (from === null) return dir > 0 ? min : max;
      const s = snap(from);
      const next = (dir > 0 ? s > from + EPS : s < from - EPS) ? s : snap(s + dir * HEIGHT_STEP);
      return Math.abs(next - from) < EPS ? null : next;
    },
  });
  const example = formatRoomSide(120, tag);
  return (
    <TextField
      className="kmap-height"
      value={field.text}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
      isInvalid={notANumber}
      autoComplete="off"
    >
      <Label className="kmap-sub">{t`Height`}</Label>
      <Group className="kmap-height-row">
        <Button
          aria-label={t`Lower`}
          excludeFromTabOrder
          preventFocusOnPress
          isDisabled={!field.canStep(-1)}
          onPress={() => field.stepBy(-1)}
        >
          −
        </Button>
        <Input className="kmap-input" inputMode="decimal" spellCheck={false} />
        <Button
          aria-label={t`Higher`}
          excludeFromTabOrder
          preventFocusOnPress
          isDisabled={!field.canStep(1)}
          onPress={() => field.stepBy(1)}
        >
          +
        </Button>
      </Group>
      {notANumber ? (
        <FieldError className="kmap-height-help kmap-error">{t`Enter metres, like ${example}.`}</FieldError>
      ) : (
        <Text slot="description" className="kmap-height-help">
          {t`From the floor to its middle`}
        </Text>
      )}
    </TextField>
  );
}
