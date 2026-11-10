/**
 * Height (#138): how high a thing on a wall hangs, on its card while arranging. Its middle above
 * the floor, in metres: arrow keys, typing and the − and + buttons (44 px on a phone) work. Steps
 * of 5 cm, kept to where the thing can hang (its bottom on the floor at the lowest, its top under
 * HANG_TOP). Digits follow the person's setting (D143); what is typed is read by @kept/shared's
 * `readLength`, so Western and Eastern Arabic digits both, "." or "," as the decimal mark in any
 * language, and what isn't a number is said so rather than turned into another height (the 1.14.4
 * review: React Aria's NumberField dropped the digits of the other set, and "0,8" in English was
 * 8 m). In imperial (#385) it is feet and inches, an inch a step, and what is typed may be feet and
 * inches (4'6", 4 ft 6 in) or metres with their unit.
 */
import {
  cmToInches,
  formatFeetInches,
  formatLength,
  formatRoomSide,
  hangRange,
  inchesToCm,
  readLength,
  readSpan,
} from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button, FieldError, Group, Input, Label, Text, TextField } from 'react-aria-components';
import { useTypedNumber } from '@/components/ui/typed-number';
import { useLengths } from '@/lib/units';
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
  const { tag, imperial, span } = useLengths();
  const range = hangRange(item.model);
  // The ends on the grid (5 cm, or an inch in imperial), so stepping and typing land on it.
  const inch = (m: number) => inchesToCm(cmToInches(m * 100)) / 100;
  const min = imperial
    ? inchesToCm(Math.ceil((range.min * 100) / 2.54 - 1e-9)) / 100
    : onGrid(range.min, true);
  const max = imperial
    ? inchesToCm(Math.floor((range.max * 100) / 2.54 + 1e-9)) / 100
    : onGrid(range.max, false);
  /** On the grid, between the ends. */
  const snap = (v: number) => {
    const on = imperial
      ? inch(v)
      : Math.round((min + Math.round((v - min) / HEIGHT_STEP) * HEIGHT_STEP) * 100) / 100;
    return Math.min(max, Math.max(min, on));
  };
  const [notANumber, setNotANumber] = useState(false);
  const field = useTypedNumber({
    value: item.hang ?? null,
    // Not Intl's unit style: Arabic writes 1 m and 2 m as a word alone ("متران"), no digits.
    show: (v) =>
      imperial ? formatFeetInches(v * 100, tag) : formatLength(v, tag, 'meter', { max: 2 }),
    read: (text) => {
      if (!imperial) return readLength(text, tag);
      const cm = readSpan(text, tag, 'imperial');
      return cm === null || cm === false ? cm : cm / 100;
    },
    onCommit: (v) => {
      setNotANumber(v === false);
      // The height it has stays as it is: snapped to the inch, 1.2 m would move to 1.22 m.
      if (typeof v === 'number') onHeight(v === item.hang ? v : snap(v));
    },
    // As NumberField stepped: to the grid first, then a step at a time, never past the ends.
    step: (from, dir) => {
      if (from === null) return dir > 0 ? min : max;
      if (imperial) {
        const next = Math.min(max, Math.max(min, inchesToCm(cmToInches(from * 100) + dir) / 100));
        return Math.abs(next - from) < EPS ? null : next;
      }
      const s = snap(from);
      const next = (dir > 0 ? s > from + EPS : s < from - EPS) ? s : snap(s + dir * HEIGHT_STEP);
      return Math.abs(next - from) < EPS ? null : next;
    },
  });
  const example = imperial ? span(120) : formatRoomSide(120, tag);
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
        <Input
          className="kmap-input"
          inputMode={imperial ? 'text' : 'decimal'}
          spellCheck={false}
        />
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
        <FieldError className="kmap-height-help kmap-error">
          {imperial
            ? t`Enter feet and inches, like ${example}.`
            : t`Enter metres, like ${example}.`}
        </FieldError>
      ) : (
        <Text slot="description" className="kmap-height-help">
          {t`From the floor to its middle`}
        </Text>
      )}
    </TextField>
  );
}
