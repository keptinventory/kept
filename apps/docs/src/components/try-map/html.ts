/**
 * The demo's small HTML helpers: escaping, and a short ID as the app shows it (components/id-chip.tsx).
 * Names first: the amber tape only for a thing with a printed label; the quiet grey code where the
 * app's card shows a code without one; lists show nothing for those (LabelTape).
 */
import { printedCode } from '@kept/shared';

export const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** A short ID: the tape (`printed`) or the quiet code. */
export const idChip = (code: string | null, printed: boolean) =>
  code
    ? `<bdi dir="ltr" role="img" aria-label="${esc(code)}" class="kd-id${printed ? '' : ' quiet'}" data-variant="${printed ? 'tape' : 'quiet'}"><span aria-hidden="true">${esc(printedCode(code))}</span></bdi>`
    : '';

/** A list's code: the tape when it has a printed label, else nothing (its name is enough). */
export const labelTape = (code: string | null, printed: boolean | undefined) =>
  printed ? idChip(code, true) : '';
