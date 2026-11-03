/**
 * A room's sides as a person types and reads them (#372): metres to the centimetre, stored as
 * whole centimetres (map_nodes `w_cm`, `d_cm`). The size fields and labels go through these
 * alone, so imperial (#385) changes this file, not the screens.
 *
 * Typing is a React Aria NumberField's: the person's locale reads its own decimal mark, so 0,80
 * in French, German, Italian and Vietnamese and 0.80 in English. Grouping is off, so a comma is
 * never read as thousands (a side is at most 100 m).
 */
import { MAP_LIMITS } from './map.js';

/** The unit the fields show. Metric only for now; #385 adds feet and inches. */
export type LengthUnit = 'm';

/** A room side's field: its unit and the step of its − and + buttons and arrow keys. */
export const ROOM_SIDE = Object.freeze({ unit: 'm' as LengthUnit, step: 0.01 });

/** How a room side's field shows its number: metres with two decimals (0.80 m), never grouped. */
export function roomSideFormat(_unit: LengthUnit = ROOM_SIDE.unit): Intl.NumberFormatOptions {
  return {
    style: 'unit',
    unit: 'meter',
    unitDisplay: 'short',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  };
}

/** A side typed in `unit` as whole centimetres; null when nothing (or no number) was typed. */
export function roomSideToCm(value: number, _unit: LengthUnit = ROOM_SIDE.unit): number | null {
  if (!Number.isFinite(value)) return null;
  // 3.58 m is 357.99999999999994 cm in floating point: rounded, it is 358.
  return Math.round(value * 100);
}

/** Whole centimetres as the field's number. */
export function roomSideFromCm(cm: number, _unit: LengthUnit = ROOM_SIDE.unit): number {
  return cm / 100;
}

export type RoomSideProblem = 'missing' | 'too_small' | 'too_large';

/** Why a side can't be a room's: nothing typed, under MAP_LIMITS.minRoom, over maxRoom. */
export function roomSideProblem(cm: number | null): RoomSideProblem | null {
  if (cm === null) return 'missing';
  if (cm < MAP_LIMITS.minRoom) return 'too_small';
  if (cm > MAP_LIMITS.maxRoom) return 'too_large';
  return null;
}

/** A side for reading, without its unit: "0.8", "3.58", "4" (no trailing zeros). `locale` is a
 * BCP 47 tag, digits included (ar-u-nu-arab). */
export function formatRoomSide(
  cm: number,
  locale: string,
  _unit: LengthUnit = ROOM_SIDE.unit,
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(
    Math.round(cm) / 100,
  );
}
