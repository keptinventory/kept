/**
 * A room's width and length (#372): two fields in metres to the centimetre (0.80 × 3.58), kept
 * as whole centimetres, the map's own units; in feet and inches when the person's Units setting is
 * imperial (#385: 11 ft 9 in, typed as 11'9", 11 ft 9 in or 3.58 m). Typing, arrow keys and the −
 * and + buttons (a centimetre a step, or an inch) work, and "." or "," is the decimal mark in any
 * language (a phone's decimal keypad offers only its region's). What a side is read and shown as
 * comes from @kept/shared's length.ts alone: Western and Eastern Arabic digits both, and
 * what isn't a number ("1e3", "-2", "3 58") is NaN for the caller to say so, never a different
 * size (the 1.14.4 review; React Aria's NumberField dropped what it couldn't read).
 * Width runs across the map, left to right in the plan view; length runs back to front. Digits
 * follow the person's setting.
 *
 * Used where a room is added (with nothing typed, it isn't put on the map) and on the room's card
 * while arranging (map variant). The caller says what is wrong; the fields only show it.
 */
import {
  formatRoomSide,
  formatRoomSideField,
  ROOM_SIDE_CM,
  readRoomSide,
  roomSideProblem,
  roomSideStep,
  type UnitSystem,
} from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import {
  FieldError as AriaFieldError,
  Label as AriaLabel,
  Button,
  Group,
  Input,
  TextField,
} from 'react-aria-components';
import { FieldError, inputClass, Label } from '@/components/ui/field';
import { useTypedNumber } from '@/components/ui/typed-number';
import { useLengths } from '@/lib/units';
import { cn } from '@/lib/utils';

/** A room's sides in whole centimetres; null where nothing is typed, NaN where what is typed
 * isn't a number. */
export type RoomSides = { w: number | null; d: number | null };

export type RoomSideErrors = { w?: string; d?: string };

/** What is wrong with one side (not a number, under 50 cm, over 100 m), said in the person's
 * numbers; undefined when nothing is, or when nothing was typed (the caller decides if that's
 * wrong). */
export function useRoomSideProblem(): (cm: number | null) => string | undefined {
  const { t } = useLingui();
  const { tag, imperial, span } = useLengths();
  return (cm) => {
    const problem = roomSideProblem(cm);
    if (imperial) {
      if (problem === 'not_a_number') {
        const example = span(358);
        return t`Enter feet and inches, like ${example}.`;
      }
      if (problem === 'too_small') {
        const min = span(ROOM_SIDE_CM.min);
        return t`A room is at least ${min} across.`;
      }
      if (problem === 'too_large') {
        const max = span(ROOM_SIDE_CM.max);
        return t`A room is at most ${max} across.`;
      }
      return undefined;
    }
    if (problem === 'not_a_number') {
      const example = formatRoomSide(358, tag);
      return t`Enter metres, like ${example}.`;
    }
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
  tag,
  system,
  onChange,
}: {
  label: string;
  cm: number | null;
  error: string | undefined;
  variant: 'form' | 'map';
  /** The person's locale, digits included (formatLocale). */
  tag: string;
  /** Metric or imperial (#385). */
  system: UnitSystem;
  onChange: (cm: number | null) => void;
}) {
  const { t } = useLingui();
  const map = variant === 'map';
  const field = useTypedNumber({
    value: cm,
    show: (v) => formatRoomSideField(v, tag, system),
    read: (text) => readRoomSide(text, tag, system),
    onCommit: (v) => onChange(v === false ? Number.NaN : v),
    // From nothing, a step starts at the smallest room; it never goes under nothing.
    step: (from, dir) => {
      if (from === null) return ROOM_SIDE_CM.min;
      const next = roomSideStep(from, dir, system);
      return next < 0 ? null : next;
    },
  });
  return (
    <TextField
      className={map ? 'kmap-height' : 'grid min-w-0 gap-1'}
      value={field.text}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
      isInvalid={!!error}
      autoComplete="off"
    >
      {map ? <AriaLabel className="kmap-sub">{label}</AriaLabel> : <Label>{label}</Label>}
      <Group className={map ? 'kmap-height-row' : 'flex min-w-0 items-center gap-1.5'}>
        <Button
          className={map ? undefined : formStep}
          aria-label={t`Decrease ${label}`}
          excludeFromTabOrder
          preventFocusOnPress
          isDisabled={!field.canStep(-1)}
          onPress={() => field.stepBy(-1)}
        >
          −
        </Button>
        <Input
          className={map ? 'kmap-input' : cn(inputClass, 'text-center tabular-nums')}
          dir="ltr"
          // Feet and inches are typed with ' and ", which a decimal keypad doesn't have.
          inputMode={system === 'imperial' ? 'text' : 'decimal'}
          spellCheck={false}
        />
        <Button
          className={map ? undefined : formStep}
          aria-label={t`Increase ${label}`}
          excludeFromTabOrder
          preventFocusOnPress
          isDisabled={!field.canStep(1)}
          onPress={() => field.stepBy(1)}
        >
          +
        </Button>
      </Group>
      {map ? (
        <AriaFieldError className="kmap-height-help kmap-error">{error}</AriaFieldError>
      ) : (
        <FieldError>{error}</FieldError>
      )}
    </TextField>
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
  const { tag, system } = useLengths();
  return (
    <div className={variant === 'map' ? 'kmap-size' : 'grid gap-3 sm:grid-cols-2'} data-room-size>
      <Side
        label={t`Width`}
        cm={value.w}
        error={errors.w}
        variant={variant}
        tag={tag}
        system={system}
        onChange={(w) => onChange({ ...value, w })}
      />
      <Side
        label={t`Length`}
        cm={value.d}
        error={errors.d}
        variant={variant}
        tag={tag}
        system={system}
        onChange={(d) => onChange({ ...value, d })}
      />
      {children}
    </div>
  );
}
