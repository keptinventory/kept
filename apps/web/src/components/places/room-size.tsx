/**
 * A room's width and length (#372): two React Aria NumberFields in metres to the centimetre
 * (0.80 × 3.58), kept as whole centimetres, the map's own units. Typing, arrow keys and the − and
 * + buttons (a centimetre a step) work, and the person's locale reads its decimal mark, so 0,80
 * in French, German, Italian and Vietnamese. What a side is read and shown as comes from
 * @kept/shared's length.ts alone (imperial, #385, changes it there). Width runs across the map,
 * left to right in the plan view; length runs back to front. Digits follow the person's setting.
 *
 * Used where a room is added (with nothing typed, it isn't put on the map) and on the room's card
 * while arranging (map variant). The caller says what is wrong; the fields only show it.
 */
import {
  formatRoomSide,
  ROOM_SIDE,
  ROOM_SIDE_CM,
  roomSideFormat,
  roomSideFromCm,
  roomSideProblem,
  roomSideToCm,
} from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  FieldError as AriaFieldError,
  Label as AriaLabel,
  Button,
  Group,
  I18nProvider,
  Input,
  NumberField,
} from 'react-aria-components';
import { FieldError, inputClass, Label } from '@/components/ui/field';
import { formatLocale, usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';

/** A room's sides in whole centimetres; null where nothing (or no number) is typed. */
export type RoomSides = { w: number | null; d: number | null };

export type RoomSideErrors = { w?: string; d?: string };

/** What is wrong with one side (under 50 cm, over 100 m), said in the person's numbers;
 * undefined when nothing is, or when nothing was typed (the caller decides if that's wrong). */
export function useRoomSideProblem(): (cm: number | null) => string | undefined {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  const tag = formatLocale(locale, digits);
  return (cm) => {
    const problem = roomSideProblem(cm);
    if (problem === 'too_small') {
      const min = formatRoomSide(ROOM_SIDE_CM.min, tag);
      return t`A room is at least ${min} m across.`;
    }
    if (problem === 'too_large') {
      const max = formatRoomSide(ROOM_SIDE_CM.max, tag);
      return t`A room is at most ${max} m across.`;
    }
    return undefined;
  };
}

const formStep =
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-line bg-surface text-[20px] text-ink outline-none data-disabled:cursor-default data-disabled:text-ink-3 data-focus-visible:outline-2 data-focus-visible:outline-info data-hovered:bg-sunken';

function Side({
  label,
  cm,
  error,
  variant,
  onChange,
}: {
  label: string;
  cm: number | null;
  error: string | undefined;
  variant: 'form' | 'map';
  onChange: (cm: number | null) => void;
}) {
  const map = variant === 'map';
  return (
    <NumberField
      className={map ? 'kmap-height' : 'grid min-w-0 gap-1'}
      value={cm === null ? Number.NaN : roomSideFromCm(cm)}
      minValue={0}
      step={ROOM_SIDE.step}
      formatOptions={roomSideFormat()}
      isInvalid={!!error}
      onChange={(v) => onChange(roomSideToCm(v))}
    >
      {map ? <AriaLabel className="kmap-sub">{label}</AriaLabel> : <Label>{label}</Label>}
      <Group className={map ? 'kmap-height-row' : 'flex min-w-0 items-center gap-1.5'}>
        <Button slot="decrement" className={map ? undefined : formStep}>
          −
        </Button>
        <Input
          className={map ? 'kmap-input' : cn(inputClass, 'text-center tabular-nums')}
          dir="ltr"
        />
        <Button slot="increment" className={map ? undefined : formStep}>
          +
        </Button>
      </Group>
      {map ? (
        <AriaFieldError className="kmap-height-help kmap-error">{error}</AriaFieldError>
      ) : (
        <FieldError>{error}</FieldError>
      )}
    </NumberField>
  );
}

export function RoomSizeFields({
  value,
  onChange,
  errors = {},
  variant = 'form',
  children,
}: {
  value: RoomSides;
  onChange: (next: RoomSides) => void;
  errors?: RoomSideErrors;
  /** `map`: on the map's room card, styled like Height. */
  variant?: 'form' | 'map';
  /** Said under the two fields (a description, or what is wrong with the pair). */
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  return (
    <I18nProvider locale={formatLocale(locale, digits)}>
      <div className={variant === 'map' ? 'kmap-size' : 'grid gap-3 sm:grid-cols-2'} data-room-size>
        <Side
          label={t`Width`}
          cm={value.w}
          error={errors.w}
          variant={variant}
          onChange={(w) => onChange({ ...value, w })}
        />
        <Side
          label={t`Length`}
          cm={value.d}
          error={errors.d}
          variant={variant}
          onChange={(d) => onChange({ ...value, d })}
        />
        {children}
      </div>
    </I18nProvider>
  );
}
