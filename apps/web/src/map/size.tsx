/**
 * Size (#240, #241): a sized shape's numbers on its card while arranging. A cube shelf by its cubes
 * across and up, with its outside size, and Turn on its side (lying down is the same unit with the
 * two swapped); a bookcase by its width, depth and height in centimetres and its levels, kept to
 * what its height fits. Fields like Height: arrow keys, typing and the − and + buttons, what is
 * typed read by @kept/shared's `readLength`, digits only (Western and Eastern Arabic both; what
 * isn't a whole number said so, never another size). Each change is a new model for the shape
 * (sizedKey), so the map draws it at its new size and saves it with the arrangement. Digits follow
 * the person's setting (D143).
 */
import {
  BOOKCASE,
  bookcaseMaxLevels,
  CUBE_GRID,
  cubeRunCm,
  formatLength,
  type MapShapeKey,
  readLength,
  type SizedShape,
  sizedKey,
  sizedOf,
} from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { type ReactNode, useState } from 'react';
import { Button, FieldError, Group, Input, Label, TextField } from 'react-aria-components';
import { useTypedNumber } from '@/components/ui/typed-number';
import { formatLocale, usePrefs } from '@/lib/prefs';

function Field({
  label,
  value,
  min,
  max,
  cm,
  tag,
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
  onChange: (v: number) => void;
}) {
  const { t } = useLingui();
  const [notANumber, setNotANumber] = useState(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const field = useTypedNumber({
    value,
    show: (v) =>
      cm
        ? formatLength(v, tag, 'centimeter', { max: 0 })
        : new Intl.NumberFormat(tag, { maximumFractionDigits: 0, useGrouping: false }).format(v),
    // Digits only: a whole number has no decimal mark to type.
    read: (text) => readLength(text, tag, cm ? 'centimeter' : null, { whole: true }),
    onCommit: (v) => {
      setNotANumber(v === false);
      if (typeof v === 'number') onChange(clamp(v));
    },
    step: (from, dir) => {
      const next = from === null ? (dir > 0 ? min : max) : clamp(from + dir);
      return next === from ? null : next;
    },
  });
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
        <Input className="kmap-input" inputMode="numeric" spellCheck={false} />
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
      <FieldError className="kmap-height-help kmap-error">{t`Enter a whole number.`}</FieldError>
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
  const { locale, digits } = usePrefs();
  const s = sizedOf(model);
  if (!s) return null;
  const tag = formatLocale(locale, digits);
  const set = (next: SizedShape) => onModel(sizedKey(next));
  let body: ReactNode;
  if (s.base === 'cube_grid') {
    const n = new Intl.NumberFormat(tag);
    const cm = new Intl.NumberFormat(tag, { style: 'unit', unit: 'centimeter' });
    const outside = `${n.format(cubeRunCm(s.across))} × ${n.format(CUBE_GRID.depth)} × ${cm.format(cubeRunCm(s.up))}`;
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
    body = (
      <>
        <Field
          tag={tag}
          label={t`Width`}
          cm
          value={s.w}
          min={BOOKCASE.w[0]}
          max={BOOKCASE.w[1]}
          onChange={(w) => set({ ...s, w })}
        />
        <Field
          tag={tag}
          label={t`Depth`}
          cm
          value={s.d}
          min={BOOKCASE.d[0]}
          max={BOOKCASE.d[1]}
          onChange={(d) => set({ ...s, d })}
        />
        <Field
          tag={tag}
          label={t`Height`}
          cm
          value={s.h}
          min={BOOKCASE.h[0]}
          max={BOOKCASE.h[1]}
          onChange={(h) => set({ ...s, h, levels: Math.min(s.levels, bookcaseMaxLevels(h)) })}
        />
        <Field
          tag={tag}
          label={t`Levels`}
          value={s.levels}
          min={BOOKCASE.levels[0]}
          max={bookcaseMaxLevels(s.h)}
          onChange={(levels) => set({ ...s, levels })}
        />
      </>
    );
  }
  return <div className="kmap-size">{body}</div>;
}
