import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderUI } from '@/test/render';

// Discussion #183: an owner's selection bar showed no Move to Trash. The button is loaded on
// demand, and a load that failed (Kept updated while the page was open) drew nothing at all, for
// good. Now the button always shows; when its load failed it says so and offers Reload, and the
// next time it's needed it is fetched again.

let fail = true;
vi.mock('@/components/things/bulk-trash', () => {
  if (fail) throw new Error('Failed to fetch dynamically imported module');
  return {
    BulkTrashButton: () => <button type="button">Move to Trash (loaded)</button>,
  };
});

const props = { thingIds: ['a'], holdsThings: false, onDone: () => {} };

describe('BulkTrashLazy', () => {
  it('still shows Move to Trash, off, with Reload, when its load failed', async () => {
    const { BulkTrashLazy } = await import('./bulk-trash-lazy');
    const first = await renderUI(<BulkTrashLazy {...props} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByRole('button', { name: 'Move to Trash' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled();
    first.unmount();

    // The next selection asks again, and the real button arrives.
    fail = false;
    vi.resetModules();
    const again = await import('./bulk-trash-lazy');
    await renderUI(<again.BulkTrashLazy {...props} />);
    expect(await screen.findByRole('button', { name: 'Move to Trash (loaded)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });
});
