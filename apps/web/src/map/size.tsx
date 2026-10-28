/**
 * Size (#240, #241): a sized shape's numbers on its card while arranging. A cube shelf by its cubes
 * across and up, with its outside size, and Turn on its side (lying down is the same unit with the
 * two swapped); a bookcase by its width, depth and height in centimetres and its levels, kept to
 * what its height fits. React Aria NumberFields, like Height: arrow keys, typing and the − and +
 * buttons. Each change is a new model for the shape (sizedKey), so the map draws it at its new
 * size and saves it with the arrangement. Digits follow the person's setting (D143).
 */
import {
  BOOKCASE,
  bookcaseMaxLevels,
  CUBE_GRID,
  cubeRunCm,
  type MapShapeKey,
  type SizedShape,
  sizedKey,
  sizedOf,
} from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { Button, Group, I18nProvider, Input, Label, NumberField } from 'react-aria-components';
import { formatLocale, usePrefs } from '@/lib/prefs';

function Field({
  label,
  value,
  min,
  max,
  cm,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Centimetres, said with their unit; otherwise a count. */
  cm?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <NumberField
      className="kmap-height"
      value={value}
      minValue={min}
      maxValue={max}
      step={1}
      formatOptions={
        cm
          ? { style: 'unit', unit: 'centimeter', maximumFractionDigits: 0 }
          : { maximumFractionDigits: 0 }
      }
      onChange={(v) => {
        if (Number.isFinite(v)) onChange(Math.round(v));
      }}
    >
      <Label className="kmap-sub">{label}</Label>
      <Group className="kmap-height-row">
        <Button slot="decrement">−</Button>
        <Input className="kmap-input" />
        <Button slot="increment">+</Button>
      </Group>
    </NumberField>
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
          label={t`Cubes across`}
          value={s.across}
          min={1}
          max={CUBE_GRID.max}
          onChange={(across) => set({ ...s, across })}
        />
        <Field
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
          label={t`Width`}
          cm
          value={s.w}
          min={BOOKCASE.w[0]}
          max={BOOKCASE.w[1]}
          onChange={(w) => set({ ...s, w })}
        />
        <Field
          label={t`Depth`}
          cm
          value={s.d}
          min={BOOKCASE.d[0]}
          max={BOOKCASE.d[1]}
          onChange={(d) => set({ ...s, d })}
        />
        <Field
          label={t`Height`}
          cm
          value={s.h}
          min={BOOKCASE.h[0]}
          max={BOOKCASE.h[1]}
          onChange={(h) => set({ ...s, h, levels: Math.min(s.levels, bookcaseMaxLevels(h)) })}
        />
        <Field
          label={t`Levels`}
          value={s.levels}
          min={BOOKCASE.levels[0]}
          max={bookcaseMaxLevels(s.h)}
          onChange={(levels) => set({ ...s, levels })}
        />
      </>
    );
  }
  return (
    <I18nProvider locale={tag}>
      <div className="kmap-size">{body}</div>
    </I18nProvider>
  );
}
