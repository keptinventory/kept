/**
 * A Copy button on a page with no Clipboard API (plain HTTP from a network address) still copies,
 * and says "Copied"; when nothing can copy, it says "Couldn't copy".
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '@/components/ui/copy-button';
import { renderUI } from '@/test/render';

afterEach(() => {
  Reflect.deleteProperty(document, 'execCommand');
});

function noClipboard() {
  // After user-event's setup, which installs a clipboard of its own.
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
}

describe('Copy without the Clipboard API', () => {
  it('copies the text through a selection and says so', async () => {
    const copied: string[] = [];
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => {
        copied.push((document.activeElement as HTMLTextAreaElement).value);
        return true;
      }),
    });
    const { user } = await renderUI(<CopyButton text="http://kept.lan:8080/mcp" label="Copy" />);
    noClipboard();
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(copied).toEqual(['http://kept.lan:8080/mcp']);
  });

  it("says it couldn't copy when nothing can", async () => {
    const { user } = await renderUI(<CopyButton text="kpt_x" label="Copy" />);
    noClipboard();
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
  });
});
