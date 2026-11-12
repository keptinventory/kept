/**
 * Size (#240, #241, #485): a sized shape's numbers on its card while arranging. A cube shelf by its
 * cubes across and up, with its outside size, and Turn on its side (lying down is the same unit
 * with the two swapped); a bookcase by its width, depth and height in centimetres and its levels,
 * and a shelving unit the same with its shelves, each count kept to what its height fits. Fields
 * like Height: arrow keys, typing and the − and + buttons, what is typed read by @kept/shared's
 * `readLength`, digits only (Western and Eastern Arabic both; what isn't a whole number said so,
 * never another size). Each change is a new model for the shape (sizedKey), so the map draws it at
 * its new size and saves it with the arrangement. Digits follow the person's setting (D143). In
 * imperial (#385) the sizes are whole inches, an inch a step, kept as whole centimetres as before;
 * feet and inches or centimetres typed with their unit read too.
 */
import {
  BOOKCASE,
  bookcaseMaxLevels,
  CUBE_GRID,
  cmToInches,
  cubeRunCm,
  formatLength,
  inchesToCm,
  type MapShapeKey,
  readLength,
  readSpan,
  SHELVING_UNIT,
  type SizedShape,
  shelvingMaxShelves,
  sizedKey,
  sizedOf,
} from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { type ReactNode, useState } from 'react';
import { Button, FieldError, Group, Input, Label, TextField } from 'react-aria-components';
import { useTypedNumber } from '@/components/ui/typed-number';
import { useLengths } from '@/lib/units';

function Field({
  label,
  value,
  min,
  max,
  cm,
  tag,
  inches,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Centimetres, said with their unit; otherwise a count. */
  cm?: boolean;
  /** The person's locale, digits included (formatLocale). */
  tag: string;
  /** A size in whole inches rather than centimetres (#385). */
  inches?: boolean;
  onChange: (v: number) => void;
}) {
  const { t } = useLingui();
  const [notANumber, setNotANumber] = useState(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const imperial = cm && inches;
  const field = useTypedNumber({
    value,
    show: (v) =>
      imperial
        ? formatLength(cmToInches(v), tag, 'inch', { max: 0 })
        : cm
          ? formatLength(v, tag, 'centimeter', { max: 0 })
          : new Intl.NumberFormat(tag, { maximumFractionDigits: 0, useGrouping: false }).format(v),
    // Digits only: a whole number has no decimal mark to type. Inches read feet too (2'6").
    read: (text) =>
      imperial
        ? readSpan(text, tag, 'imperial', 'in')
        : readLength(text, tag, cm ? 'centimeter' : null, { whole: true }),
    onCommit: (v) => {
      setNotANumber(v === false);
      if (typeof v === 'number') onChange(clamp(v));
    },
    step: (from, dir) => {
      const next =
        from === null
          ? dir > 0
            ? min
            : max
          : clamp(imperial ? inchesToCm(cmToInches(from) + dir) : from + dir);
      return next === from ? null : next;
    },
  });
  const example = formatLength(30, tag, 'inch', { max: 0 });
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
      <Label className="kmap-sub">{label}</Label>
      <Group className="kmap-height-row">
        <Button
          aria-label={t`Decrease ${label}`}
          excludeFromTabOrder
          preventFocusOnPress
          isDisabled={!field.canStep(-1)}
          onPress={() => field.stepBy(-1)}
        >
          −
        </Button>
        <Input
          className="kmap-input"
          inputMode={imperial ? 'text' : 'numeric'}
          spellCheck={false}
        />
        <Button
          aria-label={t`Increase ${label}`}
          excludeFromTabOrder
          preventFocusOnPress
          isDisabled={!field.canStep(1)}
          onPress={() => field.stepBy(1)}
        >
          +
        </Button>
      </Group>
      <FieldError className="kmap-height-help kmap-error">
        {imperial ? t`Enter inches, like ${example}.` : t`Enter a whole number.`}
      </FieldError>
    </TextField>
  );
}

export function SizeFields({
  model,
  onModel,
}: {
  model: MapShapeKey;
  onModel: (model: MapShapeKey) => void;
}) {
  const { t } = useLingui();
  const { tag, imperial } = useLengths();
  const s = sizedOf(model);
  if (!s) return null;
  const set = (next: SizedShape) => onModel(sizedKey(next));
  let body: ReactNode;
  if (s.base === 'cube_grid') {
    const n = new Intl.NumberFormat(tag);
    const unit = new Intl.NumberFormat(tag, {
      style: 'unit',
      unit: imperial ? 'inch' : 'centimeter',
    });
    const size = (cm: number) => (imperial ? cmToInches(cm) : cm);
    const outside = `${n.format(size(cubeRunCm(s.across)))} × ${n.format(size(CUBE_GRID.depth))} × ${unit.format(size(cubeRunCm(s.up)))}`;
    body = (
      <>
        <Field
          tag={tag}
          label={t`Cubes across`}
          value={s.across}
          min={1}
          max={CUBE_GRID.max}
          onChange={(across) => set({ ...s, across })}
        />
        <Field
          tag={tag}
          label={t`Cubes up`}
          value={s.up}
          min={1}
          max={CUBE_GRID.max}
          onChange={(up) => set({ ...s, up })}
        />
        <span className="kmap-height-help">{outside}</span>
        {s.across === s.up ? null : (
          <button
            type="button"
            className="kmap-btn"
            onClick={() => set({ ...s, across: s.up, up: s.across })}
          >
            {t`Turn on its side`}
          </button>
        )}
      </>
    );
  } else {
    const lim = s.base === 'bookcase' ? BOOKCASE : SHELVING_UNIT;
    // Its count (a bookcase's levels, a shelving unit's shelves), kept to what a height fits.
    const count =
      s.base === 'bookcase'
        ? {
            label: t`Levels`,
            value: s.levels,
            min: BOOKCASE.levels[0],
            max: bookcaseMaxLevels(s.h),
            onChange: (levels: number) => set({ ...s, levels }),
            fit: (h: number) => ({ ...s, h, levels: Math.min(s.levels, bookcaseMaxLevels(h)) }),
          }
        : {
            label: t({ message: 'Shelves', context: 'how many shelves' }),
            value: s.shelves,
            min: SHELVING_UNIT.shelves[0],
            max: shelvingMaxShelves(s.h),
            onChange: (shelves: number) => set({ ...s, shelves }),
            fit: (h: number) => ({ ...s, h, shelves: Math.min(s.shelves, shelvingMaxShelves(h)) }),
          };
    body = (
      <>
        <Field
          tag={tag}
          label={t`Width`}
          cm
          inches={imperial}
          value={s.w}
          min={lim.w[0]}
          max={lim.w[1]}
          onChange={(w) => set({ ...s, w })}
        />
        <Field
          tag={tag}
          label={t`Depth`}
          cm
          inches={imperial}
          value={s.d}
          min={lim.d[0]}
          max={lim.d[1]}
          onChange={(d) => set({ ...s, d })}
        />
        <Field
          tag={tag}
          label={t`Height`}
          cm
          inches={imperial}
          value={s.h}
          min={lim.h[0]}
          max={lim.h[1]}
          onChange={(h) => set(count.fit(h))}
        />
        <Field
          tag={tag}
          label={count.label}
          value={count.value}
          min={count.min}
          max={count.max}
          onChange={count.onChange}
        />
      </>
    );
  }
  return <div className="kmap-size">{body}</div>;
}
