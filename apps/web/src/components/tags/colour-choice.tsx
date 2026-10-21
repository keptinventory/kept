/**
 * A tag's colour (#209): one of the fixed palette, or none, as swatches in a radio group (never a
 * native colour picker). Each swatch is named for screen readers.
 */
import { tagColourKey } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { cn } from '@/lib/utils';
import { PALETTE, shownColour, useTagColourNames } from './palette';

const NONE = 'none';

const swatch =
  'grid size-9 cursor-pointer place-items-center rounded-full border-2 border-transparent outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-info data-selected:border-ink';

export function TagColourChoice({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (colour: string | null) => void;
}) {
  const { t } = useLingui();
  const names = useTagColourNames();
  const shown = shownColour(value);
  const selected = shown ? (tagColourKey(shown) ?? NONE) : NONE;
  return (
    <RadioGroup
      value={selected}
      onChange={(key) =>
        onChange(key === NONE ? null : (PALETTE.find((c) => c.key === key)?.hex ?? null))
      }
      orientation="horizontal"
      className="grid gap-2"
    >
      <Label className="text-small font-semibold text-ink-2">{t`Colour`}</Label>
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map((c) => (
          <Radio key={c.key} value={c.key} aria-label={names[c.key]} className={swatch}>
            <span
              aria-hidden="true"
              className="size-6 rounded-full"
              style={{ backgroundColor: c.hex }}
            />
          </Radio>
        ))}
        <Radio value={NONE} aria-label={t`No colour`} className={cn(swatch, 'text-ink-3')}>
          <span
            aria-hidden="true"
            className="size-6 rounded-full border border-dashed border-ink-3 bg-surface"
          />
        </Radio>
      </div>
    </RadioGroup>
  );
}
