/**
 * Every sheet and dialog stays above a phone's on-screen keyboard (#487): its overlay follows the
 * visual viewport, not only the pickers that asked for it (#130's `fitKeyboard`). A sheet without
 * `fitKeyboard` keeps its own height; it is only kept inside the box that is left.
 */
import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sheet as PlaceSheet } from '@/components/places/sheet';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, Modal } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { renderUI } from '@/test/render';
import { fakeVisualViewport, overlayOf } from '@/test/visual-viewport';

const noop = () => {};
const field = <TextField label="Name" />;

let phoneView: ReturnType<typeof fakeVisualViewport>;
beforeEach(() => {
  phoneView = fakeVisualViewport(844);
});
afterEach(() => phoneView.restore());

async function expectAboveKeyboard(ui: ReactElement, open?: string) {
  const { user } = await renderUI(ui);
  if (open) await user.click(screen.getByRole('button', { name: open }));
  const overlay = overlayOf(await screen.findByRole('dialog'));
  expect(overlay.style.height).toBe('844px');
  // The keyboard and the form bar take 380 px; the page scrolled 12 px to show the field.
  phoneView.keyboard(464, 12);
  expect(overlay.style.height).toBe('464px');
  expect(overlay.style.top).toBe('12px');
  expect(overlay.style.getPropertyValue('--sheet-vh')).toBe('464px');
  return overlay;
}

describe('above the on-screen keyboard', () => {
  it('a sheet, without asking for it, at its own height', async () => {
    await expectAboveKeyboard(
      <Sheet isOpen onOpenChange={noop} title="Rename">
        {field}
      </Sheet>,
    );
    const sheet = screen.getByRole('dialog').closest('[class*="rounded-t-2xl"]');
    expect(sheet?.className).toContain('max-h-[calc(var(--sheet-vh,100dvh)*0.92)]');
    expect(sheet?.className).not.toMatch(/(^|\s)h-\[/);
  });

  it('a place sheet', async () => {
    await expectAboveKeyboard(
      <PlaceSheet isOpen onOpenChange={noop} title="Add a room or spot">
        {field}
      </PlaceSheet>,
    );
  });

  it('a dialog, opened by its own state or by a trigger', async () => {
    const dialog = (
      <Dialog title="Rename">
        <TextField label="Name" />
      </Dialog>
    );
    const first = await renderUI(
      <Modal isOpen onOpenChange={noop}>
        {dialog}
      </Modal>,
    );
    expect(overlayOf(await screen.findByRole('dialog')).style.height).toBe('844px');
    first.unmount();
    await expectAboveKeyboard(
      <DialogTrigger>
        <Button>Open</Button>
        <Modal>{dialog}</Modal>
      </DialogTrigger>,
      'Open',
    );
  });
});
