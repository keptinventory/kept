/**
 * A fake `window.visualViewport` (jsdom has none): a phone's visible box, which shrinks when the
 * on-screen keyboard opens. `restore()` puts back what was there.
 */
import { act } from '@testing-library/react';

export function fakeVisualViewport(height = 844) {
  const vv = Object.assign(new EventTarget(), { height, offsetTop: 0, scale: 1 });
  const real = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  return {
    vv,
    /** The keyboard (and the browser's form bar) opens: the visible box is `h` tall at `top`. */
    keyboard(h: number, top = 0) {
      vv.height = h;
      vv.offsetTop = top;
      act(() => {
        vv.dispatchEvent(new Event('resize'));
      });
    },
    restore() {
      if (real) Object.defineProperty(window, 'visualViewport', real);
      else Reflect.deleteProperty(window, 'visualViewport');
    },
  };
}

/** The dimmed overlay a modal sits in: the `fixed inset-0` box around `dialog`. */
export function overlayOf(dialog: HTMLElement): HTMLElement {
  const el = dialog.closest<HTMLElement>('[class*="fixed inset-0"]');
  if (!el) throw new Error('No overlay around the dialog.');
  return el;
}
