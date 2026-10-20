/**
 * USB and Bluetooth barcode scanners ("keyboard wedge") on the session screen (#168): they type
 * what they read and press Enter, a few milliseconds a key. Keys that fast, ending in Enter, are
 * one read, through the same pipeline as the camera's. Keys typed into a field are the field's.
 */

/** The longest pause between a scanner's keys; a person types slower. */
export const WEDGE_GAP_MS = 60;
/** The shortest read: a person's quick double tap is not one. */
const MIN_LENGTH = 3;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function wedgeReader(
  onRead: (text: string) => void,
  now: () => number = () => performance.now(),
): (e: KeyboardEvent) => void {
  let buffer = '';
  let last = Number.NEGATIVE_INFINITY;
  return (e) => {
    if (typing(e.target)) return;
    const t = now();
    if (t - last > WEDGE_GAP_MS) buffer = '';
    last = t;
    if (e.key === 'Enter') {
      const text = buffer;
      buffer = '';
      if (text.length >= MIN_LENGTH) {
        e.preventDefault();
        onRead(text);
      }
      return;
    }
    if (e.key.length === 1) buffer += e.key;
  };
}
