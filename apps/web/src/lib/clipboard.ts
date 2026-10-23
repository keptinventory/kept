/**
 * Copies text. The Clipboard API is only on secure pages: over plain HTTP from a network address
 * (http://kept.lan, http://192.0.2.20) `navigator.clipboard` is undefined, so the text is put
 * in a hidden textarea, selected and copied with `execCommand('copy')`, which still works there.
 * Rejects when neither copied it; the caller says "Couldn't copy".
 */

function copyBySelection(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Inside an open dialog, its focus trap would pull focus (and the selection) back out of a
  // textarea placed on <body>.
  const host = before?.closest('[role="dialog"], [role="alertdialog"]') ?? document.body;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.tabIndex = -1;
  area.style.cssText = 'position:fixed;inset-block-start:0;opacity:0;pointer-events:none';
  host.append(area);
  let copied = false;
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    area.remove();
    before?.focus({ preventScroll: true });
  }
  return copied;
}

export async function copyText(text: string): Promise<void> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Refused (permission, focus): the selection way may still work.
    }
  }
  if (!copyBySelection(text)) throw new Error('Copying is not available here.');
}
