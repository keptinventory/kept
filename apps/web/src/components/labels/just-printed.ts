/**
 * Codes whose label was just confirmed printed ("Printed OK?") or claimed, in this tab: the next
 * time one of them shows as the amber tape, it runs out like printed tape once (IdChip). In memory
 * only; a reload shows the tape plainly.
 */
const just = new Set<string>();

export function markJustPrinted(codes: readonly (string | null | undefined)[]): void {
  for (const c of codes) if (c) just.add(c);
}

/** Whether `code` was just printed and hasn't printed on screen since. */
export function isJustPrinted(code: string): boolean {
  return just.has(code);
}

/** The tape has printed on screen: later appearances show it plainly. */
export function forgetJustPrinted(code: string): void {
  just.delete(code);
}
