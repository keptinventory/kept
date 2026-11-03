import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ListBulkProps } from '@/components/sheet/list-bulk';

// 1.14.4 final review: a failed load of "Set a field…" (offline, the first time) was kept for
// good, so the staging stayed dead until a reload. Now the next time it's needed, it loads.

let fail = true;
vi.mock('@/components/sheet/list-bulk', () => {
  if (fail) throw new Error('Failed to fetch dynamically imported module');
  return { default: () => <p>Set a field…</p> };
});

const props = {} as ListBulkProps;

describe('ListBulkLazy', () => {
  it('loads again after a failed load, on the next selection', async () => {
    const { ListBulkLazy } = await import('./list-bulk-lazy');
    const first = render(<ListBulkLazy {...props} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText('Set a field…')).toBeNull();
    first.unmount();

    fail = false;
    vi.resetModules();
    render(<ListBulkLazy {...props} />);
    expect(await screen.findByText('Set a field…')).toBeTruthy();
  });
});
