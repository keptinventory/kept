/**
 * A number field's typing, read by the app rather than by React Aria's NumberField (1.14.4
 * review): NumberField drops each character its locale can't parse as it is typed, so Western
 * digits in an `ar-u-nu-arab` field (a phone's other keyboard) left it empty, and in English
 * "0,8" became 8, "1e3" 13 and "-2" 2, without a word. Here the text is the person's until they
 * leave the field, press Enter or step; then `read` (packages/shared length.ts `readLength`)
 * says what it is, and something that isn't a number is said so by the caller, never changed.
 *
 * The field around it is a React Aria TextField with − and + buttons: arrow keys step, the
 * buttons step without taking the focus (as NumberField's do) and stay out of the tab order.
 */
import { type KeyboardEvent, useState } from 'react';

export type TypedNumber = {
  /** The committed value; null (or NaN) shows an empty field. */
  value: number | null;
  /** The value as the field shows it. */
  show: (value: number) => string;
  /** The typed text as a value: null when empty, false when it isn't a number. */
  read: (text: string) => number | null | false;
  /** Left, Enter or stepped: the value, null for empty, false for what isn't a number. */
  onCommit: (value: number | null | false) => void;
  /** The next value a step up (1) or down (-1) from `from`; null where it can't go. */
  step: (from: number | null, dir: 1 | -1) => number | null;
};

export function useTypedNumber({ value, show, read, onCommit, step }: TypedNumber) {
  // What is typed and not yet committed; null: the field shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const known = value !== null && Number.isFinite(value) ? value : null;
  const text = draft ?? (known === null ? '' : show(known));

  const commit = () => {
    if (draft === null) return;
    const v = read(draft);
    // What isn't a number stays as typed, for the caller to say what is wrong with it.
    if (v !== false) setDraft(null);
    onCommit(v);
  };
  /** Where a step starts: what is typed, if it reads, else the value. */
  const from = () => {
    const typed = draft === null ? false : read(draft);
    return typed === false ? known : typed;
  };
  const canStep = (dir: 1 | -1) => step(from(), dir) !== null;
  const stepBy = (dir: 1 | -1) => {
    const next = step(from(), dir);
    if (next === null) return;
    setDraft(null);
    onCommit(next);
  };
  return {
    text,
    onChange: (next: string) => setDraft(next),
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        stepBy(e.key === 'ArrowUp' ? 1 : -1);
      }
    },
    canStep,
    stepBy,
  };
}
