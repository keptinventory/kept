/**
 * Height (#138): how high a thing on a wall hangs, on its card while arranging. Its middle above
 * the floor, in metres: a React Aria NumberField, so arrow keys, typing and the − and + buttons
 * (44 px on a phone) work and a screen reader hears the value. Steps of 5 cm, kept to where the
 * thing can hang (its bottom on the floor at the lowest, its top under HANG_TOP). Digits follow
 * the person's setting (D143).
 */
import { hangRange } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import {
  Button,
  Group,
  I18nProvider,
  Input,
  Label,
  NumberField,
  Text,
} from 'react-aria-components';
import { formatLocale, usePrefs } from '@/lib/prefs';
import type { Item } from './layout';

/** The field's step, in metres. */
export const HEIGHT_STEP = 0.05;

const onGrid = (v: number, up: boolean) => {
  const n = v / HEIGHT_STEP;
  return Math.round((up ? Math.ceil(n - 1e-9) : Math.floor(n + 1e-9)) * HEIGHT_STEP * 100) / 100;
};

export function HeightField({
  item,
  onHeight,
}: {
  item: Pick<Item, 'model' | 'hang'>;
  onHeight: (h: number) => void;
}) {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  const range = hangRange(item.model);
  // The ends on the 5 cm grid, so stepping and typing land on it.
  const min = onGrid(range.min, true);
  const max = onGrid(range.max, false);
  return (
    <I18nProvider locale={formatLocale(locale, digits)}>
      <NumberField
        className="kmap-height"
        value={item.hang ?? Number.NaN}
        minValue={min}
        maxValue={max}
        step={HEIGHT_STEP}
        formatOptions={{ style: 'unit', unit: 'meter', maximumFractionDigits: 2 }}
        onChange={(v) => {
          if (Number.isFinite(v)) onHeight(Math.round(v * 100) / 100);
        }}
      >
        <Label className="kmap-sub">{t`Height`}</Label>
        <Group className="kmap-height-row">
          <Button slot="decrement" aria-label={t`Lower`}>
            −
          </Button>
          <Input className="kmap-input" />
          <Button slot="increment" aria-label={t`Higher`}>
            +
          </Button>
        </Group>
        <Text slot="description" className="kmap-height-help">
          {t`From the floor to its middle`}
        </Text>
      </NumberField>
    </I18nProvider>
  );
}
