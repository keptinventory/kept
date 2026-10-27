/**
 * Copying text: the Clipboard API where the page has it, else a selected hidden textarea and
 * `execCommand('copy')`, because a page served over plain HTTP from a network address has no
 * `navigator.clipboard`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

let copied: string[];
const execCommand = vi.fn((command: string) => {
  const el = document.activeElement as HTMLTextAreaElement | null;
  if (command !== 'copy' || !el || el.tagName !== 'TEXTAREA') return false;
  copied.push(el.value.slice(el.selectionStart, el.selectionEnd));
  return true;
});

beforeEach(() => {
  copied = [];
  execCommand.mockClear();
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
  document.body.innerHTML = '';
});

const withClipboard = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
const withoutClipboard = () =>
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

describe('copyText', () => {
  it('uses the Clipboard API when the page has it', async () => {
    const writeText = vi.fn(async () => {});
    withClipboard(writeText);
    await copyText('kpt_abc');
    expect(writeText).toHaveBeenCalledWith('kpt_abc');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('without the Clipboard API, copies the text from a selected textarea and tidies up', async () => {
    withoutClipboard();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    await copyText('http://kept.lan:8080/t/K7D2QX');
    expect(copied).toEqual(['http://kept.lan:8080/t/K7D2QX']);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('falls back when the Clipboard API refuses', async () => {
    withClipboard(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    await copyText('HD webcam');
    expect(copied).toEqual(['HD webcam']);
  });

  it('rejects when the fallback copies nothing', async () => {
    withoutClipboard();
    execCommand.mockImplementationOnce(() => false);
    await expect(copyText('HD webcam')).rejects.toThrow();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('inside a dialog, selects within the dialog, so its focus trap keeps the selection', async () => {
    withoutClipboard();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    document.body.append(dialog);
    button.focus();
    let parent: Element | null = null;
    execCommand.mockImplementationOnce(() => {
      parent = (document.activeElement as HTMLElement).parentElement;
      copied.push((document.activeElement as HTMLTextAreaElement).value);
      return true;
    });
    await copyText('Corner desk');
    expect(parent).toBe(dialog);
    expect(copied).toEqual(['Corner desk']);
  });
});
